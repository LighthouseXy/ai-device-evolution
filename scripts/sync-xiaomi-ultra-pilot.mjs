import fs from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
const VERIFIED_AT = "2026-09-07";
const CONFIGURATIONS = [
  { memory: "12GB", storage: "256GB" },
  { memory: "16GB", storage: "512GB" },
  { memory: "16GB", storage: "1TB" },
];

const rows = [
  {
    id: "xiaomi-13-ultra-2023",
    modelName: "小米 13 Ultra",
    generation: "13",
    generationOrder: 1,
    releaseYear: 2023,
    releaseDate: "2023-04-21",
    sourceUrl: "https://detail.zol.com.cn/1514/1513122/param.shtml",
    launchUrl: "https://detail.zol.com.cn/series/57/34645/param_10717148_0_1.html",
    chip: "高通 骁龙 8 Gen 2",
    displayType: "OLED（LTPO）",
    weight: 227,
    battery: "5000mAh",
    rearCamera: "5000 万像素主摄 + 5000 万像素超广角 + 5000 万像素长焦 + 5000 万像素超长焦",
    telephoto: "5000 万像素 75mm 长焦 + 5000 万像素 120mm 超长焦",
    launchPrice: 5999,
    currentPrice: 5699,
    currentSource: "天猫 ¥5699",
    dxomarkScore: 140,
    dxomarkProtocol: "Camera v5",
    dxomarkUrl: "https://www.dxomark.com/xiaomi-13-ultra-camera-test/",
  },
  {
    id: "xiaomi-14-ultra-2024",
    modelName: "小米 14 Ultra",
    generation: "14",
    generationOrder: 2,
    releaseYear: 2024,
    releaseDate: "2024-02-27",
    sourceUrl: "https://detail.zol.com.cn/1983/1982924/param.shtml",
    launchUrl: "https://detail.zol.com.cn/series/57/34645/param_10808057_0_1.html",
    chip: "高通 骁龙 8 Gen 3",
    displayType: "AMOLED",
    weight: 224.4,
    battery: "5300mAh",
    rearCamera: "5000 万像素主摄 + 5000 万像素超广角 + 5000 万像素长焦 + 5000 万像素超长焦",
    telephoto: "5000 万像素长焦 + 5000 万像素超长焦",
    launchPrice: 6499,
    currentPrice: 6199,
    currentSource: "天猫 ¥6199",
    dxomarkScore: 149,
    dxomarkProtocol: "Camera v5",
    dxomarkUrl: "https://www.dxomark.com/smartphones/Xiaomi/14-Ultra",
  },
  {
    id: "xiaomi-15-ultra-2025",
    modelName: "小米 15 Ultra",
    generation: "15",
    generationOrder: 3,
    releaseYear: 2025,
    releaseDate: "2025-03-03",
    sourceUrl: "https://detail.zol.com.cn/2122/2121957/param.shtml",
    launchUrl: "https://detail.zol.com.cn/series/57/34645/param_10910509_0_1.html",
    chip: "高通 骁龙 8 Elite",
    displayType: "AMOLED",
    weight: 226,
    battery: "6000mAh",
    rearCamera: "5000 万像素主摄 + 5000 万像素超广角 + 5000 万像素长焦 + 2 亿像素超长焦",
    telephoto: "5000 万像素 70mm 长焦 + 2 亿像素 100mm 超长焦",
    launchPrice: 6499,
    currentPrice: 6499,
    currentSource: "京东 ¥6499",
    dxomarkScore: 159,
    dxomarkProtocol: "Camera v6",
    dxomarkUrl: "https://www.dxomark.com/xiaomi-15-ultra-camera-test-retested/",
  },
];

function spec(value, rawText, sourceUrl, confidence = 0.8) {
  return {
    value,
    rawText,
    sourceUrl,
    sourceType: "reference",
    confidence,
    verifiedAt: VERIFIED_AT,
  };
}

function price(value, priceType, rawText, sourceUrl, configuration) {
  return {
    ...spec(value, rawText, sourceUrl, 0.7),
    unit: "CNY",
    priceType,
    market: "中国大陆",
    configuration,
    condition: priceType === "launch" ? "中国大陆首发起售价" : "全新，页面展示电商价",
    ...(priceType === "current" ? { observedAt: VERIFIED_AT, sourceName: "中关村在线电商报价" } : {}),
  };
}

