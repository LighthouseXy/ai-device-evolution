import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";
import { fetchWithRetry } from "./lib/fetch-with-retry.mjs";
import { normalizeProductName } from "./lib/normalize-product-name.mjs";

const DATABASE_PATH = "src/data/apple-devices-db.json";
const OBSERVATIONS_PATH = "src/data/price-observations.json";
const PRICE_TYPES = new Set(["current", "used"]);
const CATEGORIES = new Set(["phone", "tablet", "laptop"]);
const TRUSTED_HOSTS = new Set([
  "www.apple.com.cn",
  "www.shihuo.cn",
  "item.jd.com",
  "item.m.jd.com",
  "pro.m.jd.com",
  "m2.9ji.com",
]);

function readJson(path) {
  return JSON.parse(fs.readFileSync(path === "-" ? 0 : path, "utf8"));
}

function splitOptions(value) {
  return typeof value === "string" ? value.split("/").map((part) => part.trim()).filter(Boolean) : [];
}

function recommendedConfiguration(device) {
  const memory = splitOptions(device.specs.memory?.value)[0] ?? null;
  const storageOptions = splitOptions(device.specs.storage?.value);
  const preferredStorage = device.category === "laptop" ? "512GB" : "256GB";
  const storage = storageOptions.includes(preferredStorage) ? preferredStorage : storageOptions[0] ?? null;
  return [memory ? `${memory} 运行内存` : null, storage ? `${storage} 存储` : null].filter(Boolean).join(" + ");
}

function buildPlan({ category, priceType, limit }) {
  const { devices } = readJson(DATABASE_PATH);
  return devices
    .filter((device) => (!category || device.category === category) && !device.specs[`${priceType}Price`]?.value)
    .sort((left, right) => right.releaseYear - left.releaseYear || left.modelName.localeCompare(right.modelName, "zh-CN"))
    .slice(0, limit)
    .map((device) => {
      const configuration = recommendedConfiguration(device);
      return {
        deviceId: device.id,
        modelName: device.modelName,
        category: device.category,
        releaseYear: device.releaseYear,
        priceType,
        configuration,
        searchQuery: `${device.modelName} ${configuration} 国行 ${priceType === "used" ? "二手 成色" : "全新 当前价"}`,
      };
    });
}

function decodeHtml(value) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function priceCandidates(html) {
  const candidates = new Set();
  const patterns = [
    /(?:¥|￥|RMB)\s*([0-9]{3,6}(?:\.[0-9]{1,2})?)\s*(万)?/gi,
    /["'](?:price|salePrice|finalPrice|lowestPrice|lowPrice)["']\s*:\s*["']?([0-9]{3,6}(?:\.[0-9]{1,2})?)\s*(万)?/gi,
  ];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const value = Math.round(Number(match[1]) * (match[2] ? 10000 : 1));
      if (value >= 300 && value <= 100000) candidates.add(value);
    }
  }
  return [...candidates].sort((left, right) => left - right).slice(0, 30);
}

function parseDisplayedPrice(value) {
  if (typeof value !== "string") return null;
  const match = value.replaceAll(",", "").match(/([0-9]+(?:\.[0-9]+)?)\s*(万)?/);
  if (!match) return null;
  const price = Math.round(Number(match[1]) * (match[2] ? 10000 : 1));
  return price >= 300 && price <= 100000 ? price : null;
}

function shihuoPageData(html, url) {
  if (new URL(url).hostname !== "www.shihuo.cn") return null;
  const json = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
  if (!json) return null;
  return JSON.parse(json).props?.pageProps ?? null;
}

function shihuoSkus(page) {
  return (page?.skuListData?.data?.list ?? []).flatMap((style) =>
    (style.sku_list ?? []).map((sku) => ({
      styleId: String(style.style_id),
      skuId: String(sku.sku_id),
      listedPrice: parseDisplayedPrice(sku.price),
      attributes: Object.fromEntries(sku.attrs.map((attribute) => [attribute.spec_name, attribute.name])),
    })),
  );
}

function shihuoStyles(page) {
  return (page?.styleListData?.data?.list?.list ?? []).map((style) => ({
    styleId: String(style.style_id),
    label: style.img_arr?.[0]?.img_alt?.replace(/^商品配色：\s*/, "") ?? null,
  }));
}

function normalizeSkuMatchText(value) {
  return value
    .toLocaleLowerCase("zh-CN")
    .replace(/(\d+(?:\.\d+)?)\s*tb\b/g, (_, amount) => `${Math.round(Number(amount) * 1024)}gb`)
    .replace(/\s+/g, "");
}

