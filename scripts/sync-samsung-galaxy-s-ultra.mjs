import fs from "node:fs/promises";
import { getSourceSnapshot } from "./lib/source-snapshot.mjs";
import { verifyCameraScore } from "./lib/dxomark-snapshot.mjs";

const ROOT = new URL("../", import.meta.url);
const VERIFIED_AT = "2026-09-07";

const rows = [
  {
    id: "samsung-galaxy-s24-2024", modelName: "Samsung Galaxy S24", generation: "S24",
    generationOrder: 1, releaseYear: 2024, releaseDate: "2024-01-25", family: "Samsung Galaxy S",
    comparisonGroupId: "samsung.phone.galaxy-s.standard",
    officialUrl: "https://www.samsung.com.cn/smartphones/galaxy-s24/specs/",
    launchUrl: "https://www.samsung.com.cn/news/product/samsung-galaxy-s24-series-in-china/",
    launchReferenceUrl: "https://www.ithome.com/0/747/278.htm",
    launchPattern: /Galaxy S24 8GB\+256GB 售价 5499 元/, launchPrice: 5499,
    chip: "第三代骁龙 8 移动平台（for Galaxy）", screenSize: 6.2, resolution: "2340x1080", weight: 167,
    memory: "8GB / 12GB", storage: "256GB / 512GB", battery: "4000mAh",
    configurations: [{ memory: "8GB", storage: "256GB" }, { memory: "12GB", storage: "256GB" }, { memory: "8GB", storage: "512GB" }],
  },
  {
    id: "samsung-galaxy-s24-plus-2024", modelName: "Samsung Galaxy S24+", generation: "S24+",
    generationOrder: 1, releaseYear: 2024, releaseDate: "2024-01-25", family: "Samsung Galaxy S Plus",
    comparisonGroupId: "samsung.phone.galaxy-s-plus.standard",
    officialUrl: "https://www.samsung.com.cn/smartphones/galaxy-s24/specs/",
    launchUrl: "https://www.samsung.com.cn/news/product/samsung-galaxy-s24-series-in-china/",
    launchReferenceUrl: "https://www.ithome.com/0/747/278.htm",
    launchPattern: /Galaxy S24\+ 12GB\+256GB 售价 6999 元/, launchPrice: 6999,
    chip: "第三代骁龙 8 移动平台（for Galaxy）", screenSize: 6.7, resolution: "3120x1440", weight: 196,
    memory: "12GB", storage: "256GB / 512GB", battery: "4900mAh",
    configurations: [{ memory: "12GB", storage: "256GB" }, { memory: "12GB", storage: "512GB" }],
  },
  ...[false, true].map((plus) => ({
    id: `samsung-galaxy-s25${plus ? "-plus" : ""}-2025`, modelName: `Samsung Galaxy S25${plus ? "+" : ""}`, generation: `S25${plus ? "+" : ""}`,
    generationOrder: 2, releaseYear: 2025, releaseDate: "2025-02-11", family: plus ? "Samsung Galaxy S Plus" : "Samsung Galaxy S",
    comparisonGroupId: `samsung.phone.galaxy-s${plus ? "-plus" : ""}.standard`,
    officialUrl: "https://www.samsung.com.cn/smartphones/galaxy-s25/specs/",
    launchUrl: "https://www.samsung.com.cn/news/product/galaxy-s25-ai/",
    launchReferenceUrl: "https://www.samsung.com.cn/news/product/galaxy-s25-ai/", launchSourceType: "official",
    launchPattern: /其中Galaxy S25\+建议零售价6,999元起，Galaxy S25建议零售价5,999元起，两款机型均提供12GB\+256GB和12GB\+512GB两种存储规格/,
    launchPrice: plus ? 6999 : 5999, chip: "骁龙 8 至尊版移动平台（for Galaxy）",
    screenSize: plus ? 6.7 : 6.2, resolution: plus ? "3120x1440" : "2340x1080", weight: plus ? 190 : 162,
    memory: "12GB", storage: "256GB / 512GB", battery: plus ? "4900mAh" : "4000mAh",
    configurations: [{ memory: "12GB", storage: "256GB" }, { memory: "12GB", storage: "512GB" }],
  })),
  ...[false, true].map((plus) => ({
    id: `samsung-galaxy-s26${plus ? "-plus" : ""}-2026`, modelName: `Samsung Galaxy S26${plus ? "+" : ""}`, generation: `S26${plus ? "+" : ""}`,
    generationOrder: 3, releaseYear: 2026, releaseDate: "2026-02-26", family: plus ? "Samsung Galaxy S Plus" : "Samsung Galaxy S",
    comparisonGroupId: `samsung.phone.galaxy-s${plus ? "-plus" : ""}.standard`,
    officialUrl: "https://www.samsung.com.cn/smartphones/galaxy-s26/specs/",
    launchUrl: "https://www.samsung.com.cn/news/product/galaxy-s26/",
    launchReferenceUrl: "https://www.ithome.com/0/923/676.htm",
    launchPattern: plus ? /Galaxy S26\+ 12GB \+ 256GB 建议零售价 7999 元/ : /Galaxy S26 12GB \+ 256GB 建议零售价 6999 元/,
    launchPrice: plus ? 7999 : 6999, chip: "第五代骁龙 8 至尊版移动平台（for Galaxy）",
    screenSize: plus ? 6.7 : 6.3, resolution: plus ? "3120x1440" : "2340x1080", weight: plus ? 190 : 167,
    memory: "12GB", storage: plus ? "256GB / 512GB" : "256GB", battery: plus ? "4900mAh" : "4300mAh",
    configurations: plus ? [{ memory: "12GB", storage: "256GB" }, { memory: "12GB", storage: "512GB" }] : [{ memory: "12GB", storage: "256GB" }],
  })),
  {
    id: "samsung-galaxy-s24-ultra-2024", modelName: "Samsung Galaxy S24 Ultra", generation: "S24 Ultra",
    generationOrder: 1, releaseYear: 2024, releaseDate: "2024-01-25",
    officialUrl: "https://www.samsung.com.cn/smartphones/galaxy-s24-ultra/specs/",
    launchUrl: "https://www.samsung.com.cn/news/product/samsung-galaxy-s24-series-in-china/",
    launchReferenceUrl: "https://www.ithome.com/0/747/278.htm",
    chip: "第三代骁龙 8 移动平台（for Galaxy）", screenSize: 6.8, resolution: "3120x1440", weight: 232,
    memory: "12GB", storage: "256GB / 512GB / 1TB",
    configurations: [{ memory: "12GB", storage: "256GB" }, { memory: "12GB", storage: "512GB" }, { memory: "12GB", storage: "1TB" }],
    battery: "5000mAh", rearCamera: "2 亿像素主摄 + 1200 万像素超广角 + 5000 万像素长焦 + 1000 万像素长焦",
    telephoto: "5000 万像素 5 倍长焦 + 1000 万像素 3 倍长焦", launchPrice: 9699,
    dxomarkScore: 144, dxomarkProtocol: "Camera v5", dxomarkUrl: "https://www.dxomark.com/samsung-galaxy-s24-ultra-camera-test/",
  },
  {
    id: "samsung-galaxy-s25-ultra-2025", modelName: "Samsung Galaxy S25 Ultra", generation: "S25 Ultra",
    generationOrder: 2, releaseYear: 2025, releaseDate: "2025-02-14",
    officialUrl: "https://www.samsung.com.cn/smartphones/galaxy-s25-ultra/specs/",
    launchUrl: "https://www.samsung.com.cn/news/product/galaxy-s25-ai/",
    launchReferenceUrl: "https://www.ithome.com/0/830/095.htm",
    chip: "骁龙 8 至尊版移动平台（for Galaxy）", screenSize: 6.9, resolution: "3120x1440", weight: 218,
    memory: "12GB / 16GB", storage: "256GB / 512GB / 1TB",
    configurations: [{ memory: "12GB", storage: "256GB" }, { memory: "12GB", storage: "512GB" }, { memory: "16GB", storage: "1TB" }],
    battery: "5000mAh", rearCamera: "2 亿像素主摄 + 5000 万像素超广角 + 5000 万像素长焦 + 1000 万像素长焦",
    telephoto: "5000 万像素 5 倍长焦 + 1000 万像素 3 倍长焦", launchPrice: 9699,
    dxomarkScore: 151, dxomarkProtocol: "Camera v5", dxomarkUrl: "https://www.dxomark.com/samsung-galaxy-s25-ultra-camera-test/",
  },
  {
    id: "samsung-galaxy-s26-ultra-2026", modelName: "Samsung Galaxy S26 Ultra", generation: "S26 Ultra",
    generationOrder: 3, releaseYear: 2026, releaseDate: "2026-03-05",
    officialUrl: "https://www.samsung.com.cn/smartphones/galaxy-s26-ultra/specs/",
    launchUrl: "https://www.samsung.com.cn/news/product/galaxy-s26/",
    launchReferenceUrl: "https://m.ithome.com/html/923675.htm",
    chip: "第五代骁龙 8 至尊版移动平台（for Galaxy）", screenSize: 6.9, resolution: "3120x1440", weight: 214,
    memory: "12GB / 16GB", storage: "256GB / 512GB / 1TB",
    configurations: [{ memory: "12GB", storage: "256GB" }, { memory: "12GB", storage: "512GB" }, { memory: "16GB", storage: "1TB" }],
    battery: "5000mAh", rearCamera: "2 亿像素主摄 + 5000 万像素超广角 + 5000 万像素长焦 + 1000 万像素长焦",
    telephoto: "5000 万像素 5 倍长焦 + 1000 万像素 3 倍长焦", launchPrice: 9999,
    dxomarkScore: 157, dxomarkProtocol: "Camera v6", dxomarkUrl: "https://www.dxomark.com/samsung-galaxy-s26-ultra-camera-test/",
  },
];

