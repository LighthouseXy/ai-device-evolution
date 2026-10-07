import fs from "node:fs/promises";
import { getSourceSnapshot } from "./lib/source-snapshot.mjs";

const urls = {
  launch24: "https://www.ithome.com/0/806/317.htm",
  specs24: "https://detail.zol.com.cn/series/702/613/param_10907304_0_1.html",
  launch26: "https://m.ithome.com/html/907078.htm",
  specs26: "https://consumer.huawei.com/cn/tablets/matepad-11-5-2026/specs/",
};
const pages = {};
for (const [key, url] of Object.entries(urls)) {
  const page = await getSourceSnapshot(url, { offline: process.argv.includes("--offline"), refresh: process.argv.includes("--refresh") });
  if (page.html.includes("\uFFFD")) throw new Error(`${url}: broken encoding`);
  const text = page.html.replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ").replace(/\s+/g, " ").trim();
  if (!text.includes("MatePad 11.5") || !text.includes(key.endsWith("24") ? "2024" : "2026")) throw new Error(`${url}: wrong product page`);
  pages[key] = { ...page, text };
}
function field(value, key, pattern, unit) {
  const page = pages[key];
  const rawText = page.text.match(pattern)?.[0];
  if (!rawText) throw new Error(`${key}: missing ${pattern}`);
  const official = key === "specs26";
  return { value, ...(unit ? { unit } : {}), rawText, evidenceKind: "excerpt",
    sourceUrl: urls[key], sourceType: official ? "official" : "reference", confidence: official ? 1 : 0.8,
    verifiedAt: page.fetchedAt.slice(0, 10), fetchedAt: page.fetchedAt, sourceSnapshotHash: page.sha256 };
}
const definitions = [
  { suffix: "24", modelYear: 2024, releaseYear: 2024, releaseDate: "2024-10-30", order: 1,
    configurations: [["8GB", "128GB", 1699], ["8GB", "256GB", 1899]], chip: "麒麟 8000" },
  { suffix: "26", modelYear: 2026, releaseYear: 2025, releaseDate: "2025-12-22", order: 2,
    configurations: [["8GB", "128GB", 1799]], chip: "麒麟 T82B" },
];
const devices = definitions.map((definition) => {
  const { suffix, modelYear, releaseYear, releaseDate, order, configurations: offerRows, chip } = definition;
  const launchKey = `launch${suffix}`;
  const specsKey = `specs${suffix}`;
  const pricePattern = (memory, storage, price) => suffix === "24"
    ? new RegExp(`${memory} \\+ ${storage} Wi-Fi 版 ${price} 元`)
    : new RegExp(`WiFi ${memory}\\+${storage}：${price} 元`);
  const standardPrices = pages[launchKey].text.match(suffix === "24"
    ? /8GB \+ 128GB Wi-Fi 版 1699 元[\s\S]+?8GB \+ 256GB Wi-Fi 柔光版 2099 元/
    : /WiFi 8GB\+128GB：1799 元[\s\S]+?全网通 8GB\+256GB：2799 元/)?.[0];
  if (!standardPrices) throw new Error(`${launchKey}: standard price segment missing`);
  const configurations = offerRows.map(([memory, storage, price]) => {
    const pattern = pricePattern(memory, storage, price);
    if (!pattern.test(standardPrices)) throw new Error(`${launchKey}: standard ${memory}+${storage} not found`);
    return { memory, storage, evidence: field(`${memory} + ${storage}`, launchKey, pattern) };
  });
  const specs = suffix === "24" ? {
    chip: field(chip, launchKey, /处理器更换为麒麟 8000/),
    memory: field("8GB", launchKey, /8GB \+ 128GB Wi-Fi 版 1699 元[\s\S]+?8GB \+ 256GB Wi-Fi 版 1899 元/),
    storage: field("128GB / 256GB", launchKey, /8GB \+ 128GB Wi-Fi 版 1699 元[\s\S]+?8GB \+ 256GB Wi-Fi 版 1899 元/),
    screenSize: field(11.5, launchKey, /MatePad 11.5 英寸 2024 款/, "inch"),
    displayType: field("TFT LCD（IPS）", specsKey, /屏幕类型 TFT LCD（IPS）/),
    resolution: field("2200x1440", specsKey, /屏幕分辨率 2200\*1440/),
    port: field("USB Type-C", specsKey, /数据接口 USB Type-C/),
  } : {
    chip: field(chip, specsKey, /标准版：麒麟T82B/),
    memory: field("8GB", launchKey, /WiFi 8GB\+128GB：1799 元/),
    storage: field("128GB", launchKey, /WiFi 8GB\+128GB：1799 元/),
    screenSize: field(11.5, specsKey, /尺寸 11.5 英寸/, "inch"),
    displayType: field("IPS 触控屏", specsKey, /类型 IPS 触控屏/),
    resolution: field("2456x1600", specsKey, /分辨率 2456 × 1600 像素/),
    port: field("USB Type-C（USB 2.0）", specsKey, /USB Type-C，支持 USB 2.0/),
  };
  specs.launchPrice = { ...field(offerRows[0][2], launchKey,
    pricePattern(offerRows[0][0], offerRows[0][1], offerRows[0][2]), "CNY"),
    priceType: "launch", market: "中国大陆", configuration: "Wi-Fi 标准屏，8GB 运行内存 + 128GB 存储，国行",
    condition: suffix === "24" ? "中国大陆上市定价 1699 元；首发优惠到手价 1599 元不作首发定价" : "中国大陆发布定价" };
  return { id: `huawei-matepad-11-5-${modelYear}`, brand: "Huawei", market: "CN", category: "tablet",
    series: "HUAWEI MatePad 11.5", family: "HUAWEI MatePad 11.5", variant: "standard",
    modelName: `HUAWEI MatePad 11.5 (${modelYear})`, generation: String(modelYear), generationOrder: order,
    releaseYear, releaseDate, comparisonGroupId: "huawei.tablet.matepad-11-5.standard",
    configurations, specs, computed: {} };
});
const sources = { tablet: devices.map((device) => ({ id: device.id, modelName: device.modelName,
  generation: device.generation, releaseYear: device.releaseYear,
  sourcePageType: device.generation === "2026" ? "official_and_reference_snapshots" : "reference_snapshots",
  sourceStatus: "verified", ...(device.generation === "2026" ? { officialSpecUrl: urls.specs26 } : {}),
  referenceUrls: device.generation === "2026" ? [urls.launch26] : [urls.launch24, urls.specs24],
  notes: "仅 Wi-Fi 标准屏配置；柔光版和全网通版价格、芯片不得混用。2024 芯片据国内媒体报道，非官网规格。" })) };
const generatedAt = Object.values(pages).map((page) => page.fetchedAt.slice(0, 10)).sort().at(-1);
await fs.writeFile("src/data/huawei-matepad-devices-db.json", `${JSON.stringify({ metadata: { version: "1.0", totalDevices: devices.length, generatedAt }, devices }, null, 2)}\n`);
await fs.writeFile("src/data/huawei-matepad-sources.json", `${JSON.stringify(sources, null, 2)}\n`);
console.log(JSON.stringify({ devices: devices.length, sourcePages: Object.keys(pages).length }));