function filterSkus(skus, match) {
  const terms = (match ?? "").trim().split(/\s+/).filter(Boolean).map(normalizeSkuMatchText);
  if (terms.length === 0) return skus;
  return skus.filter((sku) => {
    const text = normalizeSkuMatchText(Object.values(sku.attributes).join(" "));
    return terms.every((term) => text.includes(term));
  });
}

function selectedShihuoSku(page, url) {
  if (!page) return null;
  const requestedSkuId = new URL(url).searchParams.get("skuId");
  if (!requestedSkuId) return null;
  const sku = shihuoSkus(page).find((candidate) => candidate.skuId === requestedSkuId);
  if (!sku) return null;
  const displayPrice = page?.supplierListData?.data?.list?.[0]?.supplier_info?.display_price;
  return {
    ...sku,
    price: parseDisplayedPrice(displayPrice) ?? sku.listedPrice,
    displayPrice: displayPrice ?? null,
  };
}

function renderHtml(url) {
  const candidates = [
    process.env.CHROME_BIN,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "google-chrome",
    "chromium",
    "chromium-browser",
  ].filter(Boolean);
  for (const executable of candidates) {
    const result = spawnSync(executable, [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--virtual-time-budget=6000",
      "--dump-dom",
      url,
    ], { encoding: "utf8", maxBuffer: 25 * 1024 * 1024, timeout: 30000 });
    if (result.error?.code === "ENOENT") continue;
    if (result.error) throw result.error;
    if (result.status !== 0 || !result.stdout.includes("<html")) {
      throw new Error(`动态页面渲染失败: ${result.stderr.trim() || `退出码 ${result.status}`}`);
    }
    return result.stdout;
  }
  throw new Error("未找到 Chrome/Chromium；可通过 CHROME_BIN 指定浏览器路径");
}

function selectedJiUsedItem(text, url) {
  if (new URL(url).hostname !== "m2.9ji.com") return null;
  const priceGrade = text.match(/¥\s*([0-9]{3,6})(?:\s*已优惠\s*\d+)?\s*(\d{1,2})\s*成新/);
  if (!priceGrade) return null;
  const productBlock = text.slice(priceGrade.index, text.indexOf("AI点评", priceGrade.index));
  const reportStart = text.indexOf("验机报告 先验机再付款", priceGrade.index);
  const reportEnd = text.indexOf("二手良品需人工一机一验", reportStart);
  const reportBlock = reportStart >= 0 ? text.slice(reportStart, reportEnd >= 0 ? reportEnd : undefined) : "";
  const batteryHealth = reportBlock.match(/(\d{1,3}(?:%\s*-\s*\d{1,3})?)%\s*电池寿命/)?.[1];
  return {
    price: Number(priceGrade[1]),
    grade: `${priceGrade[2]}成新`,
    product: productBlock.match(/(Apple .*? 国行)(?:\s+机况|\s+参数)/)?.[1] ?? null,
    inventoryId: reportBlock.match(/库存编号：?\s*(\d+)/)?.[1] ?? null,
    batteryHealth: batteryHealth ? `${batteryHealth.replaceAll(" ", "")}%` : null,
    repairHistory: reportBlock.match(/(未检出维修痕迹|检出.*?维修痕迹)\s*维修历史/)?.[1] ?? null,
    modelNumber: reportBlock.match(/(A\d{4})\s*型号号码/)?.[1] ?? null,
    mainland: /国行\s*版本/.test(reportBlock),
    inspectionSummary: reportBlock.match(/经检测：(.*?)详细检测结果/)?.[1]?.trim() ?? null,
    soldOut: /已售罄/.test(text.slice(reportStart >= 0 ? reportStart : priceGrade.index)),
  };
}

