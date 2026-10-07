import fs from "node:fs/promises";
import { getSourceSnapshot } from "./lib/source-snapshot.mjs";
import { verifyCameraScore } from "./lib/dxomark-snapshot.mjs";

const ROOT = new URL("../", import.meta.url);
const VERIFIED_AT = "2026-09-07";
const RECENT_CONFIGURATIONS = [
  { memory: "12GB", storage: "256GB" },
  { memory: "16GB", storage: "512GB" },
  { memory: "16GB", storage: "1TB" },
];

const rows = [
  {
    id: "xiaomi-mi-10-ultra-2020",
    modelName: "小米 10 至尊纪念版",
    generation: "10 Ultra",
    generationOrder: 1,
    releaseYear: 2020,
    releaseDate: "2020-08-16",
    sourceUrl: "https://detail.zol.com.cn/1336/1335092/param.shtml",
    launchUrl: "https://www.ithome.com/0/502/799.htm",
    chip: "高通 骁龙 865",
    screenSize: 6.67,
    displayType: "AMOLED",
    resolution: "2340x1080",
    refreshRate: 120,
    weight: 221.8,
    memory: "16GB",
    storage: "512GB",
    configurations: [{ memory: "16GB", storage: "512GB" }],
    battery: "4500mAh",
    rearCamera: "4800 万像素主摄 + 2000 万像素超广角 + 1200 万像素长焦 + 4800 万像素超长焦",
    mainCamera: "4800 万像素",
    telephoto: "1200 万像素 50mm 长焦 + 4800 万像素 120mm 超长焦",
    frontCamera: "2000 万像素",
    launchPrice: 6999,
    launchConfiguration: "16GB 运行内存 + 512GB 存储，中国大陆版本",
    launchRawText: "16GB+512GB 售价 6999 元",
    launchPattern: /16GB\+512GB售价6999元/,
    dxomarkScore: 133,
    dxomarkProtocol: "Camera v4",
    dxomarkUrl: "https://www.dxomark.com/updated-xiaomi-mi-10-ultra-camera-review-the-zoom-king-v4camera/",
  },
  {
    id: "xiaomi-mi-11-ultra-2021",
    modelName: "小米 11 Ultra",
    generation: "11 Ultra",
    generationOrder: 2,
    releaseYear: 2021,
    releaseDate: "2021-04-02",
    sourceUrl: "https://detail.zol.com.cn/1360/1359446/param.shtml",
    launchUrl: "https://www.ithome.com/0/542/941.htm",
    chip: "高通 骁龙 888",
    screenSize: 6.81,
    displayType: "AMOLED",
    resolution: "3200x1440",
    refreshRate: 120,
    weight: 234,
    memory: "8GB / 12GB",
    storage: "256GB / 512GB",
    configurations: [
      { memory: "8GB", storage: "256GB" },
      { memory: "12GB", storage: "256GB" },
      { memory: "12GB", storage: "512GB" },
    ],
    battery: "5000mAh",
    rearCamera: "5000 万像素主摄 + 4800 万像素超广角 + 4800 万像素超长焦",
    mainCamera: "5000 万像素",
    telephoto: "4800 万像素 120mm 超长焦",
    frontCamera: "2000 万像素",
    launchPrice: 5999,
    launchConfiguration: "8GB 运行内存 + 256GB 存储，中国大陆版本",
    launchRawText: "8GB+256GB 售价 5999 元",
    launchPattern: /8\+256GB 版本为 5999 元/,
    dxomarkScore: 141,
    dxomarkProtocol: "Camera v5",
    dxomarkUrl: "https://www.dxomark.com/xiaomi-mi-11-ultra-camera-review-large-sensor-power/",
  },
  {
    id: "xiaomi-12s-ultra-2022",
    modelName: "小米 12S Ultra",
    generation: "12S Ultra",
    generationOrder: 3,
    releaseYear: 2022,
    releaseDate: "2022-07-08",
    sourceUrl: "https://detail.zol.com.cn/1419/1418084/param.shtml",
    launchUrl: "https://m.ithome.com/html/628487.htm",
    chip: "高通 骁龙 8+ Gen 1",
    screenSize: 6.73,
    displayType: "AMOLED（LTPO）",
    resolution: "3200x1440",
    refreshRate: 120,
    weight: 225,
    memory: "8GB / 12GB",
    storage: "256GB / 512GB",
    configurations: [
      { memory: "8GB", storage: "256GB" },
      { memory: "12GB", storage: "256GB" },
      { memory: "12GB", storage: "512GB" },
    ],
    battery: "4860mAh",
    rearCamera: "5000 万像素主摄 + 4800 万像素超广角 + 4800 万像素超长焦",
    mainCamera: "5000 万像素",
    telephoto: "4800 万像素 120mm 超长焦",
    frontCamera: "3200 万像素",
    launchPrice: 5999,
    launchConfiguration: "8GB 运行内存 + 256GB 存储，中国大陆版本",
    launchRawText: "8GB+256GB 售价 5999 元",
    launchPattern: /8 \+ 256GB：5999 元/,
    dxomarkScore: 136,
    dxomarkProtocol: "Camera v5",
    dxomarkUrl: "https://www.dxomark.com/xiaomi-12s-ultra-camera-test-retested/",
  },
  {
    id: "xiaomi-13-ultra-2023",
    modelName: "小米 13 Ultra",
    generation: "13",
    generationOrder: 4,
    releaseYear: 2023,
    releaseDate: "2023-04-21",
    sourceUrl: "https://detail.zol.com.cn/1514/1513122/param.shtml",
    launchUrl: "https://www.ithome.com/0/687/901.htm",
    chip: "高通 骁龙 8 Gen 2",
    screenSize: 6.73,
    displayType: "OLED（LTPO）",
    resolution: "3200x1440",
    refreshRate: 120,
    weight: 227,
    memory: "12GB / 16GB",
    storage: "256GB / 512GB / 1TB",
    configurations: RECENT_CONFIGURATIONS,
    battery: "5000mAh",
    rearCamera: "5000 万像素主摄 + 5000 万像素超广角 + 5000 万像素长焦 + 5000 万像素超长焦",
    mainCamera: "5000 万像素",
    telephoto: "5000 万像素 75mm 长焦 + 5000 万像素 120mm 超长焦",
    frontCamera: "3200 万像素",
    launchPrice: 5999,
    launchConfiguration: "12GB 运行内存 + 256GB 存储，中国大陆版本",
    launchRawText: "12GB+256GB 参考价：5999 元",
    launchPattern: /12GB\+256GB、16GB\+512GB 以及 16GB\+1TB 三种内存版本可选，售价分别为 5999 元、6499 元以及 7299 元/,
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
    generationOrder: 5,
    releaseYear: 2024,
    releaseDate: "2024-02-27",
    sourceUrl: "https://detail.zol.com.cn/1983/1982924/param.shtml",
    launchUrl: "https://www.ithome.com/0/751/479.htm",
    chip: "高通 骁龙 8 Gen 3",
    screenSize: 6.73,
    displayType: "AMOLED",
    resolution: "3200x1440",
    refreshRate: 120,
    weight: 224.4,
    memory: "12GB / 16GB",
    storage: "256GB / 512GB / 1TB",
    configurations: RECENT_CONFIGURATIONS,
    battery: "5300mAh",
    rearCamera: "5000 万像素主摄 + 5000 万像素超广角 + 5000 万像素长焦 + 5000 万像素超长焦",
    mainCamera: "5000 万像素",
    telephoto: "5000 万像素长焦 + 5000 万像素超长焦",
    frontCamera: "3200 万像素",
    launchPrice: 6499,
    launchConfiguration: "12GB 运行内存 + 256GB 存储，中国大陆版本",
    launchRawText: "12GB+256GB 参考价：6499 元",
    launchPattern: /12\+256GB 版本 6499 元/,
    currentPrice: 6199,
    currentSource: "天猫 ¥6199",
    dxomarkScore: 149,
    dxomarkProtocol: "Camera v5",
    dxomarkUrl: "https://www.dxomark.com/xiaomi-14-ultra-camera-test/",
  },
  {
    id: "xiaomi-15-ultra-2025",
    modelName: "小米 15 Ultra",
    generation: "15",
    generationOrder: 6,
    releaseYear: 2025,
    releaseDate: "2025-03-03",
    sourceUrl: "https://detail.zol.com.cn/2122/2121957/param.shtml",
    launchUrl: "https://www.ithome.com/0/834/153.htm",
    chip: "高通 骁龙 8 Elite",
    screenSize: 6.73,
    displayType: "AMOLED",
    resolution: "3200x1440",
    refreshRate: 120,
    weight: 226,
    memory: "12GB / 16GB",
    storage: "256GB / 512GB / 1TB",
    configurations: RECENT_CONFIGURATIONS,
    battery: "6000mAh",
    rearCamera: "5000 万像素主摄 + 5000 万像素超广角 + 5000 万像素长焦 + 2 亿像素超长焦",
    mainCamera: "5000 万像素",
    telephoto: "5000 万像素 70mm 长焦 + 2 亿像素 100mm 超长焦",
    frontCamera: "3200 万像素",
    launchPrice: 6499,
    launchConfiguration: "12GB 运行内存 + 256GB 存储，中国大陆版本",
    launchRawText: "12GB+256GB 参考价：6499 元",
    launchPattern: /12GB \+ 256GB 定价 6499 元/,
    currentPrice: 6499,
    currentSource: "京东 ¥6499",
    dxomarkScore: 159,
    dxomarkProtocol: "Camera v6",
    dxomarkUrl: "https://www.dxomark.com/xiaomi-15-ultra-camera-test-retested/",
  },
  {
    id: "xiaomi-17-ultra-2025",
    modelName: "小米 17 Ultra",
    generation: "17",
    generationOrder: 7,
    releaseYear: 2025,
    releaseDate: "2025-12-25",
    sourceUrl: "https://detail.zol.com.cn/series/57/34645/param_10922118_0_1.html",
    officialUrl: "https://www.mi.com/prod/xiaomi-17-ultra",
    launchUrl: "https://www.ithome.com/0/908/012.htm",
    chip: "高通 骁龙 8 Elite Gen 5",
    screenSize: 6.9,
    displayType: "AMOLED",
    resolution: "2608x1200",
    refreshRate: 120,
    weight: 223.4,
    memory: "12GB / 16GB",
    storage: "512GB / 1TB",
    configurations: [
      { memory: "12GB", storage: "512GB" },
      { memory: "16GB", storage: "512GB" },
      { memory: "16GB", storage: "1TB" },
    ],
    battery: "6800mAh",
    rearCamera: "5000 万像素主摄 + 2 亿像素 75-100mm 光学变焦 + 5000 万像素超广角",
    mainCamera: "5000 万像素",
    telephoto: "2 亿像素 75-100mm 连续光学变焦",
    frontCamera: "5000 万像素",
    launchPrice: 6999,
    launchConfiguration: "12GB 运行内存 + 512GB 存储，中国大陆版本",
    launchRawText: "12GB+512GB 售价 6999 元",
    launchPattern: /12\+512GB：6999 元/,
    currentPrice: 6999,
    currentConfiguration: "12GB 运行内存 + 512GB 存储，中国大陆版本",
    currentSource: "Xiaomi 17 Ultra 6999 元起",
    currentSourceUrl: "https://www.mi.com/prod/xiaomi-17-ultra",
    currentSourceType: "official",
    currentSourceName: "小米中国大陆官网",
    currentCondition: "全新，小米中国大陆官网页面展示起售价",
    dxomarkScore: 166,
    dxomarkProtocol: "Camera v6",
    dxomarkUrl: "https://www.dxomark.com/xiaomi-17-ultra-camera-test/",
  },
];