for (const row of rows) {
  const options = { offline: process.argv.includes("--offline"), refresh: process.argv.includes("--refresh") };
  const page = await getSourceSnapshot(row.officialUrl, { ...options, validate(html) {
    if (!html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.includes(row.generation)) throw new Error(`${row.id}: 页面身份不符`);
  } });
  const tabs = [...page.html.matchAll(/<button\b([^>]*class="[^"]*js-spec-tab[^>]+)>([\s\S]*?)<\/button>/g)]
    .map((match) => ({ code: match[1].match(/data-model-code="([^"]+)"/)?.[1],
      label: match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() }))
    .filter((tab) => tab.label.startsWith(`Galaxy ${row.generation} (`));
  if (tabs.length !== row.configurations.length) throw new Error(`${row.id}: 国行配置数量变化，需重新复核`);
  for (const configuration of row.configurations) {
    const tab = tabs.find((item) => item.label === `Galaxy ${row.generation} (${configuration.memory}+${configuration.storage})`);
    if (!tab?.code?.endsWith("CHC")) throw new Error(`${row.id}: 国行配置证据缺失`);
    configuration.evidence = evidence(`${configuration.memory} + ${configuration.storage}`, tab.label, page);
  }
  row.configurationPage = page;
  row.configurationText = tabs.map((tab) => tab.label).join("\n");
  row.apiUrl = `https://searchapi.samsung.com.cn/v6/front/b2c/product/spec/detail?siteCode=cn&modelList=${tabs[0].code}&specAnnotationYN=Y`;
  row.specPage = await getSourceSnapshot(row.apiUrl, { ...options, validate(raw) {
    const response = JSON.parse(raw).response;
    if (response?.siteCode !== "cn" || response.statusCode !== 200 || response.resultData?.modelList?.[0]?.modelCode !== tabs[0].code) throw new Error(`${row.id}: 参数数据与国行型号不符`);
  } });
  row.attributes = JSON.parse(row.specPage.html).response.resultData.modelList[0].spec.specItems.flatMap((group) => group.attrs ?? []);
  row.productUrl = row.officialUrl.replace(/specs\/$/, "");
  row.productPage = await getSourceSnapshot(row.productUrl, { ...options, validate(html) {
    if (!html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.includes(row.generation)) throw new Error(`${row.id}: 产品页身份不符`);
  } });
  row.productText = row.productPage.html.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  if (row.dxomarkUrl) row.benchmarkEvidence = await verifyCameraScore(row.modelName, row.dxomarkScore, row.dxomarkUrl, options);
  row.launchPage = await getSourceSnapshot(row.launchReferenceUrl, { ...options, validate(html) {
    if (!html.includes(`Galaxy ${row.generation}`)) throw new Error(`${row.id}: 国行发布报道型号不符`);
  } });
  const launchText = row.launchPage.html.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
  const launchPattern = row.launchPattern ?? (row.generationOrder === 1 ? /Galaxy S24 Ultra 12GB\+256GB 售价 9699 元/
    : row.generationOrder === 2 ? /Galaxy S25 Ultra 12GB RAM \+ 256GB 存储空间 ：9699 元/
      : /12GB \+ 256GB 建议零售价 9999 元/);
  row.launchExcerpt = launchText.match(launchPattern)?.[0];
  if (!row.launchExcerpt) throw new Error(`${row.id}: 首发配置报价证据缺失，整批未写入`);
  if (row.family && row.generationOrder === 1) {
    row.chipPage = await getSourceSnapshot(row.launchUrl, options);
    const chipText = row.chipPage.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    row.chipExcerpt = chipText.match(/第三代骁龙8移动平台（for Galaxy）/)?.[0];
    if (!row.chipExcerpt) throw new Error(`${row.id}: 国行芯片证据缺失`);
  }
}

