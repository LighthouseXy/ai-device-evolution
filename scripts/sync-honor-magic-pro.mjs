import fs from "node:fs/promises";
import { getSourceSnapshot } from "./lib/source-snapshot.mjs";
import { verifyCameraScore } from "./lib/dxomark-snapshot.mjs";

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
    launchReferenceUrl: "https://m.ithome.com/html/889748.htm",
    chip: "高通 第五代骁龙 8 至尊版", screenSize: 6.71, resolution: "2808x1256", weight: 219,
    memory: "12GB / 16GB", storage: "256GB / 512GB / 1TB",
    configurations: [{ memory: "12GB", storage: "256GB" }, { memory: "12GB", storage: "512GB" }, { memory: "16GB", storage: "512GB" }, { memory: "16GB", storage: "1TB" }],
    battery: "7200mAh", rearCamera: "5000 万像素主摄 + 5000 万像素超广角 + 2 亿像素长焦",
    mainCamera: "50MP（5000 万像素）主摄", telephoto: "200MP（2 亿像素）潜望式长焦",
    launchPrice: 5699, launchConfiguration: "12GB 运行内存 + 256GB 存储，中国大陆全网通版本",
    dxomarkScore: 164, dxomarkProtocol: "Camera v6", dxomarkUrl: "https://www.dxomark.com/honor-magic8-pro-camera-test/",
  },
];

const sourcePages = new Map();
for (const row of rows) {
  const options = { offline: process.argv.includes("--offline"), refresh: process.argv.includes("--refresh") };
  const page = await getSourceSnapshot(`${row.officialUrl}spec/`, {
    ...options,
    validate(html) {
      if (!html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.includes(row.generation)) throw new Error(`${row.id}: 页面身份不符`);
      if (!html.includes('data-value="')) throw new Error(`${row.id}: 页面缺少参数属性`);
    },
  });
  // 官网将可见参数存于 data-value，不能把仅有标题的静态正文当成参数原文。
  page.text = [...page.html.matchAll(/data-value="([\s\S]*?)"/g)]
    .map((match) => match[1].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()).join("\n");
  sourcePages.set(row.officialUrl, page);
  const launchUrl = row.launchReferenceUrl ?? row.launchUrl;
  const launchPage = await getSourceSnapshot(launchUrl, { ...options, validate(html) {
    if (!html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.includes(`Magic${row.generationOrder + 5}`)
      && !html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.includes(`Magic ${row.generationOrder + 5}`)) throw new Error(`${row.id}: 发布页身份不符`);
  } });
  launchPage.text = launchPage.html.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  sourcePages.set(launchUrl, launchPage);
  row.benchmarkEvidence = await verifyCameraScore(`Honor ${row.generation}`, row.dxomarkScore, row.dxomarkUrl, options);
}

function officialSpec(value, rawText, sourceUrl, unit, pattern) {
  if (pattern) {
    const page = sourcePages.get(sourceUrl);
    const excerpt = page.text.match(pattern)?.[0];
    if (!excerpt) throw new Error(`${sourceUrl}: 原文证据缺失 ${pattern}，整批未写入`);
    return { value, ...(unit ? { unit } : {}), rawText: excerpt, evidenceKind: "excerpt", sourceUrl: page.url,
      sourceType: "official", confidence: 1, verifiedAt: page.fetchedAt.slice(0, 10), fetchedAt: page.fetchedAt,
      sourceSnapshotHash: page.sha256 };
  }
  return { value, ...(unit ? { unit } : {}), summaryText: rawText, evidenceKind: "summary", sourceUrl, sourceType: "official", confidence: 1, verifiedAt: VERIFIED_AT };
}

