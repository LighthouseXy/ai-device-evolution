import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { importZolSeries, plainText, zolRows, readRelease, extractZolProductImage } from "./lib/zol-device.mjs";
import { getSourceSnapshot } from "./lib/source-snapshot.mjs";

const fixture = JSON.parse(await fs.readFile(new URL("./fixtures/xiaomi-history-batch2-expansion.json", import.meta.url), "utf8"));
const targets = fixture.targets;
assert.equal(new Set(targets.map((row) => row.slug)).size, targets.length, "历史目标重复");
assert.ok(targets.every((row) => row.year >= 2017 && row.year <= 2026 && Number.isInteger(row.seriesId)));
if (process.argv.includes("--self-check")) {
  assert.ok(fixture.pending.every((row) => /^https:\/\/(?:detail\.zol\.com\.cn|www\.mi\.com)\//.test(row.sourceUrl)));
  const db = JSON.parse(await fs.readFile(new URL("../src/data/xiaomi-history-batch2-devices-db.json", import.meta.url), "utf8"));
  const registry = JSON.parse(await fs.readFile(new URL("../src/data/xiaomi-history-batch2-sources.json", import.meta.url), "utf8"));
  assert.ok(Object.values(registry).every(Array.isArray));
  const registered = Object.values(registry).flat();
  assert.deepEqual(registered.map((row) => row.id).sort(), db.devices.map((row) => row.id).sort());
  for (const device of db.devices) {
    const source = registered.find((row) => row.id === device.id);
    assert.equal(device.variant, "standard"); assert.equal(device.market, "CN");
    assert.ok(device.releaseYear >= 2017 && device.releaseYear <= 2026);
    assert.ok(!device.releaseDate || device.releaseDate <= "2026-10-06");
    assert.equal(device.comparisonGroupId, `xiaomi.phone.${device.family.toLowerCase().replace(/\+/g, "-plus").replace(/\s+/g, "-")}.standard`);
    assert.equal(new Set(device.configurations.map(({ memory, storage, chip }) => JSON.stringify([memory, storage, chip]))).size, device.configurations.length);
    for (const url of source.referenceUrls) await getSourceSnapshot(url, { offline: true });
    for (const field of [...Object.values(device.specs), ...device.configurations.map((row) => row.evidence), source.marketEvidence, source.releaseEvidence, source.colorEvidence]) {
      assert.ok(source.referenceUrls.includes(field.sourceUrl));
      assert.equal(field.sourceSnapshotHash, (await getSourceSnapshot(field.sourceUrl, { offline: true })).sha256);
    }
    if (source.primaryImageCandidate) assert.equal(source.primaryImageCandidate.sourceSnapshotHash, (await getSourceSnapshot(source.primaryImageCandidate.sourceUrl, { offline: true })).sha256);
  }
  assert.deepEqual(db.devices.find((row) => row.id === "redmi-note-4x-2017").configurations.map(({ memory, storage }) => [memory, storage]), [["3GB", "16GB"], ["3GB", "32GB"]]);
  assert.equal(db.metadata.totalDevices, db.devices.length);
  assert.equal(db.metadata.catalogAudit.annualInventory.length, 10);
  console.log(`${db.devices.length} 台 / ${db.devices.reduce((n, row) => n + row.configurations.length, 0)} 配置；来源哈希、国行/年份/分组、标准版与年度差集检查通过`);
  process.exit(0);
}

const options = { offline: process.argv.includes("--offline"), refresh: process.argv.includes("--refresh") };
const existing = [];
for (const file of await fs.readdir(new URL("../src/data/", import.meta.url))) {
  if (/^(?:xiaomi|redmi).*devices-db\.json$/.test(file) && file !== "xiaomi-history-batch2-devices-db.json") {
    existing.push(...JSON.parse(await fs.readFile(new URL(`../src/data/${file}`, import.meta.url), "utf8")).devices);
  }
}
const devices = [], sources = [], blocked = [];
const evidence = (page, value, rawText, sourceType = "reference") => ({ value, rawText, evidenceKind: "excerpt", sourceUrl: page.url,
  sourceType, confidence: sourceType === "official" ? 0.95 : 0.8, verifiedAt: page.fetchedAt.slice(0, 10),
  fetchedAt: page.fetchedAt, sourceSnapshotHash: page.sha256 });
const normalizedName = (value) => value.replace(/小米红米/g, "Redmi").replace(/红米/g, "Redmi")
  .replace(/[（(][^]*$/, "").replace(/参数$/, "").replace(/\s+/g, "").toLowerCase();

async function importPublishedFallback(row, id) {
  const seriesUrl = `https://detail.zol.com.cn/series/57/${row.seriesId}_1.html`;
  const series = await getSourceSnapshot(seriesUrl, options);
  assert.equal(normalizedName(plainText(series.html.match(/<h1\b[^>]*>([^]*?)<\/h1>/i)?.[1] ?? "")), normalizedName(row.name));
  const listingHref = [...series.html.matchAll(/href=["']([^"']+param_\d+_0_1\.html)["']/g)][0]?.[1];
  const listing = listingHref ? await getSourceSnapshot(new URL(listingHref, seriesUrl).href, options) : null;
  const candidates = [...`${series.html}\n${listing?.html ?? ""}`.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([^]*?)<\/a>/gi)]
    .map(([, href, html]) => ({ href, name: plainText(html) })).filter(({ href, name }) => /\/cell_phone\/index\d+\.shtml/.test(href)
      && normalizedName(name) === normalizedName(row.name) && !["尊享", "故宫", "透明", ...(row.excludeVariants ?? [])].some((text) => name.includes(text)));
  assert.ok(candidates.length, "补证目标缺少独立标准版参数型号");
  const productId = candidates[0].href.match(/index(\d+)\.shtml/)[1];
  const page = await getSourceSnapshot(`https://detail.zol.com.cn/${Math.floor(Number(productId) / 1000) + 1}/${productId}/param.shtml`, options);
  assert.equal(normalizedName(plainText(page.html.match(/<h1\b[^>]*>([^]*?)<\/h1>/i)?.[1] ?? "")), normalizedName(row.name));
  const rows = zolRows(page.html), release = readRelease(rows, { minYear: 2017 });
  assert.equal(release?.year, row.year, "补证参数年份不一致");
  if (row.parameterChipPattern) assert.match(rows.get("CPU型号") ?? "", new RegExp(row.parameterChipPattern), "标准版处理器不一致");
  const specs = {};
  // ponytail: 补证分支只读标准版少量独立参数；容量只允许发布原文逐条配置。
  for (const [key, label] of [["chip", "CPU型号"], ["displayType", "屏幕材质"], ["resolution", "分辨率"], ["port", "机身接口"], ["bluetooth", "蓝牙"]]) {
    if (rows.get(label)) specs[key] = evidence(page, rows.get(label), `${label} ${rows.get(label)}`);
  }
  for (const [key, label, pattern, unit] of [["screenSize", "屏幕尺寸", /(\d+(?:\.\d+)?)英寸/, "inch"], ["weight", "重量", /(\d+(?:\.\d+)?)g/, "g"], ["batteryCapacity", "电池容量", /(\d+)mAh/, "mAh"]]) {
    const match = rows.get(label)?.match(pattern);
    if (match) specs[key] = { ...evidence(page, Number(match[1]), `${label} ${rows.get(label)}`), unit };
  }
  return { device: { id, brand: "Xiaomi", market: "CN", category: "phone", series: row.family, family: row.family, variant: "standard",
    modelName: row.name, generation: row.generation ?? String(row.year), generationOrder: row.year, releaseYear: row.year,
    ...(release.date.length === 10 ? { releaseDate: release.date } : {}), comparisonGroupId: `xiaomi.phone.${row.family.toLowerCase().replace(/\+/g, "-plus").replace(/\s+/g, "-")}.standard`,
    configurations: [], specs, computed: {} }, source: { id, modelName: row.name, releaseYear: row.year,
    sourceStatus: "verified", sourcePageType: "expanded_core_spec_snapshots",
    referenceUrls: [seriesUrl, ...(listing ? [listing.url] : []), page.url], releaseEvidence: evidence(page, release.date, `${release.entry.label} ${release.entry.value}`),
    fieldGaps: [{ field: "launchPrice", reason: "本批发布原文仅用作型号与SKU补证；不将市场参考报价当首发价" }],
    notes: "旧容量汇总参数页不拆配；单独读取标准版非容量字段，配置另由发布原文逐条补证。" } };
}

for (const row of targets) {
  const id = `${row.slug}-${row.year}`;
  assert.ok(!existing.some((device) => device.id === id), `${id}: 与既有分库重复`);
  try {
    const imported = row.configurationFallback ? await importPublishedFallback(row, id) : await importZolSeries({ ...row, id, brand: "Xiaomi", category: "phone",
      modelName: row.name, expectedName: row.expectedName ?? row.name, releaseYear: row.year, variant: "standard",
      minYear: 2017, generationOrder: row.year,
      comparisonGroupId: `xiaomi.phone.${row.family.toLowerCase().replace(/\+/g, "-plus").replace(/\s+/g, "-")}.standard`,
      seriesUrl: `https://detail.zol.com.cn/series/57/${row.seriesId}_1.html`,
      excludeVariants: ["迪士尼", "Aape", "哆啦", "雷军签名", "虎年礼盒", ...(row.excludeVariants ?? [])],
    }, options);
    const { device, source } = imported;
    const verifiedConfigurations = [];
    for (const configuration of device.configurations) {
      const page = await getSourceSnapshot(configuration.evidence.sourceUrl, options);
      const rows = zolRows(page.html);
      // ponytail: 旧库多值ROM不拆配SKU；独立发布原文补证后再导入。
      if ((rows.get("ROM容量")?.match(/\d+(?:\.\d+)?\s*(?:GB|TB)/gi) ?? []).length !== 1) {
        (source.excludedConfigurations ??= []).push({ name: configuration.evidence.rawText,
          sourceUrl: page.url, reason: "旧参数页ROM是多值汇总，无法绑定单个实际SKU" });
        continue;
      }
      verifiedConfigurations.push(configuration);
    }
    if (row.configurationFallback) {
      const page = await getSourceSnapshot(row.configurationFallback.sourceUrl, options);
      const text = plainText(page.html);
      assert.ok(row.configurationFallback.identityBodyPattern ? new RegExp(row.configurationFallback.identityBodyPattern).test(text)
        : normalizedName(plainText(page.html.match(/<title\b[^>]*>([^]*?)<\/title>/i)?.[1] ?? "")).includes(normalizedName(row.name)), "配置补证的型号身份不一致");
      verifiedConfigurations.length = 0;
      for (const configuration of row.configurationFallback.entries) {
        const rawText = text.match(new RegExp(configuration.rawPattern))?.[0];
        assert.ok(rawText, "配置补证原文缺失");
        verifiedConfigurations.push({ memory: configuration.memory, storage: configuration.storage,
          evidence: evidence(page, `${configuration.memory} + ${configuration.storage}`, rawText, row.configurationFallback.sourceType) });
      }
      source.referenceUrls.push(page.url);
      for (const key of ["memory", "storage"]) {
        device.specs[key] = evidence(page, "", verifiedConfigurations[0].evidence.rawText);
      }
    }
    assert.ok(verifiedConfigurations.length, "缺少明确绑定的内存/存储SKU");
    device.configurations = verifiedConfigurations;
    const configurationPage = await getSourceSnapshot(verifiedConfigurations[0].evidence.sourceUrl, options);
    const configurationRows = zolRows(configurationPage.html);
    for (const [key, label] of [["memory", "RAM容量"], ["storage", "ROM容量"]]) {
      const value = [...new Set(verifiedConfigurations.map((configuration) => configuration[key]))].join(" / ");
      device.specs[key] = evidence(configurationPage, value, row.configurationFallback
        ? verifiedConfigurations[0].evidence.rawText : `${label} ${configurationRows.get(label)}`, row.configurationFallback?.sourceType);
      device.specs[key].note = "仅汇总本设备 configurations 中明确绑定的SKU；多值ROM页不导入。";
    }
    let marketEvidence;
    if (row.marketFallback) {
      const page = await getSourceSnapshot(row.marketFallback.sourceUrl, options);
      const rawText = plainText(page.html).match(new RegExp(row.marketFallback.rawPattern))?.[0];
      assert.ok(rawText, "国行发布补证原文缺失");
      if (row.marketFallback.sourceType === "official") {
        assert.equal(new URL(page.url).hostname, "www.mi.com");
        assert.ok(row.marketFallback.identityBodyPattern
          ? new RegExp(row.marketFallback.identityBodyPattern).test(plainText(page.html))
          : normalizedName(plainText(page.html.match(/<title\b[^>]*>([^]*?)<\/title>/i)?.[1] ?? "")).includes(normalizedName(row.marketFallback.identityName ?? row.name)), "官方国行页型号标题不一致");
      }
      marketEvidence = evidence(page, "CN", rawText, row.marketFallback.sourceType);
    }
    for (const configuration of verifiedConfigurations) {
      if (marketEvidence) break;
      const parameter = await getSourceSnapshot(configuration.evidence.sourceUrl, options);
      const rows = zolRows(parameter.html);
      const domestic = rows.get("国内发布时间");
      if (domestic) { marketEvidence = evidence(parameter, "CN", `国内发布时间 ${domestic}`); break; }
      const match = parameter.url.match(/\/(\d+)\/(\d+)\/param\.shtml$/);
      const summary = await getSourceSnapshot(`https://detail.zol.com.cn/cell_phone/index${match[2]}.shtml`, options);
      const text = plainText(summary.html);
      const rawText = text.match(/参考报价[：:]?\s*￥[^]*?\[北京[^\]]*行货\]/)?.[0];
      if (rawText) { marketEvidence = evidence(summary, "CN", `${configuration.evidence.rawText.split("；")[0]}；${rawText}`); break; }
    }
    assert.ok(marketEvidence, "缺少中国大陆发布或具体型号行货证据，暂不把中文页面默认作国行");
    source.marketEvidence = marketEvidence;
    source.referenceUrls = [...new Set([...source.referenceUrls, marketEvidence.sourceUrl])];
    for (const key of ["chip", "memory", "storage", "launchPrice", "displayType", "port", "rearCamera", "frontCamera"]) {
      if (!device.specs[key] && !source.fieldGaps.some((gap) => gap.field === key)) {
        source.fieldGaps.push({ field: key, reason: "已核验的标准版参数与配置补证页没有明确、无冲突的该字段；不从相近型号推断" });
      }
    }
    const series = await getSourceSnapshot(`https://detail.zol.com.cn/series/57/${row.seriesId}_1.html`, options);
    const galleryHref = [...series.html.matchAll(/href=["']([^"']*\/pic_\d+\.html)["']/g)][0]?.[1];
    if (galleryHref) {
      source.imageReferenceUrls = [new URL(galleryHref, series.url).href];
      source.imageReferenceStatus = "candidate_from_verified_model_series";
      source.imageReferenceNote = "图库链接由已核对型号的系列页提供；图片内容和颜色尚待独立核验，部分图库返回验证页，不视作已获取产品照片。";
    } else {
      source.imageReferenceStatus = "series_gallery_link_missing";
      source.imageReferenceNote = "已核对系列页未提供可读取的系列图库链接；可另查具体SKU参数页中的产品主图，不构造图库地址。";
    }
    const parameter = await getSourceSnapshot(source.referenceUrls.find((url) => /\/param\.shtml$/.test(url)), options);
    const colors = zolRows(parameter.html).get("机身颜色");
    if (colors) source.colorEvidence = evidence(parameter, colors, `机身颜色 ${colors}`);
    source.notes = source.notes.replace(/实际读取的 \d+ 个配置/, `核对通过的 ${verifiedConfigurations.length} 个配置`);
    if (row.configurationFallback) source.notes += " 配置另由独立发布评测原文逐条补证，仅采用该原文列明组合。";
    source.notes += " 国行身份另存marketEvidence；首发价未补证则留空；图库URL仅供后续实图核验，未生成照片。";
    source.priorReview = { status: row.priorStatus, reason: row.priorReason ?? null,
      resolution: row.configurationFallback ? "独立发布/官方原文逐SKU补证" : row.marketFallback ? "补充独立国行来源" : "逐SKU参数及行货证据核验" };
    const imagePage = extractZolProductImage(series.html) ? series : parameter;
    const image = extractZolProductImage(imagePage.html);
    if (image) source.primaryImageCandidate = { ...image, sourceUrl: imagePage.url, sourceSnapshotHash: imagePage.sha256, license: "unknown", status: "model_alt_and_primary_meta_verified_not_visually_reviewed" };
    if (fixture.imageEvidence?.[id] && image) {
      assert.equal(fixture.imageEvidence[id].url, image.url);
      source.primaryImageCandidate.actualImageEvidence = fixture.imageEvidence[id];
      source.primaryImageCandidate.status = "downloaded_and_visually_reviewed";
    }
    assert.equal(device.releaseYear, row.year);
    assert.equal(device.market, "CN");
    devices.push(device); sources.push(source);
    console.log(`${id}: ${device.configurations.length} 个明确国行配置`);
  } catch (error) {
    blocked.push({ ...row, sourceUrl: `https://detail.zol.com.cn/series/57/${row.seriesId}_1.html`, reviewStatus: "attempted_blocked", reason: error.message });
    console.log(`${id}: 暂缓 — ${error.message}`);
  }
}
assert.ok(devices.length, "无核验通过设备，不覆盖分库");
assert.equal(new Set(devices.map((device) => device.id)).size, devices.length);
assert.equal(devices.length, sources.length);
const generatedAt = devices.flatMap((device) => Object.values(device.specs).map((field) => field.verifiedAt)).sort().at(-1);
const prior = JSON.parse(await fs.readFile(new URL("../src/data/xiaomi-history-devices-db.json", import.meta.url), "utf8"));
const catalog = new Map();
const catalogKey = (row) => `${row.category ?? "phone"}:${row.year ?? row.releaseYear}:${normalizedName(row.name ?? row.modelName)}`;
for (const device of existing) catalog.set(catalogKey(device), { id: device.id, name: device.modelName, year: device.releaseYear, category: device.category,
  family: device.family, comparisonGroupId: device.comparisonGroupId, status: "already_in_master_snapshot",
  sourceUrls: [...new Set([...Object.values(device.specs), ...device.configurations.map((row) => row.evidence)].map((field) => field.sourceUrl))] });
for (const row of [...fixture.pending, ...prior.metadata.catalogAudit.blocked]) {
  const key = catalogKey(row);
  if (!catalog.has(key)) catalog.set(key, { name: row.name, year: row.year, category: row.category ?? "phone",
    status: row.slug ? "blocked_prior_batch" : "not_attempted", sourceUrls: [row.sourceUrl], reason: row.reason ?? null });
}
for (const row of targets) {
  const id = `${row.slug}-${row.year}`, source = sources.find((entry) => entry.id === id), failure = blocked.find((entry) => entry.slug === row.slug);
  catalog.set(catalogKey(row), { id, name: row.name, year: row.year, category: "phone", family: row.family,
    status: source ? "imported_batch2" : "attempted_blocked", sourceUrls: source?.referenceUrls ?? [failure.sourceUrl],
    ...(failure ? { reason: failure.reason } : {}), ...(row.priorStatus === "attempted_blocked" ? { priorReason: row.priorReason, priorBlockedResolved: Boolean(source) } : {}) });
}
const annualInventory = Array.from({ length: 10 }, (_, index) => ({ year: 2017 + index,
  models: [...catalog.values()].filter((row) => row.year === 2017 + index).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name, "zh-CN")) }));
