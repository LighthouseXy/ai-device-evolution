import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { importZolSeries, plainText } from "./lib/zol-device.mjs";
import { getSourceSnapshot } from "./lib/source-snapshot.mjs";

const rows = JSON.parse(await fs.readFile(new URL("./fixtures/xiaomi-phone-expansion.json", import.meta.url), "utf8"));
assert.ok(rows.length >= 36, "本批至少补充36个独立型号");
assert.equal(new Set(rows.map((row) => row.slug)).size, rows.length, "目标型号重复");
const familyOrders = new Map();
const conflictedVariants = {
  "redmi-k60-ultra": ["12GB/512GB"],
  "redmi-k70e": ["16GB/1TB"],
  "redmi-note-13-pro": ["12GB/256GB"],
  "redmi-turbo-5": ["16GB/512GB"],
};
const launches = {
  "redmi-k70": { url: "https://www.ithome.com/0/735/944.htm", memory: "12GB", storage: "256GB", value: 2499,
    pattern: /12\+256GB 售价 2499 元/ },
  "redmi-k70-pro": { url: "https://www.ithome.com/0/735/998.htm", memory: "12GB", storage: "256GB", value: 3299,
    pattern: /Redmi K70 Pro 手机 正式发布[^]*?12GB \+ 256GB 售价 3299 元/ },
  "redmi-k80": { url: "https://www.ithome.com/0/813/724.htm", memory: "12GB", storage: "256GB", value: 2499,
    pattern: /12\+256GB：2499 元/ },
  "redmi-k80-pro": { url: "https://www.ithome.com/0/813/722.htm", memory: "12GB", storage: "256GB", value: 3699,
    pattern: /12\+256GB 售价 3699 元/ },
  "redmi-k80-ultra": { url: "https://m.ithome.com/html/863945.htm", memory: "12GB", storage: "256GB", value: 2599,
    pattern: /12GB\+256GB：定价 2599 元/,
    configurations: [["12GB", "256GB", 2599], ["16GB", "256GB", 2799], ["12GB", "512GB", 2999], ["16GB", "512GB", 3299], ["16GB", "1TB", 3799]] },
  "redmi-turbo-4-pro": { url: "https://m.ithome.com/html/848739.htm", memory: "12GB", storage: "256GB", value: 1999,
    pattern: /12GB RAM \+ 256GB 存储空间 ：标准价 2199 元，首发价 1999 元/,
    condition: "中国大陆首发限时价，非长期标准定价",
    configurations: [["12GB", "256GB", 1999], ["16GB", "256GB", 2299], ["12GB", "512GB", 2499], ["16GB", "512GB", 2699], ["16GB", "1TB", 2999]] },
  "redmi-turbo-4": { url: "https://www.ithome.com/0/821/822.htm", memory: "12GB", storage: "256GB", value: 1999,
    pattern: /12\+256GB 售价 1999 元/,
    configurations: [["12GB", "256GB", 1999], ["16GB", "256GB", 2199], ["12GB", "512GB", 2299], ["16GB", "512GB", 2499]] },
};
const targets = rows.map((row) => {
  const generationOrder = (familyOrders.get(row.family) ?? 0) + 1;
  familyOrders.set(row.family, generationOrder);
  const familySlug = row.family.toLowerCase().replace(/\+/g, "-plus").replace(/\s+/g, "-");
  return { id: `${row.slug}-${row.year}`, brand: "Xiaomi", category: "phone", modelName: row.name,
    expectedName: row.name, family: row.family, series: row.family, variant: "standard",
    comparisonGroupId: `xiaomi.phone.${familySlug}.standard`, generation: row.generation,
    generationOrder, releaseYear: row.year, ...(row.releaseFallback ? {
      releaseFallback: { ...row.releaseFallback, pattern: new RegExp(row.releaseFallback.rawPattern) },
    } : {}),
    excludeVariants: ["迪士尼", "Aape", ...(conflictedVariants[row.slug] ?? [])],
    ...(conflictedVariants[row.slug] ? { notes: ` 原始参数页出现缺失或矛盾，暂不导入 ${conflictedVariants[row.slug].join("、")} 配置，等待独立来源核实。` } : {}),
    ...(launches[row.slug] ? { launch: launches[row.slug] } : {}),
    seriesUrl: `https://detail.zol.com.cn/series/57/${row.seriesId}_1.html` };
});
const existing = JSON.parse(await fs.readFile(new URL("../src/data/xiaomi-devices-db.json", import.meta.url), "utf8"));
assert.ok(targets.every((target) => !existing.devices.some((device) => device.id === target.id)), "不得重复已有型号");

