import fs from "node:fs/promises";
import { getSourceSnapshot } from "./lib/source-snapshot.mjs";

// Only the China launch configurations named in the two release articles are imported.
const urls = {
  launch6: "https://www.ithome.com/0/687/329.htm",
  specs6: "https://detail.zol.com.cn/1448/1447719/param.shtml",
  launch7: "https://www.ithome.com/0/806/236.htm",
  specs7: "https://detail.zol.com.cn/series/702/34645/param_10907284_0_1.html",
  proSpecs6: "https://detail.zol.com.cn/series/702/34645/param_10725213_0_1.html",
  proSpecs7: "https://detail.zol.com.cn/series/702/34645/param_10907264_0_1.html",
  launch8: "https://www.ithome.com/0/885/838.htm",
};
const pages = {};
for (const [key, url] of Object.entries(urls)) {
  const page = await getSourceSnapshot(url, { offline: process.argv.includes("--offline"), refresh: process.argv.includes("--refresh") });
  if (page.html.includes("\uFFFD")) throw new Error(`${url}: broken encoding`);
  const text = page.html.replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ").replace(/\s+/g, " ").trim();
  if (!(key.endsWith("6") ? /小米\s*平板\s*6/ : key.endsWith("7") ? /小米\s*平板\s*7/ : /小米\s*平板\s*8/).test(text)
    || (key.startsWith("proSpecs") && !/平板\s*\d+\s*[Pp]ro/.test(text))) throw new Error(`${url}: wrong product page`);
  pages[key] = { ...page, text };
}

function field(value, key, pattern, unit) {
  const page = pages[key];
  const rawText = page.text.match(pattern)?.[0];
  if (!rawText) throw new Error(`${key}: missing ${pattern}`);
  return { value, ...(unit ? { unit } : {}), rawText, evidenceKind: "excerpt",
    sourceUrl: urls[key], sourceType: "reference", confidence: 0.8,
    verifiedAt: page.fetchedAt.slice(0, 10), fetchedAt: page.fetchedAt, sourceSnapshotHash: page.sha256 };
}