for (const [slug, modelName, releaseYear, releaseDate, family, generationOrder, sourceUrl, launchUrl, launchPrice] of [
  ["14", "小米 14", 2023, "2023-10-31", "Xiaomi", 1, "https://detail.zol.com.cn/1936/1935688/param.shtml", "https://www.ithome.com/0/727/908.htm", 3999],
  ["14-pro", "小米 14 Pro", 2023, "2023-10-31", "Xiaomi Pro", 1, "https://detail.zol.com.cn/1442/1441061/param.shtml", "https://www.ithome.com/0/727/914.htm", 4999],
  ["15", "小米 15", 2024, "2024-10-31", "Xiaomi", 2, "https://detail.zol.com.cn/1960/1959968/param.shtml", "https://www.ithome.com/0/806/219.htm", 4499],
  ["15-pro", "小米 15 Pro", 2024, "2024-10-31", "Xiaomi Pro", 2, "https://detail.zol.com.cn/2113/2112061/param.shtml", "https://www.ithome.com/0/806/230.htm", 5299],
  ["17", "小米 17", 2025, "2025-09-27", "Xiaomi", 3, "https://detail.zol.com.cn/2143/2142373/param.shtml", "https://www.ithome.com/0/886/197.htm", 4499],
  ["17-pro", "小米 17 Pro", 2025, "2025-09-27", "Xiaomi Pro", 3, "https://detail.zol.com.cn/series/57/34645/param_10919508_0_1.html", "https://www.ithome.com/0/886/197.htm", 4999],
  ["17-pro-max", "小米 17 Pro Max", 2025, "2025-09-27", "Xiaomi Pro Max", 1, "https://detail.zol.com.cn/series/57/34645/param_10919509_0_1.html", "https://www.ithome.com/0/886/197.htm", 5999],
  ["18-pro", "小米 18 Pro", 2026, "2026-09-23", "Xiaomi Pro", 4, "https://g.pconline.com.cn/product/mobile/miui/2814171_detail.html", "https://www.ithome.com/0/100/6426.htm", 5999],
  ["18-pro-max", "小米 18 Pro Max", 2026, "2026-09-23", "Xiaomi Pro Max", 2, "https://g.pconline.com.cn/product/mobile/miui/2814191_detail.html", "https://www.ithome.com/1/006/425.htm", 6999],
]) rows.push({ id: `xiaomi-${slug}-${releaseYear}`, modelName, releaseYear, releaseDate, family, generationOrder, sourceUrl, launchUrl, launchPrice,
  generation: slug.replaceAll("-", " "), comparisonGroupId: `xiaomi.phone.${family.toLowerCase().replaceAll(" ", "-")}.standard` });

