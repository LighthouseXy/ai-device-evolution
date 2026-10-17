import assert from "node:assert/strict";
import { getSourceSnapshot } from "./source-snapshot.mjs";

export function plainText(html) {
  return html.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&(ldquo|rdquo|lsquo|rsquo|deg|times|middot|ndash|mdash);/g,
      (_, name) => ({ ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", deg: "°", times: "×", middot: "·", ndash: "–", mdash: "—" })[name])
    .replace(/\s+/g, " ").trim();
}

export function zolRows(html) {
  const rows = new Map();
  for (const [, row] of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const label = plainText(row.match(/<th\b[^>]*>([\s\S]*?)<\/th>/i)?.[1] ?? "");
    const cell = row.match(/<td\b[^>]*>([\s\S]*?)<\/td>/i)?.[1];
    if (!label || !cell) continue;
    const value = plainText(cell.replace(/<a\b[^>]*>\s*更多[\s\S]*?<\/a>/gi, "")
      .replace(/<em\b[^>]*>[\s\S]*?<\/em>/gi, ""))
      .replace(/，?\s*手机性能排行>.*$/, "").replace(/\s*纠错.*$/, "").replace(/>(?=\s*(?:，|,|$))/g, "").trim();
    if (value && !/^(?:暂无|未知|未公布|待定|即将上市)/.test(value)) rows.set(label, value);
  }
  return rows;
}

const identity = (value) => value.replace(/Samsung(?:[（(]三星[）)])?/gi, "三星")
  .replace(/[（(]红米[）)]/g, "").replace(/[（(][\s\S]*$/, "").replace(/\s*\d+(?:\.\d+)?GB\s*[+/][^]*$/i, "").replace(/HUAWEI/gi, "华为")
  .replace(/红米/gi, "Redmi").replace(/小米平板/gi, "小米Pad").replace(/参数$/, "").replace(/[\s"“”款]+/g, "").toLowerCase();

export function extractZolProductImage(html) {
  const attribute = (tag, name) => tag.match(new RegExp(`\\b${name}=["']([^"']+)["']`, "i"))?.[1];
  const meta = [...html.matchAll(/<meta\b[^>]*>/gi)].map(([tag]) => tag)
    .find((tag) => attribute(tag, "itemprop") === "image");
  const declared = meta && attribute(meta, "content");
  if (!declared) return null;
  const heading = plainText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
  const primary = [...html.matchAll(/<img\b[^>]*>/gi)].map(([tag]) => tag).find((tag) => {
    const src = attribute(tag, "src"), alt = attribute(tag, "alt");
    return src && alt && src.split("/").at(-1) === declared.split("/").at(-1)
      && identity(alt) === identity(heading);
  });
  if (!primary) return null;
  let url;
  try { url = new URL(attribute(primary, "src")); } catch { return null; }
  if (url.protocol !== "https:" || !/^2[a-f]\.zol-img\.com\.cn$/.test(url.hostname)
    || !/^\/product\/\d+_\d+x\d+\/\d+\/[\w-]+\.(?:png|jpe?g|webp)$/i.test(url.pathname)) return null;
  return { url: url.href, alt: plainText(attribute(primary, "alt")) };
}
const pick = (rows, labels) => labels.map((label) => rows.has(label) ? { label, value: rows.get(label) } : null).find(Boolean);
const excerpt = (entry) => entry ? `${entry.label} ${entry.value}` : "";
const capacity = (value) => value?.match(/\d+(?:\.\d+)?\s*(?:GB|TB)/i)?.[0].replace(/\s+/g, "").toUpperCase();
export function readSingleCapacity(value) {
  const first = capacity(value);
  if (!first) return null;
  let invalidModules = false;
  // 16GB（8GB×2）是同一个总容量，不是 8GB/16GB 两个 SKU。
  const normalized = value.replace(/[（(](\d+(?:\.\d+)?)\s*GB\s*[×x*]\s*(\d+)[）)]/gi,
    (text, size, count) => {
      if (`${Number(size) * Number(count)}GB` !== first) invalidModules = true;
      return "";
    });
  const values = new Set(normalized.match(/\d+(?:\.\d+)?\s*(?:GB|TB)/gi)?.map((item) => item.replace(/\s/g, "").toUpperCase()));
  return !invalidModules && values.size === 1 ? first : null;
}
export function readStorageCapacity(value, category) {
  const compound = value?.match(/^\s*(\d+(?:\.\d+)?\s*(?:GB|TB))\s*\+\s*(\d+(?:\.\d+)?\s*(?:GB|TB))\s*$/i);
  if (compound) return category === "laptop" ? compound.slice(1).map((part) => part.replace(/\s/g, "").toUpperCase()).join(" + ") : null;
  return value ? readSingleCapacity(value) : null;
}
const evidence = (page, value, rawText, unit) => ({ value, ...(unit ? { unit } : {}), rawText, evidenceKind: "excerpt",
  sourceUrl: page.url, sourceType: "reference", confidence: 0.8, verifiedAt: page.fetchedAt.slice(0, 10),
  fetchedAt: page.fetchedAt, sourceSnapshotHash: page.sha256 });

export function readZolOptionalSpecs(page) {
  const rows = zolRows(page.html), specs = {};
  for (const [key, labels] of [
    ["memoryType", ["RAM存储类型", "内存类型"]], ["storageType", ["ROM存储类型"]],
    ["operatingSystem", ["操作系统"]], ["security", ["指纹识别"]],
    ["waterResistance", ["三防功能", "防护等级", "防水防尘"]],
    ["sim", ["SIM卡类型"]], ["dimensions", ["机身尺寸", "产品尺寸"]],
  ]) {
    const entry = pick(rows, labels);
    if (entry) specs[key] = evidence(page, entry.value, excerpt(entry));
  }
  const nfc = pick(rows, ["NFC"]);
  if (nfc && /^(?:不支持|不具备|否|支持|是)/.test(nfc.value)) {
    specs.hasNFC = evidence(page, !/^(?:不支持|不具备|否)/.test(nfc.value), excerpt(nfc));
  }
  const charging = [pick(rows, ["有线充电"]), pick(rows, ["无线充电"])].filter(Boolean);
  if (charging.length) specs.chargingMethod = evidence(page,
    charging.map((entry) => `${entry.label}：${entry.value}`).join("；"), charging.map(excerpt).join("；"));
  const screen = pick(rows, ["屏幕尺寸"]);
  if ((screen?.value.match(/\d+(?:\.\d+)?\s*英寸/g) ?? []).length > 1) {
    specs.screenSizeDetails = evidence(page, screen.value, excerpt(screen));
  }
  return specs;
}

// 只合并同一编号明确标注的镜头属性；未分镜头的防抖、光圈、传感器不猜归属。
export function readZolCameraSpecs(page) {
  const rows = zolRows(page.html), specs = {};
  const numbered = (text = "") => new Map([...text.matchAll(/((?:后置|前置)摄像头\d+)：(.+?)(?= (?:后置|前置)摄像头\d+：|$)/g)]
    .map((match) => [match[1], match[2]]));
  const names = numbered(rows.get("摄像头名称")), pixels = numbered(rows.get("像素"));
  const attributes = ["光圈", "防抖功能"].map((label) => [label, numbered(rows.get(label))]);
  const rear = [];
  for (const [number, name] of names) {
    const key = number.startsWith("前置") ? (names.has("前置摄像头2") ? null : "frontCamera")
      : /超广角/.test(name) ? "ultraWide" : /长焦/.test(name) ? "telephoto"
        : /微距/.test(name) ? "macroCamera" : /景深/.test(name) ? "depthCamera"
          : /主摄/.test(name) ? "mainCamera" : null;
    if (!key || !pixels.has(number)) continue;
    const parts = [pixels.get(number), name];
    for (const [, values] of attributes) if (values.has(number)) parts.push(values.get(number));
    const value = [...new Set(parts)].join("；");
    // 全段原文保留编号，可离线复核跨属性的准确绑定。
    const labels = ["摄像头名称", "像素", ...attributes.filter(([, values]) => values.has(number)).map(([label]) => label)];
    const rawText = labels.map((label) => `${label} ${rows.get(label)}`).join("；");
    const prior = specs[key];
    specs[key] = evidence(page, prior ? `${prior.value}；${value}` : value, rawText);
    if (number.startsWith("后置")) rear.push(value);
  }
  const rearCount = [...names.keys()].filter((key) => key.startsWith("后置")).length;
  if (rearCount && rear.length === rearCount) specs.rearCamera = evidence(page, rear.join("；"),
    `摄像头名称 ${rows.get("摄像头名称")}；像素 ${rows.get("像素")}`);
  const videos = ["后置视频拍摄", "前置视频拍摄"].filter((label) => rows.has(label));
  if (videos.length) specs.videoRecording = evidence(page,
    videos.map((label) => `${label}：${rows.get(label)}`).join("；"), videos.map((label) => `${label} ${rows.get(label)}`).join("；"));
  if (rows.has("变焦倍数")) specs.opticalZoom = evidence(page, rows.get("变焦倍数"), `变焦倍数 ${rows.get("变焦倍数")}`);
  return specs;
}

export function assertZolModel(page, modelName) {
  const heading = plainText(page.html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
  assert.equal(identity(heading), identity(modelName), `参数页面型号不匹配：${heading} / ${modelName}`);
}

export function readRelease(rows, { minYear = 2022, asOf = "2026-10-06" } = {}) {
  const entry = pick(rows, ["上市日期", "上市时间", "发布时间"]);
  const match = entry?.value.match(/(20\d{2})\s*年(?:\s*(\d{1,2})(?:\s*月)?(?:\s*(\d{1,2})\s*日?)?)?/);
  if (!match) return null;
  const year = Number(match[1]), month = Number(match[2] || 0), day = Number(match[3] || 0);
  assert.ok(year >= minYear && year <= Number(asOf.slice(0, 4)), `上市年份不在收录范围: ${entry.value}`);
  assert.ok(!month || month <= 12, `无效上市月份: ${entry.value}`);
  assert.ok(!day || (month && day <= new Date(Date.UTC(year, month, 0)).getUTCDate()), `无效上市日期: ${entry.value}`);
  const date = `${year}${month ? `-${String(month).padStart(2, "0")}` : ""}${day ? `-${String(day).padStart(2, "0")}` : ""}`;
  assert.ok(date <= asOf, `尚未上市: ${date}`);
  return { year, date, entry };
}

export async function importZolSeries(target, options = {}) {
  const expected = target.expectedName ?? target.modelName;
  const matchesName = (name) => expected instanceof RegExp ? expected.test(identity(name))
    : (Array.isArray(expected) ? expected : [expected]).some((value) => identity(value) === identity(name));
  const series = await getSourceSnapshot(target.seriesUrl, options);
  const title = plainText(series.html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
  assert.ok(matchesName(title), `${target.id}: 系列身份不一致: ${title}`);
  const listingHref = [...series.html.matchAll(/href=["']([^"']+param_\d+_0_1\.html)["']/g)][0]?.[1];
  const listing = listingHref ? await getSourceSnapshot(new URL(listingHref, target.seriesUrl).href, options) : null;
  const variants = new Map();
  for (const [, href, html] of `${series.html}\n${listing?.html ?? ""}`.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const name = plainText(html);
    const id = href.match(/\/(?:cell_phone|tablepc|notebook)\/index(\d+)\.shtml/)?.[1];
    if (!id || !matchesName(name)) continue;
    if (target.variantFilter && !(target.variantFilter instanceof RegExp ? target.variantFilter.test(name) : name.includes(target.variantFilter))) continue;
    const excluded = target.excludeVariants ?? ["柔光", "悦享", "昆仑", "LTE", "蜂窝", "5G版", "全网通版"];
    if (excluded.some((text) => name.includes(text))) continue;
    variants.set(id, name);
  }
  assert.ok(variants.size, `${target.id}: 无匹配的具体配置`);
  const pages = [];
  const excludedConfigurations = [];
  // ponytail: 分批上限 3 个并发请求；按具体 SKU 获取，避免把内存清单交叉相乘。
  const entries = [...variants].slice(0, 16);
  for (let offset = 0; offset < entries.length; offset += 3) {
    const fetched = await Promise.all(entries.slice(offset, offset + 3).map(async ([id, name]) => {
      const url = `https://detail.zol.com.cn/${Math.floor(Number(id) / 1000) + 1}/${id}/param.shtml`;
      const page = await getSourceSnapshot(url, { ...options, validate(html) {
        assert.ok(!html.includes("\uFFFD"), `${url}: 页面编码损坏`);
        const heading = plainText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
        assert.ok(matchesName(heading), `${url}: 具体配置身份不一致: ${heading}`);
      } });
      const rows = zolRows(page.html);
      const memory = pick(rows, ["RAM容量", "系统内存", "内存容量"]);
      const storage = pick(rows, ["ROM容量", "存储容量", "硬盘容量"]);
      const chip = pick(rows, ["CPU型号", "处理器型号"]);
      const titleConfiguration = name.match(/(\d+(?:\.\d+)?GB)\s*[+/]\s*(\d+(?:\.\d+)?(?:GB|TB)(?:\s*\+\s*\d+(?:\.\d+)?(?:GB|TB))?)/i);
      const titleMemory = titleConfiguration?.[1] ?? name.match(/(\d+(?:\.\d+)?GB)\s*RAM\b/i)?.[1];
      const titleStorage = titleConfiguration?.[2] ?? name.match(/(\d+(?:\.\d+)?(?:GB|TB))\s*ROM\b/i)?.[1];
      const storageCapacity = readStorageCapacity(storage?.value, target.category);
      const reason = !capacity(memory?.value) || !capacity(storage?.value) ? "缺少可核验的内存或存储字段"
        : !readSingleCapacity(memory.value) || !storageCapacity ? "内存或存储是多值汇总，不能绑定独立 SKU"
        : (titleMemory && titleMemory.toUpperCase() !== capacity(memory.value)) || (titleStorage && readStorageCapacity(titleStorage, target.category) !== storageCapacity)
          ? "型号标题与参数行中的内存或存储冲突" : null;
      if (reason) { excludedConfigurations.push({ name, sourceUrl: url, reason }); return null; }
      return { ...page, rows, name, memory, storage, chip, release: readRelease(rows, { minYear: target.minYear }) };
    }));
    pages.push(...fetched.filter(Boolean));
  }
  assert.ok(pages.length, `${target.id}: 所有具体配置证据缺失或冲突`);
  const dated = pages.filter((page) => page.release && (!target.releaseYear || page.release.year === target.releaseYear))
    .sort((a, b) => a.release.year - b.release.year || b.release.date.length - a.release.date.length
      || a.release.date.localeCompare(b.release.date));
  let fallback;
  if (target.releaseFallback) {
    const details = target.releaseFallback;
    const page = await getSourceSnapshot(details.sourceUrl, options);
    const rawText = plainText(page.html).match(details.pattern ?? details.rawPattern)?.[0];
    const checkedRelease = /^20\d{2}-\d{2}-\d{2}$/.test(details.releaseDate)
      ? readRelease(new Map([["上市日期", details.releaseDate.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$1年$2月$3日")]]), { minYear: target.minYear }) : null;
    assert.ok(rawText && checkedRelease, `${target.id}: 发布日期补充证据无效`);
    fallback = { page, rawText, release: { year: Number(details.releaseDate.slice(0, 4)), date: details.releaseDate } };
  }
  assert.ok(dated.length || fallback, `${target.id}: 缺少可核验的上市时间`);
  const release = fallback?.release ?? dated[0].release;
  if (target.releaseYear) assert.equal(release.year, target.releaseYear, `${target.id}: 目标年份与参数页不一致`);
  const first = dated[0] ?? pages[0];
  let compatible = pages;
  if (target.category === "laptop") {
    const signature = (page) => ["屏幕尺寸", "屏幕分辨率", "分辨率", "显卡类型"].map((key) => page.rows.get(key) ?? "").join("|")
      + (/独立/.test(page.rows.get("显卡类型") ?? "") ? page.rows.get("显卡芯片") ?? "" : "");
    compatible = pages.filter((page) => signature(page) === signature(first));
  }
  const configurations = [];
  const cleanChip = (value) => value.replace(/跷龙/g, "骁龙").replace(/\s*(?:中端主流机|高端机|高端旗舰机|入门机|旗舰机)[^]*$/, "").trim();
  const chipValues = new Set(compatible.filter((page) => page.chip).map((page) => cleanChip(page.chip.value)));
  for (const page of compatible) {
    const memory = readSingleCapacity(page.memory.value), storage = readStorageCapacity(page.storage.value, target.category);
    const chip = target.category === "laptop" || chipValues.size > 1 ? page.chip && cleanChip(page.chip.value) : undefined;
    if (configurations.some((item) => item.memory === memory && item.storage === storage && item.chip === chip)) continue;
    configurations.push({ memory, storage, ...(chip ? { chip } : {}),
      evidence: evidence(page, `${memory} + ${storage}${chip ? ` · ${chip}` : ""}`,
        `${page.name}；${excerpt(page.memory)}；${excerpt(page.storage)}；${excerpt(page.chip)}${page.rows.has("显卡芯片") ? `；显卡芯片 ${page.rows.get("显卡芯片")}` : ""}`) });
  }
  assert.ok(configurations.length, `${target.id}: 没有明确配置`);
  const specs = {};
  const aggregate = (key, values, raw) => { specs[key] = evidence(first, [...new Set(values)].join(" / "), raw); };
  if (compatible.some((page) => page.chip)) aggregate("chip", [...chipValues], compatible.map((page) => excerpt(page.chip)).filter(Boolean).join("；"));
  aggregate("memory", configurations.map((item) => item.memory), compatible.map((page) => `${page.name}；${excerpt(page.memory)}`).join("；"));
  aggregate("storage", configurations.map((item) => item.storage), compatible.map((page) => `${page.name}；${excerpt(page.storage)}`).join("；"));
  // 聚合原文由多页提供，单页 hash 不能冒充多页原文证据；逐条配置保留自己的快照。
  for (const key of ["chip", "memory", "storage"]) {
    if (!specs[key]) continue;
    const labels = key === "chip" ? ["CPU型号", "处理器型号"] : key === "memory" ? ["RAM容量", "系统内存", "内存容量"] : ["ROM容量", "存储容量", "硬盘容量"];
    const page = compatible.find((candidate) => pick(candidate.rows, labels));
    specs[key] = { ...evidence(page, specs[key].value, excerpt(pick(page.rows, labels))),
      ...(compatible.length > 1 ? { note: "可选值汇总自本设备各配置 evidence 对应的具体规格页。" } : {}) };
  }
  function read(key, labels, convert = (value) => value, unit) {
    const entry = pick(first.rows, labels);
    const value = entry && convert(entry.value);
    if (value !== undefined && value !== null && value !== "") specs[key] = evidence(first, value, excerpt(entry), unit);
  }
  read("screenSize", ["屏幕尺寸", "尺寸"], (value) => Number(value.match(/\d+(?:\.\d+)?/)?.[0]) || undefined, "inch");
  read("displayType", ["屏幕材质", "屏幕类型", "屏幕描述"], (value) => /AMOLED|OLED|LCD|IPS|TFT|LED/i.test(value) ? value : undefined);
  read("resolution", ["分辨率", "屏幕分辨率"]);
  read("refreshRate", ["屏幕刷新率", "刷新率"], (value) => Number(value.match(/(\d+)\s*Hz/i)?.[1]) || undefined, "Hz");
  read("weight", ["重量", "产品重量", "笔记本重量"], (value) => {
    const m = value.match(/(\d+(?:\.\d+)?)\s*(kg|g|千克|克)/i);
    return m ? Number(m[1]) * (/kg|千克/i.test(m[2]) ? 1000 : 1) : undefined;
  }, "g");
  read("batteryCapacity", ["电池容量"], (value) => Number(value.match(/(\d+)\s*mAh/i)?.[1]) || undefined, "mAh");
  read("batteryLife", ["续航时间"], (value) => /小时|分钟/.test(value) && !/具体|视.*环境|暂无/.test(value) ? value : undefined);
  read("port", ["机身接口", "数据接口", "接口类型", "数据接口及其他接口"]);
  read("gpu", ["显卡芯片"]);
  const gpuPages = compatible.filter((page) => page.rows.has("显卡芯片"));
  if (new Set(gpuPages.map((page) => page.rows.get("显卡芯片"))).size > 1) {
    const values = [...new Set(gpuPages.map((page) => `${page.chip ? `${cleanChip(page.chip.value)}：` : ""}${page.rows.get("显卡芯片")}`))];
    specs.gpu = { ...evidence(gpuPages[0], values.join(" / "), `显卡芯片 ${gpuPages[0].rows.get("显卡芯片")}`),
      note: "不同芯片对应不同显卡；具体配置 evidence 保留对应芯片和显卡原文，不将第一配置显卡套用到所有版本。" };
  }
  read("wifi", ["WLAN功能", "WiFi功能", "无线网卡"]);
  read("bluetooth", ["蓝牙"]);
  Object.assign(specs, readZolOptionalSpecs(first));
  const pixels = pick(first.rows, ["像素", "摄像头"]);
  const rear = pixels?.value.match(/(?:后置摄像头\d?[^]*?)(?=前置摄像头|$)/)?.[0]
    ?? pixels?.value.match(/后置[：:]?([^]*?)(?=前置|[）)]?$)/)?.[0];
  const front = pixels?.value.match(/前置摄像头[^]*/)?.[0] ?? pixels?.value.match(/前置[：:]?[^]*?(?=后置|[）)]?$)/)?.[0];
  if (rear && !/^后置(?:摄像头\d*)?[：:]?\s*$/.test(rear)) specs.rearCamera = evidence(first, rear.trim(), excerpt(pixels));
  if (front && !/^前置(?:摄像头\d*)?[：:]?\s*$/.test(front)) specs.frontCamera = evidence(first, front.trim(), excerpt(pixels));
  const cameraDescription = (value) => /万|亿|像素|镜头|\bMP\b/i.test(value) ? value : undefined;
  read("rearCamera", ["后置摄像头"], cameraDescription);
  read("frontCamera", ["前置摄像头"], cameraDescription);
  if (target.launch) {
    const launchPage = await getSourceSnapshot(target.launch.url, options);
    const rawText = plainText(launchPage.html).match(target.launch.pattern)?.[0];
    assert.ok(rawText && rawText.replace(/[,，]/g, "").includes(String(target.launch.value)), `${target.id}: 首发价格证据不符`);
    assert.ok(configurations.some((item) => item.memory === target.launch.memory && item.storage === target.launch.storage), `${target.id}: 首发配置未核实`);
    specs.launchPrice = { ...evidence(launchPage, target.launch.value, rawText, "CNY"), priceType: "launch", market: "中国大陆",
      configuration: `${target.launch.memory} 运行内存 + ${target.launch.storage} 存储，国行`, condition: target.launch.condition ?? "中国大陆发布定价" };
  }
  const required = { phone: ["chip", "memory", "storage", "launchPrice", "displayType", "port", "rearCamera", "frontCamera"],
    tablet: ["chip", "memory", "storage", "launchPrice", "screenSize", "displayType", "resolution", "port"],
    laptop: ["chip", "memory", "storage", "launchPrice", "screenSize", "displayType", "resolution"] }[target.category];
  const device = { id: target.id, brand: target.brand, market: "CN", category: target.category, series: target.series ?? target.family,
    family: target.family, variant: target.variant ?? "standard", modelName: target.modelName, generation: target.generation ?? String(release.year),
    generationOrder: target.generationOrder ?? release.year, releaseYear: release.year,
    ...(release.date.length === 10 ? { releaseDate: release.date } : {}), comparisonGroupId: target.comparisonGroupId,
    configurations, specs, computed: {} };
  const source = { id: device.id, modelName: device.modelName, generation: device.generation, releaseYear: device.releaseYear,
    sourcePageType: "expanded_core_spec_snapshots", sourceStatus: "verified", referenceUrls: [...new Set([target.seriesUrl, ...(listing ? [listing.url] : []), ...pages.map((page) => page.url), ...(target.launch ? [target.launch.url] : []), ...(fallback ? [fallback.page.url] : [])])],
    releaseEvidence: fallback ? evidence(fallback.page, release.date, fallback.rawText) : evidence(first, release.date, excerpt(release.entry)),
    fieldGaps: required.filter((key) => !specs[key]).map((field) => ({ field, reason: field === "launchPrice" ? "参数页参考报价不等于首发价；尚未取得该配置的中国大陆发布定价原文" : "对应具体配置参数页未提供可核验的字段原文" })),
    ...(excludedConfigurations.length ? { excludedConfigurations } : {}),
    notes: `中文具体型号参数快照；仅登记实际读取的 ${configurations.length} 个配置，不表示全部配置已覆盖。${target.category === "laptop" ? "不同屏幕和显卡版本分别筛选，CPU 与内存、存储逐 SKU 绑定。" : "附加屏幕、蜂窝或套装版本不混用。"}${target.notes ?? ""}` };
  return { device, source };
}
