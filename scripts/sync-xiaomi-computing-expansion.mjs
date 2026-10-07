import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { importZolSeries } from "./lib/zol-device.mjs";
import { getSourceSnapshot } from "./lib/source-snapshot.mjs";

const targets = [
  ["xiaomi-pad-5-pro-12-4-2022", "tablet", "小米平板 5 Pro 12.4", "Xiaomi Pad Pro 12.4", 35149, {}],
  ["xiaomi-pad-6-max-14-2023", "tablet", "小米平板 6 Max 14", "Xiaomi Pad Max", 10803578,
    { launch: { url: "https://www.ithome.com/0/712/330.htm", pattern: /8\+256GB 首销 3599 元/,
      memory: "8GB", storage: "256GB", value: 3599, condition: "中国大陆首销价" } }],
  ["xiaomi-pad-6s-pro-12-4-2024", "tablet", "小米平板 6S Pro 12.4", "Xiaomi Pad S Pro", 10853920,
    { expectedName: /小米(?:平板|Pad)6SPro12\.4/i, launch: {
      url: "https://www.ithome.com/0/751/487.htm", pattern: /8\+256GB：3299 元/,
      memory: "8GB", storage: "256GB", value: 3299 } }],
  ["xiaomi-pad-7-ultra-2025", "tablet", "小米平板 7 Ultra", "Xiaomi Pad Ultra", 10913895, {}],
  ["xiaomi-pad-7s-pro-2025", "tablet", "小米平板 7S Pro", "Xiaomi Pad S Pro", 10914828,
    { launch: { url: "https://m.ithome.com/html/863944.htm", pattern: /8\+256GB：3299 元/,
      memory: "8GB", storage: "256GB", value: 3299 } }],
  ["redmi-pad-2022", "tablet", "REDMI Pad", "REDMI Pad", 10717016, {}],
  ["redmi-pad-se-2023", "tablet", "REDMI Pad SE", "REDMI Pad SE", 10823855, {}],
  ["redmi-pad-pro-2024", "tablet", "REDMI Pad Pro", "REDMI Pad Pro", 10858312, {}],
  ["redmi-pad-2-2025", "tablet", "REDMI Pad 2", "REDMI Pad", 10803982, {}],
  ["redmi-k-pad-2025", "tablet", "REDMI K Pad", "REDMI K Pad", 10914826, {}],
  ["redmi-pad-2-pro-2026", "tablet", "REDMI Pad 2 Pro", "REDMI Pad Pro", 10923385, {}],
  ["xiaomi-book-pro-14-2022", "laptop", "小米 Book Pro 14 (2022)", "Xiaomi Book Pro 14", 10712873,
    { expectedName: ["Xiaomi Book Pro 14 2022", "小米Book Pro 14 2022"], excludeVariants: ["MX550"] }],
  ["xiaomi-book-pro-16-2022", "laptop", "小米 Book Pro 16 (2022)", "Xiaomi Book Pro 16", 10712401,
    { expectedName: ["Xiaomi Book Pro 16 2022", "小米Book Pro 16 2022"] }],
  ["xiaomi-book-air-13-2022", "laptop", "小米 Book Air 13", "Xiaomi Book Air 13", 10719616,
    { expectedName: ["Xiaomi Book Air 13", "小米Book Air 13"] }],
  ["redmi-book-pro-15-2022", "laptop", "REDMI Book Pro 15 (2022)", "REDMI Book Pro 15", 37876,
    { expectedName: "Redmi Book Pro 15 2022", excludeVariants: ["集显"] }],
  ["redmi-book-pro-14-2022", "laptop", "REDMI Book Pro 14 锐龙版 (2022)", "REDMI Book Pro 14", 10709756,
    { expectedName: "Redmi Book Pro 14 锐龙版 2022" }],
  ["redmi-book-pro-15-2023", "laptop", "REDMI Book Pro 15 锐龙版 (2023)", "REDMI Book Pro 15", 10810523,
    { expectedName: "Redmi Book Pro 15 2023 锐龙版" }],
  ["redmi-book-pro-14-2024", "laptop", "REDMI Book Pro 14 (2024)", "REDMI Book Pro 14", 10853918,
    { expectedName: "Redmi Book Pro 14 2024", launch: { url: "https://www.ithome.com/0/751/490.htm",
      pattern: /Redmi Book Pro 14 2024 款笔记本[\s\S]+?英特尔 Ultra 5 125H \/ 16GB \/ 512GB 售价 4999 元/,
      value: 4999, memory: "16GB", storage: "512GB", chip: "英特尔 酷睿 Ultra5 125H" } }],
  ["redmi-book-pro-16-2024", "laptop", "REDMI Book Pro 16 (2024)", "REDMI Book Pro 16", 10853988,
    { expectedName: "Redmi Book Pro 16 2024 酷睿版", releaseFallback: {
      sourceUrl: "https://www.ithome.com/0/751/490.htm", pattern: /2024\/2\/22 21:19:13/, releaseDate: "2024-02-22" },
      launch: { url: "https://www.ithome.com/0/751/490.htm",
        pattern: /Redmi Book Pro 16 2024 定价： 英特尔 Ultra 5 125H \/ 32GB \/ 1TB 售价 5999 元/,
        value: 5999, memory: "32GB", storage: "1TB", chip: "Intel 酷睿Ultra5 125H" } }],
  ["redmi-book-16-2024", "laptop", "REDMI Book 16 (2024)", "REDMI Book 16", 10845183,
    { expectedName: "Redmi Book 16 2024", launch: { url: "https://www.ithome.com/0/735/954.htm",
      pattern: /小米 Redmi Book 16 2024 i5-13500H \+ 16G \+ 512G：4399 元/,
      value: 4399, memory: "16GB", storage: "512GB", chip: "Intel 酷睿i5 13500H" } }],
  ["redmi-book-16-2025", "laptop", "REDMI Book 16 (2025)", "REDMI Book 16", 10909137,
    { expectedName: "Redmi Book 16 2025", launch: { url: "https://www.ithome.com/0/821/829.htm",
      pattern: /REDMI Book 16 2025 16GB \+ 512GB 首发价 4799 元/,
      value: 4799, memory: "16GB", storage: "512GB", chip: "Intel 酷睿5 220H" } }],
  ["redmi-book-pro-14-2025", "laptop", "REDMI Book Pro 14 (2025)", "REDMI Book Pro 14", 10910845,
    { expectedName: "Redmi Book Pro 14 2025" }],
  ["redmi-book-pro-16-2025", "laptop", "REDMI Book Pro 16 (2025，3.1K屏)", "REDMI Book Pro 16", 10910846,
    { expectedName: "Redmi Book Pro 16 2025", variantFilter: "3.1K" }],
  ["redmi-book-14-2023", "laptop", "REDMI Book 14 (2023)", "REDMI Book 14", 10771101,
    { expectedName: "Redmi Book 14 2023", comparisonGroupId: "xiaomi.laptop.redmi-book-14.standard" }],
  ["xiaomi-book-pro-14-2026", "laptop", "小米 Book Pro 14 (2026)", "Xiaomi Book Pro 14", 10924937,
    { expectedName: "小米Book Pro 14 2026" }],
  ["redmi-book-pro-14-2026", "laptop", "REDMI Book Pro 14 (2026)", "REDMI Book Pro 14", 10925967,
    { expectedName: "Redmi Book Pro 14 2026" }],
  ["redmi-book-pro-16-2026", "laptop", "REDMI Book Pro 16 (2026)", "REDMI Book Pro 16", 10925966,
    { expectedName: "Redmi Book Pro 16 2026" }],
];

