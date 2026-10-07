import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { getSourceSnapshot } from "./lib/source-snapshot.mjs";

const fixture = JSON.parse(await fs.readFile(new URL("./fixtures/huawei-tablet-official-expansion.json", import.meta.url), "utf8"));
const options = { offline: process.argv.includes("--offline"), refresh: process.argv.includes("--refresh") };
const dbPath = new URL("../src/data/huawei-tablet-official-devices-db.json", import.meta.url);
const sourcePath = new URL("../src/data/huawei-tablet-official-sources.json", import.meta.url);
const required = ["chip", "memory", "storage", "launchPrice", "screenSize", "displayType", "resolution", "port"];
const clean = (html) => html.replace(/<!--[\s\S]*?-->|<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&NoBreak;|&#8288;|\u2060/g, "").replace(/\s+/g, " ").trim();
const pages = {};
for (const [key, url] of Object.entries(fixture.pages)) {
  const page = await getSourceSnapshot(url, options);
  assert.ok(!page.html.includes("\uFFFD"), `${url}: broken encoding`);
  pages[key] = { ...page, text: clean(page.html) };
}
function field(value, key, pattern, unit, text = pages[key].text) {
  const page = pages[key];
  const rawText = text.match(new RegExp(pattern, "i"))?.[0];
  assert.ok(rawText, `${key}: missing ${pattern}`);
  const official = new URL(page.url).hostname === "consumer.huawei.com";
  return { value, ...(unit ? { unit } : {}), rawText, evidenceKind: "excerpt", sourceUrl: page.url,
    sourceType: official ? "official" : "reference", confidence: official ? 1 : 0.8,
    verifiedAt: page.fetchedAt.slice(0, 10), fetchedAt: page.fetchedAt, sourceSnapshotHash: page.sha256 };
}
const devices = [], sources = [];
const existing = [];
for (const file of await fs.readdir(new URL("../src/data/", import.meta.url))) {
  if (/^huawei.*devices-db\.json$/.test(file) && file !== "huawei-tablet-official-devices-db.json")
    existing.push(...JSON.parse(await fs.readFile(new URL(`../src/data/${file}`, import.meta.url), "utf8")).devices.filter((d) => d.category === "tablet"));
}
for (const row of fixture.targets) {
  const product = fixture.products[row.product];
  assert.ok(!existing.some((device) => device.id === row.id || (device.family === row.family && device.releaseYear === row.year)), `duplicate ${row.id}`);
  assert.match(pages[row.product].text, new RegExp(product.identity));
  // 有些报道回顾已发生的首售；报道日和首售日明确分别保存，不能互相替代。
  const reportDate = row.saleReportDate ?? row.releaseDate;
  assert.ok(reportDate.startsWith(String(row.year)) && reportDate >= row.releaseDate);
  const [year, month, day] = reportDate.split("-").map(Number);
  const publicationDate = `${year}/${month}/${day}\\b`;
  assert.match(pages[row.salePage].text, new RegExp(publicationDate), "实际首售年份需已登记的完整报道日期支撑");
  const skuSegment = pages[row.skuPage].text.match(new RegExp(row.skuScope, "i"))?.[1];
  assert.ok(skuSegment, `${row.id}: exact edition SKU segment missing`);
  const configurations = row.configurations.map(([memory, storage, pattern]) => {
    assert.match(memory, /^\d+GB$/); assert.match(storage, /^(?:\d+GB|\d+TB)$/);
    const evidence = field(`${memory} + ${storage}`, row.skuPage, pattern, undefined, skuSegment);
    const capacities = evidence.rawText.match(/(\d+)(?:GB)?\s*\+\s*(\d+)(GB|TB)/i);
    assert.ok(capacities && `${capacities[1]}GB` === memory && `${capacities[2]}${capacities[3].toUpperCase()}` === storage, "SKU原文容量必须成对匹配");
    return { memory, storage, evidence };
  });
  const specs = {};
  for (const [key, pair] of Object.entries(product)) {
    if (!Array.isArray(pair)) continue;
    specs[key === "battery" ? "batteryCapacity" : key] = field(pair[0], row.product, pair[1], { screenSize: "inch", battery: "mAh" }[key]);
  }
  if (row.chip) specs.chip = field(...row.chip);
  if (row.displayOverride) specs.displayType = { ...field(...row.displayOverride), supportingEvidence: specs.displayType };
  // 每款相机只记官网明示像素/光圈；不把标准款红枫或闪光灯套到悦享款。
  const rearPattern = row.product === "mini" ? "5000 万像素摄像头（f/1\\.8 光圈） 800 万像素广角摄像头（f/2\\.2 光圈）" : "5000 万像素高清摄像头（[Ff]/?1\\.8 光圈，自动对焦）";
  specs.rearCamera = field(row.product === "mini" ? "5000万像素主摄 + 800万像素广角" : "5000万像素主摄（f/1.8）", row.product, rearPattern);
  specs.frontCamera = field({ pro12: "1200万像素（f/2.4）", max: "1200万像素（f/2.4）", airz: "800万像素（f/2.2）", mini: "3200万像素（f/2.4）", air: "1200万像素（f/2.4）" }[row.product], row.product,
    { pro12: "前置摄像头配置 1200 万像素高清摄像头（F2.4 光圈，固定焦距）", max: "前置摄像头配置 1200 万像素高清摄像头（F2.4 光圈，固定焦距）", airz: "前置摄像头配置 800 万像素（f/2.2 光圈）", mini: "前置摄像头配置 3200 万像素（f/2.4 光圈）", air: "前置摄像头配置 1200 万像素（f/2.4 光圈）" }[row.product]);
  if (product.chargingNote || row.product === "air") {
    specs.chargingMethod.supportingEvidence = field("标配66W充电器", row.product, "(?:华为超级快充多设备电源适配器（66 W）|华为冰糖全能充电器（Max 66 W）)");
  }
  const skuEvidence = field(configurations.map((c) => `${c.memory}+${c.storage}`).join(" / "), row.skuPage, row.skuScope);
  specs.memory = { ...skuEvidence, value: [...new Set(configurations.map((c) => c.memory))].join(" / ") };
  specs.storage = { ...skuEvidence, value: [...new Set(configurations.map((c) => c.storage))].join(" / ") };
  if (row.configurations[0][3]) {
    const [memory, storage, pattern, price] = row.configurations[0];
    specs.launchPrice = { ...field(price, row.skuPage, pattern, "CNY", skuSegment), priceType: "launch", market: "中国大陆",
      configuration: `${row.family}，${memory}运行内存 + ${storage}存储，标准屏国行主机`, condition: "国内发布定价；未使用限时优惠、教育优惠、国补或套装价格" };
  }
  if (row.colors) specs.colors = field(row.colors, row.product, row.colors.join("，"));
  const device = { id: row.id, brand: "Huawei", market: "CN", category: "tablet", series: `HUAWEI MatePad ${row.product === "max" ? "Pro Max" : row.product === "pro12" ? "Pro 12" : row.product === "airz" ? "Air Z" : row.product === "mini" ? "Mini" : "Air 12"}`,
    family: row.family, variant: "standard", modelName: `${row.family} (${row.year})`, generation: String(row.year), generationOrder: row.product === "air" ? 3 : 1,
    releaseYear: row.year, releaseDate: row.releaseDate, comparisonGroupId: row.group, configurations, specs, computed: {} };
  const references = [...new Set([row.product, row.skuPage, row.salePage, row.chip?.[1], row.displayOverride?.[1], ...(row.product === "pro12" ? ["pro12Launch"] : row.product === "airz" ? ["airzLaunch"] : [])].filter(Boolean).map((key) => pages[key].url))];
  const source = { id: row.id, modelName: device.modelName, generation: device.generation, releaseYear: row.year,
    sourcePageType: "expanded_core_spec_snapshots", sourceStatus: "verified", officialSpecUrl: pages[row.product].url, referenceUrls: references,
    marketEvidence: field("CN", row.product, product.identity), releaseEvidence: field(row.releaseDate, row.salePage, row.salePattern),
    configurationEvidence: skuEvidence, edition: row.family, excludedConfigurations: "未跨配规格总页RAM/ROM；未将柔光、悦享、典藏及配件套装混入当前主机版型。",
    fieldGaps: required.filter((key) => !specs[key]).map((key) => ({ field: key, reason: key === "chip" ? row.chipGap : "未独立核验该版型首发定价；促销、国补、教育优惠及当前官网起价不作首发价。" })),
    notes: `${row.notes} ${product.chargingNote ?? ""}`.trim(),
    sourceSnapshots: references.map((url) => { const page = Object.values(pages).find((p) => p.url === url); return { sourceUrl: url, sourceSnapshotHash: page.sha256, fetchedAt: page.fetchedAt }; }) };
  if (specs.colors) source.colorEvidence = { ...specs.colors, value: row.colors.join("，") };
  source.releaseEvidence.supportingEvidence = field(reportDate, row.salePage, publicationDate);
  if (row.saleReportDate) source.releaseEvidence.note = "报道日期与首售日期不同；原文明确回顾该年9月12日已经开售，不把报道日9月25日当普通版首售。";
  if (row.product === "airz") source.colorBindingEvidence = field(row.colors.join("，"), "airzSale",
    row.family.endsWith("悦享款") ? "悦享款配备星云粉、皓月银颜色" : "标准版配备海岛蓝、珊瑚橙、深空灰颜色");
  const imageRows = fixture.imageEvidence.filter((image) => image.targetIds.includes(row.id));
  for (const image of imageRows) {
    const page = pages[image.page];
    assert.ok(page.html.includes(image.anchor), "图片必须来自真实官网原始标签");
    assert.equal(new URL(image.relativeUrl, page.url).href, image.url);
    assert.equal(image.sourceSnapshotHash, page.sha256);
    assert.match(image.sha256, /^[a-f0-9]{64}$/);
    assert.ok(image.width >= 700 && image.height >= 700 && image.visualReview);
    if (process.argv.includes("--check-image-files")) {
      const bytes = await fs.readFile(`/tmp/huawei-tablet-official-images/${new URL(image.relativeUrl, page.url).pathname.split("/").at(-3)}-${new URL(image.url).pathname.split("/").at(-1)}`);
      assert.equal(bytes.length, image.bytes);
      assert.equal(createHash("sha256").update(bytes).digest("hex"), image.sha256);
      assert.equal(bytes.readUInt32BE(16), image.width); assert.equal(bytes.readUInt32BE(20), image.height);
    }
    const candidate = { ...image, sourceUrl: page.url, imageScope: "model_shared", licenseStatus: "unknown", status: "downloaded_and_visually_reviewed", note: "同型号共用外观图，不对应特定内存/硬盘配置" };
    if (image.primary) source.primaryImageCandidate = candidate;
    (source.colorImageCandidates ??= []).push({ ...candidate, color: image.color });
  }
  source.imageFieldGaps = [];
  if (!source.primaryImageCandidate) source.imageFieldGaps.push({ field: "primaryImage", reason: "官网图为跨版型规格总图；未证明该独立悦享款或柔光款外观绑定，不自动套图。" });
  for (const color of row.colors ?? []) if (!source.colorImageCandidates?.some((image) => image.color === color))
    source.imageFieldGaps.push({ field: "colorImage", color, reason: "未完成该型号标准色图片的实际视觉和字节哈希核验；留空。" });
  if (!row.colors) source.imageFieldGaps.push({ field: "colors", reason: "官网总页汇集普通、悦享、凝光颜色；未逐SKU核验标准屏颜色适用范围，不把系列全色当该版型全色。" });
  if (row.product === "airz" && !row.family.endsWith("悦享款")) source.imageSharingBoundary = "普通屏与柔光屏使用该同型号官网共用背面图；仅产品外观参考，不证明内部T93SD/T93S、屏幕玻璃工艺或RAM配置。芯片、屏幕与容量分别按原文核验。";
  devices.push(device); sources.push(source);
}
assert.equal(new Set(devices.map((d) => d.id)).size, devices.length);
for (const device of devices) {
  assert.ok(device.specs.memory && device.specs.storage);
  assert.equal(device.variant, "standard"); assert.equal(device.market, "CN");
  assert.ok(device.releaseDate <= "2026-10-06" && device.releaseDate.startsWith(String(device.releaseYear)));
  const source = sources.find((s) => s.id === device.id);
  assert.deepEqual(source.fieldGaps.map((gap) => gap.field).sort(), required.filter((key) => !device.specs[key]).sort());
  assert.equal(new Set(device.configurations.map(({ memory, storage }) => `${memory}/${storage}`)).size, device.configurations.length);
  assert.ok(device.comparisonGroupId.endsWith(".standard"));
  assert.ok(device.configurations.every((config) => config.memory && config.storage));
  for (const evidence of [...Object.values(device.specs), ...device.configurations.map((c) => c.evidence)]) {
    const source = sources.find((s) => s.id === device.id);
    assert.ok(source.referenceUrls.includes(evidence.sourceUrl));
    assert.equal(evidence.sourceSnapshotHash, Object.values(pages).find((p) => p.url === evidence.sourceUrl).sha256);
  }
}
assert.deepEqual(sources.map((source) => source.id), devices.map((device) => device.id));
function checkEvidence(value) {
  if (!value || typeof value !== "object") return;
  if (value.sourceSnapshotHash && value.sourceUrl) {
    const page = Object.values(pages).find((p) => p.url === value.sourceUrl);
    assert.ok(page, `未登记来源${value.sourceUrl}`); assert.equal(value.sourceSnapshotHash, page.sha256);
    if (value.rawText) assert.ok(page.text.includes(value.rawText), "证据摘要须是当前原文，不是重新拼写的推断");
  }
  for (const child of Object.values(value)) checkEvidence(child);
}
checkEvidence({ devices, sources });
const deferred = fixture.deferred.map((row) => ({ ...row, ...(row.sourceUrl ? {
  catalogEvidence: field(row.status, row.sourceUrl === pages.miniRumor.url ? "miniRumor" : "miniNewColor",
    row.status === "excluded_unreleased" ? "预计年前也会发布" : "推出了 MatePad Pro 12.2 英寸、MatePad Mini 悦读版的幻影紫配色") } : {}) }));
checkEvidence(deferred);
const db = { metadata: { version: "1.0", totalDevices: devices.length, generatedAt: Object.values(pages).map((p) => p.fetchedAt.slice(0, 10)).sort().at(-1),
  catalogAudit: { coverageStatus: "partial_bounded_official_tablet_gaps", cutoff: "2026-10-06", existingTabletCount: existing.length,
    existingTablets: existing.map(({ id, family, releaseYear }) => ({ id, family, releaseYear })), scope: fixture.scope, deferred,
    namingYearPolicy: "型号营销年与实际国内首售年分别处理；现有MatePad11.5(2026)实际2025首售不重建。", imageLicense: "unknown" } }, devices };
const registry = { tablet: sources };
const encoded = (data) => `${JSON.stringify(data, null, 2)}\n`;
if (process.argv.includes("--check")) {
  assert.equal(await fs.readFile(dbPath, "utf8"), encoded(db), "设备文件应可离线逐字重放");
  assert.equal(await fs.readFile(sourcePath, "utf8"), encoded(registry), "来源文件应可离线逐字重放");
} else {
  await fs.writeFile(dbPath, encoded(db)); await fs.writeFile(sourcePath, encoded(registry));
}
console.log(JSON.stringify({ devices: devices.length, configurations: devices.reduce((n, d) => n + d.configurations.length, 0), sourcePages: Object.keys(pages).length,
  missingLaunchPrice: devices.filter((d) => !d.specs.launchPrice).length, missingChip: devices.filter((d) => !d.specs.chip).length, mode: process.argv.includes("--check") ? "check" : "generate" }));
