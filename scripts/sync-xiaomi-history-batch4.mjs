import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { importZolSeries, plainText, zolRows, readRelease, extractZolProductImage } from "./lib/zol-device.mjs";
import { getSourceSnapshot } from "./lib/source-snapshot.mjs";

const fixture = JSON.parse(await fs.readFile(new URL("./fixtures/xiaomi-history-batch4-expansion.json", import.meta.url), "utf8"));
const targets = fixture.targets;
const groupId = (row) => row.comparisonGroupId ?? `xiaomi.${row.category}.${row.family.toLowerCase().replace(/\+/g, "-plus").replace(/\s+/g, "-")}.standard`;
const seriesUrl = (row) => row.seriesUrl ?? `https://detail.zol.com.cn/series/${{ phone: 57, tablet: 702, laptop: 16 }[row.category]}/${row.seriesId}_1.html`;
assert.equal(new Set(targets.map((row) => `${row.slug}-${row.year}`)).size, targets.length, "历史目标重复");
assert.ok(targets.every((row) => row.year >= 2017 && row.year <= 2026 && (Number.isInteger(row.seriesId) || row.seriesUrl)));
if (process.argv.includes("--self-check")) {
  assert.ok(fixture.pending.every((row) => /^https:\/\/(?:detail\.zol\.com\.cn|www\.mi\.com|www\.ithome\.com)\//.test(row.sourceUrl)));
  const db = JSON.parse(await fs.readFile(new URL("../src/data/xiaomi-history-batch4-devices-db.json", import.meta.url), "utf8"));
  const registry = JSON.parse(await fs.readFile(new URL("../src/data/xiaomi-history-batch4-sources.json", import.meta.url), "utf8"));
  assert.ok(Object.values(registry).every(Array.isArray));
  const registered = Object.values(registry).flat();
  assert.deepEqual(registered.map((row) => row.id).sort(), db.devices.map((row) => row.id).sort());
  for (const device of db.devices) {
    const source = registered.find((row) => row.id === device.id);
    assert.equal(device.variant, "standard"); assert.equal(device.market, "CN");
    assert.equal(source.sourcePageType, "expanded_core_spec_snapshots");
    const required = { phone: ["chip", "memory", "storage", "launchPrice", "displayType", "port", "rearCamera", "frontCamera"],
      tablet: ["chip", "memory", "storage", "launchPrice", "screenSize", "displayType", "resolution", "port"],
      laptop: ["chip", "memory", "storage", "launchPrice", "screenSize", "displayType", "resolution"] }[device.category];
    assert.deepEqual(source.fieldGaps.map((row) => row.field).sort(), required.filter((field) => !device.specs[field]).sort());
    assert.ok(device.specs.memory && device.specs.storage);
    assert.ok(device.releaseYear >= 2017 && device.releaseYear <= 2026);
    assert.ok(!device.releaseDate || device.releaseDate <= "2026-10-06");
    assert.equal(device.comparisonGroupId, groupId(targets.find((row) => `${row.slug}-${row.year}` === device.id)));
    assert.equal(new Set(device.configurations.map(({ memory, storage, chip }) => JSON.stringify([memory, storage, chip]))).size, device.configurations.length);
    for (const url of source.referenceUrls) await getSourceSnapshot(url, { offline: true });
    for (const field of [...Object.values(device.specs), ...device.configurations.map((row) => row.evidence), ...(source.officialSpecificationEvidence ?? []), source.marketEvidence, source.releaseEvidence, source.colorEvidence].filter(Boolean)) {
      assert.ok(source.referenceUrls.includes(field.sourceUrl));
      assert.equal(field.sourceSnapshotHash, (await getSourceSnapshot(field.sourceUrl, { offline: true })).sha256);
    }
    if (source.primaryImageCandidate) assert.equal(source.primaryImageCandidate.sourceSnapshotHash, (await getSourceSnapshot(source.primaryImageCandidate.sourceUrl, { offline: true })).sha256);
    for (const candidate of source.colorImageCandidates ?? []) {
      assert.equal(candidate.licenseStatus, "unknown"); assert.match(candidate.sha256, /^[a-f0-9]{64}$/);
      assert.equal(candidate.sourceSnapshotHash, (await getSourceSnapshot(candidate.sourceUrl, { offline: true })).sha256);
    }
  }
  assert.equal(db.metadata.totalDevices, db.devices.length);
  assert.equal(db.metadata.catalogAudit.annualInventory.length, 10);
  for (const row of db.metadata.catalogAudit.catalogDifference.unresolved.filter((row) => row.catalogEvidence)) {
    assert.equal(row.catalogEvidence.sourceSnapshotHash, (await getSourceSnapshot(row.catalogEvidence.sourceUrl, { offline: true })).sha256);
  }
  console.log(`${db.devices.length} 台 / ${db.devices.reduce((n, row) => n + row.configurations.length, 0)} 配置；来源哈希、国行/年份/分组、标准版与年度差集检查通过`);
  process.exit(0);
}

const options = { offline: process.argv.includes("--offline"), refresh: process.argv.includes("--refresh") };
const existing = [];
for (const file of await fs.readdir(new URL("../src/data/", import.meta.url))) {
  if (/^(?:xiaomi|redmi).*devices-db\.json$/.test(file) && file !== "xiaomi-history-batch4-devices-db.json") {
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
  const targetUrl = seriesUrl(row);
  const series = await getSourceSnapshot(targetUrl, options);
  assert.equal(normalizedName(plainText(series.html.match(/<h1\b[^>]*>([^]*?)<\/h1>/i)?.[1] ?? "")), normalizedName(row.name));
  const listingHref = [...series.html.matchAll(/href=["']([^"']+param_\d+_0_1\.html)["']/g)][0]?.[1];
  const listing = listingHref ? await getSourceSnapshot(new URL(listingHref, targetUrl).href, options) : null;
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
  return { device: { id, brand: "Xiaomi", market: "CN", category: row.category, series: row.family, family: row.family, variant: "standard",
    modelName: row.name, generation: row.generation ?? String(row.year), generationOrder: row.year, releaseYear: row.year,
    ...(release.date.length === 10 ? { releaseDate: release.date } : {}), comparisonGroupId: groupId(row),
    configurations: [], specs, computed: {} }, source: { id, modelName: row.name, releaseYear: row.year,
    sourceStatus: "verified", sourcePageType: "expanded_core_spec_snapshots",
    referenceUrls: [targetUrl, ...(listing ? [listing.url] : []), page.url], releaseEvidence: evidence(page, release.date, `${release.entry.label} ${release.entry.value}`),
    fieldGaps: [{ field: "launchPrice", reason: "本批发布原文仅用作型号与SKU补证；不将市场参考报价当首发价" }],
    notes: "旧容量汇总参数页不拆配；单独读取标准版非容量字段，配置另由发布原文逐条补证。" } };
}

for (const row of targets) {
  const id = `${row.slug}-${row.year}`;
  assert.ok(!existing.some((device) => device.id === id), `${id}: 与既有分库重复`);
  try {
    if (row.blockReason) throw new Error(row.blockReason);
    const imported = row.configurationFallback ? await importPublishedFallback(row, id) : await importZolSeries({ ...row, ...(row.variantPattern ? { variantFilter: new RegExp(row.variantPattern) } : {}), id, brand: "Xiaomi", category: row.category,
      modelName: row.name, expectedName: row.expectedName ?? row.name, releaseYear: row.year, variant: "standard",
      minYear: 2017, generationOrder: row.year,
      comparisonGroupId: groupId(row),
      seriesUrl: seriesUrl(row),
      excludeVariants: ["迪士尼", "Aape", "哆啦", "雷军签名", "虎年礼盒", ...(row.excludeVariants ?? [])],
    }, options);
    const { device, source } = imported;
    const withheld = row.withheldFields?.fields === "allNonCapacity" ? Object.keys(device.specs).filter((key) => !["memory", "storage"].includes(key)) : row.withheldFields?.fields ?? [];
    for (const field of withheld) {
      (source.withheldFields ??= []).push({ field, reason: row.withheldFields.reason, rejectedEvidence: device.specs[field] ?? null });
      delete device.specs[field];
    }
    const verifiedConfigurations = [];
    for (const configuration of device.configurations) {
      const page = await getSourceSnapshot(configuration.evidence.sourceUrl, options);
      const rows = zolRows(page.html);
      if (row.allowedConfigurations && !row.allowedConfigurations.some(([memory, storage]) => memory === configuration.memory && storage === configuration.storage)) {
        (source.excludedConfigurations ??= []).push({ name: configuration.evidence.rawText, sourceUrl: page.url,
          reason: "本目标仅收已由独立国内发布原文列明的标准配置，其他容量版暂不核验" });
        continue;
      }
      // ponytail: 旧库多值ROM不拆配SKU；独立发布原文补证后再导入。
      const storageRow = rows.get("ROM容量") ?? rows.get("存储容量") ?? rows.get("硬盘容量");
      if ((storageRow?.match(/\d+(?:\.\d+)?\s*(?:GB|TB)/gi) ?? []).length !== 1 || (row.category !== "phone" && readRelease(rows, { minYear: 2017 })?.year !== row.year)) {
        (source.excludedConfigurations ??= []).push({ name: configuration.evidence.rawText,
          sourceUrl: page.url, reason: "参数存储不是单值，或该具体配置上市年份与目标不一致" });
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
    for (const [key, label] of [["memory", configurationRows.has("RAM容量") ? "RAM容量" : configurationRows.has("系统内存") ? "系统内存" : "内存容量"], ["storage", configurationRows.has("ROM容量") ? "ROM容量" : configurationRows.has("存储容量") ? "存储容量" : "硬盘容量"]]) {
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
      const summary = await getSourceSnapshot(`https://detail.zol.com.cn/${{phone:"cell_phone",tablet:"tablepc",laptop:"notebook"}[row.category]}/index${match[2]}.shtml`, options);
      const text = plainText(summary.html);
      const rawText = text.match(/参考报价[：:]?\s*￥[^]*?\[北京[^\]]*行货\]/)?.[0];
      if (rawText) { marketEvidence = evidence(summary, "CN", `${configuration.evidence.rawText.split("；")[0]}；${rawText}`); break; }
    }
    assert.ok(marketEvidence, "缺少中国大陆发布或具体型号行货证据，暂不把中文页面默认作国行");
    source.marketEvidence = marketEvidence;
    source.referenceUrls = [...new Set([...source.referenceUrls, marketEvidence.sourceUrl])];
    for (const correction of row.specCorrections ?? []) {
      const page = await getSourceSnapshot(correction.sourceUrl, options);
      const rawText = plainText(page.html).match(new RegExp(correction.rawPattern))?.[0];
      assert.ok(rawText, `${row.name}: 独立字段纠正原文缺失`);
      (source.fieldCorrections ??= []).push({ field: correction.field, reason: correction.reason,
        rejectedEvidence: device.specs[correction.field] ?? source.withheldFields?.find((entry) => entry.field === correction.field)?.rejectedEvidence ?? null,
        sourceUrl: page.url, sourceSnapshotHash: page.sha256 });
      device.specs[correction.field] = { ...evidence(page, correction.value, rawText, correction.sourceType), ...(correction.unit ? { unit: correction.unit } : {}) };
      source.referenceUrls.push(page.url);
    }
    source.referenceUrls = [...new Set(source.referenceUrls)];
    for (const anchor of row.officialAnchors ?? []) {
      const page = await getSourceSnapshot(anchor.sourceUrl, options);
      assert.equal(new URL(page.url).hostname, "www.mi.com");
      const rawText = plainText(page.html).match(new RegExp(anchor.rawPattern))?.[0];
      assert.ok(rawText, "中国官网独立规格锚点缺失");
      (source.officialSpecificationEvidence ??= []).push({ ...evidence(page, row.name, rawText, "official"), note: anchor.note });
      source.referenceUrls = [...new Set([...source.referenceUrls, page.url])];
    }
    const series = await getSourceSnapshot(seriesUrl(row), options);
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
    const colors = ["机身颜色", "外壳颜色", "产品颜色", "颜色"].map((label) => zolRows(parameter.html).get(label)).find(Boolean);
    if (colors) {
      const standardColors = [...new Set(colors.replace(/\s*查看外观$/, "").split(/[,，]/).map((item) => item.trim()).filter((item) => !(row.excludedColors ?? []).includes(item)))].join("，");
      source.colorEvidence = evidence(parameter, standardColors, `机身颜色 ${colors}`);
      if (row.excludedColors?.length) source.colorEvidence.note = `排除特别版颜色：${row.excludedColors.join("、")}；原始参数引文保留。`;
    }
    if (row.colorCorrection) {
      const page = await getSourceSnapshot(row.colorCorrection.sourceUrl, options);
      const rawText = plainText(page.html).match(new RegExp(row.colorCorrection.rawPattern))?.[0];
      assert.ok(rawText, "独立标准配色原文缺失");
      source.colorEvidence = evidence(page, row.colorCorrection.value, rawText);
      source.referenceUrls = [...new Set([...source.referenceUrls, page.url])];
    }
    source.notes = source.notes.replace(/实际读取的 \d+ 个配置/, `核对通过的 ${verifiedConfigurations.length} 个配置`);
    if (row.configurationFallback) source.notes += " 配置另由独立发布评测原文逐条补证，仅采用该原文列明组合。";
    source.notes += " 国行身份另存marketEvidence；首发价未补证则留空；图库URL仅供后续实图核验，未生成照片。";
    source.priorReview = { status: row.priorStatus, reason: row.priorReason ?? null,
      resolution: row.configurationFallback ? "独立发布/官方原文逐SKU补证" : row.marketFallback ? "补充独立国行来源" : "逐SKU参数及行货证据核验" };
    const imagePage = extractZolProductImage(series.html) ? series : parameter;
    const image = extractZolProductImage(imagePage.html);
    if (image) source.primaryImageCandidate = { ...image, sourceUrl: imagePage.url, sourceSnapshotHash: imagePage.sha256, licenseStatus: "unknown", status: "model_alt_and_primary_meta_verified_not_visually_reviewed" };
    if (fixture.imageEvidence?.[id] && image) {
      assert.equal(fixture.imageEvidence[id].url, image.url);
      source.primaryImageCandidate.actualImageEvidence = fixture.imageEvidence[id];
      source.primaryImageCandidate.status = "downloaded_and_visually_reviewed";
      const color = fixture.imageEvidence[id].verifiedColor;
      if (color) {
        assert.ok(source.colorEvidence.value.includes(color), "实图颜色不在该独立型号已核验配色中");
        source.colorImageCandidates = [{ color, url: image.url, sha256: fixture.imageEvidence[id].sha256,
          sourceUrl: imagePage.url, sourceSnapshotHash: imagePage.sha256, licenseStatus: "unknown", status: "downloaded_and_visually_reviewed" }];
      }
    }
    if (row.imageExcludedReason) {
      if (source.primaryImageCandidate) source.rejectedImageCandidate = { ...source.primaryImageCandidate, status: "ambiguous_generation_or_variant", reason: row.imageExcludedReason };
      delete source.primaryImageCandidate;
      source.imageFieldGaps = [{ field: "primaryImage", reason: row.imageExcludedReason }];
    }
    if (!source.primaryImageCandidate?.actualImageEvidence && !row.imageExcludedReason) {
      source.imageFieldGaps = [{ field: "primaryImage", reason: "仅有具体型号来源候选，尚无下载及视觉核验；不标为已获取产品照片" }];
    }
    for (const color of source.colorEvidence?.value.split("，") ?? []) {
      if (!source.colorImageCandidates?.some((candidate) => candidate.color === color)) {
        (source.imageFieldGaps ??= []).push({ field: "colorImage", color, reason: "尚无该具体型号标准色的真实图片字节哈希和视觉核验；留空" });
      }
    }
    assert.equal(device.releaseYear, row.year);
    assert.equal(device.market, "CN");
    const required = { phone: ["chip", "memory", "storage", "launchPrice", "displayType", "port", "rearCamera", "frontCamera"],
      tablet: ["chip", "memory", "storage", "launchPrice", "screenSize", "displayType", "resolution", "port"],
      laptop: ["chip", "memory", "storage", "launchPrice", "screenSize", "displayType", "resolution"] }[row.category];
    source.fieldGaps = required.filter((field) => !device.specs[field]).map((field) => ({ field,
      reason: field === "launchPrice" ? "未独立核验首发价；不将市场参考报价或活动价用作首发价" : source.withheldFields?.find((entry) => entry.field === field)?.reason ?? "实际标准版参数页无可核验字段原文；留空不推断" }));
    devices.push(device); sources.push(source);
    console.log(`${id}: ${device.configurations.length} 个明确国行配置`);
  } catch (error) {
    blocked.push({ ...row, sourceUrl: seriesUrl(row), reviewStatus: "attempted_blocked", reason: error.message });
    console.log(`${id}: 暂缓 — ${error.message}`);
  }
}
assert.ok(devices.length, "无核验通过设备，不覆盖分库");
assert.equal(new Set(devices.map((device) => device.id)).size, devices.length);
assert.equal(devices.length, sources.length);
const generatedAt = devices.flatMap((device) => Object.values(device.specs).map((field) => field.verifiedAt)).sort().at(-1);
const catalog = new Map();
const catalogKey = (row) => `${row.category ?? "phone"}:${row.year ?? row.releaseYear}:${normalizedName(row.name ?? row.modelName)}`;
for (const device of existing) catalog.set(catalogKey(device), { id: device.id, name: device.modelName, year: device.releaseYear, category: device.category,
  family: device.family, comparisonGroupId: device.comparisonGroupId, status: "already_in_master_snapshot",
  sourceUrls: [...new Set([...Object.values(device.specs), ...device.configurations.map((row) => row.evidence)].map((field) => field.sourceUrl))] });
for (const row of fixture.pending) {
  const key = catalogKey(row);
  let catalogEvidence;
  if (row.catalogVerification) {
    const page = await getSourceSnapshot(row.sourceUrl, options), text = plainText(page.html);
    const rawText = text.match(new RegExp(row.catalogVerification.rawPattern))?.[0], date = text.match(new RegExp(row.catalogVerification.yearPattern))?.[0];
    assert.ok(rawText && date, `目录名称/年份证据不一致: ${row.name}`);
    catalogEvidence = evidence(page, `${row.name} · ${row.year}`, `${date}；${rawText}`);
  }
  if (!catalog.has(key)) catalog.set(key, { name: row.name, year: row.year, category: row.category ?? "phone",
    status: row.priorStatus === "blocked_prior_batch" || row.priorStatus === "attempted_blocked" ? "blocked_prior_batch" : "not_attempted", sourceUrls: [row.sourceUrl], reason: row.reason ?? null,
    ...(catalogEvidence ? { catalogEvidence } : {}) });
}
for (const row of targets) {
  const id = `${row.slug}-${row.year}`, source = sources.find((entry) => entry.id === id), failure = blocked.find((entry) => entry.slug === row.slug && entry.year === row.year);
  catalog.set(catalogKey(row), { id, name: row.name, year: row.year, category: row.category, family: row.family,
    status: source ? "imported_batch4" : "attempted_blocked", sourceUrls: source?.referenceUrls ?? [failure.sourceUrl],
    ...(failure ? { reason: failure.reason } : {}), ...(row.priorStatus === "attempted_blocked" ? { priorReason: row.priorReason, priorBlockedResolved: Boolean(source) } : {}) });
}
const annualInventory = Array.from({ length: 10 }, (_, index) => ({ year: 2017 + index,
  models: [...catalog.values()].filter((row) => row.year === 2017 + index).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name, "zh-CN")) }));
const catalogDifference = { knownModels: catalog.size, alreadyInMasterSnapshot: [...catalog.values()].filter((row) => row.status === "already_in_master_snapshot").length,
  newlyImported: devices.length, unresolved: [...catalog.values()].filter((row) => !["already_in_master_snapshot", "imported_batch4"].includes(row.status)),
  limitation: "年度清单由现有有源分库、首批阻塞、第四批目标与待核验目录合并，仍属已发现型号清单，不代表所有系列及特殊版已穷尽" };
const output = (value) => `${JSON.stringify(value, null, 2)}\n`;
await fs.writeFile(new URL("../src/data/xiaomi-history-batch4-devices-db.json", import.meta.url), output({
  metadata: { version: "1.0", totalDevices: devices.length, generatedAt, coverageStatus: "partial",
    catalogAudit: { ...fixture.metadata, imported: devices.map((device) => device.id), blocked, pending: fixture.pending, annualInventory, catalogDifference },
  }, devices,
}));
await fs.writeFile(new URL("../src/data/xiaomi-history-batch4-sources.json", import.meta.url), output(Object.fromEntries(["phone", "tablet", "laptop"].map((category) => [category, sources.filter((source) => devices.find((device) => device.id === source.id).category === category)]))));
console.log(JSON.stringify({ added: devices.length, configurations: devices.reduce((n, device) => n + device.configurations.length, 0), blocked: blocked.length, pending: fixture.pending.length }));
