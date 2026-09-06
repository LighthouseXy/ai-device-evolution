import fs from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
const VERIFIED_AT = "2026-09-07";

const rows = [
  {
    id: "vivo-x100-ultra-2024",
    modelName: "vivo X100 Ultra",
    generation: "X100 Ultra",
    generationOrder: 1,
    releaseYear: 2024,
    releaseDate: "2024-05-28",
    officialUrl: "https://www.vivo.com.cn/vivo/param/x100ultra",
    releaseUrl: "https://www.ithome.com/0/767/652.htm",
    chip: "高通 第三代骁龙 8",
    screenSize: 6.78,
    displayType: "AMOLED",
    resolution: "3200x1440",
    refreshRate: 120,
    weight: 229,
    memory: "12GB / 16GB",
    storage: "256GB / 512GB / 1TB",
    configurations: [
      { memory: "12GB", storage: "256GB" },
      { memory: "16GB", storage: "512GB" },
      { memory: "16GB", storage: "1TB" },
    ],
    battery: "5500mAh",
    rearCamera: "5000 万像素主摄 + 2 亿像素长焦 + 5000 万像素超广角",
    mainCamera: "50MP（5000 万像素）23mm 主摄",
    telephoto: "200MP（2 亿像素）85mm 长焦",
    frontCamera: "5000 万像素",
    launchPrice: 6499,
    launchConfiguration: "12GB 运行内存 + 256GB 存储，中国大陆全网通版本",
    launchRawText: "vivo X100 Ultra（12GB+256GB）：6499.00元",
  },
  {
    id: "vivo-x200-ultra-2025",
    modelName: "vivo X200 Ultra",
    generation: "X200 Ultra",
    generationOrder: 2,
    releaseYear: 2025,
    releaseDate: "2025-04-29",
    officialUrl: "https://www.vivo.com.cn/vivo/param/x200ultra",
    releaseUrl: "https://www.ithome.com/0/849/704.htm",
    chip: "高通 骁龙 8 至尊版",
    screenSize: 6.82,
    displayType: "AMOLED",
    resolution: "3168x1440",
    refreshRate: 120,
    weight: 232,
    memory: "12GB / 16GB",
    storage: "256GB / 512GB / 1TB",
    configurations: [
      { memory: "12GB", storage: "256GB" },
      { memory: "16GB", storage: "512GB" },
      { memory: "16GB", storage: "1TB" },
    ],
    battery: "6000mAh",
    rearCamera: "5000 万像素 35mm 主摄 + 2 亿像素 85mm 长焦 + 5000 万像素 14mm 超广角",
    mainCamera: "50MP（5000 万像素）35mm 主摄",
    telephoto: "200MP（2 亿像素）85mm 长焦",
    frontCamera: "5000 万像素",
    launchPrice: 6499,
    launchConfiguration: "12GB 运行内存 + 256GB 存储，中国大陆全网通版本",
    launchRawText: "vivo X200 Ultra（12GB+256GB）：6499.00元",
    dxomarkScore: 167,
    dxomarkProtocol: "Camera v6",
    dxomarkUrl: "https://www.dxomark.com/vivo-x200-ultra-camera-test/",
  },
  {
    id: "vivo-x300-ultra-2026",
    modelName: "vivo X300 Ultra",
    generation: "X300 Ultra",
    generationOrder: 3,
    releaseYear: 2026,
    releaseDate: "2026-04-03",
    officialUrl: "https://www.vivo.com.cn/vivo/param/x300ultra",
    releaseUrl: "https://www.ithome.com/0/935/594.htm",
    chip: "高通 第五代骁龙 8 至尊版",
    screenSize: 6.82,
    displayType: "AMOLED",
    resolution: "3168x1440",
    refreshRate: 144,
    weight: 232,
    memory: "12GB / 16GB",
    storage: "256GB / 512GB / 1TB",
    configurations: [
      { memory: "12GB", storage: "256GB" },
      { memory: "12GB", storage: "512GB" },
      { memory: "16GB", storage: "512GB" },
      { memory: "16GB", storage: "1TB" },
    ],
    battery: "6600mAh",
    rearCamera: "2 亿像素 35mm 主摄 + 2 亿像素 85mm 长焦 + 5000 万像素 14mm 超广角",
    mainCamera: "200MP（2 亿像素）35mm 主摄",
    telephoto: "200MP（2 亿像素）85mm 长焦",
    frontCamera: "5000 万像素",
    launchPrice: 6999,
    launchConfiguration: "12GB 运行内存 + 256GB 存储，中国大陆全网通版本",
    launchRawText: "vivo X300 Ultra（12GB+256GB）：6999.00元",
    dxomarkScore: 170,
    dxomarkProtocol: "Camera v6",
    dxomarkUrl: "https://www.dxomark.com/vivo-x300-ultra-camera-test/",
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

function launchPrice(row) {
  return {
    ...officialSpec(row.launchPrice, row.launchRawText, row.officialUrl, "CNY"),
    priceType: "launch",
    market: "中国大陆",
    configuration: row.launchConfiguration,
    condition: "中国大陆官方建议零售价",
  };
}

const devices = rows.map((row) => ({
  id: row.id,
  brand: "vivo",
  market: "CN",
  category: "phone",
  series: "vivo X Ultra",
  family: "vivo X Ultra",
  variant: "standard",
  modelName: row.modelName,
  generation: row.generation,
  generationOrder: row.generationOrder,
  releaseYear: row.releaseYear,
  releaseDate: row.releaseDate,
  comparisonGroupId: "vivo.phone.x-ultra.standard",
  configurations: row.configurations,
  benchmarks: row.dxomarkUrl ? [{
    provider: "DXOMARK",
    metric: "camera",
    score: row.dxomarkScore,
    protocolVersion: row.dxomarkProtocol,
    sourceUrl: row.dxomarkUrl,
    verifiedAt: VERIFIED_AT,
  }] : [],
  specs: {
    chip: officialSpec(row.chip, `CPU 型号：${row.chip}`, row.officialUrl),
    screenSize: officialSpec(row.screenSize, `屏幕尺寸：${row.screenSize} 英寸`, row.officialUrl, "inch"),
    displayType: officialSpec(row.displayType, `屏幕材质：${row.displayType}`, row.officialUrl),
    resolution: officialSpec(row.resolution, `分辨率：${row.resolution}`, row.officialUrl),
    refreshRate: officialSpec(row.refreshRate, `最高支持 ${row.refreshRate}Hz 刷新率`, row.officialUrl, "Hz"),
    weight: officialSpec(row.weight, `机身重量：${row.weight}g`, row.officialUrl, "g"),
    memory: officialSpec(row.memory, `运行内存：${row.memory}`, row.officialUrl),
    storage: officialSpec(row.storage, `机身存储：${row.storage}`, row.officialUrl),
    rearCamera: officialSpec(row.rearCamera, `后置摄像头像素：${row.rearCamera}`, row.officialUrl),
    mainCamera: officialSpec(row.mainCamera, row.mainCamera, row.officialUrl),
    telephoto: officialSpec(row.telephoto, row.telephoto, row.officialUrl),
    frontCamera: officialSpec(row.frontCamera, `前置摄像头像素：${row.frontCamera}`, row.officialUrl),
    batteryLife: officialSpec(row.battery, `电池典型容量：${row.battery}`, row.officialUrl),
    port: officialSpec("USB Type-C", "USB 接口类型：Type-C", row.officialUrl),
    launchPrice: launchPrice(row),
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
    supportUrl: null,
    newsroomUrl: null,
    referenceUrls: [row.releaseUrl, row.dxomarkUrl].filter(Boolean),
    sourceStatus: "verified",
    notes: row.dxomarkUrl
      ? "规格、配置与中国大陆官方建议零售价取自 vivo 官网；开售日由发布报道核对；相机评分取自 DXOMARK Camera v6。"
      : "规格、配置与中国大陆官方建议零售价取自 vivo 官网；开售日由发布报道核对；未检索到对应 DXOMARK 相机测试，评分留空。",
  })),
};

await Promise.all([
  fs.writeFile(new URL("src/data/vivo-devices-db.json", ROOT), `${JSON.stringify({
    metadata: { version: "1.0", totalDevices: devices.length, generatedAt: VERIFIED_AT },
    devices,
  }, null, 2)}\n`),
  fs.writeFile(new URL("src/data/vivo-sources.json", ROOT), `${JSON.stringify(sources, null, 2)}\n`),
]);

console.log(`wrote ${devices.length} vivo X Ultra devices`);