function makeDevice(number) {
  const is6 = number === 6;
  const launchKey = `launch${number}`;
  const specsKey = `specs${number}`;
  const prices = is6
    ? [["6GB", "128GB", 1899], ["8GB", "128GB", 1999], ["8GB", "256GB", 2299]]
    : [["8GB", "128GB", 1999], ["8GB", "256GB", 2299], ["12GB", "256GB", 2599]];
  const segment = pages[launchKey].text.match(is6
    ? /小米平板 6 首销价：[\s\S]+?小米平板 6 Pro 首销价：/
    : /小米平板 7 8GB \+ 128GB 售价[\s\S]+?小米平板 7 Pro 8GB \+ 128GB 售价/)?.[0];
  if (!segment) throw new Error(`${launchKey}: standard-model price segment missing`);
  const configurations = prices.map(([memory, storage, price]) => {
    const pattern = is6
      ? new RegExp(`${memory}\\+${storage} 售价 ${price} 元`)
      : new RegExp(`${memory} \\+ ${storage} 售价 ${price} 元`);
    if (!pattern.test(segment)) throw new Error(`${launchKey}: ${memory}+${storage} not in standard-model segment`);
    return { memory, storage, evidence: field(`${memory} + ${storage}`, launchKey, pattern) };
  });
  const specs = {
    chip: field(is6 ? "骁龙 870" : "第三代骁龙 7+", launchKey,
      is6 ? /小米平板 6 采用骁龙 870 芯片/ : /小米平板 7 搭载第三代骁龙 7\+/),
    memory: field(is6 ? "6GB / 8GB" : "8GB / 12GB", launchKey,
      is6 ? /6GB\+128GB 售价 1899 元，[\s\S]+?8GB\+256GB 售价 2299 元/
        : /8GB \+ 128GB 售价 1999 元[\s\S]+?12GB \+ 256GB 售价 2599 元/),
    storage: field("128GB / 256GB", launchKey,
      is6 ? /6GB\+128GB 售价 1899 元，[\s\S]+?8GB\+256GB 售价 2299 元/
        : /8GB \+ 128GB 售价 1999 元[\s\S]+?12GB \+ 256GB 售价 2599 元/),
    screenSize: field(is6 ? 11 : 11.2, launchKey, is6 ? /小米平板 6 系列搭载 11 英寸的 2.8K 护眼屏/ : /11.2 英寸 3.2K 分辨率/, "inch"),
    displayType: field("LCD", specsKey, /LCD(?: 纠错)?/),
    resolution: field(is6 ? "2880x1800" : "3200x2136", specsKey,
      is6 ? /屏幕分辨率 2880×1800/ : /屏幕分辨率 3200\*2136/),
    ...(!is6 ? {
      refreshRate: field(144, launchKey, /支持 144Hz 高刷/, "Hz"),
      batteryCapacity: field(8850, launchKey, /8850mAh 电池/, "mAh"),
    } : {}),
    port: field("USB Type-C", specsKey, is6 ? /数据接口 USB Type-c/ : /数据接口 Type-C/),
    launchPrice: { ...field(prices[0][2], launchKey,
      is6 ? /6GB\+128GB 售价 1899 元/ : /8GB \+ 128GB 售价 1999 元/, "CNY"),
      priceType: "launch", market: "中国大陆", configuration: `${prices[0][0]} 运行内存 + ${prices[0][1]} 存储，国行`,
      condition: is6 ? "中国大陆首销价；非长期售价" : "中国大陆首发定价" },
  };
  return { id: `xiaomi-pad-${number}-${is6 ? 2023 : 2024}`, brand: "Xiaomi", market: "CN", category: "tablet",
    series: "Xiaomi Pad", family: "Xiaomi Pad", variant: "standard", modelName: `小米平板 ${number}`,
    generation: `Pad ${number}`, generationOrder: is6 ? 1 : 2,
    releaseYear: is6 ? 2023 : 2024, releaseDate: is6 ? "2023-04-18" : "2024-10-29",
    comparisonGroupId: "xiaomi.tablet.pad.standard", configurations, specs, computed: {} };
}

