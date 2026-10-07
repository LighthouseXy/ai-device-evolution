import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { importZolSeries, plainText } from "./lib/zol-device.mjs";
import { getSourceSnapshot } from "./lib/source-snapshot.mjs";

const { targets } = JSON.parse(await fs.readFile("scripts/fixtures/huawei-expansion.json", "utf8"));
const categories = { phone: 57, tablet: 702, laptop: 16 };
const devices = [];
const sources = { phone: [], tablet: [], laptop: [] };
const flags = { offline: process.argv.includes("--offline"), refresh: process.argv.includes("--refresh") };
const launches = {
  "huawei-pura-70-2024": { url: "https://www.ithome.com/0/762/641.htm", pattern: /12GB \+ 256GB 售价 5499 元/,
    memory: "12GB", storage: "256GB", value: 5499 },
  "huawei-pura-70-pro-2024": { url: "https://www.ithome.com/0/762/641.htm", pattern: /Pro 三个版本 12GB\+256GB 售价 6499 元/,
    memory: "12GB", storage: "256GB", value: 6499 },
};
const chipSupplements = {
  "huawei-pura-70-2024": { value: "麒麟 9000S1", pattern: /Pura 70 标准版上的麒麟 9000S1/ },
  "huawei-pura-70-pro-2024": { value: "麒麟 9010", pattern: /华为 Pura 70 Pro \/ Pro\+\/Ultra 搭载的麒麟 9010 处理器/ },
  "huawei-pura-70-pro-plus-2024": { value: "麒麟 9010", pattern: /华为 Pura 70 Pro \/ Pro\+\/Ultra 搭载的麒麟 9010 处理器/ },
};
const releaseFallbacks = {
  "huawei-pura-80-2025": { sourceUrl: "https://m.ithome.com/html/860152.htm", releaseDate: "2025-06-11",
    pattern: /2025-06-11[^]*?IT之家 6 月 11 日消息，华为 Pura 80 系列手机于今日下午正式发布，新机包含 Pura 80、Pura 80 Pro、Pura 80 Pro\+ 和 Pura 80 Ultra 四款。/ },
  "huawei-pura-80-pro-2025": { sourceUrl: "https://m.ithome.com/html/860152.htm", releaseDate: "2025-06-14",
    pattern: /2025-06-11[^]*?华为 Pura 80 Pro 、Pura 80 Pro\+ 手机已于今日开启全款预售（6 月 14 日首销）/ },
  "huawei-matebook-x-pro-2023": { sourceUrl: "https://www.ithome.com/0/693/565.htm", releaseDate: "2023-05-25",
    pattern: /5 月 25 日华为 MateBook X Pro 新品全系将在华为商城[^]*?平台全面开售/ },
};
assert.ok(!(flags.offline && flags.refresh), "--offline 与 --refresh 不能同时使用");
assert.equal(new Set(targets.map((target) => target.id)).size, targets.length, "目标型号不得重复");

