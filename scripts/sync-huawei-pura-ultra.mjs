import fs from "node:fs/promises";
import { getSourceSnapshot } from "./lib/source-snapshot.mjs";
import { verifyCameraScore } from "./lib/dxomark-snapshot.mjs";

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
    cameraUrl: "https://detail.zol.com.cn/2000/1999701/param.shtml",
    chipUrl: "https://g.pconline.com.cn/product/mobile/huawei/2191939_detail.html",
    chinaReferenceUrl: "https://www.ithome.com/0/819/021.htm",
    chinaSupportUrl: "https://consumer.huawei.com/cn/support/content/zh-cn16090854/",
    launchReferenceUrl: "https://www.ithome.com/0/762/559.htm",
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
    launchReferenceUrl: "https://www.ithome.com/0/863/748.htm",
    launchUrl: "https://consumer.huawei.com/cn/phones/pura80-ultra/",
    chip: "麒麟 9020",
    chipUrl: "https://ku.ithome.com/item/46651/canshu.html",
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

const sourcePages = new Map();
for (const row of rows) {
  const options = { offline: process.argv.includes("--offline"), refresh: process.argv.includes("--refresh") };
  for (const url of [row.chinaReferenceUrl ?? row.officialUrl, row.chinaSupportUrl, row.launchReferenceUrl, row.chipUrl, row.cameraUrl].filter(Boolean)) {
    const page = await getSourceSnapshot(url, { ...options, validate(html) {
      if (!html.replace(/\s/g, "").includes(row.generation.replace(/\s/g, ""))) throw new Error(`${row.id}: 来源没有目标型号`);
    } });
    page.text = page.html.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    sourcePages.set(url, page);
  }
  row.specUrl = row.chinaReferenceUrl ?? row.officialUrl;
  row.benchmarkEvidence = await verifyCameraScore(row.modelName, row.dxomarkScore, row.dxomarkUrl, options);
}

