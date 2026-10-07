import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { importZolSeries, plainText, zolRows } from "./lib/zol-device.mjs";
import { getSourceSnapshot } from "./lib/source-snapshot.mjs";

const fixtureIndex = process.argv.indexOf("--fixture");
const fixtureName = fixtureIndex >= 0 ? process.argv[fixtureIndex + 1] : "huawei-five-year-expansion";
assert.match(fixtureName ?? "", /^huawei-five-year-(?:expansion|batch\d+)$/);
const prefix = fixtureName === "huawei-five-year-expansion" ? "huawei-five-year" : fixtureName;
const fixture = JSON.parse(await fs.readFile(new URL(`./fixtures/${fixtureName}.json`, import.meta.url), "utf8"));
const categories = { phone: 57, tablet: 702, laptop: 16 };
assert.equal(new Set(fixture.targets.map((row) => row.id)).size, fixture.targets.length);
assert.ok(fixture.targets.every((row) => categories[row.category] && row.releaseYear >= 2022 && row.releaseYear <= 2026));
if (process.argv.includes("--self-check")) {
  assert.ok(fixture.pending.every((row) => /^https:\/\/detail\.zol\.com\.cn\//.test(row.sourceUrl)));
  assert.ok(fixture.pending.every((row) => !fixture.targets.some((target) => row.sourceUrl === `https://detail.zol.com.cn/series/${categories[target.category]}/${target.seriesId}_1.html`)), "待核验清单不能重复已尝试目标");
  const db = JSON.parse(await fs.readFile(new URL(`../src/data/${prefix}-devices-db.json`, import.meta.url), "utf8"));
  const registry = JSON.parse(await fs.readFile(new URL(`../src/data/${prefix}-sources.json`, import.meta.url), "utf8"));
  assert.ok(Object.values(registry).every(Array.isArray));
  const registered = Object.values(registry).flat();
  assert.deepEqual(registered.map((row) => row.id).sort(), db.devices.map((row) => row.id).sort());
  for (const device of db.devices) {
    const target = fixture.targets.find((row) => row.id === device.id);
    const source = registered.find((row) => row.id === device.id);
    assert.equal(device.variant, "standard");
    assert.equal(device.market, "CN");
    assert.equal(device.comparisonGroupId, `huawei.${target.category}.${target.group}.standard`);
    assert.equal(device.releaseYear, target.releaseYear);
    assert.ok(!device.releaseDate || device.releaseDate <= "2026-10-06");
    assert.ok(device.configurations.every((row) => !target.configurationExclusions?.some((exclusion) => exclusion.sourceUrl === row.evidence.sourceUrl)));
    if (target.specWhitelist) assert.deepEqual(Object.keys(device.specs).sort(), target.specWhitelist.toSorted());
    for (const url of source.referenceUrls) await getSourceSnapshot(url, { offline: true });
    for (const field of [...Object.values(device.specs), ...device.configurations.map((row) => row.evidence),
      source.marketEvidence, source.releaseEvidence, source.colorEvidence, ...(source.configurationCrossCheck ?? [])].filter(Boolean)) {
      assert.ok(source.referenceUrls.includes(field.sourceUrl));
      const snapshot = await getSourceSnapshot(field.sourceUrl, { offline: true });
      assert.equal(field.sourceSnapshotHash, snapshot.sha256);
    }
  }
  assert.equal(db.metadata.totalDevices, db.devices.length);
  if (prefix === "huawei-five-year") {
    assert.equal(db.devices.find((row) => row.id === "huawei-mate-xs-2-2022").configurations.length, 2);
    assert.equal(db.devices.find((row) => row.id === "huawei-pocket-s-2022").configurations.length, 2);
  }
  console.log(`${db.devices.length} 台 / ${db.devices.reduce((n, row) => n + row.configurations.length, 0)} 配置，${fixture.targets.length} 个目标 / ${fixture.pending.length} 个待核验项；身份、分组、剔除规则、来源登记及离线快照哈希检查通过`);
  process.exit(0);
}
const options = { offline: process.argv.includes("--offline"), refresh: process.argv.includes("--refresh") };
assert.ok(!(options.offline && options.refresh));
const existing = [];
for (const file of await fs.readdir(new URL("../src/data/", import.meta.url))) {
  if (/^huawei.*devices-db\.json$/.test(file) && file !== `${prefix}-devices-db.json`) {
    existing.push(...JSON.parse(await fs.readFile(new URL(`../src/data/${file}`, import.meta.url), "utf8")).devices);
  }
}
const devices = [], blocked = [];
const sources = { phone: [], tablet: [], laptop: [] };
const evidence = (page, value, rawText, sourceType = "reference") => ({ value, rawText, evidenceKind: "excerpt",
  sourceUrl: page.url, sourceType, confidence: sourceType === "official" ? 0.95 : 0.8,
  verifiedAt: page.fetchedAt.slice(0, 10), fetchedAt: page.fetchedAt, sourceSnapshotHash: page.sha256 });
const capacityLabels = { phone: ["RAM容量", "ROM容量"], tablet: ["系统内存", "存储容量"], laptop: ["内存容量", "硬盘容量"] };

for (const target of fixture.targets) {
  assert.ok(!existing.some((device) => device.id === target.id), `${target.id}: 与既有分库重复`);
  const seriesUrl = `https://detail.zol.com.cn/series/${categories[target.category]}/${target.seriesId}_1.html`;
  try {
    const { device, source } = await importZolSeries({ ...target, brand: "Huawei", variant: "standard",
      expectedName: target.category === "phone" ? [target.expectedName,
        ...["128GB", "256GB", "512GB", "1TB"].map((storage) => `${target.expectedName} ${storage}`)] : target.expectedName,
      generation: String(target.releaseYear), generationOrder: target.releaseYear,
      comparisonGroupId: `huawei.${target.category}.${target.group}.standard`, seriesUrl,
      excludeVariants: ["典藏", "艺术定制", "柔光", "悦享", "LTE", "卫星通信", "北斗", "先锋", "星闪键盘", "星闪手写笔", "套餐", "套装",
        ...(target.category === "tablet" ? ["全网通", "蜂窝", "5G版"] : []), ...(target.excludeVariants ?? [])],
    }, options);
    const labels = capacityLabels[target.category];
    const verified = [];
    for (const configuration of device.configurations) {
      const page = await getSourceSnapshot(configuration.evidence.sourceUrl, options);
      const rows = zolRows(page.html);
      const exclusion = target.configurationExclusions?.find((row) => row.sourceUrl === page.url);
      if (exclusion) {
        (source.excludedConfigurations ??= []).push({ name: configuration.evidence.rawText, ...exclusion,
          sourceSnapshotHash: page.sha256 });
        continue;
      }
      // ponytail: 多盘/多容量摘要不拆配SKU；后续逐配置发布原文补证。
      if (labels.some((label) => (rows.get(label)?.match(/\d+(?:\.\d+)?\s*(?:GB|TB)/gi) ?? []).length !== 1)) {
        (source.excludedConfigurations ??= []).push({ name: configuration.evidence.rawText, sourceUrl: page.url,
          reason: "内存或存储参数是多值汇总，无法确认单个SKU组合" });
        continue;
      }
      verified.push(configuration);
    }
    assert.ok(verified.length, "缺少明确单值内存/存储配置");
    device.configurations = verified;
    const parameter = await getSourceSnapshot(verified[0].evidence.sourceUrl, options);
    const rows = zolRows(parameter.html);
    for (const [index, key] of ["memory", "storage"].entries()) {
      device.specs[key] = evidence(parameter, [...new Set(verified.map((configuration) => configuration[key]))].join(" / "), `${labels[index]} ${rows.get(labels[index])}`);
      device.specs[key].note = "仅汇总本设备已核验配置 evidence；不将多值容量交叉组合。";
    }
    if (target.specWhitelist) {
      source.withheldSpecifications = Object.entries(device.specs).filter(([key]) => !target.specWhitelist.includes(key))
        .map(([key, field]) => ({ key, ...field, reason: target.specReviewNote }));
      source.fieldGaps.push(...source.withheldSpecifications.map(({ key, reason }) => ({ field: key, reason })));
      device.specs = Object.fromEntries(Object.entries(device.specs).filter(([key]) => target.specWhitelist.includes(key)));
    }
    let marketEvidence;
    if (target.marketFallback) {
      const page = await getSourceSnapshot(target.marketFallback.sourceUrl, options);
      const rawText = plainText(page.html).match(new RegExp(target.marketFallback.rawPattern))?.[0];
      assert.ok(rawText, "中国大陆官方支持型号证据缺失");
      assert.ok(new URL(page.url).pathname.startsWith("/cn/"), "不得用海外官网作中国大陆型号证据");
      marketEvidence = evidence(page, "CN", rawText, target.marketFallback.sourceType);
      marketEvidence.note = "该具体型号在华为中国大陆官网支持页登记；配置与上市年份分别由具体SKU参数快照核验。";
      if (target.specWhitelist) {
        source.configurationCrossCheck = verified.map(({ memory, storage }) => {
          const raw = plainText(page.html).match(new RegExp(`11英寸 2023款 (?:wifi|wi-fi) ${memory}\\+${storage}`, "i"))?.[0];
          assert.ok(raw, "官方适用产品列表不支持该国行配置");
          return evidence(page, `${memory} + ${storage}`, raw, "official");
        });
      }
    }
    for (const configuration of verified) {
      if (marketEvidence) break;
      const page = await getSourceSnapshot(configuration.evidence.sourceUrl, options);
      const domestic = zolRows(page.html).get("国内发布时间");
      if (domestic) { marketEvidence = evidence(page, "CN", `国内发布时间 ${domestic}`); break; }
      const productId = page.url.match(/\/(\d+)\/param\.shtml$/)?.[1];
      const summary = await getSourceSnapshot(`https://detail.zol.com.cn/${target.category === "phone" ? "cell_phone" : target.category === "tablet" ? "tablepc" : "notebook"}/index${productId}.shtml`, options);
      const rawText = plainText(summary.html).match(/参考报价[：:]?\s*￥[^]*?\[北京[^\]]*行货\]/)?.[0];
      if (rawText) { marketEvidence = evidence(summary, "CN", rawText); break; }
    }
    assert.ok(marketEvidence, "缺少具体型号中国大陆发布/行货/官方CN支持页证据");
    source.marketEvidence = marketEvidence;
    source.referenceUrls = [...new Set([...source.referenceUrls, marketEvidence.sourceUrl])];
    const series = await getSourceSnapshot(seriesUrl, options);
    const galleryHref = [...series.html.matchAll(/href=["']([^"']*\/pic_\d+\.html)["']/g)][0]?.[1];
    source.imageReferenceStatus = galleryHref ? "candidate_from_verified_model_series" : "series_gallery_link_missing";
    if (galleryHref) source.imageReferenceUrls = [new URL(galleryHref, series.url).href];
    source.imageReferenceNote = "图库链接只作为由核对型号系列页提供的候选；照片与颜色待独立核验，不抓取验证页或生成假照片。";
    const colorLabel = rows.has("机身颜色") ? "机身颜色" : rows.has("机壳颜色") ? "机壳颜色" : rows.has("外壳颜色") ? "外壳颜色" : null;
    if (colorLabel) source.colorEvidence = evidence(parameter, rows.get(colorLabel), `${colorLabel} ${rows.get(colorLabel)}`);
    source.notes = source.notes.replace(/实际读取的 \d+ 个配置/, `核对通过的 ${verified.length} 个配置`);
    source.notes += " 国行身份另存marketEvidence；无独立发布报价原文不填首发价。";
    if (target.specReviewNote) source.notes += ` ${target.specReviewNote}`;
    assert.equal(device.variant, "standard");
    assert.equal(device.market, "CN");
    assert.equal(device.releaseYear, target.releaseYear);
    assert.equal(new Set(verified.map(({ memory, storage, chip }) => JSON.stringify([memory, storage, chip]))).size, verified.length);
    devices.push(device); sources[target.category].push(source);
    console.log(`${target.id}: ${verified.length} 个国行配置`);
  } catch (error) {
    blocked.push({ ...target, sourceUrl: seriesUrl, reviewStatus: "attempted_blocked", reason: error.message,
      ...(error.message.includes("所有具体配置证据缺失或冲突") ? { nextEvidenceNeeded: "逐SKU同时含单值RAM和ROM的无冲突参数或官方适用产品列表；不得从系列摘要/型号名猜RAM" } : {}),
    });
    console.log(`${target.id}: 暂缓 — ${error.message}`);
  }
}
assert.ok(devices.length, "无核验通过设备，不覆盖已有分库");
assert.equal(new Set(devices.map((device) => device.id)).size, devices.length);
assert.equal(Object.values(sources).flat().length, devices.length);
const generatedAt = devices.flatMap((device) => Object.values(device.specs).map((field) => field.verifiedAt)).sort().at(-1);
const output = (value) => `${JSON.stringify(value, null, 2)}\n`;
await fs.writeFile(new URL(`../src/data/${prefix}-devices-db.json`, import.meta.url), output({
  metadata: { version: "1.0", totalDevices: devices.length, generatedAt, coverageStatus: "partial",
    catalogAudit: { ...fixture.metadata, imported: devices.map((device) => device.id), blocked, pending: fixture.pending },
  }, devices,
}));
await fs.writeFile(new URL(`../src/data/${prefix}-sources.json`, import.meta.url), output(sources));
console.log(JSON.stringify({ added: devices.length, configurations: devices.reduce((n, device) => n + device.configurations.length, 0),
  categories: Object.fromEntries(Object.entries(sources).map(([category, rows]) => [category, rows.length])), blocked: blocked.length, pending: fixture.pending.length }));