const devices = rows.map((row) => ({
  id: row.id,
  brand: "Xiaomi",
  market: "CN",
  category: "phone",
  series: "Xiaomi Ultra",
  family: "Xiaomi Ultra",
  variant: "standard",
  modelName: row.modelName,
  generation: row.generation,
  generationOrder: row.generationOrder,
  releaseYear: row.releaseYear,
  releaseDate: row.releaseDate,
  comparisonGroupId: "xiaomi.phone.xiaomi-ultra.standard",
  configurations: CONFIGURATIONS,
  benchmarks: [{
    provider: "DXOMARK",
    metric: "camera",
    score: row.dxomarkScore,
    protocolVersion: row.dxomarkProtocol,
    sourceUrl: row.dxomarkUrl,
    verifiedAt: VERIFIED_AT,
  }],
  specs: {
    chip: spec(row.chip, `CPU型号：${row.chip}`, row.sourceUrl),
    screenSize: { ...spec(6.73, "屏幕尺寸：6.73英寸", row.sourceUrl), unit: "inch" },
    displayType: spec(row.displayType, `屏幕材质：${row.displayType}`, row.sourceUrl),
    resolution: spec("3200x1440", "分辨率：3200x1440px", row.sourceUrl),
    refreshRate: { ...spec(120, "屏幕刷新率：120Hz", row.sourceUrl), unit: "Hz" },
    weight: { ...spec(row.weight, `重量：${row.weight}g`, row.sourceUrl), unit: "g" },
    memory: spec("12GB / 16GB", "RAM容量：12GB / 16GB", row.sourceUrl),
    storage: spec("256GB / 512GB / 1TB", "ROM容量：256GB / 512GB / 1TB", row.sourceUrl),
    rearCamera: spec(row.rearCamera, `后置摄像头：${row.rearCamera}`, row.sourceUrl),
    mainCamera: spec("5000 万像素", "后置主摄：5000万像素", row.sourceUrl),
    telephoto: spec(row.telephoto, row.telephoto, row.dxomarkUrl, 0.9),
    frontCamera: spec("3200 万像素", "前置摄像头：3200万像素", row.sourceUrl),
    batteryLife: spec(row.battery, `电池容量：${row.battery}`, row.sourceUrl),
    port: spec("USB Type-C", "机身接口：USB Type-C", row.sourceUrl),
    waterResistance: spec("IP68", "防护等级：IP68", row.sourceUrl),
    launchPrice: price(row.launchPrice, "launch", `12GB/256GB 参考价：￥${row.launchPrice}`, row.launchUrl, "12GB 运行内存 + 256GB 存储，中国大陆版本"),
    currentPrice: price(row.currentPrice, "current", row.currentSource, row.sourceUrl, "16GB 运行内存 + 512GB 存储，中国大陆版本"),
  },
  computed: row.generationOrder === 1 ? {
    generationUpgradeMagnitude: {
      value: null,
      comparedTo: null,
      changeSummary: "该设备为当前试点比较组第一代，无可对比前代",
      scoreBreakdown: "无对比前代",
      confidence: 0,
      computedAt: VERIFIED_AT,
      sourceType: "computed",
      verifiedAt: VERIFIED_AT,
    },
  } : {},
}));

const sources = {
  phone: rows.map((row) => ({
    id: row.id,
    modelName: row.modelName,
    generation: row.generation,
    releaseYear: row.releaseYear,
    sourcePageType: "reference_spec_and_benchmark",
    officialSpecUrl: null,
    supportUrl: null,
    newsroomUrl: null,
    referenceUrls: [row.sourceUrl, row.launchUrl, row.dxomarkUrl],
    sourceStatus: "verified",
    notes: "规格与中国大陆价格取自中关村在线对应配置页；相机评分取自 DXOMARK，并保留测试协议版本。",
  })),
};

await Promise.all([
  fs.writeFile(new URL("src/data/xiaomi-devices-db.json", ROOT), `${JSON.stringify({
    metadata: { version: "1.0", totalDevices: devices.length, generatedAt: VERIFIED_AT },
    devices,
  }, null, 2)}\n`),
  fs.writeFile(new URL("src/data/xiaomi-sources.json", ROOT), `${JSON.stringify(sources, null, 2)}\n`),
]);

console.log(`wrote ${devices.length} Xiaomi Ultra pilot devices`);