function evidence(value, rawText, page, unit) {
  return { value, ...(unit ? { unit } : {}), rawText, evidenceKind: "excerpt", sourceUrl: page.url,
    sourceType: "official", confidence: 1, verifiedAt: page.fetchedAt.slice(0, 10), fetchedAt: page.fetchedAt,
    sourceSnapshotHash: page.sha256 };
}

function verifiedSpec(row, name, value, expected, unit) {
  const attribute = row.attributes.find((item) => item.attrName === name);
  if (!attribute || !expected.test(attribute.attrValue)) throw new Error(`${row.id}: ${name} 原文与整理值不符，整批未写入`);
  return evidence(value, attribute.attrValue, row.specPage, unit);
}

function productSpec(row, value, pattern) {
  const excerpt = row.productText.match(pattern)?.[0];
  if (!excerpt) throw new Error(`${row.id}: 产品页原文缺失 ${pattern}，整批未写入`);
  return evidence(value, excerpt, row.productPage);
}

const devices = rows.map((row) => ({
  id: row.id, brand: "Samsung", market: "CN", category: "phone", series: row.family ?? "Samsung Galaxy S Ultra",
  family: row.family ?? "Samsung Galaxy S Ultra", variant: "standard", modelName: row.modelName, generation: row.generation,
  generationOrder: row.generationOrder, releaseYear: row.releaseYear, releaseDate: row.releaseDate,
  comparisonGroupId: row.comparisonGroupId ?? "samsung.phone.galaxy-s-ultra.standard", configurations: row.configurations,
  benchmarks: row.dxomarkUrl ? [{ provider: "DXOMARK", metric: "camera", score: row.dxomarkScore, protocolVersion: row.dxomarkProtocol, sourceUrl: row.dxomarkUrl, ...row.benchmarkEvidence }] : [],
  specs: {
    chip: row.chipPage ? evidence(row.chip, row.chipExcerpt, row.chipPage) : productSpec(row, row.chip, row.generationOrder === 1 ? /第三代骁龙8移动平台 \(for Galaxy\)/
      : row.generationOrder === 2 ? /骁龙8至尊版移动平台（for Galaxy）/ : /第五代骁龙8至尊版（for Galaxy）处理器/),
    screenSize: verifiedSpec(row, "尺寸", row.screenSize, new RegExp(`^${String(row.screenSize).replace(".", "\\.")}英寸`), "inch"),
    displayType: verifiedSpec(row, "类型", "第二代动态 AMOLED", /^第二代动态\s*AMOLED$/),
    resolution: verifiedSpec(row, "分辨率", row.resolution, new RegExp(`^${row.resolution.replace("x", " x ")}`)),
    refreshRate: verifiedSpec(row, "最高刷新率", 120, /^120\s*Hz$/, "Hz"),
    weight: verifiedSpec(row, "重量 (g)", row.weight, new RegExp(`^${row.weight}$`), "g"),
    memory: evidence(row.memory, row.configurationText, row.configurationPage),
    storage: evidence(row.storage, row.configurationText, row.configurationPage),
    rearCamera: row.family ? verifiedSpec(row, "后置摄像头 - 分辨率 (多重)", "5000 万像素 + 1000 万像素 + 1200 万像素", /^5000万像素\+1000万像素\+1200万像素$/)
      : productSpec(row, row.rearCamera, /后置摄像头 (?:(?!前置摄像头|比较摄像头).){0,400}?1000万像素(?: F2\.4)?(?: 长焦摄像头)? 3倍光学变焦/),
    mainCamera: row.family ? productSpec(row, "50MP（5000 万像素）主摄", /5000万像素(?: F1\.8)? 广角摄像头/)
      : productSpec(row, "200MP（2 亿像素）主摄", /2亿像素(?: F1\.[47])? 广角摄像头/),
    telephoto: row.family ? productSpec(row, "1000 万像素 3 倍光学长焦", /1000万像素(?: F2\.4)?(?: 长焦摄像头)? 3倍光学变焦/)
      : productSpec(row, row.telephoto, /5000万像素(?: F2\.9)?(?: 长焦摄像头)? 5倍光学变焦\s*&amp;\s*10倍光学品质变焦 1000万像素(?: F2\.4)?(?: 长焦摄像头)? 3倍光学变焦/),
    frontCamera: verifiedSpec(row, "前置摄像头 - 分辨率", "1200 万像素", /^1200万像素$/),
    batteryCapacity: verifiedSpec(row, "电池容量 (mAh, 典型值)", parseInt(row.battery, 10), new RegExp(`^${parseInt(row.battery, 10)}$`), "mAh"),
    port: verifiedSpec(row, "USB 接口", "USB Type-C", /^USB Type-C$/),
    launchPrice: { ...evidence(row.launchPrice, row.launchExcerpt, row.launchPage, "CNY"), sourceType: row.launchSourceType ?? "reference", confidence: row.launchSourceType === "official" ? 1 : 0.85,
      priceType: "launch", market: "中国大陆", configuration: `${row.configurations[0].memory} 运行内存 + ${row.configurations[0].storage} 存储，国行版本`, condition: "中国大陆首发厂商建议零售价，不含限时升杯或预售尝鲜价" },
  },
  computed: row.generationOrder === 1 ? { generationUpgradeMagnitude: { value: null, comparedTo: null, changeSummary: "该设备为当前比较组第一代，无可对比前代", scoreBreakdown: "无对比前代", confidence: 0, computedAt: VERIFIED_AT, sourceType: "computed", verifiedAt: VERIFIED_AT } } : {},
}));