const options = { offline: process.argv.includes("--offline"), refresh: process.argv.includes("--refresh") };
const devices = [];
const sources = [];
for (const target of targets) {
  const { device, source } = await importZolSeries(target, options);
  // 参数表有复制错误时，使用已发布的配置价格原文补齐组合，逐条保存证据。
  if (target.launch?.configurations) {
    const page = await getSourceSnapshot(target.launch.url, options);
    const text = plainText(page.html);
    const excerpt = (value, rawText) => ({ value, rawText, evidenceKind: "excerpt", sourceUrl: page.url,
      sourceType: "reference", confidence: 0.8, verifiedAt: page.fetchedAt.slice(0, 10),
      fetchedAt: page.fetchedAt, sourceSnapshotHash: page.sha256 });
    const excerpts = [];
    device.configurations = target.launch.configurations.map(([memory, storage, price]) => {
      const pattern = target.id.startsWith("redmi-k80-ultra")
        ? new RegExp(`${memory}\\+${storage}：定价 ${price} 元`)
        : target.id === "redmi-turbo-4-2025"
          ? new RegExp(`${memory.replace("GB", "")}\\+${storage} 售价 ${price} 元`)
          : new RegExp(`${memory} RAM \\+ ${storage} 存储空间 ：(?:标准价 2199 元，)?首发价 ${price} 元`);
      const rawText = text.match(pattern)?.[0];
      assert.ok(rawText, `${device.id}: 发布原文未包含 ${memory}+${storage} ${price}元`);
      excerpts.push(rawText);
      return { memory, storage, evidence: excerpt(`${memory} + ${storage}`, rawText) };
    });
    const rawText = excerpts.join(" ");
    assert.ok(text.includes(rawText) || excerpts.every((value) => text.includes(value)), `${device.id}: 配置证据缺失`);
    device.specs.memory = excerpt([...new Set(device.configurations.map((config) => config.memory))].join(" / "), excerpts[0]);
    device.specs.storage = excerpt([...new Set(device.configurations.map((config) => config.storage))].join(" / "), excerpts[0]);
    device.specs.memory.note = device.specs.storage.note = "可选值汇总自各配置 evidence 中的中国大陆发布定价原文。";
    source.notes += " 配置列表用中国大陆发布文章逐条核对，避免参数表复制错误。";
    if (target.id === "redmi-turbo-4-2025") {
      const rawText = text.match(/6.67 英寸 2712×1220 柔性 OLED 直屏/)?.[0];
      assert.ok(rawText, "Turbo 4 OLED 材质证据缺失");
      device.specs.displayType = excerpt("OLED", rawText);
      source.fieldGaps = source.fieldGaps.filter((gap) => gap.field !== "displayType");
    }
  }
  if (target.id === "xiaomi-13-2022") {
    const page = await getSourceSnapshot("https://mobile.zol.com.cn/810/8107649.html", options);
    const text = plainText(page.html);
    const rawText = text.match(/该机主摄为5000万像素，搭载IMX800传感器，支持OIS/)?.[0];
    assert.ok(text.includes("小米13") && rawText, "小米13主摄像素补证缺失");
    device.specs.mainCamera = { value: "5000 万像素主摄（IMX800，OIS）", rawText,
      evidenceKind: "excerpt", sourceUrl: page.url, sourceType: "reference", confidence: 0.8,
      verifiedAt: page.fetchedAt.slice(0, 10), fetchedAt: page.fetchedAt,
      sourceSnapshotHash: page.sha256 };
    device.specs.rearCamera.note = "参数库记为5400万；中文实机评测主摄为5000万，主摄成像口径以mainCamera补证为准。";
    source.referenceUrls.push(page.url);
    source.notes += " 主摄对比采用中文实机评测的5000万像素口径，不把参数表5400万直接用作主摄比较。";
  }
  devices.push(device);
  sources.push(source);
  console.log(`${device.id}: ${device.configurations.length}个已核实配置`);
}
const generatedAt = [...devices.flatMap((device) => Object.values(device.specs).map((field) => field.verifiedAt))].sort().at(-1);
const output = (value) => `${JSON.stringify(value, null, 2)}\n`;
await fs.writeFile(new URL("../src/data/xiaomi-phone-expansion-devices-db.json", import.meta.url), output({
  metadata: { version: "1.0", totalDevices: devices.length, generatedAt }, devices,
}));
await fs.writeFile(new URL("../src/data/xiaomi-phone-expansion-sources.json", import.meta.url), output({ phone: sources }));
console.log(`新增 ${devices.length} 台独立中国大陆手机；配置共 ${devices.reduce((total, device) => total + device.configurations.length, 0)} 个`);
