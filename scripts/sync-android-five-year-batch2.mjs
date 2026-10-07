import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { importZolSeries, plainText, zolRows, extractZolProductImage } from "./lib/zol-device.mjs";
import { getSourceSnapshot } from "./lib/source-snapshot.mjs";
import { readZolColors, readZolColorImages } from "./lib/device-images.mjs";

const fixture = JSON.parse(await fs.readFile(new URL("./fixtures/android-five-year-batch2.json", import.meta.url), "utf8"));
assert.ok(fixture.targets.length >= 20 && fixture.targets.length <= 30);
assert.equal(new Set(fixture.targets.map((row) => row.id)).size, fixture.targets.length);
const manifest = JSON.parse(await fs.readFile(new URL("../src/data/device-data-manifest.json", import.meta.url), "utf8"));
const datasets = manifest.datasets.filter((dataset) => ["OPPO", "vivo", "HONOR"].includes(dataset.brand) && !dataset.devices.includes("five-year-batch2"));
const previous = [], inventory = [];
for (const dataset of datasets) {
  const database = JSON.parse(await fs.readFile(new URL(`../src/data/${dataset.devices}`, import.meta.url), "utf8"));
  const sources = Object.values(JSON.parse(await fs.readFile(new URL(`../src/data/${dataset.sources}`, import.meta.url), "utf8"))).flat();
  previous.push(...database.devices);
  inventory.push(...database.devices.map((device) => {
    const source = sources.find((source) => source.id === device.id);
    return { id: device.id, brand: device.brand, modelName: device.modelName, releaseYear: device.releaseYear, series: device.family,
      status: "present", sourceUrls: [...new Set([source?.officialSpecUrl, ...(source?.referenceUrls ?? [])].filter(Boolean))] };
  }));
}
assert.ok(fixture.targets.every((target) => !previous.some((device) => device.id === target.id)), "本批不得重复已有设备");
const options = { offline: process.argv.includes("--offline"), refresh: process.argv.includes("--refresh") };
const devices = [], sources = [], blocked = [], familyOrders = new Map();
const evidence = (page, value, rawText) => ({ value, rawText, evidenceKind: "excerpt", sourceUrl: page.url,
  sourceType: "reference", confidence: 0.8, verifiedAt: page.fetchedAt.slice(0, 10), fetchedAt: page.fetchedAt, sourceSnapshotHash: page.sha256 });
