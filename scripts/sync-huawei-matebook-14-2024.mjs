import fs from "node:fs/promises";
import { getSourceSnapshot } from "./lib/source-snapshot.mjs";

const urls = {
  specs: "https://consumer.huawei.com/cn/laptops/matebook-14-2024/specs/",
  price: "https://www.ithome.com/0/768/168.htm",
  specs26: "https://consumer.huawei.com/cn/harmonyos-computer/matebook-14-harmonyos-version/specs/",
  price26: "https://www.ithome.com/0/941/273.htm",
};
const pages = {};
for (const [key, url] of Object.entries(urls)) {
  const page = await getSourceSnapshot(url, { offline: process.argv.includes("--offline"), refresh: process.argv.includes("--refresh") });
  if (page.html.includes("\uFFFD")) throw new Error(`${url}: broken encoding`);
  const text = page.html.replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ").replace(/\s+/g, " ").trim();
  if (!text.includes("MateBook 14")) throw new Error(`${url}: wrong product page`);
  pages[key] = { ...page, text };
}
function field(value, key, pattern, unit) {
  const page = pages[key];
  const rawText = page.text.match(pattern)?.[0];
  if (!rawText) throw new Error(`${key}: missing ${pattern}`);
  const official = key.startsWith("specs");
  return { value, ...(unit ? { unit } : {}), rawText, evidenceKind: "excerpt",
    sourceUrl: urls[key], sourceType: official ? "official" : "reference", confidence: official ? 1 : 0.8,
    verifiedAt: page.fetchedAt.slice(0, 10), fetchedAt: page.fetchedAt, sourceSnapshotHash: page.sha256 };
}
const offers = [
  ["Ultra 5 125H", "16GB", "512GB", 6099],
  ["Ultra 5 125H", "16GB", "1TB", 6499],
  ["Ultra 5 125H", "32GB", "1TB", 7399],
  ["Ultra 7 155H", "32GB", "1TB", 8499],
];
const configurations = offers.map(([chip, memory, storage, price]) => {
  const rawStorage = storage === "1TB" ? "1TB" : "512GB";
  const pattern = new RegExp(`${chip.replace(" 125H", "").replace(" 155H", "")}\\/${memory} \\/ ${rawStorage}，售价 ${price} 元`);
  return { chip: `英特尔酷睿 ${chip}`, memory, storage,
    evidence: field(`${chip} / ${memory} / ${storage}`, "price", pattern) };
});
const specs = {
  chip: field("英特尔酷睿 Ultra 5 125H / 英特尔酷睿 Ultra 7 155H", "specs", /英特尔® 酷睿™ Ultra 7 155H 处理器[\s\S]+?英特尔® 酷睿™ Ultra 5 125H 处理器/),
  memory: field("16GB / 32GB", "price", /Ultra 5\/16GB \/ 512GB，售价 6099 元[\s\S]+?Ultra 7\/32GB \/ 1TB，售价 8499 元/),
  storage: field("512GB / 1TB", "price", /Ultra 5\/16GB \/ 512GB，售价 6099 元[\s\S]+?Ultra 7\/32GB \/ 1TB，售价 8499 元/),
  screenSize: field(14.2, "specs", /尺寸 14.2 英寸/, "inch"),
  displayType: field("OLED", "specs", /类型 OLED/),
  resolution: field("2880x1920", "specs", /分辨率 2880 × 1920/),
  port: field("USB-C（全功能） / USB-A / HDMI / 3.5mm", "specs", /接口 USB-C 接口 × 1（全功能） USB3.2 Gen1 × 2 HDMI × 1 3.5 mm 耳机/),
  launchPrice: { ...field(6099, "price", /Ultra 5\/16GB \/ 512GB，售价 6099 元/, "CNY"),
    priceType: "launch", market: "中国大陆", configuration: "酷睿 Ultra 5 125H + 16GB 运行内存 + 512GB 存储，国行 Windows 版",
    condition: "中国大陆上市定价；不含后续促销或补贴" },
};
const device = { id: "huawei-matebook-14-2024", brand: "Huawei", market: "CN", category: "laptop",
  series: "HUAWEI MateBook 14", family: "HUAWEI MateBook 14", variant: "standard",
  modelName: "HUAWEI MateBook 14 (2024)", generation: "2024", generationOrder: 1,
  releaseYear: 2024, releaseDate: "2024-05-15", comparisonGroupId: "huawei.laptop.matebook-14.standard",
  configurations, specs, computed: {} };
