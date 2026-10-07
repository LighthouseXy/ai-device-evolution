import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { importZolSeries, plainText, zolRows } from "./lib/zol-device.mjs";
import { getSourceSnapshot } from "./lib/source-snapshot.mjs";

const fixture = JSON.parse(await fs.readFile(new URL("./fixtures/xiaomi-history-expansion.json", import.meta.url), "utf8"));
const targets = fixture.targets;
assert.equal(new Set(targets.map((row) => row.slug)).size, targets.length, "历史目标重复");
assert.ok(targets.every((row) => row.year >= 2017 && row.year <= 2026 && Number.isInteger(row.seriesId)));
if (process.argv.includes("--self-check")) {
  assert.ok(fixture.pending.every((row) => /^https:\/\/detail\.zol\.com\.cn\//.test(row.sourceUrl)));
  console.log(`${targets.length} 个导入目标，${fixture.pending.length} 个有来源的待核验条目；清单检查通过`);
  process.exit(0);
}

const options = { offline: process.argv.includes("--offline"), refresh: process.argv.includes("--refresh") };
const existing = [];
for (const file of await fs.readdir(new URL("../src/data/", import.meta.url))) {
  if (/^(?:xiaomi|redmi).*devices-db\.json$/.test(file) && file !== "xiaomi-history-devices-db.json") {
    existing.push(...JSON.parse(await fs.readFile(new URL(`../src/data/${file}`, import.meta.url), "utf8")).devices);
  }
}
const devices = [], sources = [], blocked = [];
const evidence = (page, value, rawText) => ({ value, rawText, evidenceKind: "excerpt", sourceUrl: page.url,
  sourceType: "reference", confidence: 0.8, verifiedAt: page.fetchedAt.slice(0, 10),
  fetchedAt: page.fetchedAt, sourceSnapshotHash: page.sha256 });

for (const row of targets) {
  const id = `${row.slug}-${row.year}`;
  assert.ok(!existing.some((device) => device.id === id), `${id}: 与既有分库重复`);
  try {
    const imported = await importZolSeries({ ...row, id, brand: "Xiaomi", category: "phone",
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
      assert.ok(text.includes(row.name), "配置补证的型号身份不一致");
      verifiedConfigurations.length = 0;
      for (const configuration of row.configurationFallback.entries) {
        const rawText = text.match(new RegExp(configuration.rawPattern))?.[0];
        assert.ok(rawText, "配置补证原文缺失");
        verifiedConfigurations.push({ memory: configuration.memory, storage: configuration.storage,
          evidence: evidence(page, `${configuration.memory} + ${configuration.storage}`, rawText) });
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
        ? verifiedConfigurations[0].evidence.rawText : `${label} ${configurationRows.get(label)}`);
      device.specs[key].note = "仅汇总本设备 configurations 中明确绑定的SKU；多值ROM页不导入。";
    }
    let marketEvidence;
    if (row.marketFallback) {
      const page = await getSourceSnapshot(row.marketFallback.sourceUrl, options);
      const rawText = plainText(page.html).match(new RegExp(row.marketFallback.rawPattern))?.[0];
      assert.ok(rawText, "国行发布补证原文缺失");
      marketEvidence = evidence(page, "CN", rawText);
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
    assert.equal(device.releaseYear, row.year);
    assert.equal(device.market, "CN");
    devices.push(device); sources.push(source);
    console.log(`${id}: ${device.configurations.length} 个明确国行配置`);
  } catch (error) {
    blocked.push({ ...row, sourceUrl: `https://detail.zol.com.cn/series/57/${row.seriesId}_1.html`, reason: error.message });
    console.log(`${id}: 暂缓 — ${error.message}`);
  }
}
assert.ok(devices.length, "无核验通过设备，不覆盖分库");
assert.equal(new Set(devices.map((device) => device.id)).size, devices.length);
assert.equal(devices.length, sources.length);
const generatedAt = devices.flatMap((device) => Object.values(device.specs).map((field) => field.verifiedAt)).sort().at(-1);
const output = (value) => `${JSON.stringify(value, null, 2)}\n`;
await fs.writeFile(new URL("../src/data/xiaomi-history-devices-db.json", import.meta.url), output({
  metadata: { version: "1.0", totalDevices: devices.length, generatedAt, coverageStatus: "partial",
    catalogAudit: { ...fixture.metadata, imported: devices.map((device) => device.id), blocked, pending: fixture.pending },
  }, devices,
}));
await fs.writeFile(new URL("../src/data/xiaomi-history-sources.json", import.meta.url), output({ phone: sources }));
console.log(JSON.stringify({ added: devices.length, configurations: devices.reduce((n, device) => n + device.configurations.length, 0), blocked: blocked.length, pending: fixture.pending.length }));
