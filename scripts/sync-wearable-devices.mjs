import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { getSourceSnapshot } from "./lib/source-snapshot.mjs";
import { plainText, zolRows, extractZolProductImage } from "./lib/zol-device.mjs";
import { mergeColorImages, readAppleProductImage, readOfficialColorGallery, readPconlineProductImage, safeImageUrl } from "./lib/device-images.mjs";

const isOfficial = url => /^(?:support\.apple\.com\/zh-cn\/|consumer\.huawei\.com\/cn\/|www\.samsung\.com\.cn\/|www\.honor\.com\/cn\/|www\.oppo\.com\/cn\/|www\.vivo\.com\.cn\/)/.test(url.slice(8));
// 荣耀规格页将展示文本保存在 data-value 中，由浏览器填入。只读取这一官方组件的数据。
const pageText = p => plainText(p.html) + (p.url.startsWith("https://www.honor.com/cn/wearables/")
  ? " " + [...p.html.matchAll(/<div\b[^>]*\bdata-value="([^"]*)"[^>]*>/g)].map(m => plainText(m[1])).join(" ") : "");
export const evidence = (p, value, rawText, unit) => ({ value, ...(unit ? { unit } : {}), rawText, evidenceKind: "excerpt", sourceUrl: p.url,
  sourceType: isOfficial(p.url) ? "official" : "reference",
  confidence: isOfficial(p.url) ? 1 : 0.8,
  verifiedAt: p.fetchedAt.slice(0, 10), fetchedAt: p.fetchedAt, sourceSnapshotHash: p.sha256 });
const asset = (image, target, p) => ({ ...image, modelName: target.modelName, sourceUrl: p.url,
  sourceName: target.brand === "Apple" ? "Apple 中文支持" : isOfficial(p.url) ? `${target.brand} 中国官网`
    : p.url.includes("pconline.com.cn") ? "太平洋电脑网" : "中关村在线",
  fetchedAt: p.fetchedAt, sourceSnapshotHash: p.sha256, licenseStatus: "unknown" });

export function readWearableRows(p, target = {}) {
  const rows = zolRows(p.html), specs = {};
  const mapping = { displayType: ["屏幕类型", "显示技术"], resolution: ["屏幕分辨率"], operatingSystem: ["操作系统"], compatibility: ["匹配系统", "适配机型"],
    bluetooth: ["蓝牙"], wifi: ["WIFI", "WiFi"], cellular: ["eSIM功能", "SIM卡支持", "通讯网络"], connectivity: ["网络连接"], waterResistance: ["防护级别", "防水级别"], sensors: ["传感器", "感应器"],
    positioning: ["GPS功能", "定位功能", "定位系统"], wearableFeatures: ["其它功能", "其他功能", "主要功能"], sportsModes: ["运动功能", "运动模式"],
    batteryLife: ["续航时间", "电池续航"], chargingMethod: ["充电方式"], chargingTime: ["充电时间"],
    dimensions: ["产品尺寸"], material: ["产品材质", "表壳材质", "主机材质", "使用材质"], strapMaterial: ["腕带材质", "表带材质"], wearableWeight: ["产品重量", "重量"],
    caseSize: ["表盘直径"], wearableChip: ["处理器"], onboardStorage: ["存储容量", "机身存储", "存储空间"], wearableCamera: ["摄像头"] };
  for (const [key, labels] of Object.entries(mapping)) {
    const raw = labels.map(label => rows.get(label)).find(Boolean);
    // 仅清理重复单位这类明确排版错误，原文仍留在 rawText 中。
    if (raw) specs[key] = evidence(p, raw.replace(/(\d)(?:mm){2,}\b/gi, "$1mm").replace(/(\d)g{2,}\b/gi, "$1g"), raw);
  }
  // X 不提供防尘等级，不能把第三方的“IPX8防水防尘”变成防尘能力。
  if (/^IPX\d\s*防水防尘$/i.test(specs.waterResistance?.value ?? "")) {
    specs.waterResistance.value = specs.waterResistance.value.match(/^IPX\d/i)[0];
  }
  // WATCH 3 第三方资料把蓝牙/eSIM 续航写在同一行。仅用确切蓝牙版身份
  // 限定原文已有的模式，不从 eSIM 数值推算蓝牙续航，rawText 仍保留原文。
  if (target.brand === "vivo" && /^vivo-watch-3-(?:2023|bluetooth-leather-2023)$/.test(target.id ?? "")) {
    const battery = specs.batteryLife;
    if (battery?.value.includes("独立通信")) {
      const modes = battery.value.split(/[；;]/).filter(part => part.includes("关闭独立通信"));
      if (modes.length) battery.value = modes.map(part => part.replace("关闭独立通信", "蓝牙模式")).join("；");
      else delete specs.batteryLife;
    }
    if (specs.wearableFeatures?.value.includes("独立在线听歌")) {
      specs.wearableFeatures.value = specs.wearableFeatures.value.replace(/、独立在线听歌/g, "");
      specs.wearableFeatures.note = "蓝牙版不支持独立蜂窝通信；联网应用及 Jovi 语音的手机配对和系统限制以 vivo 官方说明为准。";
    }
  }
  // “通讯网络”有时只写蓝牙通话，不能因此推导出独立蜂窝网络。
  if (specs.cellular && /蓝牙/.test(specs.cellular.value) && !/eSIM|SIM卡|蜂窝|LTE|独立通话|(?:^|[^\d.])[2-5]G(?:网络|通信|$)/i.test(specs.cellular.value)) {
    specs.connectivity ??= specs.cellular;
    delete specs.cellular;
  }
  const size = rows.get("屏幕尺寸");
  if (size && /^\d+(?:\.\d+)?\s*(?:英寸|寸)+$/.test(size)) specs.screenSize = evidence(p, Number(size.match(/\d+(?:\.\d+)?/)[0]), size, "inch");
  const capacity = rows.get("电池容量") ?? rows.get("电池规格");
  if (capacity && /^\d+\s*mAh$/i.test(capacity)) specs.batteryCapacity = evidence(p, Number(capacity.match(/\d+/)[0]), capacity, "mAh");
  else if (capacity) specs.batteryCapacityDetails = evidence(p, capacity, capacity);
  const nfc = rows.get("NFC");
  if (nfc && /^(支持|不支持)(?:$|\s|[，,:：]|读卡)/.test(nfc)) specs.hasNFC = evidence(p, nfc.startsWith("支持"), nfc);
  const colors = rows.get("产品颜色") ?? rows.get("颜色/配色");
  if (colors) specs.colors = evidence(p, colors.split(/[，,、/]/).map(c => c.trim()).filter(Boolean), colors);
  // 短的“支持”不能代替详细健康能力；保留各监测项的真实标签。
  const health = ["心率监测", "血氧监测", "睡眠监测", "血压监测", "压力监测"].filter(key => rows.get(key)).map(key => `${key}：${rows.get(key)}`);
  if (health.length && !specs.healthFeatures) specs.healthFeatures = evidence(p, health.join("；"), health.join("；"));
  return specs;
}

export function readAppleWearable(p) {
  const body = p.html.match(/<h1\b[^>]*>[^]*?<\/h1>([^]*?)(?:<div[^>]*class="[^"]*helpful|<footer)/i)?.[1];
  assert.ok(body, "Apple 技术规格正文缺失");
  const sections = new Map();
  for (const m of body.matchAll(/<h[23]\b[^>]*>([^]*?)<\/h[23]>([^]*?)(?=<h[23]\b|$)/gi)) {
    const label = plainText(m[1]);
    const raw = plainText(m[2].replace(/<sup\b[^>]*>[^]*?<\/sup>/gi, "")
      .replace(/<\/(?:li|p)>/gi, "；")).replace(/(?:\s*；\s*)+/g, "；").replace(/^；|；$/g, "");
    if (raw) sections.set(label, raw);
  }
  const specs = {};
  const assignSection = (key, labels) => { const raw = labels.map(label => sections.get(label)).find(Boolean); if (raw) specs[key] = evidence(p, raw, raw); };
  assignSection("wearableChip", ["芯片"]); assignSection("displayType", ["显示屏"]); assignSection("sensors", ["感应器"]);
  assignSection("healthFeatures", ["健康"]); assignSection("sportsModes", ["体能训练和活动", "体能训练和运动", "体能训练和健身记录"]);
  assignSection("batteryLife", ["电源和电池续航", "电源和电池", "电源", "电池续航", "电池"]); assignSection("waterResistance", ["坚固耐用", "耐用性", "防水防尘"]);
  assignSection("operatingSystem", ["操作系统"]); assignSection("material", ["材质和外观", "外观"]);
  assignSection("dimensions", ["尺寸和重量", "表壳尺寸", "尺寸"]); assignSection("wearableWeight", ["重量"]);
  const display = sections.get("显示屏") ?? "", dimensions = specs.dimensions?.value ?? "";
  // 单位分隔符不能切断“重量 (铝金属；GPS)”这样的版本条件。
  const parts = raw => raw.split(/；(?![^()（）]*[)）])/g).map(part => part.trim()).filter(Boolean);
  const scopeParts = (raw, pattern) => {
    let context = "";
    return parts(raw).flatMap(part => {
      if (/^(?:(?:铝金属|不锈钢|精密陶瓷|钛金属)\s*-\s*)?\d+\s*(?:毫米|mm)$/.test(part.trim())) context = part.trim();
      return pattern.test(part) ? [`${context ? `${context}：` : ""}${part.trim()}`] : [];
    });
  };
  const resolutions = [...new Set([display, dimensions].flatMap(raw => scopeParts(raw, /\d+\s*[x×]\s*\d+/)))];
  if (resolutions.length) specs.resolution = evidence(p, resolutions.join("；"), [display, dimensions].filter(Boolean).join("；"));
  const weights = scopeParts(dimensions, /重量/);
  if (weights.length) specs.wearableWeight ??= evidence(p, weights.join("；"), dimensions);
  if (specs.dimensions) specs.dimensions = { ...specs.dimensions,
    value: parts(dimensions).filter(part => !/重量|\d+\s*[x×]\s*\d+|平方毫米显示面积|腕围/.test(part)).join("；") };
  if (specs.displayType) {
    const value = parts(display).filter(part => !/\d+\s*[x×]\s*\d+|平方毫米显示面积|^\d+\s*毫米$/.test(part)).join("；");
    specs.displayType = { ...specs.displayType, value };
  }
  const sizes = [];
  // 表壳毫米不是屏幕英寸；只记录原页明确给出的表壳选项。
  sizes.push(...[...new Set([display, dimensions].flatMap(raw => parts(raw).filter(part => /^\d+\s*(?:毫米|mm)$/.test(part)))) ]);
  if (sizes.length) specs.caseSize = evidence(p, sizes.join(" / "), sizes.join("；"));
  const connection = sections.get("连接方式") ?? sections.get("连接") ?? "";
  const connectionFields = { positioning: /GPS|GNSS|GLONASS|北斗|Galileo|QZSS/, bluetooth: /蓝牙/, wifi: /无线局域网|Wi-Fi|802\.11/i,
    cellular: /LTE|UMTS|蜂窝网络|eSIM/i };
  for (const [key, pattern] of Object.entries(connectionFields)) {
    const value = parts(connection).filter(part => pattern.test(part)).join("；");
    if (value) specs[key] = { ...evidence(p, value, connection),
      ...(key === "cellular" ? { note: "仅适用于支持蜂窝网络的表款，运营商套餐和地区限制以原页说明为准。" } : {}) };
  }
  const otherConnections = parts(connection).filter(part => !Object.values(connectionFields).some(pattern => pattern.test(part))).join("；");
  if (otherConnections) specs.connectivity = evidence(p, otherConnections, connection);
  assignSection("compatibility", ["兼容性"]);
  const compatibility = [...body.matchAll(/<p\b[^>]*>([^]*?)<\/p>/gi)].map(m => plainText(m[1]))
    .filter(raw => /^Apple\s*Watch/.test(raw) && /(?:需要|要求)(?:使用)?\s*iPhone/.test(raw)).join("；");
  if (compatibility) specs.compatibility ??= evidence(p, compatibility, compatibility);
  const functions = sections.get("功能");
  if (functions) {
    const sensors = functions.split("；").filter(part => /传感器|感应器|陀螺仪|高度计|指南针/.test(part)).join("；");
    if (sensors) specs.sensors ??= evidence(p, sensors, functions);
    const water = functions.match(/(?:防水\s*(?:达到\s*)?\d+\s*米|\d+\s*米防水|防水溅)/);
    if (water) specs.waterResistance ??= evidence(p, water[0], water[0]);
    const positioning = functions.split("；").filter(part => /GPS|GNSS|GLONASS|北斗|Galileo|QZSS/.test(part)).join("；");
    if (positioning) specs.positioning = evidence(p, positioning, functions);
  }
  // 尺寸、材质、网络版本的条件作为同一段保留，不从多值描述中抽取一个冒充整机规格。
  return specs;
}

