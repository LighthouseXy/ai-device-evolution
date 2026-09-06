import fs from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
const VERIFIED_AT = "2026-09-07";

const rows = [
  {
    id: "honor-magic6-pro-2024", modelName: "荣耀 Magic6 Pro", generation: "Magic6 Pro",
    generationOrder: 1, releaseYear: 2024, releaseDate: "2024-01-18",
    officialUrl: "https://www.honor.com/cn/phones/honor-magic6-pro/",
    launchUrl: "https://www.honor.com/cn/news/honor-magic6-launch/",
    chip: "高通 第三代骁龙 8", screenSize: 6.8, resolution: "2800x1280", weight: 229,
    memory: "12GB / 16GB", storage: "256GB / 512GB / 1TB",
    configurations: [{ memory: "12GB", storage: "256GB" }, { memory: "16GB", storage: "512GB" }, { memory: "16GB", storage: "1TB" }],
    battery: "5600mAh", rearCamera: "5000 万像素主摄 + 5000 万像素超广角 + 1.8 亿像素长焦",
    mainCamera: "50MP（5000 万像素）主摄", telephoto: "180MP（1.8 亿像素）潜望式长焦",
    launchPrice: 5699, launchConfiguration: "12GB 运行内存 + 256GB 存储，中国大陆全网通版本",
    dxomarkScore: 158, dxomarkProtocol: "Camera v5", dxomarkUrl: "https://www.dxomark.com/honor-magic6-pro-camera-test/",
  },
  {
    id: "honor-magic7-pro-2024", modelName: "荣耀 Magic7 Pro", generation: "Magic7 Pro",
    generationOrder: 2, releaseYear: 2024, releaseDate: "2024-11-08",
    officialUrl: "https://www.honor.com/cn/phones/honor-magic7-pro/",
    launchUrl: "https://www.honor.com/cn/news/honor-magic7-launch/",
    chip: "高通 骁龙 8 至尊版", screenSize: 6.8, resolution: "2800x1280", weight: 223,
    memory: "12GB / 16GB", storage: "256GB / 512GB / 1TB",
    configurations: [{ memory: "12GB", storage: "256GB" }, { memory: "16GB", storage: "512GB" }, { memory: "16GB", storage: "1TB" }],
    battery: "5850mAh", rearCamera: "5000 万像素主摄 + 5000 万像素超广角 + 2 亿像素长焦",
    mainCamera: "50MP（5000 万像素）主摄", telephoto: "200MP（2 亿像素）潜望式长焦",
    launchPrice: 5699, launchConfiguration: "12GB 运行内存 + 256GB 存储，中国大陆全网通版本",
    dxomarkScore: 148, dxomarkProtocol: "Camera v6", dxomarkUrl: "https://www.dxomark.com/honor-magic7-pro-camera-test-retested/",
  },
  {
    id: "honor-magic8-pro-2025", modelName: "荣耀 Magic8 Pro", generation: "Magic8 Pro",
    generationOrder: 3, releaseYear: 2025, releaseDate: "2025-10-23",
    officialUrl: "https://www.honor.com/cn/phones/honor-magic8-pro/",
    launchUrl: "https://www.honor.com/cn/news/honor-magic8-launch/",
    chip: "高通 第五代骁龙 8 至尊版", screenSize: 6.71, resolution: "2808x1256", weight: 219,
    memory: "12GB / 16GB", storage: "512GB / 1TB",
    configurations: [{ memory: "12GB", storage: "512GB" }, { memory: "16GB", storage: "512GB" }, { memory: "16GB", storage: "1TB" }],
    battery: "7200mAh", rearCamera: "5000 万像素主摄 + 5000 万像素超广角 + 2 亿像素长焦",
    mainCamera: "50MP（5000 万像素）主摄", telephoto: "200MP（2 亿像素）潜望式长焦",
    launchPrice: 5699, launchConfiguration: "12GB 运行内存 + 512GB 存储，中国大陆全网通版本",
    dxomarkScore: 164, dxomarkProtocol: "Camera v6", dxomarkUrl: "https://www.dxomark.com/honor-magic8-pro-camera-test/",
  },
];

