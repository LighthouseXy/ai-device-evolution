import fs from "node:fs/promises";
import { getSourceSnapshot } from "./lib/source-snapshot.mjs";

const urls = {
  launch24: "https://www.ithome.com/0/735/954.htm",
  launch25: "https://www.ithome.com/0/821/829.htm",
  screen25: "https://g.pconline.com.cn/product/notebook/redmi/2498099_detail.html",
};
const pages = {};
for (const [key, url] of Object.entries(urls)) {
  const page = await getSourceSnapshot(url, { offline: process.argv.includes("--offline"), refresh: process.argv.includes("--refresh") });
  const text = page.html.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/\s+/g, " ").trim();
  if (!new RegExp(`(?:Redmi|REDMI)\\s*Book 14 20${key.endsWith("24") ? "24" : "25"}`, "i").test(text)) throw new Error(`${url}: wrong model page`);
  pages[key] = { ...page, text };
}
function field(value, key, pattern, unit) {
  const page = pages[key];
  const rawText = page.text.match(pattern)?.[0];
  if (!rawText) throw new Error(`${key}: missing ${pattern}`);
  return { value, ...(unit ? { unit } : {}), rawText, evidenceKind: "excerpt", sourceUrl: urls[key],
    sourceType: "reference", confidence: 0.8, verifiedAt: page.fetchedAt.slice(0, 10),
    fetchedAt: page.fetchedAt, sourceSnapshotHash: page.sha256 };
}
const rows = [
  { key: "launch24", modelYear: 2024, releaseYear: 2023, releaseDate: "2023-11-29", order: 1,
    chip: "英特尔酷睿 i5-13500H", offers: [["16GB", "512GB", 4199], ["16GB", "1TB", 4499]] },
  { key: "launch25", modelYear: 2025, releaseYear: 2025, releaseDate: "2025-01-02", order: 2,
    chip: "英特尔酷睿 5 220H", offers: [["16GB", "512GB", 4599], ["16GB", "1TB", 4899], ["32GB", "1TB", 5199]] },
];
const devices = rows.map(({ key, modelYear, releaseYear, releaseDate, order, chip, offers }) => {
  const is24 = modelYear === 2024;
  const segment = pages[key].text.match(is24
    ? /小米 Redmi Book 14 2024[^]*?i5-13500H \+ 16G \+ 512G：4199 元[^]*?i5-13500H \+ 16G \+ 1T：4499 元/
    : /REDMI Book 14 2025[^]*?16GB \+ 512GB 首发价 4599 元[^]*?32GB \+ 1TB 首发价 5199 元/)?.[0];
  if (!segment) throw new Error(`${key}: price segment missing`);
  const pattern = (memory, storage, price) => is24
    ? new RegExp(`i5-13500H \\+ ${memory.replace("GB", "G")} \\+ ${storage.replace("GB", "G").replace("TB", "T")}：${price} 元`)
    : new RegExp(`${memory} \\+ ${storage} 首发价 ${price} 元`);
  const configurations = offers.map(([memory, storage, price]) => {
    const offerPattern = pattern(memory, storage, price);
    if (!offerPattern.test(segment)) throw new Error(`${key}: ${memory}+${storage} absent from price segment`);
    return { chip, memory, storage, evidence: field(`${chip} + ${memory} + ${storage}`, key, offerPattern) };
  });
  const specs = {
    chip: field(chip, key, is24 ? /搭载 i5-13500H 处理器/ : /搭载英特尔 酷睿 5 220H 处理器/),
    memory: field(is24 ? "16GB" : "16GB / 32GB", key, is24
      ? /i5-13500H \+ 16G \+ 512G：4199 元[^]*?i5-13500H \+ 16G \+ 1T：4499 元/
      : /16GB \+ 512GB 首发价 4599 元[^]*?32GB \+ 1TB 首发价 5199 元/),
    storage: field("512GB / 1TB", key, is24
      ? /i5-13500H \+ 16G \+ 512G：4199 元[^]*?i5-13500H \+ 16G \+ 1T：4499 元/
      : /16GB \+ 512GB 首发价 4599 元[^]*?32GB \+ 1TB 首发价 5199 元/),
    screenSize: field(14, key, is24 ? /14 英寸 2.8K 屏/ : /REDMI Book 14 2025 搭载 2.8K 120Hz 屏/, "inch"),
    ...(!is24 ? { displayType: field("LCD", "screen25", /屏幕类型 LCD屏/) } : {}),
    resolution: field("2.8K", key, is24 ? /14 英寸 2.8K 屏/ : /REDMI Book 14 2025 搭载 2.8K 120Hz 屏/),
    refreshRate: field(120, key, is24 ? /120Hz 刷新率/ : /2.8K 120Hz 屏/, "Hz"),
    ...(is24 ? { port: field("雷电 4 / USB-A / HDMI / 3.5mm", key, /接口包括一个雷电 4、三个 USB-A、一个 HDMI 以及一个 3.5mm 音频接口/) } : {}),
    launchPrice: { ...field(offers[0][2], key, pattern(offers[0][0], offers[0][1], offers[0][2]), "CNY"),
      priceType: "launch", market: "中国大陆", configuration: `${chip} + ${offers[0][0]} 运行内存 + ${offers[0][1]} 存储，国行`,
      condition: is24 ? "中国大陆首销价；不等于建议零售价" : "中国大陆首发定价；不含后续补贴" },
  };
  return { id: `redmi-book-14-${modelYear}`, brand: "Xiaomi", market: "CN", category: "laptop",
    series: "REDMI Book 14", family: "REDMI Book 14", variant: "standard", modelName: `REDMI Book 14 (${modelYear})`,
    generation: String(modelYear), generationOrder: order, releaseYear, releaseDate,
    comparisonGroupId: "xiaomi.laptop.redmi-book-14.standard", configurations, specs, computed: {} };
});
const sources = { laptop: devices.map((device, index) => ({ id: device.id, modelName: device.modelName,
  generation: device.generation, releaseYear: device.releaseYear, sourcePageType: "reference_snapshots",
  sourceStatus: "verified", referenceUrls: [urls[rows[index].key], ...(index ? [urls.screen25] : [])],
  notes: "中国大陆发布报道明确列出的酷睿配置；2024 款实际于 2023 年发布，未拼接其他处理器或焕新版 SKU。屏幕分辨率按报道的 2.8K 表述，非精确像素值；2024 款面板类型暂缺明确证据。" })) };
const generatedAt = Object.values(pages).map((page) => page.fetchedAt.slice(0, 10)).sort().at(-1);
await fs.writeFile("src/data/redmi-book-devices-db.json", `${JSON.stringify({ metadata: { version: "1.0", totalDevices: devices.length, generatedAt }, devices }, null, 2)}\n`);
await fs.writeFile("src/data/redmi-book-sources.json", `${JSON.stringify(sources, null, 2)}\n`);
console.log(JSON.stringify({ devices: devices.length, configurations: devices.reduce((total, device) => total + device.configurations.length, 0) }));