// 只复用具体 SKU 参数页的已售组合；标准/柔光、Wi-Fi/LTE 不相互补配。
for (const target of targets) {
  const { device, source } = await importZolSeries({
    ...target,
    ...(launches[target.id] ? { launch: launches[target.id] } : {}),
    ...(releaseFallbacks[target.id] ? { releaseFallback: releaseFallbacks[target.id],
      notes: (target.notes ?? "") + (target.id === "huawei-pura-80-2025" ? "参数页未记载上市日期；采用该型号中国大陆发布报道日期，不等同首销日期。" : "参数页未记载上市日期；采用中国大陆首销报道日期。") } : {}),
    brand: "Huawei",
    comparisonGroupId: `huawei.${target.category}.${target.group}.standard`,
    seriesUrl: `https://detail.zol.com.cn/series/${categories[target.category]}/${target.seriesId}_1.html`,
    excludeVariants: ["柔光", "悦享", "LTE", "卫星通信", "北斗", "星闪键盘", "星闪手写笔",
      ...(target.category === "tablet" ? ["全网通", "蜂窝", "5G版"] : []), ...(target.excludeVariants ?? [])],
  }, flags);
  if (chipSupplements[target.id]) {
    const supplement = chipSupplements[target.id];
    const page = await getSourceSnapshot("https://www.ithome.com/0/778/427.htm", flags);
    const rawText = plainText(page.html).match(supplement.pattern)?.[0];
    assert.ok(rawText, `${target.id}: 处理器补证缺失`);
    assert.ok(!device.specs.chip, `${target.id}: 不覆盖已有处理器证据`);
    device.specs.chip = { value: supplement.value, rawText, evidenceKind: "excerpt",
      sourceUrl: page.url, sourceType: "reference", confidence: 0.8, verifiedAt: page.fetchedAt.slice(0, 10),
      fetchedAt: page.fetchedAt, sourceSnapshotHash: page.sha256,
      note: "采用中文媒体对具体型号的处理器报道；标准版不混用北斗卫星版的麒麟 9010E。" };
    source.referenceUrls.push(page.url);
    source.fieldGaps = source.fieldGaps.filter(({ field }) => field !== "chip");
    source.notes += "处理器由中文媒体明确型号报道补证，非官方公布。";
  }
  if (target.id === "huawei-matebook-x-pro-2023") {
    const page = await getSourceSnapshot(releaseFallbacks[target.id].sourceUrl, flags);
    const text = plainText(page.html);
    const rawText = text.match(/i7\+16GB\+1TB 13代酷睿版售价 9999 元/)?.[0];
    const chipText = text.match(/13代酷睿™i7-1360P 处理器/)?.[0];
    assert.ok(rawText && chipText, "X Pro 2023 标准版配置、处理器与首发价格证据缺失");
    const evidence = { rawText, evidenceKind: "excerpt", sourceUrl: page.url, sourceType: "reference", confidence: 0.8,
      verifiedAt: page.fetchedAt.slice(0, 10), fetchedAt: page.fetchedAt, sourceSnapshotHash: page.sha256 };
    const chip = "Intel 酷睿i7 1360P";
    device.configurations.unshift({ memory: "16GB", storage: "1TB", chip,
      evidence: { ...evidence, rawText: `${chipText}；${rawText}`, value: `16GB + 1TB · ${chip}` } });
    device.specs.memory = { ...evidence, value: [...new Set(device.configurations.map(({ memory }) => memory))].join(" / "),
      note: "仅汇总本批已核验配置；32GB 标准版参数页有容量冲突，本批不宣称已核验。" };
    device.specs.chip = { ...evidence, rawText: chipText,
      value: [...new Set(device.configurations.map(({ chip }) => chip))].join(" / "),
      note: "i7-1360P 由发布报道核验；一致的其他 CPU 配置保留各自具体参数页证据。" };
    device.specs.launchPrice = { ...evidence, value: 9999, unit: "CNY", priceType: "launch", market: "中国大陆",
      configuration: "16GB 运行内存 + 1TB 存储，i7-1360P，国行", condition: "中国大陆标准版最低配首发定价；不含微绒典藏版" };
    source.fieldGaps = source.fieldGaps.filter(({ field }) => field !== "launchPrice");
    source.notes = source.notes.replace(/仅登记实际读取的 \d+ 个配置/, `仅登记核验的 ${device.configurations.length} 个配置`);
    source.notes += "16GB+1TB 参数页冲突已通过中国大陆发布报道补证，未采用冲突的内存字段。";
  }
  assert.equal(device.brand, "Huawei");
  assert.equal(device.market, "CN");
  assert.ok(device.releaseYear >= 2022 && device.releaseYear <= 2026, `${device.id}: 不在近五年范围`);
  assert.ok(device.configurations.length, `${device.id}: 无有据可查的配置`);
  const identities = device.configurations.map(({ memory, storage, chip }) => JSON.stringify([memory, storage, chip]));
  assert.equal(new Set(identities).size, identities.length, `${device.id}: 补证后出现重复配置`);
  for (const configuration of device.configurations) {
    const title = configuration.evidence.rawText.split("；")[0];
    const capacities = [...title.matchAll(/\d+(?:\.\d+)?\s*(?:GB|TB)/gi)].map(([value]) => value.replace(/\s/g, "").toUpperCase());
    if (capacities.length >= 2) {
      assert.deepEqual(capacities.slice(0, 2), [configuration.memory, configuration.storage], `${device.id}: SKU 标题与参数内存/存储冲突`);
    }
    assert.match(configuration.evidence.sourceSnapshotHash, /^[a-f0-9]{64}$/);
    assert.ok(configuration.evidence.fetchedAt && configuration.evidence.sourceUrl);
  }
  devices.push(device);
  sources[device.category].push(source);
  console.log(JSON.stringify({ id: device.id, year: device.releaseYear,
    configurations: device.configurations.length, fields: Object.keys(device.specs).length, gaps: source.fieldGaps }));
}

assert.ok(devices.length >= 31, "Huawei 扩容批次至少需要 31 台独立设备");
assert.equal(new Set(devices.map((device) => device.id)).size, devices.length, "设备 ID 重复");
for (const category of Object.keys(categories)) assert.ok(sources[category].length, `${category}: 缺少设备`);
const groups = new Map();
for (const device of devices) {
  const group = groups.get(device.comparisonGroupId) ?? [];
  group.push(device);
  groups.set(device.comparisonGroupId, group);
}
for (const group of groups.values()) {
  group.sort((a, b) => (a.releaseDate ?? String(a.releaseYear)).localeCompare(b.releaseDate ?? String(b.releaseYear)));
  group.forEach((device, index) => { device.generationOrder = index + 1; });
}
const generatedAt = devices.flatMap((device) => Object.values(device.specs).map((field) => field.fetchedAt?.slice(0, 10)))
  .filter(Boolean).sort().at(-1);
await fs.writeFile("src/data/huawei-expansion-devices-db.json", `${JSON.stringify({ metadata: { version: "1.0",
  totalDevices: devices.length, generatedAt }, devices }, null, 2)}\n`);
await fs.writeFile("src/data/huawei-expansion-sources.json", `${JSON.stringify(sources, null, 2)}\n`);
console.log(JSON.stringify({ devices: devices.length, categories: Object.fromEntries(Object.entries(sources).map(([key, values]) => [key, values.length])) }));
