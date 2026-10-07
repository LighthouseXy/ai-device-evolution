import fs from "node:fs/promises";
import { getSourceSnapshot } from "./lib/source-snapshot.mjs";
import { verifyCameraScore } from "./lib/dxomark-snapshot.mjs";

const ROOT = new URL("../", import.meta.url);
const VERIFIED_AT = "2026-09-07";

const rows = [
  {
    id: "oppo-find-x7-ultra-2024",
    modelName: "OPPO Find X7 Ultra",
    generation: "X7 Ultra",
    generationOrder: 1,
    releaseYear: 2024,
    releaseDate: "2024-01-12",
    officialUrl: "https://www.oppo.com/cn/smartphones/series-find-x/find-x7-ultra/specs/",
    launchUrl: "https://www.ithome.com/0/743/979.htm",
    chip: "高通 第三代骁龙 8",
    screenSize: 6.82,
    displayType: "AMOLED LTPO 柔性屏",
    resolution: "3168x1440",
    refreshRate: 120,
    weight: 221,
    memory: "12GB / 16GB",
    storage: "256GB / 512GB",
    configurations: [
      { memory: "12GB", storage: "256GB" },
      { memory: "16GB", storage: "256GB" },
      { memory: "16GB", storage: "512GB" },
    ],
    battery: "5000mAh",
    rearCamera: "5000 万像素主摄 + 5000 万像素超广角 + 5000 万像素长焦 + 5000 万像素超长焦",
    mainCamera: "5000 万像素 23mm 主摄",
    telephoto: "5000 万像素 65mm 长焦 + 5000 万像素 135mm 超长焦",
    frontCamera: "3200 万像素",
    waterResistance: "IP68",
    launchPrice: 5999,
    launchConfiguration: "12GB 运行内存 + 256GB 存储，中国大陆版本",
    launchRawText: "12GB+256GB 售价 5999 元",
    dxomarkScore: 157,
    dxomarkProtocol: "Camera v5",
    dxomarkUrl: "https://www.dxomark.com/oppo-find-x7-ultra-camera-test/",
  },
  {
    id: "oppo-find-x8-ultra-2025",
    modelName: "OPPO Find X8 Ultra",
    generation: "X8 Ultra",
    generationOrder: 2,
    releaseYear: 2025,
    releaseDate: "2025-04-16",
    officialUrl: "https://www.oppo.com/cn/smartphones/series-find-x/find-x8-ultra/specs/",
    launchUrl: "https://m.ithome.com/html/844379.htm",
    chip: "高通 骁龙 8 至尊版",
    screenSize: 6.82,
    displayType: "AMOLED 柔性屏",
    resolution: "3168x1440",
    refreshRate: 120,
    weight: 226,
    memory: "12GB / 16GB",
    storage: "256GB / 512GB",
    configurations: [
      { memory: "12GB", storage: "256GB" },
      { memory: "16GB", storage: "512GB" },
    ],
    battery: "6100mAh",
    rearCamera: "5000 万像素主摄 + 5000 万像素超广角 + 5000 万像素长焦 + 5000 万像素超长焦",
    mainCamera: "5000 万像素 23mm 主摄",
    telephoto: "5000 万像素 70mm 长焦 + 5000 万像素 135mm 超长焦",
    frontCamera: "3200 万像素",
    waterResistance: "IP68 / IP69",
    launchPrice: 6499,
    launchConfiguration: "12GB 运行内存 + 256GB 存储，中国大陆版本",
    launchRawText: "12GB+256GB 版 6499 元",
    dxomarkScore: 168,
    dxomarkProtocol: "Camera v6",
    dxomarkUrl: "https://www.dxomark.com/oppo-find-x8-ultra-camera-test/",
  },
  {
    id: "oppo-find-x9-ultra-2026",
    modelName: "OPPO Find X9 Ultra",
    generation: "X9 Ultra",
    generationOrder: 3,
    releaseYear: 2026,
    releaseDate: "2026-04-23",
    officialUrl: "https://www.oppo.com/cn/smartphones/series-find-x/find-x9-ultra/specs/",
    displayUrl: "https://detail.zol.com.cn/2165/2164063/param.shtml",
    launchUrl: "https://www.ithome.com/0/941/820.htm",
    chip: "高通 第五代骁龙 8 至尊版",
    screenSize: 6.82,
    displayType: "AMOLED 直面屏",
    resolution: "3168x1440",
    refreshRate: 144,
    weight: 235,
    memory: "12GB / 16GB",
    storage: "256GB / 512GB / 1TB",
    configurations: [
      { memory: "12GB", storage: "256GB" },
      { memory: "12GB", storage: "512GB" },
      { memory: "16GB", storage: "512GB" },
      { memory: "16GB", storage: "1TB" },
    ],
    battery: "7050mAh",
    rearCamera: "2 亿像素主摄 + 5000 万像素超广角 + 2 亿像素长焦 + 5000 万像素超长焦",
    mainCamera: "200MP（2 亿像素）23mm 主摄",
    telephoto: "2 亿像素 70mm 长焦 + 5000 万像素 230mm 超长焦",
    frontCamera: "5000 万像素",
    waterResistance: "IP66 / IP68 / IP69",
    launchPrice: 7499,
    launchConfiguration: "12GB 运行内存 + 256GB 存储，中国大陆版本",
    launchRawText: "12GB+256GB 规格：定价 7499 元",
    dxomarkScore: 170,
    dxomarkProtocol: "Camera v6",
    dxomarkUrl: "https://www.dxomark.com/oppo-find-x9-ultra-camera-test/",
  },
];

