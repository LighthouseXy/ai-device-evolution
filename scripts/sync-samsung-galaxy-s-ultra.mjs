import fs from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
const VERIFIED_AT = "2026-09-07";

const rows = [
  {
    id: "samsung-galaxy-s24-ultra-2024", modelName: "Samsung Galaxy S24 Ultra", generation: "S24 Ultra",
    generationOrder: 1, releaseYear: 2024, releaseDate: "2024-01-25",
    officialUrl: "https://www.samsung.com.cn/smartphones/galaxy-s24-ultra/specs/",
    launchUrl: "https://www.samsung.com.cn/news/product/samsung-galaxy-s24-series-in-china/",
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
    chip: "第五代骁龙 8 至尊版移动平台（for Galaxy）", screenSize: 6.9, resolution: "3120x1440", weight: 214,
    memory: "12GB / 16GB", storage: "256GB / 512GB / 1TB",
    configurations: [{ memory: "12GB", storage: "256GB" }, { memory: "12GB", storage: "512GB" }, { memory: "16GB", storage: "1TB" }],
    battery: "5000mAh", rearCamera: "2 亿像素主摄 + 5000 万像素超广角 + 5000 万像素长焦 + 1000 万像素长焦",
    telephoto: "5000 万像素 5 倍长焦 + 1000 万像素 3 倍长焦", launchPrice: 9999,
    dxomarkScore: 157, dxomarkProtocol: "Camera v6", dxomarkUrl: "https://www.dxomark.com/samsung-galaxy-s26-ultra-camera-test/",
  },
];

function officialSpec(value, rawText, sourceUrl, unit) {
  return { value, ...(unit ? { unit } : {}), rawText, sourceUrl, sourceType: "official", confidence: 1, verifiedAt: VERIFIED_AT };
}

const devices = rows.map((row) => ({
  id: row.id, brand: "Samsung", market: "CN", category: "phone", series: "Samsung Galaxy S Ultra",
  family: "Samsung Galaxy S Ultra", variant: "standard", modelName: row.modelName, generation: row.generation,
  generationOrder: row.generationOrder, releaseYear: row.releaseYear, releaseDate: row.releaseDate,
  comparisonGroupId: "samsung.phone.galaxy-s-ultra.standard", configurations: row.configurations,
  benchmarks: [{ provider: "DXOMARK", metric: "camera", score: row.dxomarkScore, protocolVersion: row.dxomarkProtocol, sourceUrl: row.dxomarkUrl, verifiedAt: VERIFIED_AT }],
  specs: {
    chip: officialSpec(row.chip, `处理器：${row.chip}`, row.officialUrl),
    screenSize: officialSpec(row.screenSize, `显示屏直角尺寸：${row.screenSize} 英寸`, row.officialUrl, "inch"),
    displayType: officialSpec("第二代动态 AMOLED", "显示屏类型：第二代动态 AMOLED", row.officialUrl),
    resolution: officialSpec(row.resolution, `显示屏分辨率：${row.resolution}`, row.officialUrl),
    refreshRate: officialSpec(120, "最高刷新率：120Hz", row.officialUrl, "Hz"),
    weight: officialSpec(row.weight, `重量：${row.weight} 克`, row.officialUrl, "g"),
    memory: officialSpec(row.memory, `运行内存：${row.memory}`, row.officialUrl),
    storage: officialSpec(row.storage, `机身存储：${row.storage}`, row.officialUrl),
    rearCamera: officialSpec(row.rearCamera, row.rearCamera, row.officialUrl),
    mainCamera: officialSpec("200MP（2 亿像素）主摄", "广角主摄：2 亿像素", row.officialUrl),
    telephoto: officialSpec(row.telephoto, row.telephoto, row.officialUrl),
    frontCamera: officialSpec("1200 万像素", "前置摄像头：1200 万像素", row.officialUrl),
    batteryLife: officialSpec(row.battery, `电池典型容量：${row.battery}`, row.officialUrl),
    port: officialSpec("USB Type-C", "USB 接口：USB Type-C", row.officialUrl),
    launchPrice: { ...officialSpec(row.launchPrice, `中国大陆厂商建议零售价 ${row.launchPrice} 元起`, row.launchUrl, "CNY"), priceType: "launch", market: "中国大陆", configuration: "12GB 运行内存 + 256GB 存储，国行版本", condition: "中国大陆首发厂商建议零售价" },
  },
  computed: row.generationOrder === 1 ? { generationUpgradeMagnitude: { value: null, comparedTo: null, changeSummary: "该设备为当前比较组第一代，无可对比前代", scoreBreakdown: "无对比前代", confidence: 0, computedAt: VERIFIED_AT, sourceType: "computed", verifiedAt: VERIFIED_AT } } : {},
}));

const sources = { phone: rows.map((row) => ({
  id: row.id, modelName: row.modelName, generation: row.generation, releaseYear: row.releaseYear,
  sourcePageType: "official_spec_price_and_reference_benchmark", officialSpecUrl: row.officialUrl,
  supportUrl: null, newsroomUrl: row.launchUrl, referenceUrls: [row.dxomarkUrl], sourceStatus: "verified",
  notes: `规格、国行配置与中国大陆首发指导价取自三星中国官网；相机评分取自 DXOMARK ${row.dxomarkProtocol}。`,
})) };

await Promise.all([
  fs.writeFile(new URL("src/data/samsung-devices-db.json", ROOT), `${JSON.stringify({ metadata: { version: "1.0", totalDevices: devices.length, generatedAt: VERIFIED_AT }, devices }, null, 2)}\n`),
  fs.writeFile(new URL("src/data/samsung-sources.json", ROOT), `${JSON.stringify(sources, null, 2)}\n`),
]);
console.log(`wrote ${devices.length} Samsung Galaxy S Ultra devices`);
