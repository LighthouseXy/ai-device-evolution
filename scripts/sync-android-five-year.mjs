import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { importZolSeries, plainText, zolRows, extractZolProductImage } from "./lib/zol-device.mjs";
import { getSourceSnapshot } from "./lib/source-snapshot.mjs";
import { readZolColors, readZolColorImages, readOfficialColorGallery } from "./lib/device-images.mjs";

const { targets: rows } = JSON.parse(await fs.readFile(new URL("./fixtures/android-five-year-expansion.json", import.meta.url), "utf8"));
assert.equal(rows.length, 30);
assert.equal(new Set(rows.map((row) => row.id)).size, rows.length);
const existing = (await Promise.all(["oppo", "vivo", "honor"].map(async (brand) => JSON.parse(await fs.readFile(new URL(`../src/data/${brand}-devices-db.json`, import.meta.url), "utf8")).devices))).flat();
assert.ok(rows.every((row) => !existing.some((device) => device.id === row.id)), "本批不得重复已有设备 ID");
const options = { offline: process.argv.includes("--offline"), refresh: process.argv.includes("--refresh") };
const devices = [], sources = { phone: [], tablet: [], laptop: [] }, familyOrders = new Map();
const evidence = (page, value, rawText, sourceType = "reference") => ({ value, rawText, evidenceKind: "excerpt", sourceUrl: page.url,
  sourceType, confidence: sourceType === "official" ? 1 : 0.8, verifiedAt: page.fetchedAt.slice(0, 10), fetchedAt: page.fetchedAt, sourceSnapshotHash: page.sha256 });