const sourcePages = new Map();
for (const row of rows) {
  const page = await getSourceSnapshot(row.sourceUrl, {
    offline: process.argv.includes("--offline"), refresh: process.argv.includes("--refresh"),
    validate(html) {
      const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
      const model = row.generationOrder === 1 ? /小米10 .*至尊纪念版/ : new RegExp(`小米${row.generationOrder === 3 ? "12S" : row.modelName.match(/\d+/)[0]} Ultra`);
      const identityMatches = row.family ? title.replace(/\s+/g, "").includes(row.modelName.replace(/\s+/g, "")) || title.toLowerCase().includes(`xiaomi ${row.generation}`) : model.test(title);
      if (!identityMatches || html.includes("\uFFFD")) throw new Error(`${row.id}: 型号或字符编码不符`);
    },
  });
  page.text = page.html.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  sourcePages.set(row.sourceUrl, page);
  const launchPage = await getSourceSnapshot(row.launchUrl, {
    offline: process.argv.includes("--offline"), refresh: process.argv.includes("--refresh"),
    validate(html) {
      const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, "") ?? "";
      if (row.family ? !html.replace(/\s+/g, "").includes(row.modelName.replace(/\s+/g, "")) : !title.includes(row.modelName.replace(/\s+/g, ""))) throw new Error(`${row.id}: 首发报道型号不符`);
    },
  });
  launchPage.text = launchPage.html.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  sourcePages.set(row.launchUrl, launchPage);
  if (row.family) continue;
  row.configurations = row.configurations.map((configuration) => {
    const prefix = row.generationOrder === 1 ? "小米10" : `小米${row.generationOrder === 3 ? "12S" : row.modelName.match(/\d+/)[0]} Ultra`;
    const suffix = row.generationOrder === 1 ? "/全网通/5G版/至尊纪念版" : row.generationOrder === 2 ? "/全网通/5G版" : "";
    const pattern = new RegExp(`${prefix}\\s*[（(]\\s*${configuration.memory}/${configuration.storage}${suffix}[）)]`);
    return { ...configuration, evidence: spec(`${configuration.memory} + ${configuration.storage}`, "", row.sourceUrl, 0.8, pattern) };
  });
  if (row.generationOrder >= 3) {
    row.benchmarkEvidence = await verifyCameraScore(row.modelName.replace("小米 ", "Xiaomi "), row.dxomarkScore, row.dxomarkUrl, {
      offline: process.argv.includes("--offline"), refresh: process.argv.includes("--refresh"),
    });
  }
  const cameraPage = await getSourceSnapshot(row.dxomarkUrl, {
    offline: row.generationOrder >= 3 || process.argv.includes("--offline"),
    refresh: row.generationOrder < 3 && process.argv.includes("--refresh"),
    validate(html) {
      if (row.generationOrder < 3 && !html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.includes(`Xiaomi Mi ${row.generationOrder === 1 ? "10" : "11"} Ultra`)) {
        throw new Error(`${row.id}: 相机原文型号不符`);
      }
    },
  });
  cameraPage.text = cameraPage.html.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  sourcePages.set(row.dxomarkUrl, cameraPage);
  if (row.generationOrder === 1) {
    const excerpt = cameraPage.text.match(/With an overall DXOMARK Camera score of 133, the Xiaomi Mi 10 Ultra[^.]+new version 4 of our test protocol\./)?.[0];
    if (!excerpt) throw new Error(`${row.id}: 历史 v4 分数与协议原文缺失，不能使用当前徽章替代`);
    row.benchmarkEvidence = {
      rawText: excerpt, verifiedAt: cameraPage.fetchedAt.slice(0, 10), fetchedAt: cameraPage.fetchedAt,
      sourceSnapshotHash: cameraPage.sha256,
      notes: "133 分为正文明确对应 Camera v4 的历史相机综合分；页面顶部已改为另一次测试的 129 分，不能混用。不是单独拍照分，也不是当前榜单分数。",
    };
  } else if (row.generationOrder === 2) {
    const protocolUrl = "https://www.dxomark.com/whats-new-in-dxomarks-protocol-updates/";
    const badges = [...cameraPage.html.matchAll(/class="scoreBadgeValue">(\d+)</g)].map((match) => Number(match[1]));
    if (!badges.length || badges.some((score) => score !== row.dxomarkScore)
      || !/retested[\s\S]*?href="\/whats-new-in-dxomarks-protocol-updates\/"/.test(cameraPage.html)) {
      throw new Error(`${row.id}: 重测分数或协议说明链接变化，需人工复核`);
    }
    await getSourceSnapshot(protocolUrl, {
      offline: process.argv.includes("--offline"), refresh: process.argv.includes("--refresh"),
      validate(html) {
        if (!html.includes("New Camera version 5 results") || !html.includes("Xiaomi Mi11 Ultra")) {
          throw new Error(`${row.id}: v5 协议说明缺少对应型号`);
        }
      },
    });
    row.benchmarkEvidence = {
      rawText: String(row.dxomarkScore), verifiedAt: cameraPage.fetchedAt.slice(0, 10),
      fetchedAt: cameraPage.fetchedAt, sourceSnapshotHash: cameraPage.sha256,
      notes: `141 为重测后的相机综合分，不是单独拍照分；正文 143 为旧版成绩，不混用。Camera v5 依据页面重测提示所链接的协议说明（${protocolUrl}）；具体小版本、固件及与国行配置的一致性未核验。`,
    };
  }
}

