import fs from "node:fs/promises";
import { getSourceSnapshot } from "./lib/source-snapshot.mjs";
import { verifyCameraScore } from "./lib/dxomark-snapshot.mjs";

const ROOT = new URL("../", import.meta.url);
const VERIFIED_AT = "2026-09-07";

const rows = [
  ...[
    ["x200", "X200", 2024, "2024-10-19", 4299, "vivo X", "vivo.phone.x.standard", 1],
    ["x200pro", "X200 Pro", 2024, "2024-10-19", 5299, "vivo X Pro", "vivo.phone.x-pro.standard", 1],
    ["x200promini", "X200 Pro mini", 2024, "2024-10-25", 4699, "vivo X Pro mini", "vivo.phone.x-pro-mini.standard", 1],
    ["x300", "X300", 2025, "2025-10-17", 4399, "vivo X", "vivo.phone.x.standard", 2],
    ["x300pro", "X300 Pro", 2025, "2025-10-17", 5299, "vivo X Pro", "vivo.phone.x-pro.standard", 2],
    ["x500", "X500", 2026, "2026-09-24", 5499, "vivo X", "vivo.phone.x.standard", 3],
    ["x500pro", "X500 Pro", 2026, "2026-09-29", 6499, "vivo X Pro", "vivo.phone.x-pro.standard", 3],
    ["x500promax", "X500 Pro Max", 2026, "2026-09-24", 6999, "vivo X Pro Max", "vivo.phone.x-pro-max.standard", 1],
  ].map(([slug, generation, releaseYear, releaseDate, launchPrice, family, comparisonGroupId, generationOrder]) => ({
    id: `vivo-${generation.toLowerCase().replaceAll(" ", "-")}-${releaseYear}`, modelName: `vivo ${generation}`, generation,
    releaseYear, releaseDate, launchPrice, family, comparisonGroupId, generationOrder,
    officialUrl: `https://www.vivo.com.cn/vivo/param/${slug}`,
    launchUrl: releaseYear === 2024 ? "https://www.vivo.com.cn/brand/news/detail?id=1273"
      : releaseYear === 2025 ? "https://www.vivo.com.cn/brand/news/detail?id=1336&type=3"
        : "https://www.vivo.com.cn/brand/news/detail?id=1393&type=0",
  })),
  {
    id: "vivo-x100-ultra-2024",
    modelName: "vivo X100 Ultra",
    generation: "X100 Ultra",
    generationOrder: 1,
    releaseYear: 2024,
    releaseDate: "2024-05-28",
    officialUrl: "https://www.vivo.com.cn/vivo/param/x100ultra",
    cameraUrl: "https://m.vivo.com.cn/vivo/x100ultra/",
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

const sourcePages = new Map();
for (const row of rows) {
  for (const url of [row.officialUrl, row.cameraUrl, row.launchUrl].filter(Boolean)) {
    const page = await getSourceSnapshot(url, {
      offline: process.argv.includes("--offline"), refresh: process.argv.includes("--refresh"),
      validate(html) {
        if (url === row.launchUrl ? !html.includes(row.modelName)
          : !html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.includes(row.modelName)) throw new Error(`${row.id}: 页面身份不符`);
      },
    });
    page.text = page.html.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    sourcePages.set(url, page);
  }
  if (row.dxomarkUrl) row.benchmarkEvidence = await verifyCameraScore(row.modelName, row.dxomarkScore, row.dxomarkUrl, {
    offline: process.argv.includes("--offline"), refresh: process.argv.includes("--refresh"),
  });
}

function officialSpec(value, rawText, sourceUrl, unit, pattern) {
  if (pattern) {
    const page = sourcePages.get(sourceUrl);
    const excerpt = page.text.match(pattern)?.[0];
    if (!excerpt) throw new Error(`${sourceUrl}: 原文证据缺失 ${pattern}，整批未写入`);
    return { value, ...(unit ? { unit } : {}), rawText: excerpt, evidenceKind: "excerpt", sourceUrl,
      sourceType: "official", confidence: 1, verifiedAt: page.fetchedAt.slice(0, 10), fetchedAt: page.fetchedAt,
      sourceSnapshotHash: page.sha256 };
  }
  return {
    value,
    ...(unit ? { unit } : {}),
    summaryText: rawText,
    evidenceKind: "summary",
    sourceUrl,
    sourceType: "official",
    confidence: 1,
    verifiedAt: VERIFIED_AT,
  };
}

function launchPrice(row) {
  return {
    ...officialSpec(row.launchPrice, row.launchRawText, row.officialUrl, "CNY", new RegExp(`${row.modelName}（12GB\\+256GB）：${row.launchPrice}\\.00元`)),
    priceType: "launch",
    market: "中国大陆",
    configuration: row.launchConfiguration,
    condition: "中国大陆官方建议零售价",
  };
}

function mainstreamDevice(row) {
  const page = sourcePages.get(row.officialUrl);
  const field = (pattern, value, unit) => {
    const match = page.text.match(pattern);
    if (!match) throw new Error(`${row.id}: 必要参数原文缺失 ${pattern}，整批未写入`);
    return officialSpec(value(match), "", row.officialUrl, unit, pattern);
  };
  const escapePattern = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const priceBlockPattern = /建议零售价 [\s\S]+?(?= 上市时间)/;
  const priceBlock = page.text.match(priceBlockPattern)?.[0];
  if (!priceBlock) throw new Error(`${row.id}: 明确配置表缺失`);
  const configurations = [...new Map([...priceBlock.matchAll(new RegExp(`${escapePattern(row.modelName)}（(\\d+GB)\\+(\\d+(?:GB|TB))(?:卫星通信版)?）：\\d+\\.00元`, "g"))]
    .map((match) => [`${match[1]}|${match[2]}`, { memory: match[1], storage: match[2],
      evidence: officialSpec(`${match[1]} + ${match[2]}`, "", row.officialUrl, undefined, priceBlockPattern) }])).values()];
  if (!configurations.length || !configurations.some((item) => item.memory === "12GB" && item.storage === "256GB")) {
    throw new Error(`${row.id}: 基础配置证据缺失`);
  }
  const launchPattern = row.releaseYear === 2026
    ? new RegExp(`${escapePattern(row.generation)}各版本售价分别为：12GB\\+256GB ${row.launchPrice}元`)
    : new RegExp(`${escapePattern(row.modelName)}\\s*(?:有|提供)12GB\\+256GB[^。]+?售价分别为${row.launchPrice}元`);
  const weight = field(/重量 (.+?)(?= 建议零售价)/, (match) => Number(match[1].match(/(\d+(?:\.\d+)?)g/)?.[1]), "g");
  if (!Number.isFinite(weight.value)) throw new Error(`${row.id}: 重量单位或数值变化`);
  weight.note = weight.rawText;
  return {
    id: row.id, brand: "vivo", market: "CN", category: "phone", series: row.family, family: row.family, variant: "standard",
    modelName: row.modelName, generation: row.generation, generationOrder: row.generationOrder,
    releaseYear: row.releaseYear, releaseDate: row.releaseDate, comparisonGroupId: row.comparisonGroupId, configurations, benchmarks: [],
    specs: {
      chip: field(/CPU型号 (.+?)(?= CPU核心数)/, (match) => match[1]),
      screenSize: field(/尺寸（英寸） (\d+(?:\.\d+)?)英寸/, (match) => Number(match[1]), "inch"),
      displayType: field(/屏幕材质 (.+?)(?= 触摸屏)/, (match) => match[1]),
      resolution: field(/分辨率 (\d+)\s*[x×]\s*(\d+)/, (match) => `${match[1]}x${match[2]}`),
      refreshRate: field(/刷新率 ([\d./~\-]+)Hz/, (match) => Math.max(...match[1].match(/\d+(?:\.\d+)?/g).map(Number)), "Hz"),
      weight,
      memory: field(/运行内存（RAM） ([\dGBT/]+)(?=（)/, (match) => match[1].split("/").join(" / ")),
      storage: field(/机身存储（ROM） ([\dGBT/]+)(?=（)/, (match) => match[1].split("/").join(" / ")),
      rearCamera: field(/后置摄像头像素 (.+?)(?= 后置摄像头光圈)/, (match) => match[1]),
      mainCamera: field(/后置摄像头像素 ((\d+)(万|亿)像素\S*主摄)/, (match) => `${match[3] === "亿" ? Number(match[2]) * 100 : Number(match[2]) / 100}MP（${match[1]}）`),
      telephoto: field(/后置摄像头像素 .+? (\d+(?:万|亿)像素\S*长焦)/, (match) => match[1]),
      frontCamera: field(/前置摄像头像素 (\d+万像素)/, (match) => match[1]),
      batteryCapacity: field(/典型容量：(\d+)mAh/, (match) => Number(match[1]), "mAh"),
      port: field(/USB接口类型 Type-C/, () => "USB Type-C"),
      launchPrice: { ...officialSpec(row.launchPrice, "", row.launchUrl, "CNY", launchPattern), priceType: "launch",
        market: "中国大陆", configuration: "12GB 运行内存 + 256GB 存储，国行基础版本", condition: "发布会公布的基础版本首发建议零售价，不采用后来修改的参数页价格" },
    },
    computed: {},
  };
}

const devices = rows.map((row) => row.family ? mainstreamDevice(row) : ({
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
  configurations: row.configurations.map((configuration) => ({ ...configuration,
    evidence: officialSpec(`${configuration.memory} + ${configuration.storage}`, "", row.officialUrl, undefined,
      new RegExp(`${row.modelName}（${configuration.memory}\\+${configuration.storage}${row.generationOrder > 1 && configuration.storage === "1TB" ? "卫星通信版" : ""}）：\\d+\\.00元`)),
  })),
  benchmarks: row.dxomarkUrl ? [{
    provider: "DXOMARK",
    metric: "camera",
    score: row.dxomarkScore,
    protocolVersion: row.dxomarkProtocol,
    sourceUrl: row.dxomarkUrl,
    verifiedAt: VERIFIED_AT,
    ...row.benchmarkEvidence,
  }] : [],
  specs: {
    chip: officialSpec(row.chip, `CPU 型号：${row.chip}`, row.officialUrl, undefined, new RegExp(`CPU型号 ${row.chip.replace(/高通 | /g, "")}(?:移动平台)?`)),
    screenSize: officialSpec(row.screenSize, `屏幕尺寸：${row.screenSize} 英寸`, row.officialUrl, "inch", new RegExp(`尺寸（英寸） ${String(row.screenSize).replace(".", "\\.")}英寸`)),
    displayType: officialSpec(row.displayType, `屏幕材质：${row.displayType}`, row.officialUrl, undefined, /屏幕材质 AMOLED/),
    resolution: officialSpec(row.resolution, `分辨率：${row.resolution}`, row.officialUrl, undefined, new RegExp(`分辨率 ${row.resolution.replace("x", " [x×] ")}`)),
    refreshRate: officialSpec(row.refreshRate, `最高支持 ${row.refreshRate}Hz 刷新率`, row.officialUrl, "Hz", new RegExp(`刷新率 (?:最高支持|1-)?${row.refreshRate}Hz`)),
    weight: { ...officialSpec(row.weight, `机身重量：${row.weight}g`, row.officialUrl, "g", /重量 [\s\S]+?g(?= 建议零售价)/),
      ...(row.generationOrder === 2 ? { note: "黑Ka、红圈约232g；银调约229g" }
        : row.generationOrder === 3 ? { note: "黑Ka约232g；胶片绿、银调约237g" } : {}),
    },
    memory: officialSpec(row.memory, `运行内存：${row.memory}`, row.officialUrl, undefined, /运行内存（RAM） 12GB\/16GB/),
    storage: officialSpec(row.storage, `机身存储：${row.storage}`, row.officialUrl, undefined, /机身存储（ROM） 256GB\/512GB\/1TB/),
    rearCamera: officialSpec(row.rearCamera, `后置摄像头像素：${row.rearCamera}`, row.officialUrl, undefined,
      /后置摄像头像素 [\s\S]+?(?= 后置摄像头光圈)/),
    mainCamera: officialSpec(row.mainCamera, row.mainCamera, row.cameraUrl ?? row.officialUrl, undefined,
      row.generationOrder > 1 ? new RegExp(`${row.generationOrder === 2 ? "5000万" : "2亿"}像素35mm 蔡司人文纪实镜头(?: II)?`) : /一英寸云台级主摄 5000 万像素[^]*?23mm 焦距/),
    telephoto: officialSpec(row.telephoto, row.telephoto, row.cameraUrl ?? row.officialUrl, undefined,
      row.generationOrder > 1 ? /2亿像素85mm 蔡司(?:APO超级长焦镜头 II|云台级长焦镜头)/ : /蔡司 2 亿 APO 超级长焦 2 亿像素[^]*?85mm 焦距/),
    frontCamera: officialSpec(row.frontCamera, `前置摄像头像素：${row.frontCamera}`, row.officialUrl, undefined, /前置摄像头像素 5000万像素/),
    batteryCapacity: officialSpec(parseInt(row.battery, 10), `电池典型容量：${row.battery}`, row.officialUrl, "mAh", new RegExp(`典型容量：${row.battery}`)),
    port: officialSpec("USB Type-C", "USB 接口类型：Type-C", row.officialUrl, undefined, /USB接口类型 Type-C/),
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
    newsroomUrl: row.launchUrl ?? null,
    referenceUrls: [row.releaseUrl, row.cameraUrl, row.dxomarkUrl].filter(Boolean),
    sourceStatus: "verified",
    notes: row.family ? "规格和当前存在的国行配置取自 vivo 中国参数页；首发价与开售日单独取自同期官方发布新闻，不将后来修改的建议零售价冒充首发价；配色重量差异保留原文，未核验评测分数与当前价留空。" : row.dxomarkUrl
      ? "规格、配置与中国大陆官方建议零售价取自 vivo 官网；开售日由发布报道核对；相机评分取自 DXOMARK Camera v6。"
      : "规格、配置与中国大陆官方建议零售价取自 vivo 官网；开售日由发布报道核对；未检索到对应 DXOMARK 相机测试，评分留空。",
  })),
};

await Promise.all([
  fs.writeFile(new URL("src/data/vivo-devices-db.json", ROOT), `${JSON.stringify({
    metadata: { version: "1.0", totalDevices: devices.length, generatedAt: new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai" }).format(new Date()) },
    devices,
  }, null, 2)}\n`),
  fs.writeFile(new URL("src/data/vivo-sources.json", ROOT), `${JSON.stringify(sources, null, 2)}\n`),
]);

console.log(`wrote ${devices.length} vivo X devices`);