const devices = rows.map((row) => ({
  id: row.id, brand: "HONOR", market: "CN", category: "phone", series: "荣耀 Magic Pro",
  family: "荣耀 Magic Pro", variant: "standard", modelName: row.modelName, generation: row.generation,
  generationOrder: row.generationOrder, releaseYear: row.releaseYear, releaseDate: row.releaseDate,
  comparisonGroupId: "honor.phone.magic-pro.standard", configurations: row.configurations.map((configuration) => ({ ...configuration,
    evidence: officialSpec(`${configuration.memory} + ${configuration.storage}`, "", row.officialUrl, undefined,
      new RegExp(`${configuration.memory}\\+${configuration.storage}`)),
  })),
  benchmarks: [{ provider: "DXOMARK", metric: "camera", score: row.dxomarkScore, protocolVersion: row.dxomarkProtocol, sourceUrl: row.dxomarkUrl, ...row.benchmarkEvidence }],
  specs: {
    chip: officialSpec(row.chip, `处理器：${row.chip}`, row.officialUrl, undefined, /^(?:第三代|第五代)?骁龙[^\n]+移动平台$/m),
    screenSize: officialSpec(row.screenSize, `屏幕尺寸：${row.screenSize} 英寸`, row.officialUrl, "inch", new RegExp(`^${String(row.screenSize).replace(".", "\\.")}0?英寸$`, "m")),
    displayType: officialSpec("OLED", "", row.officialUrl, undefined, /^OLED$/m),
    resolution: officialSpec(row.resolution, `屏幕分辨率：${row.resolution}`, row.officialUrl, undefined, new RegExp(`FHD\\+ ${row.resolution.split("x").reverse().join("\\s*x\\s*")}\\s*像素`)),
    refreshRate: officialSpec(120, "", row.officialUrl, "Hz", /^显示技术：[^\n]*120Hz[^\n]*/m),
    weight: { ...officialSpec(row.weight, `重量约 ${row.weight} 克`, row.officialUrl, "g", new RegExp(`^(?:玻璃版：)?约${row.weight}(?:克|g)[^\\n]*`, "m")),
      ...(row.generationOrder === 1 ? { note: "玻璃版约229g；素皮版约225g，均含电池" } : {}),
    },
    memory: officialSpec(row.memory, `运行内存：${row.memory}`, row.officialUrl, undefined, /^12GB\+256GB[^\n]*16GB\+1TB$/m),
    storage: officialSpec(row.storage, `机身存储：${row.storage}`, row.officialUrl, undefined, /^12GB\+256GB[^\n]*16GB\+1TB$/m),
    rearCamera: officialSpec(row.rearCamera, row.rearCamera, row.officialUrl, undefined, /^5000万[^\n]*(?:1\.8亿|2亿)[^\n]+$/m),
    mainCamera: officialSpec(row.mainCamera, row.mainCamera, row.officialUrl, undefined, /5000万(?:像素广角摄像头|超夜神主摄)/),
    telephoto: officialSpec(row.telephoto, row.telephoto, row.officialUrl, undefined, /(?:1\.8亿像素潜望式长焦摄像头|2亿像素超清潜望式长焦摄像头|2亿超夜神长焦：潜望式长焦)/),
    frontCamera: { ...officialSpec("5000 万像素", "", row.officialUrl, undefined, /^5000万[^\n]+3D深感摄像头$/m), note: "另有3D深感摄像头" },
    batteryCapacity: officialSpec(parseInt(row.battery, 10), `电池典型容量：${row.battery}`, row.officialUrl, "mAh", new RegExp(`${row.battery}（典型值）`)),
    port: officialSpec("USB Type-C", "", row.officialUrl, undefined, /数据线接口：USB Type-C/),
    launchPrice: { ...officialSpec(row.launchPrice, "", row.launchReferenceUrl ?? row.launchUrl, "CNY",
      row.launchReferenceUrl ? /12GB RAM\+256GB ROM：5699 元/
        : new RegExp(`荣耀${row.generation}提供12(?:GB)?\\+256GB[^；。]+售价\\s*5699(?:元)?起`)),
      ...(row.launchReferenceUrl ? { sourceType: "reference", confidence: 0.85 } : {}),
      priceType: "launch", market: "中国大陆", configuration: row.launchConfiguration,
      condition: row.launchReferenceUrl ? "中国大陆首发价，IT之家发布会报道明确配置" : "中国大陆官方首发价",
    },
  },
  computed: row.generationOrder === 1 ? { generationUpgradeMagnitude: { value: null, comparedTo: null, changeSummary: "该设备为当前比较组第一代，无可对比前代", scoreBreakdown: "无对比前代", confidence: 0, computedAt: VERIFIED_AT, sourceType: "computed", verifiedAt: VERIFIED_AT } } : {},
}));

const sources = { phone: rows.map((row) => ({
  id: row.id, modelName: row.modelName, generation: row.generation, releaseYear: row.releaseYear,
  sourcePageType: "official_spec_price_and_reference_benchmark", officialSpecUrl: `${row.officialUrl}spec/`,
  supportUrl: null, newsroomUrl: row.launchUrl, referenceUrls: [row.dxomarkUrl, ...(row.launchReferenceUrl ? [row.launchReferenceUrl] : [])], sourceStatus: "verified",
  notes: `规格与配置取自荣耀中国官网；首发价${row.launchReferenceUrl ? "配置对应关系取自IT之家发布会报道" : "取自荣耀中国官网"}；相机评分取自 DXOMARK ${row.dxomarkProtocol}。`,
})) };

await Promise.all([
  fs.writeFile(new URL("src/data/honor-devices-db.json", ROOT), `${JSON.stringify({ metadata: { version: "1.0", totalDevices: devices.length, generatedAt: new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai" }).format(new Date()) }, devices }, null, 2)}\n`),
  fs.writeFile(new URL("src/data/honor-sources.json", ROOT), `${JSON.stringify(sources, null, 2)}\n`),
]);
console.log(`wrote ${devices.length} HONOR Magic Pro devices`);