function configurationSpec(row, value) {
  return { ...row.configurations[0].evidence, value, rawText: row.configurations.map((configuration) => configuration.evidence.rawText).join("\n") };
}

function spec(value, rawText, sourceUrl, confidence = 0.8, pattern) {
  if (pattern) {
    const page = sourcePages.get(sourceUrl);
    const excerpt = page.text.match(pattern)?.[0];
    if (!excerpt) throw new Error(`${sourceUrl}: 原文证据缺失 ${pattern}，整批未写入`);
    return { value, rawText: excerpt, evidenceKind: "excerpt", sourceUrl, sourceType: "reference", confidence,
      verifiedAt: page.fetchedAt.slice(0, 10), fetchedAt: page.fetchedAt, sourceSnapshotHash: page.sha256 };
  }
  return {
    value,
    summaryText: rawText,
    evidenceKind: "summary",
    sourceUrl,
    sourceType: "reference",
    confidence,
    verifiedAt: VERIFIED_AT,
  };
}

function price(value, priceType, rawText, sourceUrl, configuration, options = {}) {
  const sourceType = options.sourceType ?? "reference";
  return {
    ...spec(value, rawText, sourceUrl, sourceType === "official" ? 1 : 0.7),
    rawText,
    summaryText: undefined,
    evidenceKind: "excerpt",
    sourceType,
    unit: "CNY",
    priceType,
    market: "中国大陆",
    configuration,
    condition: priceType === "launch" ? "中国大陆所列配置首发价" : options.condition ?? "全新，页面展示电商价",
    ...(priceType === "current" ? { observedAt: VERIFIED_AT, sourceName: options.sourceName ?? "中关村在线电商报价" } : {}),
  };
}