function relatedJiUsedItems(html, url) {
  if (new URL(url).hostname !== "m2.9ji.com") return [];
  const currentPath = new URL(url).pathname;
  const items = new Map();
  for (const match of html.matchAll(/<a\b[^>]*href="(\/secondHand\/detail\/\d+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const [, path, body] = match;
    if (path === currentPath || items.has(path)) continue;
    const productHtml = body.match(/class="[^"]*\bproduct-name\b[^"]*"[^>]*>([\s\S]*?)<\/span>/)?.[1];
    if (!productHtml) continue;
    const product = decodeHtml(productHtml);
    const text = decodeHtml(body);
    const price = parseDisplayedPrice(text.match(/[¥￥]\s*([0-9]{3,6}(?:\.[0-9]{1,2})?)/)?.[1]);
    if (!price) continue;
    const batteryHealth = text.match(/(\d{1,3}(?:%\s*-\s*\d{1,3})?)%/)?.[1];
    items.set(path, {
      url: new URL(path, url).href,
      product,
      grade: text.match(/(\d{1,2})\s*成新/)?.[1] ? `${text.match(/(\d{1,2})\s*成新/)?.[1]}成新` : null,
      price,
      batteryHealth: batteryHealth ? `${batteryHealth.replaceAll(" ", "")}%` : null,
    });
  }
  return [...items.values()].slice(0, 50);
}

async function inspectUrl(url, { render = false } = {}) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error("只接受 HTTPS 商品页");
  if (render && !TRUSTED_HOSTS.has(parsed.hostname)) throw new Error("动态渲染只接受受信来源域名");
  const response = await fetchWithRetry(url, {
    headers: { "user-agent": "Mozilla/5.0 DeviceScope price snapshot audit", "accept-language": "zh-CN,zh;q=0.9" },
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  if (render && !TRUSTED_HOSTS.has(new URL(response.url).hostname)) throw new Error("动态渲染重定向到了非受信来源域名");
  const staticHtml = await response.text();
  const html = render ? renderHtml(response.url) : staticHtml;
  const text = decodeHtml(html);
  const shihuoPage = shihuoPageData(html, response.url);
  const selectedSku = selectedShihuoSku(shihuoPage, response.url);
  const selectedUsedItem = selectedJiUsedItem(text, response.url);
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() ?? "";
  const capacities = [...new Set(text.match(/\b\d+(?:\.\d+)?\s*(?:GB|TB)\b/gi) ?? [])].slice(0, 30);
  const highlightedPrices = [...text.matchAll(/.{0,80}(?:最低价|页面价|当前价格|售价为|价格区间).{0,120}/g)]
    .map((match) => match[0].trim())
    .slice(0, 8);
  return {
    requestedUrl: url,
    finalUrl: response.url,
    sourceHost: new URL(response.url).hostname,
    rendered: render,
    title,
    selectedSku,
    availableStyles: shihuoStyles(shihuoPage),
    availableSkus: shihuoSkus(shihuoPage).slice(0, 50),
    selectedUsedItem,
    relatedUsedItems: relatedJiUsedItems(html, response.url),
    priceCandidates: priceCandidates(html),
    highlightedPrices,
    capacities,
    signals: {
      mainland: /国行|中国大陆|大陆版本|全网通/.test(text),
      used: /二手|成新|电池效率|电池寿命|维修痕迹/.test(text),
      pageTextAvailable: text.length > 500,
    },
    textPreview: text.slice(0, 800),
  };
}

function compactInspection(inspection) {
  const compact = { ...inspection };
  delete compact.relatedUsedItems;
  return compact;
}

async function searchJiUsed(query, limit, pages = 1) {
  async function fetchPage(current) {
    const url = new URL("https://m2.9ji.com/web/api/second/secondGoodsSearch/v1");
    url.search = new URLSearchParams({
      coll: "0-0-0-0-0-0-0-0-0_0",
      keywords: query,
      ppid: "",
      hsPid: "",
      filterSales: "",
      current: String(current),
      cityId: "",
      size: String(limit),
    });
    const response = await fetchWithRetry(url, {
      headers: { "user-agent": "Mozilla/5.0 DeviceScope price snapshot audit", "accept-language": "zh-CN,zh;q=0.9" },
    });
    if (!response.ok) throw new Error(`${response.status} ${url}`);
    const payload = await response.json();
    if (payload.code !== 0 || !Array.isArray(payload.data?.product?.records)) {
      throw new Error(payload.userMsg || "九机二手搜索返回格式异常");
    }
    return payload.data.product.records;
  }

  const records = new Map();
  const firstPage = await fetchPage(1);
  for (const item of firstPage) records.set(item.id, item);
  if (pages > 1 && firstPage.length >= limit) {
    const remainingPages = await Promise.all(
      Array.from({ length: pages - 1 }, (_, index) => fetchPage(index + 2)),
    );
    for (const page of remainingPages) {
      for (const item of page) records.set(item.id, item);
    }
  }
  return [...records.values()].map((item) => ({
    id: item.id,
    url: `https://m2.9ji.com/secondHand/detail/${item.id}`,
    product: normalizeProductName(item.name),
    skuName: item.skuName,
    price: Number(item.salePrice) || null,
    grade: item.glevelName || item.gleavel || null,
    inspectionSignals: item.secondParams ?? [],
    network: item.network || null,
    stockout: Boolean(item.stockout),
  }));
}

function filterJiUsedItems(items, { product, require: requiredText, exclude: excludedText, available }) {
  const exactProduct = normalizeProductName(product).toLocaleLowerCase("zh-CN");
  const requiredTerms = (requiredText ?? "").trim().toLocaleLowerCase("zh-CN").split(/\s+/).filter(Boolean);
  const excludedTerms = (excludedText ?? "").trim().toLocaleLowerCase("zh-CN").split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    if (available && item.stockout) return false;
    if (exactProduct && normalizeProductName(item.product).toLocaleLowerCase("zh-CN") !== exactProduct) return false;
    const text = `${item.product} ${item.skuName} ${item.network ?? ""}`.toLocaleLowerCase("zh-CN");
    return requiredTerms.every((term) => text.includes(term)) && excludedTerms.every((term) => !text.includes(term));
  });
}