function officialSpec(value, rawText, sourceUrl, unit, pattern) {
  if (pattern) {
    const page = sourcePages.get(sourceUrl);
    const excerpt = page.text.match(pattern)?.[0];
    if (!excerpt) throw new Error(`${sourceUrl}: 原文证据缺失 ${pattern}，整批未写入`);
    const reference = new URL(sourceUrl).hostname !== "consumer.huawei.com";
    return { value, ...(unit ? { unit } : {}), rawText: excerpt, evidenceKind: "excerpt", sourceUrl,
      sourceType: reference ? "reference" : "official", confidence: reference ? 0.85 : 1,
      verifiedAt: page.fetchedAt.slice(0, 10), fetchedAt: page.fetchedAt, sourceSnapshotHash: page.sha256 };
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
    ...(row.generationOrder === 1 ? [{ memory: "12GB", storage: "512GB" }] : []),
    { memory: "16GB", storage: "512GB" },
    { memory: "16GB", storage: "1TB" },
  ].map((configuration) => ({ ...configuration,
    evidence: officialSpec(`${configuration.memory} + ${configuration.storage}`, "", row.chinaSupportUrl, undefined,
      new RegExp(`HUAWEI ${row.generation}\\([^)]*${configuration.memory.replace("GB", "(?:gb)?")}\\+${configuration.storage === "1TB" ? "1tb?" : "512gb"}[^)]*\\)`, "i")),
  })),
  benchmarks: [{
    provider: "DXOMARK",
    metric: "camera",
    score: row.dxomarkScore,
    protocolVersion: row.dxomarkProtocol,
    sourceUrl: row.dxomarkUrl,
    ...row.benchmarkEvidence,
  }],
  specs: {
    chip: officialSpec(row.chip, `处理器：${row.chip}`, row.chipUrl ?? row.officialUrl, undefined,
      row.generationOrder === 2 ? /CPU型号： 华为海思 麒麟9020/ : /CPU品牌 华为海思 CPU 麒麟9010/),
    screenSize: officialSpec(row.screenSize, "", row.specUrl, "inch", /6\.8 英寸/),
    displayType: officialSpec("LTPO OLED", "", row.specUrl, undefined,
      row.generationOrder === 1 ? /OLED 屏，支持 1-120Hz LTPO 自适应刷新率/ : /OLED，支持 1-120 Hz LTPO 自适应刷新率/),
    resolution: officialSpec(row.resolution, "", row.specUrl, undefined, new RegExp(row.resolution.replace("x", "\\s*[×x]\\s*"))),
    refreshRate: officialSpec(120, "", row.specUrl, "Hz", /1-120\s*Hz LTPO 自适应刷新率/),
    weight: officialSpec(row.weight, "", row.specUrl, "g", new RegExp(`约 ${String(row.weight).replace(".", "\\.")} 克`)),
    memory: officialSpec(row.generationOrder === 1 ? "12GB / 16GB" : "16GB", "", row.chinaSupportUrl, undefined, new RegExp(`HUAWEI ${row.generation}\\([^)]*\\)`)),
    storage: officialSpec("512GB / 1TB", "", row.chinaSupportUrl, undefined, new RegExp(`HUAWEI ${row.generation}\\([^)]*\\)`)),
    rearCamera: {
      ...officialSpec(row.rearCamera, row.rearCamera, row.cameraUrl ?? row.officialUrl, undefined,
        row.generationOrder === 2 ? /5000 万像素一英寸超高动态摄像头.*?150 万多光谱通道红枫原色摄像头/
          : /摄像头名称 后置摄像头1：超聚光伸缩摄像头.*?传感器尺寸 1\/1"/),
      ...(row.generationOrder === 2 ? { note: "另有 150 万多光谱通道红枫原色摄像头" } : {}),
    },
    mainCamera: officialSpec("50MP（5000 万像素）一英寸主摄", "5000 万像素一英寸主摄", row.cameraUrl ?? row.officialUrl, undefined,
      row.generationOrder === 2 ? /5000 万像素一英寸超高动态摄像头（[^）]+）/
        : /摄像头名称 后置摄像头1：超聚光伸缩摄像头.*?传感器尺寸 1\/1"/),
    telephoto: officialSpec(row.telephoto, row.telephoto, row.generationOrder === 1 ? row.launchReferenceUrl : row.officialUrl, undefined,
      row.generationOrder === 2 ? /5000 万像素超大底长焦摄像头.*?支持 3\.7 倍和 9\.4 倍光学变焦（[^）]+）/ : /5000 万像素超聚光微距长焦摄像头（[^）]+）/),
    frontCamera: officialSpec("1300 万像素", "", row.specUrl, undefined, /1300 万像素超广角摄像头/),
    batteryCapacity: officialSpec(parseInt(row.battery, 10), "", row.specUrl, "mAh", new RegExp(`${parseInt(row.battery, 10)}\\s*mAh(?:（典型值）)?`)),
    port: officialSpec("USB Type-C", "", row.specUrl, undefined, row.generationOrder === 1 ? /Type-C（USB 3\.1 Gen1）/ : /数据线接口 USB Type-C，USB 3\.1 Gen 1/),
    launchPrice: {
      ...officialSpec(row.launchPrice, "", row.launchReferenceUrl, "CNY",
        row.generationOrder === 1 ? /16GB \+ 512GB 定价 9999 元/ : /16GB\+512GB 版 9999 元/),
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
    officialSpecUrl: row.officialUrl ?? null,
    supportUrl: row.chinaSupportUrl,
    newsroomUrl: row.launchUrl,
    referenceUrls: [row.chipUrl, row.cameraUrl, row.chinaReferenceUrl, row.launchReferenceUrl, row.dxomarkUrl].filter(Boolean),
    sourceStatus: "verified",
    notes: row.generationOrder === 1
      ? "中国大陆原产品规格页已下线；核心规格、长焦与首发价取自IT之家国行报道，主摄参数取自中关村在线、芯片取自太平洋产品库；12GB+512GB为2024年12月后增配置，配置由华为中文支持页确认；首发价保持初始16GB+512GB口径，相机评分取自 DXOMARK Camera v5。"
      : "规格与配置取自华为中国官网及中文支持页；芯片由IT之家产品百科补充，中国大陆首发价由开售报道核验；相机评分取自 DXOMARK Camera v6。",
  })),
};

await Promise.all([
  fs.writeFile(new URL("src/data/huawei-devices-db.json", ROOT), `${JSON.stringify({
    metadata: { version: "1.0", totalDevices: devices.length, generatedAt: new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai" }).format(new Date()) },
    devices,
  }, null, 2)}\n`),
  fs.writeFile(new URL("src/data/huawei-sources.json", ROOT), `${JSON.stringify(sources, null, 2)}\n`),
]);

console.log(`wrote ${devices.length} HUAWEI Pura Ultra devices`);