function makeDevice(target, year, specs) {
  const identity = `${target.brand.toLowerCase()}.${target.category}.${target.family.toLowerCase().replace(/\s+/g, "-")}.${target.variant ?? "standard"}`;
  return { id: target.id, brand: target.brand, market: "CN", category: target.category, family: target.family,
    variant: target.variant ?? "standard", series: target.family, modelName: target.modelName, generation: String(year),
    generationOrder: 1, releaseYear: year, comparisonGroupId: identity, specs };
}
async function main() {
const directory = process.env.WEARABLE_SOURCE_CACHE ?? ".source-cache";
const options = { directory, offline: process.argv.includes("--offline") };
const asOf = "2026-10-07";
const minYears = { Apple: 2016, Xiaomi: 2017, Redmi: 2017, Samsung: 2017, Huawei: 2022, OPPO: 2022, vivo: 2022, HONOR: 2022 };
const required = { watch: ["displayType", "resolution", "batteryLife", "waterResistance", "compatibility"], band: ["screenSize", "displayType", "resolution", "batteryLife", "waterResistance", "compatibility"] };
const targets = JSON.parse(await fs.readFile("scripts/fixtures/wearable-targets.json", "utf8"));
const launchPrices = JSON.parse(await fs.readFile("scripts/fixtures/wearable-launch-prices.json", "utf8"));
const images = JSON.parse(await fs.readFile("src/data/device-images.json", "utf8"));
const galleries = JSON.parse(await fs.readFile("src/data/device-image-galleries.json", "utf8"));
const previousSources = new Map(JSON.parse(await fs.readFile("src/data/device-sources.json", "utf8")).devices.map(source => [source.id, source]));
const devices = [], sources = [], inventory = [], blocked = [];
const cache = new Map();
const page = url => { if (!cache.has(url)) cache.set(url, getSourceSnapshot(url, { ...options, validate(html) {
  assert.ok(/<(?:title|h1)\b/i.test(html) && !/service\.zol\.com\.cn\/checking/.test(html), "来源返回验证页，不作为产品证据");
} })); return cache.get(url); };
async function add(target, p, releasePage, rawRelease, year) {
  assert.ok(year >= minYears[target.brand] && year <= 2026, "型号年份超出约定范围");
  const specs = target.brand === "Apple" ? readAppleWearable(p) : readWearableRows(p, target);
  const extraPages = [], excludedFields = [];
  // 有明确来源冲突时先撤下可疑值，不能因为第三方给出了字段就当成定论。
  for (const [field, exclusion] of Object.entries(target.exclusions ?? {})) {
    const conflict = await page(exclusion.url);
    const text = plainText(conflict.html);
    const raw = text.match(new RegExp(exclusion.pattern))?.[0];
    assert.ok(raw && text.includes(exclusion.model), `${field}: 冲突来源型号或原文缺失`);
    extraPages.push(conflict.url);
    excludedFields.push({ field, reason: exclusion.reason, rejectedEvidence: specs[field], conflictEvidence: evidence(conflict, raw, raw) });
    delete specs[field];
  }
  // 具体参数页标题可消除通用表带/尺寸行的歧义；补充页必须是已核验的准确型号。
  const additions = [{ page: p, fields: target.paramSupplement ?? {} }, { page: releasePage, fields: target.supplement ?? {} }];
  if (target.additionalSpecs) {
    const extra = await page(target.additionalSpecs.url);
    const title = plainText(extra.html.match(/<title\b[^>]*>([^]*?)<\/title>/i)?.[1] ?? "");
    assert.ok(title.includes(target.additionalSpecs.model), "补充规格页型号不符（重定向目录不作为证据）");
    extraPages.push(extra.url);
    additions.push({ page: extra, fields: target.additionalSpecs.fields });
    if (isOfficial(extra.url) && ["Huawei", "HONOR", "vivo"].includes(target.brand)
      && (target.additionalSpecs.galleryColors || target.brand === "Huawei")) {
      const baseModel = target.additionalSpecs.model.replace(/ 规格参数$/, "");
      const colors = readOfficialColorGallery(extra.html, { ...target, modelName: baseModel }, extra.url).colors
        .filter(color => color.url && (!target.additionalSpecs.galleryColors || target.additionalSpecs.galleryColors.includes(color.name)))
        .map(color => ({ name: color.name, image: asset(color, target, extra) }));
      if (colors.length) galleries[target.id] = { modelName: target.modelName, sourceUrl: extra.url, sourceName: `${target.brand} 中国官网`,
        fetchedAt: extra.fetchedAt, sourceSnapshotHash: extra.sha256, colors: mergeColorImages(galleries[target.id]?.colors, colors) };
    }
  }
  for (const { page: origin, fields } of additions) {
    for (const [key, pattern] of Object.entries(fields)) {
      const raw = pageText(origin).match(new RegExp(pattern))?.[0];
      assert.ok(raw, `${key}: 补充来源原文缺失`);
      const inches = key === "screenSize" && raw.match(/^(\d+(?:\.\d+)?)\s*英寸(?:屏幕)?$/);
      specs[key] = inches ? evidence(origin, Number(inches[1]), raw, "inch")
        : evidence(origin, key === "colors" ? raw.split(/[，,、/]/).map(value => value.trim()).filter(Boolean) : raw, raw);
    }
  }
  for (const key of ["healthFeatures", "wearableFeatures"]) {
    if (specs[key] && /健康|监测|血|心率|研究|风险/.test(specs[key].value)) specs[key].note = [specs[key].note,
      "健康记录、研究和风险提示不等于医疗诊断；适用地区、年龄和手机系统限制以原页说明为准。"].filter(Boolean).join(" ");
  }
  const launch = launchPrices[target.id];
  if (launch) {
    assert.ok(plainText(releasePage.html).includes(launch.pattern), "首发价格版型原文未找到");
    assert.ok(launch.pattern.replace(/(?<=\d),(?=\d)/g, "").includes(String(launch.value)), "首发价格与原文不一致");
    specs.launchPrice = { ...evidence(releasePage, launch.value, launch.pattern, "CNY"),
      priceType: "launch", market: "中国大陆", configuration: `国行 ${target.modelName}`, condition: launch.condition ?? "首发全新",
      sourceName: isOfficial(releasePage.url) ? `${target.brand} 中国官网`
        : releasePage.url.includes("ithome.com") ? "IT之家发布报道" : releasePage.url.includes("mydrivers.com") ? "快科技发布报道" : "产品发布报道" };
  }
  assert.ok(Object.keys(specs).length >= 4, "参数不足，不发布空型号");
  const device = makeDevice(target, year, specs);
  const urls = [...new Set([p.url, releasePage.url, target.overview, ...extraPages].filter(Boolean))];
  const source = { id: device.id, modelName: device.modelName, generation: String(year), releaseYear: year,
    sourcePageType: "wearable_spec_snapshots", sourceStatus: "verified", releaseDatePrecision: "year",
    releaseEvidence: evidence(releasePage, String(year), rawRelease), referenceUrls: urls,
    ...(target.brand === "Apple" ? { supportUrl: p.url, officialSpecUrl: p.url } : {}),
    fieldGaps: required[target.category].filter(key => specs[key]?.value == null).map(field => ({ field, reason: "本型号原页未提供可明确归属的参数；不借同系列或其他版本填补" })),
    ...(excludedFields.length ? { excludedFields } : {}),
    notes: "尺寸、网络、材质版本条件保留；健康记录不用于医疗诊断。首发价、当前价、二手价无明确对应证据时留空。" };
  const previous = previousSources.get(device.id);
  if (previous?.colorVersionVerification) {
    const verification = previous.colorVersionVerification, origin = await page(verification.sourceUrl);
    assert.equal(origin.sha256, verification.sourceSnapshotHash);
    assert.ok(plainText(origin.html).includes(verification.rawText));
    assert.deepEqual(specs.colors?.value, verification.allowedColors, "再次采集不能恢复已拒绝的原配颜色组合");
    source.colorVersionVerification = verification;
    source.rejectedColorNames = previous.rejectedColorNames;
    if (galleries[device.id]) galleries[device.id].colors = galleries[device.id].colors.filter(color => !source.rejectedColorNames.includes(color.name));
  }
  let image, imagePage = p;
  if (target.brand === "Apple") image = readAppleProductImage(p.html, device);
  else if (target.overview) {
    imagePage = await page(target.overview);
    const heading = plainText(imagePage.html.match(/<h1\b[^>]*>([^]*?)<\/h1>/i)?.[1] ?? "");
    const compact = value => value.replace(/[\s()（）]/g, "").replace(/参数$/, "").toLowerCase();
    assert.ok(compact(heading).includes(compact(target.sourceName)), "主图来源页具体型号不符");
    image = imagePage.url.includes("pconline.com.cn")
      ? readPconlineProductImage(imagePage.html, { modelName: target.sourceName }) : extractZolProductImage(imagePage.html);
  } else if (isOfficial(p.url) && ["Huawei", "HONOR", "vivo"].includes(target.brand)) {
    const gallery = readOfficialColorGallery(p.html, { ...device, modelName: target.sourceName }, p.url);
    const matching = gallery.colors.filter(color => color.url && (!target.galleryColors || target.galleryColors.includes(color.name)));
    image = target.primaryColor ? matching.find(color => color.name === target.primaryColor) : gallery.image;
    if (target.primaryColor) assert.ok(image, "本版型指定配色主图缺失，不能借另一尺寸或材质照片");
    const colors = matching.map(color => ({ name: color.name, image: asset(color, target, p) }));
    if (colors.length) galleries[device.id] = { modelName: device.modelName, sourceUrl: p.url, sourceName: `${target.brand} 中国官网`,
      fetchedAt: p.fetchedAt, sourceSnapshotHash: p.sha256, colors: mergeColorImages(galleries[device.id]?.colors, colors) };
  }
  // 同型号配色使用各自准确型号页的主图；不从图集猜颜色或拿同系列机型替代。
  if (target.colorImages?.length) {
    const colors = [];
    for (const color of target.colorImages) {
      const origin = await page(color.url);
      const heading = plainText(origin.html.match(/<h1\b[^>]*>([^]*?)<\/h1>/i)?.[1] ?? "");
      assert.equal(heading, color.sourceName, "配色图片页具体型号不符");
      assert.ok(plainText(origin.html).includes(color.name), "配色图片页颜色原文缺失");
      const photo = extractZolProductImage(origin.html);
      assert.ok(photo && safeImageUrl(photo.url), "配色图片页未取得可核验图片");
      colors.push({ name: color.name, image: asset(photo, target, origin) });
      urls.push(origin.url);
    }
    galleries[device.id] = { modelName: device.modelName, sourceUrl: imagePage.url, sourceName: "中关村在线",
      fetchedAt: imagePage.fetchedAt, sourceSnapshotHash: imagePage.sha256,
      colors: mergeColorImages(galleries[device.id]?.colors, colors) };
  }
  if (image && safeImageUrl(image.url)) { images[device.id] = asset(image, target, imagePage); source.productImages = { primary: images[device.id], licenseStatus: "unknown" }; }
  else source.imageFieldGaps = [{ field: "defaultImage", reason: "未取得本型号可核验图片，不使用相似机型替代" }];
  if (galleries[device.id]) source.productImages = { ...source.productImages, colors: galleries[device.id].colors, licenseStatus: "unknown" };
  devices.push(device); sources.push({ ...source, category: target.category });
  inventory.push({ id: device.id, modelName: device.modelName, category: target.category, releaseYear: year, status: "present", sourceUrls: urls });
}

// Apple 官方目录直接提供推出年份和技术规格链接；原页面无年份时不按型号数字推测。
const appleCatalog = await page("https://support.apple.com/zh-cn/docs/watch");
const appleLinks = [...new Set([...appleCatalog.html.matchAll(/href="(https:\/\/support\.apple\.com\/zh-cn\/docs\/watch\/(?:pl\d+|30\d+))"/g)].map(m => m[1]))];
for (const url of appleLinks) {
  try {
    const model = await page(url), text = plainText(model.html);
    const title = plainText(model.html.match(/<h1\b[^>]*>([^]*?)<\/h1>/i)?.[1] ?? "");
    const yearMatch = text.match(/推出年份[：:]\s*(20\d{2})/); if (!yearMatch || +yearMatch[1] < minYears.Apple) continue;
    const specUrl = [...model.html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([^]*?)<\/a>/g)].find(m => plainText(m[2]) === "技术规格")?.[1];
    assert.ok(specUrl && title.startsWith("Apple Watch"), "目录型号或技术规格链接无效");
    const suffix = title.match(/Series\s*(\d+)/)?.[1], ultra = title.match(/Ultra\s*(\d*)/)?.[1], se = title.includes("SE");
    const year = Number(yearMatch[1]);
    const id = suffix ? `apple-watch-series-${suffix}-${year}` : se ? `apple-watch-se-${year}` : ultra !== undefined ? `apple-watch-ultra${ultra ? `-${ultra}` : ""}-${year}` : null;
    if (!id) continue;
    await add({ id, brand: "Apple", category: "watch", modelName: title, family: se ? "Apple Watch SE" : ultra !== undefined ? "Apple Watch Ultra" : "Apple Watch", variant: "standard" }, await page(specUrl), model, yearMatch[0], year);
  } catch (error) { blocked.push({ brand: "Apple", sourceUrl: url, reason: error.message }); }
}
for (const target of targets) {
  try {
    const p = await page(target.params), title = plainText(p.html.match(/<h1\b[^>]*>([^]*?)<\/h1>/i)?.[1] ?? "");
    const normalize = s => s.replace(/[\s()（）]/g, "").toLowerCase();
    assert.ok(normalize(title).includes(normalize(target.sourceName)), "具体参数页型号不符");
    const release = await page(target.releaseUrl), text = plainText(release.html);
    const raw = text.match(new RegExp(target.releasePattern))?.[0];
    assert.ok(raw && new RegExp(`${target.year}[/-]\\d{1,2}[/-]\\d{1,2}|${target.year}\\s*年`).test(text), "缺少本型号发布原文或准确年份");
    await add(target, p, release, raw, target.year);
  } catch (error) { blocked.push({ ...target, reason: error.message }); }
}
assert.equal(new Set(devices.map(d => d.id)).size, devices.length, "同机型不得重复");
if (process.argv.includes("--check")) { console.log(JSON.stringify({ devices: devices.length, blocked }, null, 2)); process.exit(blocked.length ? 1 : 0); }
assert.equal(blocked.length, 0, `来源校验失败，保留全部既有数据：${JSON.stringify(blocked)}`);
// 目录缩减/页面结构变化也不能静默删除上一批已经发布的型号。
for (const brand of Object.keys(minYears)) {
  let previous;
  try { previous = JSON.parse(await fs.readFile(`src/data/${brand.toLowerCase()}-wearable-devices-db.json`, "utf8")); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  for (const device of previous?.devices ?? []) assert.ok(devices.some(row => row.id === device.id), `${device.id}: 本次缺失，保留既有批次`);
}
for (const brand of Object.keys(minYears)) {
  const rows = devices.filter(d => d.brand === brand); if (!rows.length) continue;
  const slug = brand.toLowerCase(), base = `${slug}-wearable`;
  const metadata = { version: "1.0", generatedAt: asOf, totalDevices: rows.length,
    coverage: { market: "CN", minReleaseYear: minYears[brand], asOf, partial: true },
    catalogAudit: { catalogSources: brand === "Apple" ? [appleCatalog.url] : [],
      inventory: inventory.filter(i => rows.some(d => d.id === i.id)), blocked: blocked.filter(b => b.brand === brand),
      pending: [{ category: "watch/band", reason: "已核验型号分批扩充；仍需核对剩余历史、儿童款、网络/尺寸版本和彩色图库，全品牌全集未完成" }] } };
  await fs.writeFile(`src/data/${base}-devices-db.json`, JSON.stringify({ metadata, devices: rows }, null, 2) + "\n");
  await fs.writeFile(`src/data/${base}-sources.json`, JSON.stringify({ watch: sources.filter(s => s.category === "watch" && rows.some(d => d.id === s.id)),
    band: sources.filter(s => s.category === "band" && rows.some(d => d.id === s.id)) }, null, 2) + "\n");
}
await fs.writeFile("src/data/device-images.json", JSON.stringify(images, null, 2) + "\n");
await fs.writeFile("src/data/device-image-galleries.json", JSON.stringify(galleries, null, 2) + "\n");
console.log(JSON.stringify({ devices: devices.length, categories: Object.fromEntries(["watch", "band"].map(c => [c, devices.filter(d => d.category === c).length])), blocked }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