function validateBatch(input, { allowExisting = false } = {}) {
  if (!Array.isArray(input) || input.length === 0) throw new Error("批次文件必须是非空 JSON 数组");
  const { devices } = readJson(DATABASE_PATH);
  const devicesById = new Map(devices.map((device) => [device.id, device]));
  const seen = new Set();
  return input.map((row, index) => {
    const label = `第 ${index + 1} 条`;
    const device = devicesById.get(row.deviceId);
    if (!device) throw new Error(`${label}: deviceId 不存在`);
    if (!PRICE_TYPES.has(row.priceType)) throw new Error(`${label}: priceType 只能是 current 或 used`);
    const duplicateKey = `${row.priceType}:${row.deviceId}`;
    if (seen.has(duplicateKey)) throw new Error(`${label}: 同一设备和价格类型重复`);
    seen.add(duplicateKey);
    if (!allowExisting && device.specs[`${row.priceType}Price`]?.value) throw new Error(`${label}: 正式库已有该价格类型`);
    if (!Number.isInteger(row.value) || row.value < 300 || row.value > 100000) throw new Error(`${label}: value 必须是 300-100000 的整数人民币价格`);
    const sourceUrl = new URL(row.sourceUrl);
    if (sourceUrl.protocol !== "https:" || !TRUSTED_HOSTS.has(sourceUrl.hostname)) throw new Error(`${label}: 来源域名未列入受信清单`);
    if ((row.sourceType === "apple") !== (sourceUrl.hostname === "www.apple.com.cn")) {
      throw new Error(`${label}: sourceType 必须与 Apple 或第三方来源域名一致`);
    }
    for (const key of ["sourceName", "rawText", "configuration", "condition"]) {
      if (typeof row[key] !== "string" || !row[key].trim()) throw new Error(`${label}: 缺少 ${key}`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.observedAt)) throw new Error(`${label}: observedAt 必须为 YYYY-MM-DD`);
    if (row.priceType === "current" && !/全新|在售价|当前价|公开价|最低价/.test(row.condition)) throw new Error(`${label}: 当前价 condition 必须说明全新或价格状态`);
    if (row.priceType === "used" && !/二手|成新/.test(row.condition)) throw new Error(`${label}: 二手价 condition 必须说明二手或成色`);
    const memoryOptions = splitOptions(device.specs.memory?.value);
    if (memoryOptions.length && !memoryOptions.some((memory) => row.configuration.includes(memory))) {
      throw new Error(`${label}: configuration 未包含该设备的有效运行内存`);
    }
    const storageOptions = splitOptions(device.specs.storage?.value);
    if (storageOptions.length && !storageOptions.some((storage) => row.configuration.includes(storage))) {
      throw new Error(`${label}: configuration 未包含该设备的有效存储容量`);
    }
    return {
      deviceId: row.deviceId,
      priceType: row.priceType,
      observation: {
        value: row.value,
        sourceUrl: row.sourceUrl,
        sourceName: row.sourceName.trim(),
        rawText: row.rawText.trim(),
        configuration: row.configuration.trim(),
        condition: row.condition.trim(),
        observedAt: row.observedAt,
        ...(row.sourceType === "apple" ? { sourceType: "apple" } : {}),
      },
    };
  });
}

function applyBatch(rows) {
  const observations = readJson(OBSERVATIONS_PATH);
  for (const row of rows) observations[row.priceType][row.deviceId] = row.observation;
  for (const priceType of PRICE_TYPES) {
    observations[priceType] = Object.fromEntries(Object.entries(observations[priceType]).sort(([left], [right]) => left.localeCompare(right)));
  }
  fs.writeFileSync(OBSERVATIONS_PATH, `${JSON.stringify(observations, null, 2)}\n`);
}

