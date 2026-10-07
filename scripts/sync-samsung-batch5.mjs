import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { importZolSeries, plainText, zolRows, readSingleCapacity, extractZolProductImage } from "./lib/zol-device.mjs";
import { getSourceSnapshot } from "./lib/source-snapshot.mjs";
import { readZolColors, readZolColorImages } from "./lib/device-images.mjs";
import { loadTsModule } from "./lib/load-ts-module.mjs";
import { samsungProductRows } from "./lib/android-official-specs.mjs";

const { getPriceConfiguration } = loadTsModule("./src/lib/device-configurations.ts");

const fixture = JSON.parse(await fs.readFile("scripts/fixtures/samsung-batch5-expansion.json", "utf8"));
const previous = JSON.parse(await fs.readFile("src/data/samsung-batch4-devices-db.json", "utf8"));
const existing = (await Promise.all(["samsung-devices-db", "samsung-history-devices-db", "samsung-batch2-devices-db", "samsung-batch3-devices-db", "samsung-batch4-devices-db"]
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
const seriesUrl = row => row.productUrl ?? (row.seriesId ? "https://detail.zol.com.cn/series/" + (row.category === "tablet" ? 702 : 57) + "/" + row.seriesId + "_1.html"
  : "https://detail.zol.com.cn/" + (row.category === "tablet" ? "tablepc" : "cell_phone") + "/index" + row.productId + ".shtml");
for (const row of fixture.targets) {
  const category = row.category ?? "phone", variant = row.variant ?? (category === "tablet" ? "wifi" : "standard");
  const id = "samsung-" + row.slug + "-" + row.year, name = "Samsung " + (row.displayName ?? row.name);
  assert.ok(!existing.some(d => d.id === id || (normalize(d.modelName) === normalize(name) && d.variant === variant)), id + ": 不能重复");
  try {
    const market = { ...fixture.markets[row.marketKey], ...(row.identityUrl ? { identityUrl: row.identityUrl, identityPattern: row.identityPattern } : {}) }, page = await getSourceSnapshot(market.url, options), text = plainText(page.html);
    const raw = text.match(new RegExp(market.pattern))?.[0];
    const identityPage = market.identityUrl ? await getSourceSnapshot(market.identityUrl, options) : page;
    const identityRaw = plainText(identityPage.html).match(new RegExp(market.identityPattern ?? market.pattern))?.[0];
    assert.ok(raw && identityRaw, id + ": 国行型号/市场原文缺失");
    const fallbackDate = market.date ?? row.fallbackDate;
    const { device, source } = row.kind ? await importVerified(row, page, raw) : await importZolSeries({ ...row, launch: undefined, id, category, variant, brand: "Samsung",
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
      if (row.kind) { retained.push(c); continue; }
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
    for (const k of ["memory", "storage"]) device.specs[k] = { ...evidence(page, "", raw),
      value: [...new Set(retained.map(c => c[k]))].join(" / "), note: "仅汇总已接受的独立单值SKU，不作多值首选或笛卡尔组合。" };
    source.excludedConfigurations = [...(source.excludedConfigurations ?? []), ...excluded];
    source.marketEvidence = evidence(identityPage, "中国大陆已发布销售型号", identityRaw);
    source.configurationMarketEvidence = evidence(page, "国行配对配置核验范围", raw);
    source.referenceUrls.push(page.url, identityPage.url);
    source.referenceUrls.push(...retained.map(c => c.evidence.sourceUrl));
    if (!market.date) { delete device.releaseDate; source.releaseEvidence.value = String(row.year);
      source.releaseEvidence.note = "仅保留已证大陆年份，不将海外/发布/预售/少量优先发货日当中国大陆正式首销日。"; }
    if (row.yearEvidence) {
      const yearPage = await getSourceSnapshot(row.yearEvidence.sourceUrl, options);
      const yearRaw = plainText(yearPage.html).match(new RegExp(row.yearEvidence.pattern))?.[0];
      assert.ok(yearRaw, id + ": 独立年份证据缺失");
      source.releaseEvidence = { ...evidence(yearPage, String(row.year), yearRaw), note: row.yearEvidence.note };
      source.referenceUrls.push(yearPage.url);
    }
    if (row.chipEvidence) {
      const chipRaw = text.match(new RegExp(row.chipEvidence.pattern))?.[0];
      assert.ok(chipRaw, id + ": 芯片补充/纠正原文缺失");
      device.specs.chip = { ...evidence(page, row.chipEvidence.value, chipRaw), note: row.chipEvidence.reason };
      source.fieldCorrections = [...(source.fieldCorrections ?? []), { field: "chip", reason: row.chipEvidence.reason }];
    }
    for (const key of row.dropFields ?? []) { delete device.specs[key];
      source.fieldGaps.push({ field: key, reason: "原参数页存在型号/代际或多来源冲突，未取得独立可信原文则隔离；不猜值。" });
      source.fieldCorrections = [...(source.fieldCorrections ?? []), { field: key, reason: "原页字段存在代际/型号错误，未取得可靠原文则删除而非猜测。" }]; }
    for (const item of row.fieldEvidence ?? []) {
      const p = await getSourceSnapshot(item.sourceUrl, options), raw = plainText(p.html).match(new RegExp(item.pattern))?.[0];
      assert.ok(raw, id + ": 字段纠正原文缺失");
      device.specs[item.field] = { ...evidence(p, item.value, raw), ...(item.unit ? { unit: item.unit } : {}), note: item.reason };
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
    if (image) {
      source.productImage = { ...image, modelName: name, sourceUrl: overview.url, sourceName: "中关村在线",
        fetchedAt: overview.fetchedAt, sourceSnapshotHash: overview.sha256 };
      source.referenceUrls.push(overview.url);
    }
    if (row.kind !== "official") source.colorNames = readZolColors(overview.html);
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
    if (row.productImageEvidence) {
      const item = row.productImageEvidence, p = await getSourceSnapshot(item.sourceUrl, options);
      assert.ok(p.html.includes(item.url.replace(/^https:/, "")), id + ": 官方型号主图证据缺失");
      source.productImage = { url: item.url, alt: name, modelName: name, sourceUrl: p.url, sourceName: "三星中国",
        fetchedAt: p.fetchedAt, sourceSnapshotHash: p.sha256 };
      source.referenceUrls.push(p.url);
    }
    if (!source.productImage && source.colorGallery?.colors.some(color => color.url)) {
      const gallery = source.colorGallery, photo = gallery.colors.find(color => color.url);
      source.productImage = { url: photo.url, alt: name + " " + photo.name, modelName: name,
        sourceUrl: gallery.sourceUrl, sourceName: "中关村在线", fetchedAt: gallery.fetchedAt,
        sourceSnapshotHash: gallery.sourceSnapshotHash, note: "确切型号图库的配色实图作为默认主图。" };
    }
    source.referenceUrls = [...new Set(source.referenceUrls)];
    source.sourceInputKind = source.sourcePageType;
    source.sourcePageType = "expanded_core_spec_snapshots";
    source.notes = "具体国行配置交叉核验；只登记实际读取的 " + retained.length + " 个配置。网络版本与海外命名不混用。公开产品照片许可unknown，不表示图片授权或全部大陆配色已覆盖。";
    devices.push(device); sources[category].push(source);
    console.log(JSON.stringify({ id, configurations: retained.length, image: Boolean(source.productImage?.url), colors: source.colorGallery?.colors.filter(color => color.url).length ?? 0 }));
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
  const officialMembers = fixture.targets.filter(row => row.identityUrl === url);
  if (officialMembers.length) {
    for (const row of officialMembers) {
      assert.ok(plainText(page.html).match(new RegExp(row.identityPattern)), "官方目录缺少型号成员证据");
      add(row.name, seriesUrl(row), page, row.category ?? "phone");
    }
    catalogEvidence.push({ sourceUrl: url, fetchedAt: page.fetchedAt, sourceSnapshotHash: page.sha256,
      members: officialMembers.length, batch: 5, scope: "仅记录本批实际核验的目录成员，不宣称完整目录" });
    continue;
  }
  assert.ok(!page.html.includes("service.zol.com.cn/checking"), "验证跳转不是有效目录");
  const members = [...page.html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([^]*?)<\/a>/g)]
    .map(([, href, html]) => ({ name: plainText(html.replace(/<span[^>]*>[^]*?<\/span>/g, "")), url: new URL(href, url).href }))
    .filter(item => /^三星|^Samsung/.test(item.name) && /\/(?:series|cell_phone|tablepc)\/(?:\d+\/\d+_1\.html|index\d+\.shtml)$/.test(item.url) && !/\.\.|查看|参数|报价|点评|比价|图片|综述|论坛|手机$|平板电脑$/.test(item.name));
  assert.ok(members.length, "目录未得到有效型号列表");
  catalogEvidence.push({ sourceUrl: url, fetchedAt: page.fetchedAt, sourceSnapshotHash: page.sha256, members: members.length, batch: 5 });
  for (const member of members) add(member.name, member.url, page);
} catch (error) { catalogGaps.push({ sourceUrl: url, reason: error.message, batch: 5 }); }
for (const row of fixture.targets) add(row.displayName ?? row.name, seriesUrl(row), null, row.category ?? "phone");
for (const row of [...(fixture.blockedModels ?? []), ...(fixture.additionalPending ?? [])]) {
  const page = await getSourceSnapshot(row.sourceUrl, options);
  add(row.name, row.sourceUrl, page, row.category);
  const item = inventory.get(normalize(row.name)); item.year = row.year;
  item.status = (fixture.blockedModels ?? []).includes(row) ? "blocked" : "pending";
  item.reason = row.reason;
  const raw = plainText(page.html).match(new RegExp(row.pattern ?? ".{0,100}(?:国行|中国大陆|Galaxy Tab S10|Galaxy Tab S9).{0,300}"))?.[0];
  if (raw) item.blockerEvidence = evidence(page, item.status, raw);
}
for (const item of inventory.values()) {
  if (item.sourceUrls.some(url => /\/tablepc\//.test(url))) item.category = "tablet";
  const old = existing.find(d => normalize(d.modelName) === normalize(item.name));
  const alias = fixture.targets.find(row => row.category === "tablet" && (
    (row.variant === "lte" && /4G/.test(row.name) && normalize(row.name) === normalize(item.name))
    || (row.variant !== "lte" && normalize(row.name + " WLAN") === normalize(item.name))));
  const exactAlias = fixture.targets.find(row => row.catalogAliases?.some(name => normalize(name) === normalize(item.name)));
  const typedTarget = exactAlias ?? fixture.targets.find(row => normalize(row.name) === normalize(item.name));
  if (typedTarget) { item.family = typedTarget.family; item.series = typedTarget.family.replace(/^Samsung Galaxy (?:Tab )?/, "").replace(/^Samsung /, ""); }
  const added = devices.find(d => (normalize(d.modelName) === normalize(item.name) || normalize(d.modelName) === normalize(item.name + " LTE"))
    || ((alias || exactAlias) && d.id === "samsung-" + (alias || exactAlias).slug + "-" + (alias || exactAlias).year));
  const skip = skipped.find(d => normalize(d.name) === normalize(item.name));
  if (old || added) { item.status = old ? "covered_existing" : "added_batch5"; item.deviceId = (old ?? added).id;
    item.year = (old ?? added).releaseYear; item.reason = "已有核验型号；仅覆盖入库网络版本与实际保留SKU，不代表全部配置。"; }
  else if (skip) { item.status = "blocked"; item.reason = skip.reason;
    item.sourceUrls = [...new Set([...item.sourceUrls, skip.sourceUrl, skip.marketSourceUrl, skip.identitySourceUrl])]; }
  else if (/^added_batch/.test(item.status)) item.status = "covered_existing";
  else if (!item.status) { item.status = "pending"; item.reason = "公开目录出现的型号；尚未完成大陆销售及独立SKU核验，不代表国行已发售。"; }
}
const list = [...inventory.values()], counts = list.reduce((acc, item) => ({ ...acc, [item.status]: (acc[item.status] ?? 0) + 1 }), {});
assert.ok(devices.length >= fixture.expectedDevices, "本批不得静默低于已核验基线");
assert.equal(new Set(devices.map(d => d.id)).size, devices.length);
for (const d of devices) {
  assert.ok(d.releaseYear >= 2017 && d.releaseYear <= 2026 && d.configurations.length);
  for (const c of d.configurations) assert.match(c.evidence.sourceSnapshotHash, /^[a-f0-9]{64}$/);
  if (d.specs.launchPrice) {
    assert.ok(d.configurations.some(c => d.specs.launchPrice.configuration === c.memory + " 运行内存 + " + c.storage + " 存储，国行"));
    assert.ok(getPriceConfiguration({ ...d, specs: Object.fromEntries(Object.entries(d.specs).map(([key, field]) => [key, field.value])) }, d.specs.launchPrice), d.id + ": 首发价格配置绑定失败");
  }
}
await fs.writeFile("src/data/samsung-batch5-devices-db.json", JSON.stringify({ metadata: { version: "1.0", totalDevices: devices.length, scope: fixture.scope,
  skipped, catalogEvidence, catalogGaps, coverageInventory: list, coverageCounts: counts,
  pending: list.filter(i => i.status === "pending"), blocked: list.filter(i => i.status === "blocked"),
  catalogLimit: fixture.metadata.catalogLimit, imageLicense: "unknown" }, devices }, null, 2) + "\n");
await fs.writeFile("src/data/samsung-batch5-sources.json", JSON.stringify(sources, null, 2) + "\n");
console.log(JSON.stringify({ total: devices.length, configurations: devices.reduce((n, d) => n + d.configurations.length, 0), coverageCounts: counts, skipped }, null, 2));

// ponytail: 同一个静态行解析器生成交接证据，不改旧设备，不额外恢复页面未写的UFS或One UI版本。
const repairs = [];
for (const item of fixture.officialRepairTargets ?? []) {
  const page = await getSourceSnapshot(item.sourceUrl, options), rows = samsungProductRows(page.html);
  assert.equal(plainText(page.html.match(/<h1[^>]*>([^]*?)<\/h1>/)?.[1] ?? ""), item.name);
  assert.ok(page.html.includes('value="' + item.code + '"') && /CH[CN]$/.test(item.code));
  assert.equal(rows.get("内存(GB)"), item.ram); assert.equal(rows.get("存储 (GB)"), item.rom);
  assert.ok(rows.get("类型") && rows.get("类型 (外屏)")); assert.equal(rows.get("OS"), "Android");
  const display = "主屏：" + rows.get("类型") + "；外屏：" + rows.get("类型 (外屏)");
  repairs.push({ id: item.id, modelName: "Samsung " + item.name, market: "CN", modelCode: item.code,
    configuration: { memory: item.ram + "GB", storage: item.rom + "GB" },
    sourcePageType: "expanded_core_spec_snapshots", sourceInputKind: "official_cn_exact_sku_static_spec_rows",
    referenceUrls: [page.url], fetchedAt: page.fetchedAt, sourceSnapshotHash: page.sha256,
    specs: { operatingSystem: { ...evidence(page, "Android", "OS Android"), note: "只核验官方当前参数的generic Android，不声称原始出厂Android/One UI数字版本。" },
      displayType: evidence(page, display, "类型 " + rows.get("类型") + "；类型 (外屏) " + rows.get("类型 (外屏)")) },
    unavailableFields: ["storageType", "memoryType", "launchOperatingSystemVersion"].map(field => ({ field,
      status: "no_official_value", reason: "所核验的官方单SKU静态规格未明确UFS、LPDDR或出厂One UI数字版本；保持隔离，不从记忆或更新手册补值。" })),
    specRows: Object.fromEntries(rows), note: "本文件仅为root修复历史字段的正式原文证据，不代表核验所有规格；未改历史DB。" });
}
const rejectedPages = [];
for (const url of fixture.officialRepairRejectedUrls ?? []) {
  const page = await getSourceSnapshot(url, options);
  rejectedPages.push({ sourceUrl: url, fetchedAt: page.fetchedAt, sourceSnapshotHash: page.sha256,
    observedTitle: plainText(page.html.match(/<title[^>]*>([^]*?)<\/title>/)?.[1] ?? ""),
    reason: /fold6/.test(url) ? "家族规格页只有标签/交互入口，不能从标签补不存在的实际参数值；使用准确CHC商用单SKU页替代。"
      : "旧款家族地址现在返回新款Z系列内容；型号不匹配，不能用来修旧Fold5/Flip5。" });
}
await fs.writeFile("scripts/fixtures/samsung-official-field-repairs.json", JSON.stringify({ metadata: {
  scope: "仅Fold5/Fold6/Flip5旧页面复制风险的大陆CHC单SKU官方字段修复证据", repairs: repairs.length,
  boundary: "仅specs内字段可直接补回；specRows是原始上下文不是全字段验收，缺值保持缺失。" }, repairs, rejectedPages }, null, 2) + "\n");

async function importVerified(row, marketPage, marketRaw) {
  const page = await getSourceSnapshot(row.productUrl ?? `https://detail.zol.com.cn/${Math.floor(row.productId / 1000) + 1}/${row.productId}/param.shtml`, options);
  const title = plainText(row.kind === "official-marketing" ? page.html.match(/<title[^>]*>([^]*?)<\/title>/)?.[1]
    : page.html.match(/<h1[^>]*>([^]*?)<\/h1>/)?.[1] ?? "");
  assert.ok((row.pageNames ?? [row.name]).some(n => normalize(n) === normalize(title.replace(/参数$/, ""))), row.name + ": 具体页面型号不匹配 " + title);
  const official = row.kind === "official", rows = official ? samsungProductRows(page.html) : zolRows(page.html), specs = {};
  if (official) {
    const ram = rows.get("内存(GB)"), rom = rows.get("存储 (GB)");
    assert.match(ram ?? "", /^\d+(?:GB)?$/); assert.match(rom ?? "", /^\d+(?:GB)?$/);
    assert.ok(row.pairs.some(([r, s]) => r === ram.replace(/GB$/, "") + "GB" && s === rom.replace(/GB$/, "") + "GB"), "官方单SKU容量不在大陆发售配置清单");
    const code = page.html.match(/id="modelCode"[^>]*value="([^"]+)"/)?.[1];
    assert.ok(code && /(?:CHN|CHC)$/.test(code) && page.url.toLowerCase().includes(code.toLowerCase()), "缺少精确国行SKU身份");
    if (row.category === "tablet") assert.equal(/(?:^|\s)5G$/.test(title), row.variant === "5g", "网络版本身份冲突");
  }
  if (row.singleCapacityPair) {
    assert.equal(row.pairs.length, 1);
    assert.equal(readSingleCapacity(rows.get("系统内存") ?? rows.get("RAM容量")), row.pairs[0][0]);
    assert.equal(readSingleCapacity(rows.get("存储容量") ?? rows.get("ROM容量")), row.pairs[0][1]);
  }
  function field(key, labels, convert = v => v, unit) {
    const label = labels.find(k => rows.has(k)); if (!label) return;
    const value = convert(rows.get(label));
    if (value !== undefined && value !== null && value !== "") specs[key] = { ...evidence(page, value, label + " " + rows.get(label)), ...(unit ? { unit } : {}) };
  }
  field("chip", ["CPU型号", "处理器型号"]);
  field("screenSize", ["尺寸", "屏幕尺寸"], v => Number(v.match(/\d+(?:\.\d+)?/)?.[0]) || undefined, "inch");
  field("displayType", ["类型", "屏幕材质", "屏幕类型", "屏幕描述"], v => /第二代动态AMOLED/.test(v) ? "Dynamic AMOLED 2X" : v.match(/(?:Super |Dynamic )?AMOLED(?: 2X)?|TFT|LCD|OLED|IPS/)?.[0]);
  field("resolution", ["分辨率", "屏幕分辨率"]);
  field("weight", ["重量 (g)", "重量"], v => Number(v.match(/\d+(?:\.\d+)?/)?.[0]) || undefined, "g");
  field("batteryCapacity", ["电池容量 (mAh, 典型值)", "电池容量", "电池类型"], v => Number(v.match(/\d+/)?.[0]) || undefined, "mAh");
  field("port", ["耳机接口", "机身接口", "数据接口"]);
  if (official) {
    field("rearCamera", ["后置摄像头 - 分辨率", "后置摄像头 - 分辨率 (多重)"]); field("frontCamera", ["前置摄像头 - 分辨率"]);
    field("wifi", ["WLAN（Wi-Fi）"]); field("bluetooth", ["蓝牙版本"]); field("dimensions", ["尺寸 (高*宽*厚, mm)"]);
    field("sim", ["卡槽类型"]);
  } else {
    const pixels = rows.get("像素") ?? rows.get("摄像头") ?? "";
    for (const [key, pattern] of [["rearCamera", /后置摄像头[^]*?(?=前置摄像头|$)/], ["frontCamera", /前置摄像头[^]*/]]) {
      const raw = pixels.match(pattern)?.[0]; if (raw) specs[key] = evidence(page, raw, "像素 " + pixels);
    }
  }
  const configurations = await Promise.all(row.pairs.map(async ([memory, storage, pattern, sourceUrl]) => {
    const pairPage = sourceUrl ? await getSourceSnapshot(sourceUrl, options) : marketPage;
    const raw = plainText(pairPage.html).match(new RegExp(pattern))?.[0];
    assert.ok(raw, row.name + ": 国行逐配置配对原文缺失");
    return { memory, storage, evidence: row.singleCapacityPair
      ? evidence(page, memory + " + " + storage, "系统内存 " + rows.get("系统内存") + "；存储容量 " + rows.get("存储容量"))
      : evidence(pairPage, memory + " + " + storage, raw) };
  }));
  const id = "samsung-" + row.slug + "-" + row.year;
  const device = { id, brand: "Samsung", market: "CN", category: row.category ?? "phone", series: row.family, family: row.family,
    variant: row.variant ?? "standard", modelName: "Samsung " + row.name, generation: row.name.replace(/^Galaxy /, ""), generationOrder: row.year,
    releaseYear: row.year, comparisonGroupId: "samsung." + (row.category ?? "phone") + "." + row.group + "." + (row.variant ?? "standard"), configurations, specs, computed: {} };
  const source = { id, modelName: device.modelName, generation: device.generation, releaseYear: row.year,
    sourcePageType: official ? "official_cn_single_sku_and_launch_configuration_snapshots" : row.kind === "official-marketing"
      ? "official_cn_model_marketing_and_launch_configuration" : row.kind === "article"
      ? "cn_sale_article_explicit_configurations_and_model_specs" : "cn_launch_configuration_and_selected_parameter_rows",
    sourceStatus: "verified", referenceUrls: [page.url, marketPage.url], releaseEvidence: evidence(marketPage, String(row.year), marketRaw),
    fieldGaps: [], notes: "独立配置来源为大陆正式发布原文；不从多值参数拆分猜测SKU。" };
  if (!official) source.fieldCorrections = [{ field: "memory", reason: row.correctionReason }, { field: "storage", reason: row.correctionReason },
    ...["operatingSystem", "memoryType", "storageType", "security", "sim", "waterResistance", "chargingMethod", "hasNFC", "wifi", "bluetooth"].map(field => ({ field, reason: "混淆页或多值页不继承未经独立核验的可选字段。" }))];
  if (official) {
    const buy = page.url.includes("/business/") ? page : await getSourceSnapshot(page.url + "buy/", options), code = page.html.match(/id="modelCode"[^>]*value="([^"]+)"/)?.[1];
    const candidates = [...buy.html.matchAll(/(?:data-src|src|data-desktop-src|data-mobile-src)=["']([^"']+)["']/g)].map(m => m[1])
      .filter(u => u.includes("/p6pim/cn/" + code.toLowerCase() + "/gallery/") && /images\.samsung\.com\.cn/.test(u));
    const src = candidates.find(u => /\$1164_776_PNG\$/.test(u)) ?? candidates[0];
    const color = rows.get("颜色") ?? row.imageColor;
    if (src && color) { const url = new URL(src, buy.url).href;
      source.productImage = { url, alt: device.modelName + " " + color, modelName: device.modelName, sourceUrl: buy.url,
        sourceName: "三星中国", fetchedAt: buy.fetchedAt, sourceSnapshotHash: buy.sha256 };
      source.colorGallery = { sourceUrl: buy.url, fetchedAt: buy.fetchedAt, sourceSnapshotHash: buy.sha256, colors: [{ name: color, url }] };
      source.colorNames = [color]; source.referenceUrls.push(buy.url);
      source.imageGaps = [{ field: "colorGallery", reason: "只核验该CHN/CHC单SKU配色；其他正式国行颜色尚待逐SKU原图绑定，不宣称全部配色。" }];
    }
  }
  const required = row.category === "tablet" ? ["chip", "memory", "storage", "launchPrice", "screenSize", "displayType", "resolution", "port"] : ["chip", "memory", "storage", "launchPrice", "displayType", "port", "rearCamera", "frontCamera"];
  source.fieldGaps = required.filter(field => !specs[field]).map(field => ({ field, reason: "未取得对应可信原文，留空；参数现价不作为首发价。" }));
  return { device, source };
}