function makeProDevice(number) {
  const is6 = number === 6;
  const launchKey = `launch${number}`;
  const specsKey = `proSpecs${number}`;
  const prices = is6
    ? [["8GB", "128GB", 2399], ["8GB", "256GB", 2699], ["12GB", "256GB", 2999], ["12GB", "512GB", 3299]]
    : [["8GB", "128GB", 2499], ["8GB", "256GB", 2799], ["12GB", "256GB", 3099], ["12GB", "512GB", 3499]];
  const segment = pages[launchKey].text.match(is6
    ? /小米平板 6 Pro 首销价：[\s\S]+?小米平板 6 系列采用/
    : /小米平板 7 Pro 8GB \+ 128GB 售价[\s\S]+?小米平板 7 系列可选/)?.[0];
  if (!segment) throw new Error(`${launchKey}: Pro price segment missing`);
  const configurations = prices.map(([memory, storage, price]) => {
    const pattern = is6
      ? new RegExp(`${memory}\\+${storage} 售价 ${price} 元`)
      : new RegExp(`${memory} \\+ ${storage} 售价 ${price} 元`);
    if (!pattern.test(segment)) throw new Error(`${launchKey}: Pro ${memory}+${storage} not in segment`);
    return { memory, storage, evidence: field(`${memory} + ${storage}`, launchKey, pattern) };
  });
  const specs = {
    chip: field(is6 ? "骁龙 8+ Gen 1" : "第三代骁龙 8s", launchKey,
      is6 ? /小米平板 6 Pro 搭载骁龙 8\+ Gen 1 芯片/ : /小米平板 7 Pro 搭载第三代骁龙 8s/),
    memory: field("8GB / 12GB", launchKey, is6
      ? /小米平板 6 Pro 首销价：[\s\S]+?12GB\+512GB 售价 3299 元/
      : /小米平板 7 Pro 8GB \+ 128GB 售价[\s\S]+?12GB \+ 512GB 售价 3499 元/),
    storage: field("128GB / 256GB / 512GB", launchKey, is6
      ? /小米平板 6 Pro 首销价：[\s\S]+?12GB\+512GB 售价 3299 元/
      : /小米平板 7 Pro 8GB \+ 128GB 售价[\s\S]+?12GB \+ 512GB 售价 3499 元/),
    screenSize: field(is6 ? 11 : 11.2, launchKey, is6
      ? /小米平板 6 系列搭载 11 英寸的 2.8K 护眼屏/ : /11.2 英寸 3.2K 分辨率/, "inch"),
    displayType: field("LCD", specsKey, /屏幕类型 LCD/),
    resolution: field(is6 ? "2880x1800" : "3200x2136", specsKey,
      is6 ? /屏幕分辨率 2880x1800/ : /屏幕分辨率 3200×2136/),
    ...(!is6 ? {
      refreshRate: field(144, launchKey, /支持 144Hz 高刷/, "Hz"),
      batteryCapacity: field(8850, launchKey, /8850mAh 电池/, "mAh"),
    } : {}),
    port: field(is6 ? "USB Type-C" : "USB Type-C（USB 3.2 Gen 1）", specsKey,
      is6 ? /数据接口 USB Type-c/ : /数据接口 USB3.2 Gen1/),
    launchPrice: { ...field(prices[0][2], launchKey,
      is6 ? /8GB\+128GB 售价 2399 元/ : /8GB \+ 128GB 售价 2499 元/, "CNY"),
      priceType: "launch", market: "中国大陆", configuration: "8GB 运行内存 + 128GB 存储，国行标准屏版",
      condition: is6 ? "中国大陆首销价；非长期售价" : "中国大陆首发定价" },
  };
  return { id: `xiaomi-pad-${number}-pro-${is6 ? 2023 : 2024}`, brand: "Xiaomi", market: "CN", category: "tablet",
    series: "Xiaomi Pad Pro", family: "Xiaomi Pad Pro", variant: "standard", modelName: `小米平板 ${number} Pro`,
    generation: `Pad ${number} Pro`, generationOrder: is6 ? 1 : 2,
    releaseYear: is6 ? 2023 : 2024, releaseDate: is6 ? "2023-04-18" : "2024-10-29",
    comparisonGroupId: "xiaomi.tablet.pad-pro.standard", configurations, specs, computed: {} };
}