const devices = [];
const sources = { tablet: [], laptop: [] };
for (const [id, category, modelName, family, seriesId, options] of targets) {
  const imported = await importZolSeries({ id, brand: "Xiaomi", category, modelName, family,
    comparisonGroupId: `xiaomi.${category}.${family.toLowerCase().replace(/\s+/g, "-")}.standard`,
    seriesUrl: `https://detail.zol.com.cn/series/${category === "tablet" ? 702 : 16}/${seriesId}_1.html`,
    ...options,
    excludeVariants: ["柔光", "悦享", "昆仑", "LTE", "蜂窝", "5G版", "全网通版", "哈利", "乐学", ...(options.excludeVariants ?? [])],
  }, { offline: process.argv.includes("--offline"), refresh: process.argv.includes("--refresh") });
  if (options.launch?.chip) {
    const launch = options.launch;
    assert.ok(imported.device.configurations.some((configuration) => configuration.memory === launch.memory
      && configuration.storage === launch.storage && configuration.chip === launch.chip), `${id}: launch CPU/configuration mismatch`);
    imported.device.specs.launchPrice.configuration = `${launch.chip}，${launch.memory} 运行内存 + ${launch.storage} 存储，国行`;
  }
  if (/Ultra/i.test(imported.device.specs.chip.value) && /Iris|Xe Graphics/i.test(imported.device.specs.gpu?.value ?? "")) {
    const reason = "ZOL 显卡行写为 Iris Xe / Xe Graphics eligible，与 Intel 125H/155H 官方规格存在冲突；发布报道未明确本机型逐配置 GPU，暂不展示显卡型号或核心数。";
    delete imported.device.specs.gpu;
    imported.source.fieldGaps.push({ field: "gpu", reason });
    imported.source.notes += reason;
  }
  if (id === "xiaomi-book-pro-14-2026") {
    // The ZOL row has a 3120x1080 typo; the hands-on review gives 3120x2080.
    const url = "https://www.ithome.com/0/931/172.htm";
    const page = await getSourceSnapshot(url, { offline: process.argv.includes("--offline"), refresh: process.argv.includes("--refresh") });
    const text = page.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    const rawText = text.match(/屏幕分辨率达到了 3120×2080 的高标准/)?.[0];
    assert.ok(rawText, `${id}: resolution correction evidence missing`);
    imported.device.specs.resolution = { value: "3120x2080", rawText, evidenceKind: "excerpt",
      sourceUrl: url, sourceType: "reference", confidence: 0.8,
      verifiedAt: page.fetchedAt.slice(0, 10), fetchedAt: page.fetchedAt, sourceSnapshotHash: page.sha256 };
    imported.source.referenceUrls.push(url);
  }
  assert.equal(imported.device.market, "CN");
  assert.ok(imported.device.releaseYear >= 2022 && imported.device.releaseYear <= 2026, id);
  assert.ok(imported.device.configurations.length, `${id}: missing real configurations`);
  assert.ok(imported.device.configurations.every((configuration) => !/柔光|蜂窝|哈利|乐学/.test(configuration.evidence.rawText)), `${id}: mixed variant`);
  if (id === "redmi-book-pro-16-2025") {
    assert.ok(imported.device.configurations.every((configuration) => configuration.evidence.rawText.includes("3.1K")), `${id}: mixed display configurations`);
  }
  devices.push(imported.device);
  sources[category].push(imported.source);
  console.log(`${id}: ${imported.device.configurations.length} configurations`);
}
assert.equal(new Set(devices.map((device) => device.id)).size, devices.length);
assert.ok(devices.length >= 20);
const generatedAt = devices.flatMap((device) => Object.values(device.specs).map((field) => field.verifiedAt)).sort().at(-1);
await fs.writeFile("src/data/xiaomi-computing-expansion-devices-db.json", `${JSON.stringify({
  metadata: { version: "1.0", totalDevices: devices.length, generatedAt }, devices,
}, null, 2)}\n`);
await fs.writeFile("src/data/xiaomi-computing-expansion-sources.json", `${JSON.stringify(sources, null, 2)}\n`);
console.log(JSON.stringify({ devices: devices.length, tablet: sources.tablet.length, laptop: sources.laptop.length }));