function usage() {
  return `价格快照批处理\n\n` +
    `  npm run prices -- plan [--type current|used] [--category phone|tablet|laptop] [--limit 20] [--json]\n` +
    `  npm run prices -- search <九机二手型号关键词> [--limit 20] [--pages 1] [--products-only] [--product "精确产品名"] [--require "词1 词2"] [--exclude "词3 词4"] [--available]\n` +
    `  npm run prices -- inspect <https商品页> [--match "256GB WLAN"] [--all-styles] [--available] [--render] [--compact]  # 识货多规格页请带 skuId；动态页加 --render\n` +
    `  npm run prices -- validate <batch.json>\n` +
    `  npm run prices -- apply <batch.json>\n`;
}

const command = process.argv[2];
if (!command || ["help", "--help", "-h"].includes(command)) {
  console.log(usage());
} else if (command === "plan") {
  const { values } = parseArgs({
    args: process.argv.slice(3),
    options: { type: { type: "string", default: "current" }, category: { type: "string" }, limit: { type: "string", default: "20" }, json: { type: "boolean" } },
  });
  if (!PRICE_TYPES.has(values.type)) throw new Error("--type 只能是 current 或 used");
  if (values.category && !CATEGORIES.has(values.category)) throw new Error("--category 非法");
  const limit = Number(values.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 129) throw new Error("--limit 必须是 1-129 的整数");
  const plan = buildPlan({ category: values.category, priceType: values.type, limit });
  if (values.json) console.log(JSON.stringify(plan, null, 2));
  else for (const row of plan) console.log(`${row.deviceId}\t${row.configuration}\t${row.searchQuery}`);
} else if (command === "search") {
  if (!process.argv[3] || process.argv[3].startsWith("--")) throw new Error("缺少九机二手型号关键词");
  const { values } = parseArgs({
    args: process.argv.slice(4),
    options: {
      limit: { type: "string", default: "20" },
      pages: { type: "string", default: "1" },
      "products-only": { type: "boolean", default: false },
      product: { type: "string" },
      require: { type: "string" },
      exclude: { type: "string" },
      available: { type: "boolean", default: false },
    },
  });
  const limit = Number(values.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("--limit 必须是 1-100 的整数");
  const pages = Number(values.pages);
  if (!Number.isInteger(pages) || pages < 1 || pages > 5) throw new Error("--pages 必须是 1-5 的整数");
  const items = await searchJiUsed(process.argv[3], limit, pages);
  const filteredItems = filterJiUsedItems(items, values);
  const output = values["products-only"]
    ? [...new Set(filteredItems.map((item) => item.product))].sort((left, right) => left.localeCompare(right, "zh-CN"))
    : filteredItems;
  console.log(JSON.stringify(output, null, 2));
} else if (command === "inspect") {
  if (!process.argv[3]) throw new Error("缺少商品页 URL");
  const { values } = parseArgs({
    args: process.argv.slice(4),
    options: {
      match: { type: "string" },
      "all-styles": { type: "boolean", default: false },
      available: { type: "boolean", default: false },
      render: { type: "boolean", default: false },
      compact: { type: "boolean", default: false },
    },
  });
  const inspection = await inspectUrl(process.argv[3], { render: values.render });
  if (values["all-styles"] && inspection.sourceHost === "www.shihuo.cn" && inspection.availableStyles.length > 0) {
    const styleInspections = await Promise.all(inspection.availableStyles.map((style) => {
      const styleUrl = new URL(process.argv[3]);
      styleUrl.searchParams.set("styleId", style.styleId);
      styleUrl.searchParams.delete("skuId");
      return inspectUrl(styleUrl.toString());
    }));
    inspection.availableSkus = Array.from(
      new Map(styleInspections.flatMap((item) => item.availableSkus).map((sku) => [sku.skuId, sku])).values(),
    );
  }
  inspection.availableSkus = filterSkus(inspection.availableSkus, values.match);
  if (values.available) inspection.availableSkus = inspection.availableSkus.filter((sku) => sku.listedPrice !== null);
  console.log(JSON.stringify(values.compact ? compactInspection(inspection) : inspection, null, 2));
} else if (["validate", "apply"].includes(command)) {
  if (!process.argv[3]) throw new Error("缺少批次 JSON 文件");
  const rows = validateBatch(readJson(process.argv[3]));
  if (command === "apply") applyBatch(rows);
  console.log(`${command === "apply" ? "已导入" : "验证通过"} ${rows.length} 条价格快照`);
} else {
  throw new Error(`未知命令: ${command}\n${usage()}`);
}