function mainstreamDevice(row) {
  const text = sourcePages.get(row.sourceUrl).text;
  const launchText = sourcePages.get(row.launchUrl).text;
  const field = (pattern, value, unit) => {
    const match = text.match(pattern);
    if (!match) throw new Error(`${row.id}: 字段证据缺失 ${pattern}`);
    return { ...spec(value(match), "", row.sourceUrl, 0.85, pattern), ...(unit ? { unit } : {}) };
  };
  const pricePattern = /(\d+)(?:GB)?(?: RAM)?\s*\+\s*(\d+(?:GB|TB))(?: 存储)?\s*(?:售价|首发价|版本|定价|：定价|：)\s*(\d+)\s*元/g;
  const priceSection = row.releaseYear === 2025 ? launchText.match(new RegExp(`${row.modelName} 12GB RAM[^]*?(?= 京东)`))?.[0] : launchText;
  if (!priceSection) throw new Error(`${row.id}: 同报道不同型号的价格区块无法唯一绑定`);
  const configurations = [...priceSection.matchAll(pricePattern)].map((match) => ({ memory: `${match[1]}GB`, storage: match[2],
    evidence: spec(`${match[1]}GB + ${match[2]}`, "", row.launchUrl, 0.8, new RegExp(match[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))) }));
  const launchMatch = [...priceSection.matchAll(pricePattern)].find((match) => Number(match[3]) === row.launchPrice);
  if (!configurations.length || !launchMatch) throw new Error(`${row.id}: 首发配置价格缺失`);
  const mainlandPconline = row.releaseYear === 2026;
  const weight = row.id === "xiaomi-15-pro-2024"
    ? { ...spec(213, "", row.launchUrl, 0.8, /小米 15 Pro 重约 213g/), unit: "g" }
    : field(mainlandPconline ? /重量 (\d+(?:\.\d+)?)g[^]*?(?= 随机配件)/ : /重量 (\d+(?:\.\d+)?)g/, (match) => Number(match[1]), "g");
  weight.note = mainlandPconline ? weight.rawText : row.id === "xiaomi-15-pro-2024"
    ? "发布报道所列普通版约 213g；参数页另列 219g，特殊材质版本对应未独立确认，不套用到普通版。"
    : "对应中国大陆参数页所列重量，不代表所有配色及特殊材质版本。";
  const rearPattern = mainlandPconline ? /后置摄像头 (.+?)(?= 前置摄像头)/ : /像素 (后置摄像头1：[\s\S]+?)(?= 前置摄像头1：)/;
  const specs = {
    chip: field(mainlandPconline ? / CPU (.+?)(?= 查看完整天梯图)/ : /CPU型号 ((?:高通 )?骁龙\s*8(?:\s*Gen3|\s*Elite(?:\s*Gen5)?))/, (match) => match[1]),
    screenSize: field(mainlandPconline ? /屏幕大小 (\d+(?:\.\d+)?)英寸/ : /屏幕尺寸 (?:主：)?(\d+(?:\.\d+)?)英寸/, (match) => Number(match[1]), "inch"),
    displayType: field(/屏幕材质 (?:主：)?((?:AMOLED|OLED)(?:（LTPO）)?)/, (match) => match[1]),
    resolution: field(mainlandPconline ? /屏幕分辨率 (\d+)×(\d+)像素/ : /分辨率 (?:主：)?(\d+)x(\d+)px/, (match) => `${match[1]}x${match[2]}`),
    refreshRate: field(/屏幕刷新率 (\d+)Hz/, (match) => Number(match[1]), "Hz"), weight,
    memory: { ...configurations[0].evidence, value: [...new Set(configurations.map((c) => c.memory))].join(" / "), rawText: configurations.map((c) => c.evidence.rawText).join("\n") },
    storage: { ...configurations[0].evidence, value: [...new Set(configurations.map((c) => c.storage))].join(" / "), rawText: configurations.map((c) => c.evidence.rawText).join("\n") },
    rearCamera: field(rearPattern, (match) => match[1].replace(/ 纠错.*$/, "").trim()),
    mainCamera: field(mainlandPconline ? /后置摄像头 (\d+)(万|亿)像素/ : /后置摄像头1：(\d+)(万|亿)像素/, (match) => `${match[2] === "亿" ? Number(match[1]) * 100 : Number(match[1]) / 100}MP（${match[1]}${match[2]}像素）`),
    frontCamera: field(mainlandPconline ? /前置摄像头 (\d+万像素)/ : /前置摄像头1：(\d+万像素)/, (match) => match[1]),
    telephoto: field(mainlandPconline ? /后置摄像头3 (.+?)(?= 前置摄像头)/ : /摄像头名称 [\s\S]+?后置摄像头\d：([^：]{0,70}长焦[^]*?)(?= 后置摄像头| 前置摄像头| 纠错)/, (match) => match[1]),
    batteryCapacity: field(/电池容量 (\d+)mAh/, (match) => Number(match[1]), "mAh"),
    port: field(mainlandPconline ? /数据接口 USB Type C接口/ : /机身接口 USB Type-C接[口囗]/, () => "USB Type-C"),
    launchPrice: { ...spec(row.launchPrice, "", row.launchUrl, 0.8, new RegExp(launchMatch[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))), unit: "CNY", priceType: "launch",
      market: "中国大陆", configuration: `${launchMatch[1]}GB 运行内存 + ${launchMatch[2]} 存储，国行基础版本`, condition: "同期发布报道所列基础版本首发价，不作为当前报价" },
  };
  return { id: row.id, brand: "Xiaomi", market: "CN", category: "phone", family: row.family, series: row.family, variant: "standard",
    modelName: row.modelName, generation: row.generation, generationOrder: row.generationOrder, releaseYear: row.releaseYear,
    releaseDate: row.releaseDate, comparisonGroupId: row.comparisonGroupId, configurations, specs, benchmarks: [], computed: {} };
}

