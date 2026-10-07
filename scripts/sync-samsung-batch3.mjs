import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { importZolSeries, plainText, zolRows, readSingleCapacity, extractZolProductImage } from "./lib/zol-device.mjs";
import { getSourceSnapshot } from "./lib/source-snapshot.mjs";
import { readZolColors, readZolColorImages } from "./lib/device-images.mjs";

const fixture = JSON.parse(await fs.readFile("scripts/fixtures/samsung-batch3-expansion.json", "utf8"));
const previous = JSON.parse(await fs.readFile("src/data/samsung-batch2-devices-db.json", "utf8"));
const existing = (await Promise.all(["samsung-devices-db", "samsung-history-devices-db", "samsung-batch2-devices-db"]
  .map(async name => JSON.parse(await fs.readFile("src/data/" + name + ".json", "utf8")).devices))).flat();
const options = { offline: process.argv.includes("--offline"), refresh: process.argv.includes("--refresh") };
assert.ok(!(options.offline && options.refresh));
const devices = [], sources = { phone: [], tablet: [], laptop: [] }, skipped = [];
const normalize = value => value.replace(/^Samsung[（(]三星[）)]|^Samsung|^三星/i, "")
  .replace(/\s*\d+(?:\.\d+)?GB\s*[+/][^]*$/i, "").replace(/[（(][^]*$/, "").replace(/系列$/, "")
  .replace(/[\s-]/g, "").toLowerCase();
const evidence = (page, value, rawText) => ({ value, rawText, evidenceKind: "excerpt", sourceUrl: page.url,
  sourceType: /samsung\.com\.cn/.test(page.url) ? "official" : "reference",
  confidence: /samsung\.com\.cn/.test(page.url) ? 1 : 0.8,
  verifiedAt: page.fetchedAt.slice(0, 10), fetchedAt: page.fetchedAt, sourceSnapshotHash: page.sha256 });
const seriesUrl = row => row.seriesId ? "https://detail.zol.com.cn/series/" + (row.category === "tablet" ? 702 : 57) + "/" + row.seriesId + "_1.html"
  : "https://detail.zol.com.cn/" + (row.category === "tablet" ? "tablepc" : "cell_phone") + "/index" + row.productId + ".shtml";
for (const row of fixture.targets) {
  const category = row.category ?? "phone", variant = row.variant ?? (category === "tablet" ? "wifi" : "standard");
  const id = "samsung-" + row.slug + "-" + row.year, name = "Samsung " + (row.displayName ?? row.name);
  assert.ok(!existing.some(d => d.id === id || (normalize(d.modelName) === normalize(name) && d.variant === variant)), id + ": 不能重复");
  try {
    const market = fixture.markets[row.marketKey], page = await getSourceSnapshot(market.url, options), text = plainText(page.html);
    const raw = text.match(new RegExp(market.pattern))?.[0];
    const identityPage = market.identityUrl ? await getSourceSnapshot(market.identityUrl, options) : page;
    const identityRaw = plainText(identityPage.html).match(new RegExp(market.identityPattern ?? market.pattern))?.[0];
    assert.ok(raw && identityRaw, id + ": 国行型号/市场原文缺失");
    const fallbackDate = market.date ?? row.fallbackDate;
    const { device, source } = await importZolSeries({ ...row, launch: undefined, id, category, variant, brand: "Samsung",
      minYear: 2017, releaseYear: row.year, modelName: name, expectedName: row.expectedName ?? "三星" + row.name,
      generation: (row.displayName ?? row.name).replace(/^Galaxy /, ""), comparisonGroupId: "samsung." + category + "." + row.group + "." + variant,
      seriesUrl: seriesUrl(row),
      ...(fallbackDate ? { releaseFallback: { sourceUrl: market.url, releaseDate: fallbackDate, pattern: new RegExp(market.datePattern ?? market.pattern) } } : {}),
      excludeVariants: ["Thom Browne", "限量", "定制", "单卡版", "双4G", "移动4G",
        ...(category === "tablet" && variant === "wifi" ? ["5G", "LTE", "4G", "键盘", "套装"] : []),
        ...(category === "tablet" && variant === "lte" ? ["WiFi", "WIFI", "WLAN", "键盘", "套装"] : [])],
    }, options);
    const retained = [], excluded = [];
    for (const c of device.configurations) {
      const p = await getSourceSnapshot(c.evidence.sourceUrl, options), rows = zolRows(p.html);
      const title = plainText(p.html.match(/<h1[^>]*>([^]*?)<\/h1>/i)?.[1] ?? "").replace(/参数$/, "");
      assert.ok((Array.isArray(row.expectedName) ? row.expectedName : [row.expectedName ?? row.name])
        .some(n => normalize(n) === normalize(title)), id + ": 具体标题型号不匹配：" + title);
      const ram = readSingleCapacity(rows.get("RAM容量") ?? rows.get("系统内存"));
      const rom = readSingleCapacity(rows.get("ROM容量") ?? rows.get("存储容量"));
      if (!ram || !rom || !row.pairs.some(([r, s]) => r === ram && s === rom)) excluded.push({
        name: title, sourceUrl: p.url, reason: "未取得本批国行单值配对SKU证据，或参数多值/冲突" });
      else retained.push(c);
    }
    device.configurations = retained;
    assert.ok(retained.length, id + ": 无可信国行独立配置");
    for (const k of ["memory", "storage"]) device.specs[k] = { ...retained[0].evidence,
      value: [...new Set(retained.map(c => c[k]))].join(" / "), note: "仅汇总已接受的独立单值SKU，不作多值首选或笛卡尔组合。" };
    source.excludedConfigurations = [...(source.excludedConfigurations ?? []), ...excluded];
    source.marketEvidence = evidence(identityPage, "中国大陆已发布销售型号", identityRaw);
    source.configurationMarketEvidence = evidence(page, "国行配对配置核验范围", raw);
    source.referenceUrls.push(page.url, identityPage.url);
    if (!market.date) { delete device.releaseDate; source.releaseEvidence.value = String(row.year);
      source.releaseEvidence.note = "仅保留已证大陆年份，不将海外/发布/预售/少量优先发货日当中国大陆正式首销日。"; }
    if (row.chipEvidence) {
      const chipRaw = text.match(new RegExp(row.chipEvidence.pattern))?.[0];
      assert.ok(chipRaw, id + ": 芯片补充/纠正原文缺失");
      device.specs.chip = { ...evidence(page, row.chipEvidence.value, chipRaw), note: row.chipEvidence.reason };
      source.fieldCorrections = [{ field: "chip", reason: row.chipEvidence.reason }];
    }
    for (const key of row.dropFields ?? []) { delete device.specs[key];
      source.fieldCorrections = [...(source.fieldCorrections ?? []), { field: key, reason: "原页字段存在代际/型号错误，未取得可靠原文则删除而非猜测。" }]; }
    for (const item of row.fieldEvidence ?? []) {
      const p = await getSourceSnapshot(item.sourceUrl, options), raw = plainText(p.html).match(new RegExp(item.pattern))?.[0];
      assert.ok(raw, id + ": 字段纠正原文缺失");
      device.specs[item.field] = { ...evidence(p, item.value, raw), note: item.reason };
      source.fieldCorrections = [...(source.fieldCorrections ?? []), { field: item.field, reason: item.reason }];
      source.referenceUrls.push(p.url);
    }
    if (row.launch) {
      const [value, ram, rom, pattern] = row.launch, launchRaw = text.match(new RegExp(pattern))?.[0];
      assert.ok(launchRaw, id + ": 正式逐配置价格原文缺失");
      if (retained.some(c => c.memory === ram && c.storage === rom)) device.specs.launchPrice = { ...evidence(page, value, launchRaw),
        unit: "CNY", market: "中国大陆", priceType: "launch", configuration: ram + " 运行内存 + " + rom + " 存储，国行",
        condition: "正式发布的最低配置指导价；不使用现价、国补、预售免费升杯或限时价" };
    }
    source.fieldGaps = source.fieldGaps.filter(g => !device.specs[g.field]);
    const required = category === "tablet"
      ? ["chip", "memory", "storage", "launchPrice", "screenSize", "displayType", "resolution", "port"]
      : ["chip", "memory", "storage", "launchPrice", "displayType", "port", "rearCamera", "frontCamera"];
    for (const field of required) if (device.specs[field]?.value == null && !source.fieldGaps.some(g => g.field === field)) {
      source.fieldGaps.push({ field, reason: source.fieldCorrections?.find(item => item.field === field)?.reason
        ?? "具体配置页面无可靠字段原文；留空不推断" });
    }
    const overview = await getSourceSnapshot(seriesUrl(row), options), image = extractZolProductImage(overview.html);
    source.imageLicense = "unknown";
    if (image) source.productImage = { ...image, modelName: name, sourceUrl: overview.url, sourceName: "中关村在线",
      fetchedAt: overview.fetchedAt, sourceSnapshotHash: overview.sha256 };
    source.colorNames = readZolColors(overview.html);
    const href = [...overview.html.matchAll(/href=["']([^"']*\/picture_index_\d+\/index\d+_\d+_p\d+\.shtml)["']/g)][0]?.[1];
    if (href) try {
      const gallery = await getSourceSnapshot(new URL(href, overview.url).href, options);
      source.colorGallery = { sourceUrl: gallery.url, fetchedAt: gallery.fetchedAt, sourceSnapshotHash: gallery.sha256,
        colors: readZolColorImages(gallery.html, row.seriesId ? { seriesId: String(row.seriesId) } : { productId: String(row.productId) }) };
      source.referenceUrls.push(gallery.url);
    } catch (error) { source.imageGaps = [{ field: "colorGallery", reason: error.message }]; }
    if (row.colorEvidence) {
      const item = row.colorEvidence, p = await getSourceSnapshot(item.sourceUrl, options);
      assert.ok(p.html.includes(item.url.replace(/^https:/, "")) && p.html.includes('alt="' + item.name + '"'), id + ": 配色原图证据缺失");
      source.colorGallery = { sourceUrl: p.url, fetchedAt: p.fetchedAt, sourceSnapshotHash: p.sha256, colors: [{ name: item.name, url: item.url }] };
      source.referenceUrls.push(p.url);
    }
    source.referenceUrls = [...new Set(source.referenceUrls)];
    source.notes = "具体国行配置交叉核验；只登记实际读取的 " + retained.length + " 个配置。网络版本与海外命名不混用。公开产品照片许可unknown，不表示图片授权或全部大陆配色已覆盖。";
    devices.push(device); sources[category].push(source);
    console.log(JSON.stringify({ id, configurations: retained.length, image: Boolean(image), colors: source.colorGallery?.colors.length ?? 0 }));
  } catch (error) { skipped.push({ id, name: row.displayName ?? row.name, year: row.year, category, sourceUrl: seriesUrl(row), reason: error.message });
    skipped.at(-1).reason = row.blockedReason ?? error.message;
    skipped.at(-1).marketSourceUrl = fixture.markets[row.marketKey].url;
    skipped.at(-1).identitySourceUrl = fixture.markets[row.marketKey].identityUrl ?? fixture.markets[row.marketKey].url;
    console.warn(id + ": " + skipped.at(-1).reason); }
}

// ponytail: 沿用有限公开目录差集，不重新构造爬虫，也不把中文目录当大陆全集。
const inventory = new Map(previous.metadata.coverageInventory.map(item => [normalize(item.name), structuredClone(item)]));
const catalogEvidence = [...previous.metadata.catalogEvidence], catalogGaps = [...previous.metadata.catalogGaps];
const add = (name, url, page, category) => {
  name = name.replace(/^Samsung[（(]三星[）)]|^Samsung|^三星/i, "").replace(/[（(][^]*$/, "").replace(/系列$/, "").trim();
  const key = normalize(name), item = inventory.get(key) ?? { brand: "Samsung", name, category: category ?? (/Tab/.test(name) ? "tablet" : "phone"),
    series: /^Galaxy\s+(?:Tab\s+)?([A-Z]+)/i.exec(name)?.[1] ?? "other", year: null, sourceUrls: [], catalogSources: [] };
  item.sourceUrls = [...new Set([...item.sourceUrls, url])];
  if (page && !item.catalogSources.some(s => s.sourceUrl === page.url && s.rawText === name)) item.catalogSources.push({
    sourceUrl: page.url, rawText: name, fetchedAt: page.fetchedAt, sourceSnapshotHash: page.sha256 });
  inventory.set(key, item);
};
for (const url of fixture.catalogUrls) try {
  const page = await getSourceSnapshot(url, options);
  assert.ok(!page.html.includes("service.zol.com.cn/checking"), "验证跳转不是有效目录");
  const members = [...page.html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([^]*?)<\/a>/g)]
    .map(([, href, html]) => ({ name: plainText(html.replace(/<span[^>]*>[^]*?<\/span>/g, "")), url: new URL(href, url).href }))
    .filter(item => /^三星|^Samsung/.test(item.name) && /\/(?:series|cell_phone|tablepc)\/(?:\d+\/\d+_1\.html|index\d+\.shtml)$/.test(item.url) && !/\.\.|查看|参数|报价|点评|比价|图片|综述|论坛|手机$|平板电脑$/.test(item.name));
  assert.ok(members.length, "目录未得到有效型号列表");
  catalogEvidence.push({ sourceUrl: url, fetchedAt: page.fetchedAt, sourceSnapshotHash: page.sha256, members: members.length, batch: 3 });
  for (const member of members) add(member.name, member.url, page);
} catch (error) { catalogGaps.push({ sourceUrl: url, reason: error.message, batch: 3 }); }
for (const row of fixture.targets) add(row.displayName ?? row.name, seriesUrl(row), null, row.category ?? "phone");
for (const row of [...fixture.blockedModels, ...fixture.additionalPending]) {
  const page = await getSourceSnapshot(row.sourceUrl, options);
  add(row.name, row.sourceUrl, page, row.category);
  const item = inventory.get(normalize(row.name)); item.year = row.year;
  item.status = fixture.blockedModels.includes(row) ? "blocked" : "pending";
  item.reason = row.reason;
  const raw = plainText(page.html).match(new RegExp(row.pattern ?? ".{0,100}(?:国行|中国大陆|Galaxy Tab S10|Galaxy Tab S9).{0,300}"))?.[0];
  if (raw) item.blockerEvidence = evidence(page, item.status, raw);
}
for (const item of inventory.values()) {
  const old = existing.find(d => normalize(d.modelName) === normalize(item.name));
  const alias = fixture.targets.find(row => row.category === "tablet" && (
    (row.variant === "lte" && /4G/.test(row.name) && normalize(row.name) === normalize(item.name))
    || (row.variant !== "lte" && normalize(row.name + " WLAN") === normalize(item.name))));
  const added = devices.find(d => normalize(d.modelName) === normalize(item.name) || (alias && d.id === "samsung-" + alias.slug + "-" + alias.year));
  const skip = skipped.find(d => normalize(d.name) === normalize(item.name));
  if (old || added) { item.status = old ? "covered_existing" : "added_batch3"; item.deviceId = (old ?? added).id;
    item.year = (old ?? added).releaseYear; item.reason = "已有核验型号；仅覆盖入库网络版本与实际保留SKU，不代表全部配置。"; }
  else if (skip) { item.status = "blocked"; item.reason = skip.reason;
    item.sourceUrls = [...new Set([...item.sourceUrls, skip.sourceUrl, skip.marketSourceUrl, skip.identitySourceUrl])]; }
  else if (item.status === "added_batch2") item.status = "covered_existing";
  else if (!item.status) { item.status = "pending"; item.reason = "公开目录出现的型号；尚未完成大陆销售及独立SKU核验，不代表国行已发售。"; }
}
const list = [...inventory.values()], counts = list.reduce((acc, item) => ({ ...acc, [item.status]: (acc[item.status] ?? 0) + 1 }), {});
assert.ok(devices.length >= fixture.expectedDevices, "本批不得静默低于已核验基线");
assert.equal(new Set(devices.map(d => d.id)).size, devices.length);
for (const d of devices) {
  assert.ok(d.releaseYear >= 2017 && d.releaseYear <= 2026 && d.configurations.length);
  for (const c of d.configurations) assert.match(c.evidence.sourceSnapshotHash, /^[a-f0-9]{64}$/);
  if (d.specs.launchPrice) assert.ok(d.configurations.some(c => d.specs.launchPrice.configuration === c.memory + " 运行内存 + " + c.storage + " 存储，国行"));
}
await fs.writeFile("src/data/samsung-batch3-devices-db.json", JSON.stringify({ metadata: { version: "1.0", totalDevices: devices.length, scope: fixture.scope,
  skipped, catalogEvidence, catalogGaps, coverageInventory: list, coverageCounts: counts,
  pending: list.filter(i => i.status === "pending"), blocked: list.filter(i => i.status === "blocked"),
  catalogLimit: fixture.metadata.catalogLimit, imageLicense: "unknown" }, devices }, null, 2) + "\n");
await fs.writeFile("src/data/samsung-batch3-sources.json", JSON.stringify(sources, null, 2) + "\n");
console.log(JSON.stringify({ total: devices.length, configurations: devices.reduce((n, d) => n + d.configurations.length, 0), coverageCounts: counts, skipped }, null, 2));
