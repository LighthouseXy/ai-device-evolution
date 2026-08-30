import fs from "node:fs";
import { parseArgs } from "node:util";

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

async function inspectUrl(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error("只接受 HTTPS 商品页");
  const response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 DeviceScope price snapshot audit", "accept-language": "zh-CN,zh;q=0.9" },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  const html = await response.text();
  const text = decodeHtml(html);
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() ?? "";
  const capacities = [...new Set(text.match(/\b\d+(?:\.\d+)?\s*(?:GB|TB)\b/gi) ?? [])].slice(0, 30);
  const highlightedPrices = [...text.matchAll(/.{0,80}(?:最低价|页面价|当前价格|售价为|价格区间).{0,120}/g)]
    .map((match) => match[0].trim())
    .slice(0, 8);
  return {
    requestedUrl: url,
    finalUrl: response.url,
    sourceHost: new URL(response.url).hostname,
    title,
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
    `  npm run prices -- inspect <https商品页>\n` +
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
} else if (command === "inspect") {
  if (!process.argv[3]) throw new Error("缺少商品页 URL");
  console.log(JSON.stringify(await inspectUrl(process.argv[3]), null, 2));
} else if (["validate", "apply"].includes(command)) {
  if (!process.argv[3]) throw new Error("缺少批次 JSON 文件");
  const rows = validateBatch(readJson(process.argv[3]));
  if (command === "apply") applyBatch(rows);
  console.log(`${command === "apply" ? "已导入" : "验证通过"} ${rows.length} 条价格快照`);
} else {
  throw new Error(`未知命令: ${command}\n${usage()}`);
}