for (const [slug, modelName, releaseYear, releaseDate, launchPrice, family, generationOrder, launchUrl] of [
  ["find-x8", "OPPO Find X8", 2024, "2024-10-30", 4199, "Find X", 1, "https://www.ithome.com/0/804/972.htm"],
  ["find-x8-pro", "OPPO Find X8 Pro", 2024, "2024-10-30", 5299, "Find X Pro", 1, "https://www.ithome.com/0/804/972.htm"],
  ["find-x9", "OPPO Find X9", 2025, "2025-10-22", 4399, "Find X", 2, "https://m.ithome.com/html/890054.htm"],
  ["find-x9-pro", "OPPO Find X9 Pro", 2025, "2025-10-22", 5299, "Find X Pro", 2, "https://m.ithome.com/html/890054.htm"],
  ["find-x10", "OPPO Find X10", 2026, "2026-09-24", 5499, "Find X", 3, "https://www.ithome.com/1/005/944.htm"],
  ["find-x10-pro-max", "OPPO Find X10 Pro Max", 2026, "2026-09-24", 6799, "Find X Pro Max", 1, "https://m.ithome.com/html/1005943.htm"],
  ["find-x10-e", "OPPO Find X10 E", 2026, "2026-09-24", 4999, "Find X E", 1, "https://www.ithome.com/1/005/955.htm"],
]) {
  rows.push({ id: `oppo-${slug}-${releaseYear}`, modelName, releaseYear, releaseDate, launchPrice, family, generationOrder,
    generation: modelName.replace("OPPO Find ", ""), comparisonGroupId: `oppo.phone.${family.toLowerCase().replaceAll(" ", "-")}.standard`,
    officialUrl: `https://www.oppo.com/cn/smartphones/series-find-x/${slug}/specs/`, launchUrl,
    releaseUrl: releaseYear === 2026 ? "https://www.ithome.com/1/006/564.htm" : launchUrl,
  });
}