const offerRows26 = [["24GB", "512GB", 6599], ["24GB", "1TB", 7599], ["32GB", "1TB", 8599]];
const segment26 = pages.price26.text.match(/24GB RAM \+ 512GB SSD：6599 元[\s\S]+?32GB RAM \+ 1TB SSD：8599 元/)?.[0];
if (!segment26) throw new Error("price26: HarmonyOS standard-screen price segment missing");
const configurations26 = offerRows26.map(([memory, storage, price]) => {
  const pattern = new RegExp(`${memory} RAM \\+ ${storage} SSD：${price} 元`);
  if (!pattern.test(segment26)) throw new Error(`price26: ${memory}+${storage} standard-screen offer missing`);
  return { chip: "麒麟 X90", memory, storage, evidence: field(`${memory} + ${storage}`, "price26", pattern) };
});
const specs26 = {
  chip: field("麒麟 X90", "specs26", /CPU 麒麟 X90/),
  memory: field("24GB / 32GB", "specs26", /内存 24 GB \/ 32 GB/),
  storage: field("512GB / 1TB", "specs26", /存储 512 GB \/ 1 TB/),
  screenSize: field(14.2, "specs26", /尺寸 14.2 英寸/, "inch"),
  displayType: field("OLED（抗反射屏）", "specs26", /类型 OLED（抗反射屏）/),
  resolution: field("2880x1920", "specs26", /分辨率 2880 × 1920/,),
  port: field("USB-C / USB-A / HDMI / 3.5mm", "specs26", /左侧：HDMI2.1 TMDS × 1；USB-C × 1\*；USB -A × 1\*\*；3.5 mm 耳机和麦克风二合一接口/),
  launchPrice: { ...field(6599, "price26", /24GB RAM \+ 512GB SSD：6599 元/, "CNY"),
    priceType: "launch", market: "中国大陆", configuration: "麒麟 X90 + 24GB 运行内存 + 512GB 存储，国行标准屏版",
    condition: "中国大陆发布定价；鸿蒙版，不与 Windows 版配置混用" },
};
const harmonyDevice = { id: "huawei-matebook-14-harmonyos-2026", brand: "Huawei", market: "CN", category: "laptop",
  series: "HUAWEI MateBook 14", family: "HUAWEI MateBook 14", variant: "standard",
  modelName: "HUAWEI MateBook 14 鸿蒙版 (2026)", generation: "2026 鸿蒙版", generationOrder: 2,
  releaseYear: 2026, releaseDate: "2026-04-20", comparisonGroupId: "huawei.laptop.matebook-14.standard",
  configurations: configurations26, specs: specs26, computed: {} };
const devices = [device, harmonyDevice];
const sources = { laptop: [{ id: device.id, modelName: device.modelName, generation: device.generation,
  releaseYear: device.releaseYear, sourcePageType: "official_and_reference_snapshots", sourceStatus: "verified",
  officialSpecUrl: urls.specs, referenceUrls: [urls.price],
  notes: "中国大陆上市报道中的四个 Windows 配置；官网规格页含其他系统版本，未将其笛卡尔组合为在售 SKU。" },
  { id: harmonyDevice.id, modelName: harmonyDevice.modelName, generation: harmonyDevice.generation,
    releaseYear: harmonyDevice.releaseYear, sourcePageType: "official_and_reference_snapshots", sourceStatus: "verified",
    officialSpecUrl: urls.specs26, referenceUrls: [urls.price26],
    notes: "鸿蒙版，仅列发布报道中的标准屏组合；Windows 软件兼容性不可从上一代直接推断。" }] };
const generatedAt = Object.values(pages).map((page) => page.fetchedAt.slice(0, 10)).sort().at(-1);
await fs.writeFile("src/data/huawei-matebook-devices-db.json", `${JSON.stringify({ metadata: { version: "1.0", totalDevices: devices.length, generatedAt }, devices }, null, 2)}\n`);
await fs.writeFile("src/data/huawei-matebook-sources.json", `${JSON.stringify(sources, null, 2)}\n`);
console.log(JSON.stringify({ devices: devices.length, configurations: configurations.length + configurations26.length }));