const capacities = (value) => [...new Set((value?.match(/\d+(?:\.\d+)?\s*(?:GB|TB)/gi) ?? []).map((part) => part.replace(/\s/g, "").toUpperCase()))];
for (const row of rows) {
  const orderKey = `${row.brand}.${row.category}.${row.family}`;
  const generationOrder = (familyOrders.get(orderKey) ?? 0) + 1;
  familyOrders.set(orderKey, generationOrder);
  const target = { ...row, series: row.family, variant: "standard", generation: row.modelName.replace(/^(?:OPPO|vivo|荣耀)\s*/, ""),
    generationOrder, comparisonGroupId: `${row.brand.toLowerCase()}.${row.category}.${row.group}.standard`,
    seriesUrl: `https://detail.zol.com.cn/series/${{ phone: 57, tablet: 702, laptop: 16 }[row.category]}/${row.seriesId}_1.html`,
    ...(row.releaseFallback ? { releaseFallback: { ...row.releaseFallback, pattern: new RegExp(row.releaseFallback.rawPattern) } } : {}) };
  const { device, source } = await importZolSeries(target, options);
  // 共享导入器解析具体 SKU；此批额外拒绝参数行的多值清单，不能取首值代表独立配置。
  const checked = [];
  for (const config of device.configurations) {
    const page = await getSourceSnapshot(config.evidence.sourceUrl, options), params = zolRows(page.html);
    const memory = capacities(params.get("RAM容量") ?? params.get("系统内存") ?? params.get("内存容量"));
    const storage = capacities(params.get("ROM容量") ?? params.get("存储容量") ?? params.get("硬盘容量"));
    if (memory.length !== 1 || storage.length !== 1 || memory[0] !== config.memory || storage[0] !== config.storage) {
      (source.excludedConfigurations ??= []).push({ name: config.evidence.rawText.split("；")[0], sourceUrl: page.url, reason: "内存或存储不是单一明确的独立 SKU 值" });
      continue;
    }
    if (row.category === "phone") {
      const domestic = params.get("国内发布时间");
      assert.ok(domestic && /20\d\d年/.test(domestic), `${row.id}: 缺少明确国内发布时间，不能凭中文网页判定国行`);
      source.marketEvidence ??= evidence(page, "中国大陆", `国内发布时间 ${domestic}`);
    }
    checked.push(config);
  }
  assert.ok(checked.length, `${row.id}: 缺少独立 SKU`);
  if (row.configurationSupport) {
    const page = await getSourceSnapshot(row.configurationSupport.url, options), text = plainText(page.html);
    const declared = row.configurationSupport.configurations.map(([memory, storage, pattern]) => {
      const rawText = text.match(new RegExp(pattern))?.[0];
      assert.ok(rawText, `${row.id}: 明确国行配置原文缺失 ${memory}/${storage}`);
      return { memory, storage, evidence: evidence(page, `${memory} + ${storage}`, rawText) };
    });
    for (const config of checked.filter((config) => !declared.some((entry) => entry.memory === config.memory && entry.storage === config.storage)))
      (source.excludedConfigurations ??= []).push({ name: `${config.memory}/${config.storage}`, sourceUrl: config.evidence.sourceUrl, reason: "未取得该配置独立国行发布证据；不把参数库额外组合冒充大陆 SKU" });
    device.configurations = declared;
    source.referenceUrls.push(page.url);
    source.notes += " 内存/存储组合以大陆发布/首售报道逐条核验，保留每项的原文和快照，不使用矛盾参数行。";
  } else device.configurations = checked;
  const firstPage = await getSourceSnapshot(checked[0].evidence.sourceUrl, options), params = zolRows(firstPage.html);
  for (const [key, labels, values] of [["memory", ["RAM容量", "系统内存", "内存容量"], device.configurations.map((config) => config.memory)], ["storage", ["ROM容量", "存储容量", "硬盘容量"], device.configurations.map((config) => config.storage)]]) {
    const label = labels.find((label) => params.has(label)), field = params.get(label);
    device.specs[key] = { ...evidence(firstPage, [...new Set(values)].join(" / "), `${label} ${field}`), note: "可选值仅汇总本设备各独立配置的 evidence，不表示全部在售组合。" };
  }
  const seriesPage = await getSourceSnapshot(target.seriesUrl, options);
  const pictureLinks = [...new Set([...seriesPage.html.matchAll(/href=["']([^"']*\/picture_index_\d+\/index\d+_\d+_p\d+\.shtml)["']/g)].map((match) => new URL(match[1], target.seriesUrl).href))].slice(0, 2);
  let productImage = extractZolProductImage(seriesPage.html), colorImages = readZolColors(seriesPage.html).map((name) => ({ name })), imagePage = seriesPage;
  const imageGaps = [];
  for (const url of pictureLinks) {
    try {
      const page = await getSourceSnapshot(url, options);
      const colors = readZolColorImages(page.html, { seriesId: row.seriesId });
      if (colors.length) {
        colorImages = [...colorImages.map((color) => colors.find((entry) => entry.name === color.name) ?? color), ...colors.filter((color) => !colorImages.some((entry) => entry.name === color.name))];
        imagePage = page; break;
      }
    } catch (error) { imageGaps.push(error.message); }
  }
  if (row.officialSpecUrl) {
    const page = await getSourceSnapshot(row.officialSpecUrl, options);
    const title = plainText(page.html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
    const compact = (text) => text.replace(/[\s()（）]/g, "").toLowerCase();
    assert.ok(compact(title).includes(compact(row.modelName)), `${row.id}: 中国官网型号身份不一致: ${title}`);
    source.officialSpecUrl = page.url;
    source.referenceUrls.push(page.url);
    source.marketEvidence = { ...evidence(page, "中国大陆", title, "official"), note: "型号在品牌中国官网的产品页，结合已售日期和独立 SKU 参数，不以中文语种本身判定市场。" };
    try {
      const gallery = readOfficialColorGallery(page.html, device, page.url);
      if (gallery.image) productImage = { ...gallery.image, sourceUrl: page.url, sourceSnapshotHash: page.sha256, fetchedAt: page.fetchedAt };
      if (gallery.colors.length) { colorImages = gallery.colors; imagePage = page; }
    } catch (error) { imageGaps.push(error.message); }
  }
  assert.ok(source.marketEvidence, `${row.id}: 市场证据缺失`);
  const excludedColors = (row.excludeColors ?? []).filter((excluded) => colorImages.some((color) => color.name === excluded.name));
  colorImages = colorImages.filter((color) => !excludedColors.some((excluded) => excluded.name === color.name));
  if ((!productImage || excludedColors.length) && colorImages.some((color) => color.url)) productImage = { ...colorImages.find((color) => color.url), sourceUrl: imagePage.url, sourceSnapshotHash: imagePage.sha256, fetchedAt: imagePage.fetchedAt };
  source.productImages = { modelName: device.modelName, seriesId: row.seriesId, sourceUrl: imagePage.url, fetchedAt: imagePage.fetchedAt, sourceSnapshotHash: imagePage.sha256,
    ...(productImage ? { primary: { ...productImage, modelName: device.modelName, sourceUrl: productImage.sourceUrl ?? seriesPage.url, sourceSnapshotHash: productImage.sourceSnapshotHash ?? seriesPage.sha256, fetchedAt: productImage.fetchedAt ?? seriesPage.fetchedAt } } : {}),
    galleryUrls: pictureLinks, colors: colorImages.map((color) => color.url ? { ...color, modelName: device.modelName, sourceUrl: imagePage.url, sourceSnapshotHash: imagePage.sha256, fetchedAt: imagePage.fetchedAt } : color),
    ...(excludedColors.length ? { excludedColors: excludedColors.map((color) => ({ ...color, sourceUrl: seriesPage.url, sourceSnapshotHash: seriesPage.sha256, fetchedAt: seriesPage.fetchedAt })) } : {}),
    gaps: [...imageGaps, ...(!productImage ? ["未取得通过身份校验的主产品图"] : []),
      ...colorImages.filter((color) => !color.url).map((color) => `${color.name}配色图片未核实`)] };
  source.referenceUrls = [...new Set([...source.referenceUrls, ...pictureLinks])];
  source.notes += " 本批额外检查内存/存储字段单值，以及明确国行市场证据；特殊配色、卫星、典藏、柔光等附加版本不代表全部覆盖。";
  devices.push(device); sources[row.category].push(source);
  console.log(`${row.id}: ${device.configurations.length} 个独立配置，${colorImages.filter((color) => color.url).length}/${colorImages.length} 配色图片`);
}
assert.equal(devices.length, rows.length);
const generatedAt = new Date().toISOString().slice(0, 10);
const output = (value) => `${JSON.stringify(value, null, 2)}\n`;
for (const [slug, brand] of [["oppo", "OPPO"], ["vivo", "vivo"], ["honor", "HONOR"]]) {
  const selected = devices.filter((device) => device.brand === brand), ids = new Set(selected.map((device) => device.id));
  await fs.writeFile(new URL(`../src/data/${slug}-five-year-devices-db.json`, import.meta.url), output({ metadata: { version: "1.0", totalDevices: selected.length, generatedAt,
    coverage: { market: "CN", minReleaseYear: 2022, asOf: "2026-10-06", scope: `${brand}首批${selected.length}款缺失型号，不代表五年全型号已覆盖` } }, devices: selected }));
  await fs.writeFile(new URL(`../src/data/${slug}-five-year-sources.json`, import.meta.url), output(Object.fromEntries(Object.entries(sources).map(([category, entries]) => [category, entries.filter((source) => ids.has(source.id))]))));
}
console.log(`新增 ${devices.length} 台，${devices.reduce((count, device) => count + device.configurations.length, 0)} 个已核验配置`);