const sources = { phone: rows.map((row) => ({
  id: row.id, modelName: row.modelName, generation: row.generation, releaseYear: row.releaseYear,
  sourcePageType: "official_spec_reference_launch_and_benchmark", officialSpecUrl: row.officialUrl,
  supportUrl: null, newsroomUrl: row.launchUrl, referenceUrls: [row.dxomarkUrl, row.apiUrl, row.productUrl, row.launchReferenceUrl].filter(Boolean), sourceStatus: "verified",
  notes: row.family ? `规格与配置取自三星中国官网，并绑定 CHC 国行型号；首发价为明确的${row.configurations[0].memory}+${row.configurations[0].storage}基础配置指导价，不含升杯或限时优惠；发布日期按国行发布信息登记；未核验的评测分数与当前价留空。`
    : `规格与国行配置取自三星中国官网；中国大陆首发指导价按IT之家发布报道中的12GB+256GB配置核验，不含升杯优惠或尝鲜价；相机评分取自 DXOMARK ${row.dxomarkProtocol}。`,
})) };

await Promise.all([
  fs.writeFile(new URL("src/data/samsung-devices-db.json", ROOT), `${JSON.stringify({ metadata: { version: "1.0", totalDevices: devices.length, generatedAt: new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai" }).format(new Date()) }, devices }, null, 2)}\n`),
  fs.writeFile(new URL("src/data/samsung-sources.json", ROOT), `${JSON.stringify(sources, null, 2)}\n`),
]);
console.log(`wrote ${devices.length} Samsung Galaxy S devices`);