function officialSpec(value, rawText, sourceUrl, unit) {
  return { value, ...(unit ? { unit } : {}), rawText, sourceUrl, sourceType: "official", confidence: 1, verifiedAt: VERIFIED_AT };
}

const devices = rows.map((row) => ({
  id: row.id, brand: "HONOR", market: "CN", category: "phone", series: "荣耀 Magic Pro",
  family: "荣耀 Magic Pro", variant: "standard", modelName: row.modelName, generation: row.generation,
  generationOrder: row.generationOrder, releaseYear: row.releaseYear, releaseDate: row.releaseDate,
  comparisonGroupId: "honor.phone.magic-pro.standard", configurations: row.configurations,
  benchmarks: [{ provider: "DXOMARK", metric: "camera", score: row.dxomarkScore, protocolVersion: row.dxomarkProtocol, sourceUrl: row.dxomarkUrl, verifiedAt: VERIFIED_AT }],
  specs: {
    chip: officialSpec(row.chip, `处理器：${row.chip}`, row.officialUrl),
    screenSize: officialSpec(row.screenSize, `屏幕尺寸：${row.screenSize} 英寸`, row.officialUrl, "inch"),
    displayType: officialSpec("LTPO OLED", "屏幕类型：LTPO OLED，支持 1-120Hz 自适应刷新率", row.officialUrl),
    resolution: officialSpec(row.resolution, `屏幕分辨率：${row.resolution}`, row.officialUrl),
    refreshRate: officialSpec(120, "支持 1-120Hz 自适应刷新率", row.officialUrl, "Hz"),
    weight: officialSpec(row.weight, `重量约 ${row.weight} 克`, row.officialUrl, "g"),
    memory: officialSpec(row.memory, `运行内存：${row.memory}`, row.officialUrl),
    storage: officialSpec(row.storage, `机身存储：${row.storage}`, row.officialUrl),
    rearCamera: officialSpec(row.rearCamera, row.rearCamera, row.officialUrl),
    mainCamera: officialSpec(row.mainCamera, row.mainCamera, row.officialUrl),
    telephoto: officialSpec(row.telephoto, row.telephoto, row.officialUrl),
    frontCamera: officialSpec("5000 万像素", "前置摄像头：5000 万像素", row.officialUrl),
    batteryLife: officialSpec(row.battery, `电池典型容量：${row.battery}`, row.officialUrl),
    port: officialSpec("USB Type-C", "数据线接口：USB Type-C", row.officialUrl),
    launchPrice: { ...officialSpec(row.launchPrice, `荣耀 ${row.generation} 售价 ${row.launchPrice} 元起`, row.launchUrl, "CNY"), priceType: "launch", market: "中国大陆", configuration: row.launchConfiguration, condition: "中国大陆官方首发价" },
  },
  computed: row.generationOrder === 1 ? { generationUpgradeMagnitude: { value: null, comparedTo: null, changeSummary: "该设备为当前比较组第一代，无可对比前代", scoreBreakdown: "无对比前代", confidence: 0, computedAt: VERIFIED_AT, sourceType: "computed", verifiedAt: VERIFIED_AT } } : {},
}));

const sources = { phone: rows.map((row) => ({
  id: row.id, modelName: row.modelName, generation: row.generation, releaseYear: row.releaseYear,
  sourcePageType: "official_spec_price_and_reference_benchmark", officialSpecUrl: row.officialUrl,
  supportUrl: null, newsroomUrl: row.launchUrl, referenceUrls: [row.dxomarkUrl], sourceStatus: "verified",
  notes: `规格、配置与中国大陆首发价取自荣耀中国官网；相机评分取自 DXOMARK ${row.dxomarkProtocol}。`,
})) };

await Promise.all([
  fs.writeFile(new URL("src/data/honor-devices-db.json", ROOT), `${JSON.stringify({ metadata: { version: "1.0", totalDevices: devices.length, generatedAt: VERIFIED_AT }, devices }, null, 2)}\n`),
  fs.writeFile(new URL("src/data/honor-sources.json", ROOT), `${JSON.stringify(sources, null, 2)}\n`),
]);
console.log(`wrote ${devices.length} HONOR Magic Pro devices`);