for (const row of fixture.targets) {
  const orderKey = `${row.brand}.${row.family}`, generationOrder = (familyOrders.get(orderKey) ?? 0) + 1;
  familyOrders.set(orderKey, generationOrder);
  const target = { ...row, category: "phone", series: row.family, variant: "standard", generation: row.modelName.replace(/^(?:OPPO|vivo|荣耀)\s*/, ""),
    generationOrder, comparisonGroupId: `${row.brand.toLowerCase()}.phone.${row.group}.standard`,
    excludeVariants: row.excludeVariants ?? ["天玑版", "竞速版", "卫星", "典藏", "限定"],
    seriesUrl: `https://detail.zol.com.cn/series/57/${row.seriesId}_1.html`,
    ...(row.releaseFallback ? { releaseFallback: { ...row.releaseFallback, pattern: new RegExp(row.releaseFallback.rawPattern) } } : {}) };
  try {
    const { device, source } = await importZolSeries(target, options);
    if (row.releaseFallback?.sourceUrl.startsWith("https://www.vivo.com.cn/")) source.releaseEvidence = { ...source.releaseEvidence, sourceType: "official", confidence: 1 };
    for (const config of device.configurations) {
      const page = await getSourceSnapshot(config.evidence.sourceUrl, options), rows = zolRows(page.html), domestic = rows.get("国内发布时间");
      assert.ok(domestic && /20\d\d年/.test(domestic), `${row.id}: 缺少明确国内发布时间，中文网页不能单独证明国行`);
      source.marketEvidence ??= evidence(page, "中国大陆", `国内发布时间 ${domestic}`);
    }
    const page = await getSourceSnapshot(target.seriesUrl, options);
    const galleryUrls = [...new Set([...page.html.matchAll(/href=["']([^"']*\/picture_index_\d+\/index\d+_\d+_p\d+\.shtml)["']/g)].map((match) => new URL(match[1], page.url).href))].slice(0, 2);
    let imagePage = page, colors = readZolColors(page.html).map((name) => ({ name })), primary = extractZolProductImage(page.html);
    const imageGaps = [];
    for (const url of galleryUrls) {
      try {
        const gallery = await getSourceSnapshot(url, options), entries = readZolColorImages(gallery.html, { seriesId: row.seriesId });
        if (entries.length) {
          colors = [...colors.map((color) => entries.find((entry) => entry.name === color.name) ?? color), ...entries.filter((entry) => !colors.some((color) => color.name === entry.name))];
          imagePage = gallery; break;
        }
      } catch (error) { imageGaps.push(error.message); }
    }
    let specialEvidence;
    if (row.specialEditionEvidence) {
      const page = await getSourceSnapshot(row.specialEditionEvidence.url, options), rawText = plainText(page.html).match(new RegExp(row.specialEditionEvidence.rawPattern))?.[0];
      assert.ok(rawText, `${row.id}: 特别版区分证据缺失`);
      specialEvidence = { ...evidence(page, "独立特别版，不并入standard", rawText), sourceType: "official", confidence: 1 };
      source.referenceUrls.push(page.url);
    }
    const excludedColors = (row.excludeColors ?? []).filter((entry) => colors.some((color) => color.name === entry.name))
      .map((entry) => ({ ...entry, ...(specialEvidence ? { evidence: specialEvidence } : {}) }));
    colors = colors.filter((color) => !excludedColors.some((entry) => entry.name === color.name));
    if ((!primary || excludedColors.length) && colors.some((color) => color.url)) primary = { ...colors.find((color) => color.url), sourceUrl: imagePage.url, sourceSnapshotHash: imagePage.sha256, fetchedAt: imagePage.fetchedAt };
    const license = { licenseStatus: "unknown", licenseNote: "仅核验型号对应和公开图片URL；未取得版权授权或核验商业使用许可，不默认具有转载许可。" };
    source.productImages = { modelName: device.modelName, seriesId: row.seriesId, sourceUrl: imagePage.url, sourceSnapshotHash: imagePage.sha256, fetchedAt: imagePage.fetchedAt, ...license,
      ...(primary ? { primary: { ...primary, modelName: device.modelName, sourceUrl: primary.sourceUrl ?? page.url, sourceSnapshotHash: primary.sourceSnapshotHash ?? page.sha256, fetchedAt: primary.fetchedAt ?? page.fetchedAt, ...license } } : {}),
      colors: colors.map((color) => color.url ? { ...color, modelName: device.modelName, sourceUrl: imagePage.url, sourceSnapshotHash: imagePage.sha256, fetchedAt: imagePage.fetchedAt, ...license } : color),
      galleryUrls, ...(excludedColors.length ? { excludedColors } : {}), gaps: [...imageGaps, ...(!primary ? ["主产品图未核实"] : []), ...colors.filter((color) => !color.url).map((color) => `${color.name}配色图片未核实`)] };
    source.referenceUrls = [...new Set([...source.referenceUrls, ...galleryUrls])];
    source.notes += " 仅登记本批实际核验的SKU，不代表全部配置、配色或五年全型号覆盖；图片授权状态未知。";
    assert.ok(device.releaseDate, `${row.id}: 需要明确已售日期，不能只记录年份`);
    devices.push(device); sources.push(source);
    inventory.push({ id: row.id, brand: row.brand, modelName: row.modelName, releaseYear: device.releaseYear, series: row.family, status: "added", sourceUrls: source.referenceUrls });
    console.log(`${row.id}: ${device.configurations.length} SKU；${colors.filter((color) => color.url).length}/${colors.length} 配色图`);
  } catch (error) {
    const record = { id: row.id, brand: row.brand, modelName: row.modelName, releaseYear: row.releaseYear, series: row.family,
      status: "blocked", reason: error.message, sourceUrls: [target.seriesUrl] };
    blocked.push(record); inventory.push(record);
    console.log(`BLOCKED ${row.id}: ${error.message}`);
  }
}
const pending = [];
for (const row of fixture.pendingCandidates.filter((row) => !previous.some((device) => device.id === row.id) && !devices.some((device) => device.id === row.id))) {
  const page = await getSourceSnapshot(row.sourceUrl, options), title = plainText(page.html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
  const compact = (text) => text.replace(/[（(][^]*$/, "").replace(/参数$/, "").replace(/\s/g, "").toLowerCase();
  assert.equal(compact(title), compact(row.modelName), `${row.id}: 已知目录标题不匹配`);
  const params = zolRows(page.html);
  const label = ["上市日期", "国内发布时间"].find((label) => params.has(label));
  const intro = plainText(page.html).match(/系列手机，是[^。]+/)?.[0] ?? (label ? `${label} ${params.get(label)}` : undefined), listedYear = Number(intro?.match(/(20\d{2})年/)?.[1]);
  assert.equal(listedYear, row.releaseYear, `${row.id}: 已知目录上市年份与候选值不一致`);
  pending.push({ ...row, series: row.family, sourceUrls: [row.sourceUrl], sourceEvidence: evidence(page, row.modelName, title),
    listedYearEvidence: evidence(page, listedYear, intro), yearBasis: "目录或参数描述的年份，具体国行首售日期尚未处理",
    marketVerification: "中国大陆已售日期、独立SKU和配置配色尚未处理，不视为已核验" });
}
inventory.push(...pending);
assert.ok(devices.length >= 20, "已核验设备不足20款，不发布半成品；先处理blocked证据");
const generatedAt = new Date().toISOString().slice(0, 10), output = (value) => `${JSON.stringify(value, null, 2)}\n`;
for (const [slug, brand] of [["oppo", "OPPO"], ["vivo", "vivo"], ["honor", "HONOR"]]) {
  const selected = devices.filter((device) => device.brand === brand), ids = new Set(selected.map((device) => device.id));
  await fs.writeFile(new URL(`../src/data/${slug}-five-year-batch2-devices-db.json`, import.meta.url), output({ metadata: { version: "1.0", totalDevices: selected.length, generatedAt,
    coverage: { market: "CN", minReleaseYear: 2022, asOf: "2026-10-06", scope: "有来源的已知型号候选清单，不是品牌全量目录；主流型号完成不等于五年全部已覆盖。" },
    audit: { inventory: inventory.filter((row) => row.brand === brand), pending: pending.filter((row) => row.brand === brand), blocked: blocked.filter((row) => row.brand === brand),
      differenceFromExisting: inventory.filter((row) => row.brand === brand && row.status !== "present"), statusMeaning: { present: "既有dataset已有", added: "本批已核验新增", pending: "本批未开展", blocked: "本批实际检查后证据不能核验，错误原文见reason" } } }, devices: selected }));
  await fs.writeFile(new URL(`../src/data/${slug}-five-year-batch2-sources.json`, import.meta.url), output({ phone: sources.filter((source) => ids.has(source.id)), tablet: [], laptop: [] }));
}
console.log(`本批 ${devices.length} 款新增，${devices.reduce((sum, device) => sum + device.configurations.length, 0)} SKU；pending ${pending.length}；blocked ${blocked.length}`);