const sourcePages = new Map();
for (const row of rows) {
  row.productUrl = row.officialUrl.replace(/specs\/$/, "");
  for (const url of [row.officialUrl, row.productUrl, row.displayUrl, row.launchUrl, row.releaseUrl].filter(Boolean)) {
    const page = await getSourceSnapshot(url, {
      offline: process.argv.includes("--offline"), refresh: process.argv.includes("--refresh"),
      validate(html) {
        const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ");
        if (!(url === row.releaseUrl || (row.family && url === row.launchUrl)) && !title?.includes(row.modelName)) throw new Error(`${row.id}: 页面身份不符`);
        if (row.family && url === row.launchUrl && !html.includes(row.modelName.replace("OPPO ", ""))) throw new Error(`${row.id}: 发布报道身份不符`);
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
      sourceType: new URL(sourceUrl).hostname === "www.oppo.com" ? "official" : "reference",
      confidence: new URL(sourceUrl).hostname === "www.oppo.com" ? 1 : 0.85,
      verifiedAt: page.fetchedAt.slice(0, 10), fetchedAt: page.fetchedAt,
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
    ...officialSpec(row.launchPrice, "", row.launchUrl, "CNY",
      new RegExp(`12GB\\s*\\+\\s*256GB (?:售价|版|规格：定价) ${row.launchPrice} 元`)),
    confidence: 0.7,
    priceType: "launch",
    market: "中国大陆",
    configuration: row.launchConfiguration,
    condition: "中国大陆首发起售价",
  };
}

function mainstreamDevice(row) {
  const text = sourcePages.get(row.officialUrl).text;
  const field = (pattern, value, unit) => {
    const match = text.match(pattern);
    if (!match) throw new Error(`${row.id}: 官方字段缺失 ${pattern}，整批未写入`);
    return officialSpec(value(match), "", row.officialUrl, unit, pattern);
  };
  const configPattern = /运行内存容量 \+ 机身存储容量 (.+?)(?=RAM 规格)/;
  const configText = text.match(configPattern)?.[1];
  if (!configText) throw new Error(`${row.id}: 配置组合缺失`);
  const configurations = [...configText.matchAll(/(\d+GB)\+(\d+(?:GB|TB))/g)].map((match) => ({
    memory: match[1], storage: match[2], evidence: officialSpec(`${match[1]} + ${match[2]}`, "", row.officialUrl, undefined, configPattern),
  }));
  if (!configurations.length || !configurations.some(({ memory, storage }) => memory === "12GB" && storage === "256GB")) throw new Error(`${row.id}: 首发配置未获官方支持`);
  const rearPattern = /摄像头 后置 (.+?)(?= 前置)/;
  const cameraNames = (content) => [...content.matchAll(/(?:\d+\s*万|\d+\s*亿)像素[^：]+摄像头/g)].map((match) => match[0]);
  const launchPattern = new RegExp(`${row.modelName} [^]{0,1200}?12(?:GB)?\\+256GB(?: 版本| 售价|：)\\s*${row.launchPrice} 元`);
  const [, month, day] = row.releaseDate.split("-").map(Number);
  if (!sourcePages.get(row.releaseUrl).text.match(new RegExp(`${month} 月 ${day} 日[^。]{0,100}开售`))) throw new Error(`${row.id}: 开售日原文缺失`);
  const weight = field(/ 重量 (.+?)(?= 存储 2)/, (match) => Number(match[1].match(/(?:约 )?(\d+) 克/)?.[1]), "g");
  if (!Number.isFinite(weight.value)) throw new Error(`${row.id}: 重量单位变化`);
  weight.note = weight.rawText;
  const specs = {
    chip: field(/芯片 移动平台 (.+?)(?=，)/, (match) => match[1]),
    screenSize: field(/显示 尺寸 (\d+(?:\.\d+)?) 英寸/, (match) => Number(match[1]), "inch"),
    displayType: field(/ 类型 (.+?)(?= (?:最高支持|1-120Hz|60\/90\/120Hz))/, (match) => match[1]),
    resolution: field(/分辨率 (?:FHD\+ )?(\d+)×(\d+) 像素/, (match) => `${match[1]}x${match[2]}`),
    refreshRate: field(/最高支持 (\d+)Hz(?: 刷新率|（[^）]+）)?/, (match) => Number(match[1]), "Hz"),
    weight,
    memory: field(configPattern, () => [...new Set(configurations.map(({ memory }) => memory))].join(" / ")),
    storage: field(configPattern, () => [...new Set(configurations.map(({ storage }) => storage))].join(" / ")),
    rearCamera: field(rearPattern, (match) => cameraNames(match[1]).join(" + ")),
    mainCamera: field(/((\d+)\s*(万|亿)像素(?:大底)?广角摄像头：[\s\S]+?等效焦距 \d+ 毫米)/, (match) => `${match[3] === "亿" ? Number(match[2]) * 100 : Number(match[2]) / 100}MP（${match[1]}）`),
    telephoto: field(rearPattern, (match) => cameraNames(match[1]).filter((name) => /长焦|哈苏人像/.test(name)).join(" + ")),
    frontCamera: field(/前置 (\d+\s*万像素)摄像头/, (match) => match[1]),
    batteryCapacity: field(/电池容量 3 (\d+) mAh\/[\d.]+ Wh（典型值）/, (match) => Number(match[1]), "mAh"),
    port: field(/数据接口 (?:USB )?Type-C/, () => "USB Type-C"),
    launchPrice: { ...officialSpec(row.launchPrice, "", row.launchUrl, "CNY", launchPattern), priceType: "launch", market: "中国大陆",
      configuration: "12GB 运行内存 + 256GB 存储，国行基础版本", condition: "发布报道中的基础版首发价格，非当前价" },
  };
  if (row.releaseYear === 2026 && /144Hz/.test(specs.refreshRate.rawText)) specs.refreshRate.note = "144Hz 只在部分游戏场景生效";
  return { id: row.id, brand: "OPPO", market: "CN", category: "phone", series: row.family, family: row.family, variant: "standard",
    modelName: row.modelName, generation: row.generation, generationOrder: row.generationOrder, releaseYear: row.releaseYear,
    releaseDate: row.releaseDate, comparisonGroupId: row.comparisonGroupId, configurations, specs, benchmarks: [], computed: {} };
}

const devices = rows.map((row) => row.family ? mainstreamDevice(row) : ({
  id: row.id,
  brand: "OPPO",
  market: "CN",
  category: "phone",
  series: "Find X Ultra",
  family: "Find X Ultra",
  variant: "standard",
  modelName: row.modelName,
  generation: row.generation,
  generationOrder: row.generationOrder,
  releaseYear: row.releaseYear,
  releaseDate: row.releaseDate,
  comparisonGroupId: "oppo.phone.find-x-ultra.standard",
  configurations: row.configurations.map((configuration) => ({ ...configuration,
    evidence: officialSpec(`${configuration.memory} + ${configuration.storage}`, "", row.officialUrl, undefined,
      new RegExp(`运行内存容量 \\+ 机身存储容量 (?=[^R]*${configuration.memory}\\+${configuration.storage}(?:，| ))[^R]+(?=RAM 规格)`)),
  })),
  benchmarks: [{
    provider: "DXOMARK",
    metric: "camera",
    score: row.dxomarkScore,
    protocolVersion: row.dxomarkProtocol,
    sourceUrl: row.dxomarkUrl,
    verifiedAt: VERIFIED_AT,
    ...row.benchmarkEvidence,
  }],
  specs: {
    chip: officialSpec(row.chip, `移动平台：${row.chip}`, row.officialUrl, undefined, new RegExp(`移动平台 (?:高通)?${row.chip.replace("高通 ", "").replaceAll(" ", "").replace("骁龙", "骁龙®")}移动平台`)),
    screenSize: officialSpec(row.screenSize, `显示尺寸：${row.screenSize} 英寸`, row.officialUrl, "inch", /尺寸 6\.82 英寸/),
    displayType: officialSpec(row.displayType, `显示类型：${row.displayType}`, row.displayUrl ?? row.officialUrl, undefined,
      row.generationOrder < 3 ? /类型 AMOLED (?:LTPO )?柔性屏/ : /屏幕类型 全面屏（中置挖孔屏），\s*直面屏.*?屏幕材质 柔性AMOLED/),
    resolution: officialSpec(row.resolution, `分辨率：${row.resolution} 像素`, row.officialUrl, undefined, /分辨率 (?:QHD\+ )?3168×1440 像素/),
    refreshRate: { ...officialSpec(row.refreshRate, `最高支持 ${row.refreshRate}Hz 刷新率`, row.officialUrl, "Hz", new RegExp(`(?:最高支持 |1～)${row.refreshRate}Hz (?:自适应)?刷新率(?:（[^）]+）)?`)),
      ...(row.generationOrder === 3 ? { note: "144Hz 只在部分游戏场景生效" } : {}),
    },
    weight: { ...officialSpec(row.weight, `重量：约 ${row.weight} 克`, row.officialUrl, "g", /重量 (?:约 )?\d+ 克[\s\S]*?(?= 存储 2)/),
      ...(row.generationOrder === 3 ? { note: "极地冰川、绒砂峡谷约235g；大地苔原约236g" } : {}),
    },
    memory: officialSpec(row.memory, `运行内存容量：${row.memory}`, row.officialUrl, undefined, /运行内存容量 \+ 机身存储容量 [^R]+(?=RAM 规格)/),
    storage: officialSpec(row.storage, `机身存储容量：${row.storage}`, row.officialUrl, undefined, /运行内存容量 \+ 机身存储容量 [^R]+(?=RAM 规格)/),
    rearCamera: { ...officialSpec(row.rearCamera, `后置摄像头：${row.rearCamera}`, row.officialUrl, undefined,
      /摄像头 后置 [\s\S]+?(?= 前置)/),
      ...(row.generationOrder === 2 ? { note: "另有200万像素丹霞原彩镜头" }
        : row.generationOrder === 3 ? { note: "另有第二代丹霞色彩还原镜头，官网未列像素数" } : {}),
    },
    mainCamera: officialSpec(row.mainCamera, row.mainCamera, row.officialUrl, undefined,
      /(?:5000 万|2 亿)像素\s*(?:1 英寸大底)?广角摄像头：[\s\S]+?等效焦距 23 毫米/),
    telephoto: officialSpec(row.telephoto, row.telephoto, row.officialUrl, undefined,
      /(?:5000 万|2 亿)像素(?:超光感潜望)?长焦摄像头：[\s\S]+?等效焦距 (?:135|230) 毫米/),
    frontCamera: officialSpec(row.frontCamera, `前置摄像头：${row.frontCamera}`, row.officialUrl, undefined, new RegExp(`前置 ${row.frontCamera}摄像头：[^，]+`)),
    batteryCapacity: officialSpec(parseInt(row.battery, 10), `电池典型容量：${row.battery}`, row.officialUrl, "mAh",
      row.generationOrder === 1 ? /典型容量：2500 mAh（双电芯串联设计，等效于 5000 mAh）/
        : row.generationOrder === 2 ? /2×3050 mAh\/23\.38 Wh（典型值），等效 6100 mAh/ : /7050 mAh\/26\.23 Wh（典型值）/),
    port: officialSpec("USB Type-C", "数据接口：USB Type-C", row.officialUrl, undefined, /数据接口 USB Type-C/),
    waterResistance: {
      ...officialSpec(row.waterResistance, "", row.productUrl, undefined,
        row.generationOrder === 1 ? /IP68 级防尘抗水/
          : row.generationOrder === 2 ? /IP69 & IP68 级防尘抗水/ : /IP66 & IP68 & IP69 超强防水/),
      note: "受控实验室测试等级，防护能力可能随磨损下降；不代表可日常浸水使用。",
    },
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
    sourcePageType: "official_spec_reference_launch_and_benchmark",
    officialSpecUrl: row.officialUrl,
    supportUrl: null,
    newsroomUrl: null,
    referenceUrls: [row.launchUrl, row.productUrl, row.displayUrl, row.dxomarkUrl, row.releaseUrl].filter(Boolean),
    sourceStatus: "verified",
    notes: row.family ? "规格和明确内存存储组合取自 OPPO 中国官网；国行基础配置首发价及开售日取自同期发布报道；配色重量和高刷场景限制保留原文；未核验的当前价、二手价和评测评分留空。" : "规格与配置取自 OPPO 中国官网，Find X9 Ultra 屏幕材质由中关村在线补充；中国大陆首发价格取自发布报道；相机评分取自 DXOMARK，并保留测试协议版本。",
  })),
};

await Promise.all([
  fs.writeFile(new URL("src/data/oppo-devices-db.json", ROOT), `${JSON.stringify({
    metadata: { version: "1.0", totalDevices: devices.length, generatedAt: new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai" }).format(new Date()) },
    devices,
  }, null, 2)}\n`),
  fs.writeFile(new URL("src/data/oppo-sources.json", ROOT), `${JSON.stringify(sources, null, 2)}\n`),
]);

console.log(`wrote ${devices.length} OPPO Find X devices`);
