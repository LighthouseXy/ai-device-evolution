import fs from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
const VERIFIED_AT = "2026-09-07";

const rows = [
  {
    id: "huawei-pura-70-ultra-2024",
    modelName: "HUAWEI Pura 70 Ultra",
    generation: "Pura 70 Ultra",
    generationOrder: 1,
    releaseYear: 2024,
    releaseDate: "2024-04-18",
    officialUrl: "https://consumer.huawei.com/sg/phones/pura70-ultra/specs/",
    chinaSupportUrl: "https://consumer.huawei.com/cn/support/content/zh-cn16090854/",
    launchUrl: "https://feeds-drcn.cloud.huawei.com.cn/landingpage/latest?channel=-1&cpid=666&ctype=news&docid=10510413dba49eb6bc59d7e050c8bb2507afa16&dy_scenario=relate&ifl=zh_CN&r=CN&tn=fe5602e1e67153885a098aa1ea73fc5445fcb4a97e34f75510a0287f89d83525&to_app=hwbrowser",
    chip: "麒麟 9010",
    screenSize: 6.8,
    resolution: "2844x1260",
    weight: 226,
    battery: "5200mAh",
    rearCamera: "5000 万像素一英寸主摄 + 4000 万像素超广角 + 5000 万像素长焦",
    telephoto: "5000 万像素超聚光微距长焦",
    launchPrice: 9999,
    dxomarkScore: 163,
    dxomarkProtocol: "Camera v5",
    dxomarkUrl: "https://www.dxomark.com/huawei-pura-70-ultra-camera-test/",
  },
  {
    id: "huawei-pura-80-ultra-2025",
    modelName: "HUAWEI Pura 80 Ultra",
    generation: "Pura 80 Ultra",
    generationOrder: 2,
    releaseYear: 2025,
    releaseDate: "2025-06-26",
    officialUrl: "https://consumer.huawei.com/cn/phones/pura80-ultra/specs/",
    chinaSupportUrl: "https://consumer.huawei.com/cn/support/content/zh-cn16053353/",
    launchUrl: "https://consumer.huawei.com/cn/phones/pura80-ultra/",
    chip: "麒麟 9020",
    chipUrl: "https://consumer.huawei.com/hk/phones/pura80-ultra/specs/",
    screenSize: 6.8,
    resolution: "2848x1276",
    weight: 233.5,
    battery: "5700mAh",
    rearCamera: "5000 万像素一英寸主摄 + 4000 万像素超广角 + 5000 万像素长焦 + 1250 万像素超长焦",
    telephoto: "5000 万像素 3.7 倍长焦 + 1250 万像素 9.4 倍超长焦",
    launchPrice: 9999,
    dxomarkScore: 175,
    dxomarkProtocol: "Camera v6",
    dxomarkUrl: "https://www.dxomark.com/huawei-pura-80-ultra-camera-test/",
  },
];

function officialSpec(value, rawText, sourceUrl, unit) {
  return {
    value,
    ...(unit ? { unit } : {}),
    rawText,
    sourceUrl,
    sourceType: "official",
    confidence: 1,
    verifiedAt: VERIFIED_AT,
  };
}

const devices = rows.map((row) => ({
  id: row.id,
  brand: "Huawei",
  market: "CN",
  category: "phone",
  series: "HUAWEI Pura Ultra",
  family: "HUAWEI Pura Ultra",
  variant: "standard",
  modelName: row.modelName,
  generation: row.generation,
  generationOrder: row.generationOrder,
  releaseYear: row.releaseYear,
  releaseDate: row.releaseDate,
  comparisonGroupId: "huawei.phone.pura-ultra.standard",
  configurations: [
    { memory: "16GB", storage: "512GB" },
    { memory: "16GB", storage: "1TB" },
  ],
  benchmarks: [{
    provider: "DXOMARK",
    metric: "camera",
    score: row.dxomarkScore,
    protocolVersion: row.dxomarkProtocol,
    sourceUrl: row.dxomarkUrl,
    verifiedAt: VERIFIED_AT,
  }],
  specs: {
    chip: officialSpec(row.chip, `处理器：${row.chip}`, row.chipUrl ?? row.officialUrl),
    screenSize: officialSpec(row.screenSize, `屏幕尺寸：${row.screenSize} 英寸`, row.officialUrl, "inch"),
    displayType: officialSpec("LTPO OLED", "屏幕类型：LTPO OLED，支持 1-120Hz 自适应刷新率", row.officialUrl),
    resolution: officialSpec(row.resolution, `分辨率：${row.resolution}`, row.officialUrl),
    refreshRate: officialSpec(120, "支持 1-120Hz 自适应刷新率", row.officialUrl, "Hz"),
    weight: officialSpec(row.weight, `重量约 ${row.weight} 克（含电池）`, row.officialUrl, "g"),
    memory: officialSpec("16GB", "运行内存：16GB", row.chinaSupportUrl),
    storage: officialSpec("512GB / 1TB", "机身存储：512GB / 1TB", row.chinaSupportUrl),
    rearCamera: officialSpec(row.rearCamera, row.rearCamera, row.officialUrl),
    mainCamera: officialSpec("50MP（5000 万像素）一英寸主摄", "5000 万像素一英寸主摄", row.officialUrl),
    telephoto: officialSpec(row.telephoto, row.telephoto, row.officialUrl),
    frontCamera: officialSpec("1300 万像素", "前置摄像头：1300 万像素", row.officialUrl),
    batteryLife: officialSpec(row.battery, `电池典型容量：${row.battery}`, row.officialUrl),
    port: officialSpec("USB Type-C", "数据线接口：USB Type-C", row.officialUrl),
    launchPrice: {
      ...officialSpec(row.launchPrice, `中国大陆首发价 ${row.launchPrice} 元起`, row.launchUrl, "CNY"),
      priceType: "launch",
      market: "中国大陆",
      configuration: "16GB 运行内存 + 512GB 存储，中国大陆版本",
      condition: "中国大陆官方首发价",
    },
  },
  computed: row.generationOrder === 1 ? {
    generationUpgradeMagnitude: {
      value: null,
      comparedTo: null,
      changeSummary: "该设备为当前比较组第一代，无可对比前代",
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
    sourcePageType: "official_spec_price_and_reference_benchmark",
    officialSpecUrl: row.officialUrl,
    supportUrl: row.chinaSupportUrl,
    newsroomUrl: row.launchUrl,
    referenceUrls: [row.chipUrl, row.dxomarkUrl].filter(Boolean),
    sourceStatus: "verified",
    notes: row.generationOrder === 1
      ? "中国大陆原产品规格页已下线；核心规格由华为官方海外规格页交叉核验，中国大陆配置由华为中文支持页确认，首发价来自华为中文资讯，相机评分取自 DXOMARK Camera v5。"
      : "规格、配置与首发价取自华为中国官网及中文支持页；处理器由华为香港官方规格页补充；相机评分取自 DXOMARK Camera v6。",
  })),
};

await Promise.all([
  fs.writeFile(new URL("src/data/huawei-devices-db.json", ROOT), `${JSON.stringify({
    metadata: { version: "1.0", totalDevices: devices.length, generatedAt: VERIFIED_AT },
    devices,
  }, null, 2)}\n`),
  fs.writeFile(new URL("src/data/huawei-sources.json", ROOT), `${JSON.stringify(sources, null, 2)}\n`),
]);

console.log(`wrote ${devices.length} HUAWEI Pura Ultra devices`);