const devices = rows.map((row) => row.family ? mainstreamDevice(row) : ({
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
  configurations: row.configurations,
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
    chip: spec(row.chip, "", row.sourceUrl, 0.8, new RegExp(`CPU型号 (?:高通 )?${row.chip.replace(/^高通 /, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s*")}`)),
    screenSize: { ...spec(row.screenSize, "", row.sourceUrl, 0.8, new RegExp(`屏幕尺寸 ${String(row.screenSize).replace(".", "\\.")}英寸`)), unit: "inch" },
    displayType: spec(row.displayType, "", row.sourceUrl, 0.8, new RegExp(`屏幕材质 ${row.displayType.replace("（LTPO）", "（LTPO[^）]*）")}`)),
    resolution: spec(row.resolution, "", row.sourceUrl, 0.8, new RegExp(`分辨率 ${row.resolution}px`)),
    refreshRate: { ...spec(row.refreshRate, "", row.sourceUrl, 0.8, /屏幕刷新率 120Hz/), unit: "Hz" },
    weight: { ...spec(row.weight, "", row.sourceUrl, 0.8, new RegExp(`重量 ${String(row.weight).replace(".", "\\.")}g`)), unit: "g",
      ...(row.generationOrder === 5 ? { note: "黑色、白色224.4g；龙晶蓝229.5g；钛金属特别版229.6g" }
        : row.generationOrder === 6 ? { note: "白色、黑色226g；松柏绿、经典黑银229g" }
          : row.generationOrder === 7 ? { note: "黑色、白色、冷烟紫223.4g；星空绿224g" } : {}),
    },
    memory: configurationSpec(row, row.memory),
    storage: configurationSpec(row, row.storage),
    rearCamera: spec(row.rearCamera, "", row.sourceUrl, 0.8, /摄像头名称 [\s\S]+?前置摄像头1：\d+万像素/),
    mainCamera: spec(row.mainCamera, "", row.sourceUrl, 0.8, new RegExp(`后置摄像头1：${row.mainCamera.replace(/ /g, "")}`)),
    telephoto: spec(row.telephoto, row.telephoto, row.dxomarkUrl, 0.9,
      row.generationOrder === 1 ? /Telephoto 1: 12MP [\s\S]+?50mm-equivalent[\s\S]+?Telephoto 2: 48MP [\s\S]+?120mm-equivalent[\s\S]+?(?= Ultra-wide:)/
        : row.generationOrder === 2 ? /Tele: 48 MP [\s\S]+?120 mm-equivalent lens with f\/4\.1 aperture, OIS/
        : row.generationOrder === 3 ? /Tele: 48MP [\s\S]+?120mm equivalent[\s\S]+?(?= Video:)/
        : [4, 5].includes(row.generationOrder) ? /Tele ?1: 50 ?MP [\s\S]+?75 ?mm[\s\S]+?Tele ?2: 50 ?MP [\s\S]+?120 ?mm[\s\S]+?lens/
          : row.generationOrder === 6 ? /Tele 1: 50MP[\s\S]+?70mm[\s\S]+?Tele 2: 200MP[\s\S]+?100mm[\s\S]+?(?= Ultra-wide:)/
            : row.generationOrder === 7 ? /Tele: 200 MP[\s\S]+?75-100mm[\s\S]+?optical zoom/ : undefined),
    frontCamera: spec(row.frontCamera, "", row.sourceUrl, 0.8, new RegExp(`前置摄像头1：${row.frontCamera.replace(/ /g, "")}`)),
    batteryCapacity: { ...spec(parseInt(row.battery, 10), "", row.sourceUrl, 0.8, new RegExp(`电池容量 ${row.battery}`)), unit: "mAh" },
    port: spec("USB Type-C", "", row.sourceUrl, 0.8, /机身接口 USB Type-C接[口囗]/),
    ...(row.generationOrder > 1 ? { waterResistance: spec("IP68", "", row.sourceUrl, 0.8, /三防功能 IP68等级/) } : {}),
    launchPrice: { ...price(row.launchPrice, "launch", row.launchRawText, row.launchUrl, row.launchConfiguration),
      ...spec(row.launchPrice, "", row.launchUrl, 0.7, row.launchPattern) },
    ...(row.currentPrice ? {
      currentPrice: price(
        row.currentPrice,
        "current",
        row.currentSource,
        row.currentSourceUrl ?? row.sourceUrl,
        row.currentConfiguration ?? "16GB 运行内存 + 512GB 存储，中国大陆版本",
        {
          sourceType: row.currentSourceType,
          sourceName: row.currentSourceName,
          condition: row.currentCondition,
        },
      ),
    } : {}),
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
    officialSpecUrl: row.officialUrl ?? null,
    supportUrl: null,
    newsroomUrl: null,
    referenceUrls: [row.sourceUrl, row.launchUrl, row.dxomarkUrl],
    sourceStatus: "verified",
    notes: row.family ? "中国大陆核心规格取自中关村在线或太平洋产品参数页，配置组合及首发价来自同期发布报道的明确组合表；不同型号价格区块独立绑定，内存存储不做笛卡尔组合；未核验的当前价、二手价和评测评分留空。小米 15 Pro 普通版重量采用发布报道 213g，不将参数页所列 219g 套用到普通版；仍不声称覆盖所有特制版。" : "规格与中国大陆价格取自中关村在线对应配置页；相机评分取自 DXOMARK，并保留测试协议版本。",
  })),
};

await Promise.all([
  fs.writeFile(new URL("src/data/xiaomi-devices-db.json", ROOT), `${JSON.stringify({
    metadata: { version: "1.0", totalDevices: devices.length, generatedAt: new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai" }).format(new Date()) },
    devices,
  }, null, 2)}\n`),
  fs.writeFile(new URL("src/data/xiaomi-sources.json", ROOT), `${JSON.stringify(sources, null, 2)}\n`),
]);

console.log(`wrote ${devices.length} Xiaomi Ultra pilot devices`);