function makePad8(pro) {
  const prices = pro
    ? [["8GB", "128GB", 2799], ["8GB", "256GB", 3099], ["12GB", "256GB", 3399], ["12GB", "512GB", 3699], ["16GB", "512GB", 3899]]
    : [["8GB", "128GB", 2199], ["8GB", "256GB", 2499], ["12GB", "256GB", 2799]];
  const segment = pages.launch8.text.match(pro
    ? /小米平板 8 Pro：2799 元起[\s\S]+?京东 小米平板 8 Pro/
    : /小米平板 8：2199 元起[\s\S]+?京东 小米平板 8 2199 元起/)?.[0];
  if (!segment) throw new Error(`launch8: ${pro ? "Pro" : "standard"} price segment missing`);
  const pricePattern = (memory, storage, price) => new RegExp(`${memory} RAM \\+ ${storage} 存储：${price} 元`);
  const configurations = prices.map(([memory, storage, price]) => {
    const pattern = pricePattern(memory, storage, price);
    if (!pattern.test(segment)) throw new Error(`launch8: ${memory}+${storage} not in the right model segment`);
    return { memory, storage, evidence: field(`${memory} + ${storage}`, "launch8", pattern) };
  });
  const chip = pro ? "骁龙 8 至尊版" : "第四代骁龙 8s";
  const specs = {
    chip: field(chip, "launch8", pro
      ? /小米平板 8 Pro 搭载高通骁龙 8 至尊版移动平台/ : /小米平板 8 搭载第四代高通骁龙 8s 移动平台/),
    memory: field(pro ? "8GB / 12GB / 16GB" : "8GB / 12GB", "launch8", pro
      ? /小米平板 8 Pro：2799 元起[\s\S]+?16GB RAM \+ 512GB 存储：3899 元/
      : /小米平板 8：2199 元起[\s\S]+?12GB RAM \+ 256GB 存储：2799 元/),
    storage: field(pro ? "128GB / 256GB / 512GB" : "128GB / 256GB", "launch8", pro
      ? /小米平板 8 Pro：2799 元起[\s\S]+?16GB RAM \+ 512GB 存储：3899 元/
      : /小米平板 8：2199 元起[\s\S]+?12GB RAM \+ 256GB 存储：2799 元/),
    screenSize: field(11.2, "launch8", /11.2 英寸 3200x2136 分辨率 144Hz IPS LCD 屏幕/, "inch"),
    displayType: field("IPS LCD", "launch8", /IPS LCD 屏幕/),
    resolution: field("3200x2136", "launch8", /3200x2136 分辨率/),
    refreshRate: field(144, "launch8", /144Hz IPS LCD 屏幕/, "Hz"),
    batteryCapacity: field(9200, "launch8", /两款机型均搭载 9200 毫安时电池/, "mAh"),
    port: field("USB Type-C", "launch8", /机身底部匹配 USB-C 接口/),
    launchPrice: { ...field(prices[0][2], "launch8", pricePattern(prices[0][0], prices[0][1], prices[0][2]), "CNY"),
      priceType: "launch", market: "中国大陆", configuration: "8GB 运行内存 + 128GB 存储，国行标准屏版",
      condition: "中国大陆发布定价；柔光版另有价格，不混入" },
  };
  return { id: `xiaomi-pad-8${pro ? "-pro" : ""}-2025`, brand: "Xiaomi", market: "CN", category: "tablet",
    series: pro ? "Xiaomi Pad Pro" : "Xiaomi Pad", family: pro ? "Xiaomi Pad Pro" : "Xiaomi Pad",
    variant: "standard", modelName: `小米平板 8${pro ? " Pro" : ""}`, generation: `Pad 8${pro ? " Pro" : ""}`,
    generationOrder: 3, releaseYear: 2025, releaseDate: "2025-09-25",
    comparisonGroupId: `xiaomi.tablet.pad${pro ? "-pro" : ""}.standard`, configurations, specs, computed: {} };
}

const devices = [makeDevice(6), makeDevice(7), makePad8(false), makeProDevice(6), makeProDevice(7), makePad8(true)];
const sources = { tablet: devices.map((device) => ({ id: device.id, modelName: device.modelName,
  generation: device.generation, releaseYear: device.releaseYear, sourcePageType: "reference_snapshots",
  sourceStatus: "verified", referenceUrls: device.generationOrder === 3 ? [urls.launch8]
    : [urls[`launch${device.generationOrder + 5}`], urls[`${device.modelName.includes("Pro") ? "proSpecs" : "specs"}${device.generationOrder + 5}`]],
  notes: "中国大陆发布报道与对应型号参数页；配置矩阵仅列报道中的标准屏组合，柔光版不混入。" })) };
const generatedAt = Object.values(pages).map((page) => page.fetchedAt.slice(0, 10)).sort().at(-1);
await fs.writeFile("src/data/xiaomi-pad-devices-db.json", `${JSON.stringify({ metadata: { version: "1.0", totalDevices: devices.length, generatedAt }, devices }, null, 2)}\n`);
await fs.writeFile("src/data/xiaomi-pad-sources.json", `${JSON.stringify(sources, null, 2)}\n`);
console.log(JSON.stringify({ devices: devices.length, sourcePages: Object.keys(pages).length }));