const catalogDifference = { knownModels: catalog.size, alreadyInMasterSnapshot: [...catalog.values()].filter((row) => row.status === "already_in_master_snapshot").length,
  newlyImported: devices.length, unresolved: [...catalog.values()].filter((row) => !["already_in_master_snapshot", "imported_batch2"].includes(row.status)),
  limitation: "年度清单由现有有源分库、首批阻塞、第二批目标与待核验目录合并，仍属已发现型号清单，不代表所有系列及特殊版已穷尽" };
const output = (value) => `${JSON.stringify(value, null, 2)}\n`;
await fs.writeFile(new URL("../src/data/xiaomi-history-batch2-devices-db.json", import.meta.url), output({
  metadata: { version: "1.0", totalDevices: devices.length, generatedAt, coverageStatus: "partial",
    catalogAudit: { ...fixture.metadata, imported: devices.map((device) => device.id), blocked, pending: fixture.pending, annualInventory, catalogDifference },
  }, devices,
}));
await fs.writeFile(new URL("../src/data/xiaomi-history-batch2-sources.json", import.meta.url), output({ phone: sources }));
console.log(JSON.stringify({ added: devices.length, configurations: devices.reduce((n, device) => n + device.configurations.length, 0), blocked: blocked.length, pending: fixture.pending.length }));
