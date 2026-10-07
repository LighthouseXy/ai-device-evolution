import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { importZolSeries, plainText, zolRows, readSingleCapacity, extractZolProductImage } from "./lib/zol-device.mjs";
import { getSourceSnapshot } from "./lib/source-snapshot.mjs";
import { readOfficialAndroidSpecs } from "./lib/android-official-specs.mjs";
import { readOfficialColorGallery, readZolColors, readZolColorImages } from "./lib/device-images.mjs";

const fixture = JSON.parse(await fs.readFile(new URL("./fixtures/android-five-year-batch5.json", import.meta.url), "utf8"));
const options = { offline: process.argv.includes("--offline"), refresh: process.argv.includes("--refresh") };
const manifest = JSON.parse(await fs.readFile(new URL("../src/data/device-data-manifest.json", import.meta.url), "utf8"));
const prior = await Promise.all(["oppo", "vivo", "honor"].map(async slug => JSON.parse(await fs.readFile(new URL(`../src/data/${slug}-five-year-batch4-devices-db.json`, import.meta.url), "utf8"))));
const existing = [], existingSources = [];
for (const row of manifest.datasets.filter(row => ["OPPO", "vivo", "HONOR"].includes(row.brand) && !row.devices.includes("batch5"))) {
  existing.push(...JSON.parse(await fs.readFile(new URL(`../src/data/${row.devices}`, import.meta.url), "utf8")).devices);
  existingSources.push(...Object.values(JSON.parse(await fs.readFile(new URL(`../src/data/${row.sources}`, import.meta.url), "utf8"))).flat());
}
for (const db of prior) for (const d of db.devices) if (!existing.some(x => x.id === d.id)) existing.push(d);
const compact = value => value.replace(/参数$/, "").replace(/[\s()（）]/g, "").toLowerCase();
const evidence = (p, value, rawText, official = false, unit) => ({ value, ...(unit ? { unit } : {}), rawText, evidenceKind: "excerpt", sourceUrl: p.url, sourceType: official ? "official" : "reference", confidence: official ? 1 : 0.8, verifiedAt: p.fetchedAt.slice(0, 10), fetchedAt: p.fetchedAt, sourceSnapshotHash: p.sha256 });
const license = { licenseStatus: "unknown", licenseNote: "公开URL与产品身份已核验；未取得图片版权授权或商业转载许可。" };
const required = category => category === "phone" ? ["chip", "memory", "storage", "launchPrice", "displayType", "port", "rearCamera", "frontCamera"] : ["chip", "memory", "storage", "launchPrice", "screenSize", "displayType", "resolution", "port", "rearCamera", "frontCamera"];
const devices = [], sources = [], blocked = [], processed = new Set();
assert.equal(new Set(fixture.targets.map(t => t.id)).size, fixture.targets.length);
assert.ok(fixture.targets.length <= 30);
const titleOf = p => plainText(p.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
function officialRows(p) {
  const rows = new Map();
  for (const [, block] of p.html.matchAll(/<li\b[^>]*class="attr-item[^"]*"[^>]*>([\s\S]*?)<\/li>/g)) {
    const label = plainText(block.match(/<p\b[^>]*class="attr-item-name"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? "");
    const content = block.match(/class="more-text-content"[^>]*>([\s\S]*)/)?.[1] ?? "";
    if (label && content) rows.set(label, plainText(content));
  }
  return rows;
}
async function officialImport(row, page) {
  const text = plainText(page.html), title = titleOf(page), baseName = row.officialName ?? row.modelName;
  const titleAt = compact(title).indexOf(compact(baseName));
  assert.ok(titleAt >= 0 && !/^(?:pro|max|ultra|mini|\+)/.test(compact(title).slice(titleAt + compact(baseName).length)), "官网型号身份不符或为相邻高配型号");
  const rows = officialRows(page), specs = readOfficialAndroidSpecs(row.brand, page);
  let skuText, matches;
  if (row.brand === "vivo") {
    skuText = text.match(/建议零售价 ([^]*?)(?=上市时间)/)?.[0];
    assert.ok(skuText?.includes("全网通"), "缺国行全网通明确SKU段");
    matches = [...skuText.matchAll(/(?:(?:vivo|iQOO|Y|X)[^：]*?)?(\d+GB)\+(\d+(?:GB|TB))[\s）)]*(?:[（(](LPDDR5T限量版)[）)])?[：:](\d+(?:\.\d+)?)元/g)];
    assert.ok(matches.length, "官网没有明确成对价目SKU，不使用RAMROM聚合清单");
  } else {
    skuText = text.match(/运行内存容量 \+ 机身存储容量 ([^]*?)(?=RAM 规格)/)?.[0];
    matches = [...(skuText ?? "").matchAll(/(\d+GB)\+(\d+(?:GB|TB))/g)];
    assert.ok(matches.length && /入网型号[：:]/.test(text), "中国官网缺明确成对容量或入网型号");
  }
  const configurations = matches.filter(m => row.variant === "lpddr5t" ? Boolean(m[3]) : !m[3])
    .map(m => ({ memory: m[1], storage: m[2], evidence: evidence(page, m[1] + " + " + m[2], m[0], true) }));
  assert.ok(configurations.length && new Set(configurations.map(c => c.memory + "|" + c.storage)).size === configurations.length, "真实SKU为空或本版型容量重复");
  specs.memory = evidence(page, [...new Set(configurations.map(c => c.memory))].join(" / "), skuText, true);
  specs.storage = evidence(page, [...new Set(configurations.map(c => c.storage))].join(" / "), skuText, true);
  const read = (field, label, convert = value => value, unit) => {
    const raw = rows.get(label), value = raw && convert(raw);
    if (value !== undefined && value !== null && value !== "") specs[field] = evidence(page, value, label + " " + raw, true, unit);
  };
  if (row.brand === "vivo") {
    read("chip", "CPU型号"); read("gpu", "GPU（图形处理器）型号");
    read("screenSize", "尺寸（英寸）", v => Number(v.match(/\d+(?:\.\d+)?/)?.[0]), "inch");
    read("displayType", "屏幕材质"); read("resolution", "分辨率");
    read("refreshRate", "刷新率", v => Math.max(...[...v.matchAll(/(\d+)\s*Hz/g)].map(m => Number(m[1]))), "Hz");
    read("rearCamera", "后置摄像头像素"); read("frontCamera", "前置摄像头像素");
    read("batteryCapacity", "电池容量", v => Number(v.match(/典型容量[：:][^。]*?等效于(\d+)\s*mAh/)?.[1] ?? v.match(/典型容量[：:]\s*(\d+)\s*mAh/)?.[1]) || undefined, "mAh");
    read("port", "USB接口类型"); read("chargingMethod", "充电规格"); read("sim", "SIM卡类型");
    read("memoryType", "RAM类型"); read("storageType", "ROM类型"); read("operatingSystem", "操作系统"); read("security", "指纹识别");
    const os = text.match(/操作系统(?: 操作系统)? ([^]*?)(?=Jovi|数据连接)/)?.[0];
    if (os) specs.operatingSystem = evidence(page, os.replace(/^操作系统(?: 操作系统)? /, "").trim(), os, true);
    const nfc = rows.get("NFC");
    if (nfc && /^(?:支持|不支持)/.test(nfc)) specs.hasNFC = evidence(page, !nfc.startsWith("不支持"), "NFC " + nfc, true);
    if (rows.has("重量") && /^\d+(?:\.\d+)?g$/.test(rows.get("重量"))) read("weight", "重量", v => Number(v.match(/\d+(?:\.\d+)?/)?.[0]), "g");
    if (rows.has("RAM类型")) {
      const raw = rows.get("RAM类型");
      for (const config of configurations) {
        const type = row.variant === "lpddr5t" ? "LPDDR5T" : row.id === "vivo-x100-2023" ? "LPDDR5X" : row.id === "vivo-x100pro-2023" ? (config.storage === "1TB" ? "LPDDR5T" : "LPDDR5X") : raw;
        config.memoryType = type;
        config.memoryTypeEvidence = evidence(page, type, "RAM类型 " + raw, true);
      }
      if (row.id === "vivo-x100-2023" || row.variant === "lpddr5t") {
        specs.memoryType = evidence(page, row.variant === "lpddr5t" ? "LPDDR5T 四通道" : "LPDDR5X 四通道", "RAM类型 " + raw, true);
        specs.memoryType.note = "官方逐容量内存制式明确；普通版与16GB+1TB LPDDR5T限量版是独立device，未合并重复容量。";
      }
    }
  } else {
    const readText = (field, regex, convert = value => value, unit) => { const match = text.match(regex); if (match) { const value = convert(match[1]); if (value !== undefined) specs[field] = evidence(page, value, match[0], true, unit); } };
    readText("chip", /移动平台 ([^]*?)(?=GPU| 电池 )/);
    readText("screenSize", /显示 尺寸 (\d+(?:\.\d+)?) 英寸/, Number, "inch");
    readText("resolution", /分辨率 ([^]*?)(?=色域|色彩)/);
    readText("displayType", /类型 ([^]*?)(?=最高支持|最高|摄像头)/, v => /OLED|LCD|AMOLED/.test(v) ? v : undefined);
    readText("refreshRate", /类型 ([^]*?)(?=摄像头)/, v => Number(v.match(/(?:最高支持|[～~])\s*(\d+)\s*Hz/)?.[1]) || undefined, "Hz");
    readText("rearCamera", /摄像头 后置 ([^]*?)(?=前置)/);
    readText("frontCamera", /前置 (\d+ 万像素摄像头[^]*?)(?=支持[：:]|照片格式|视频拍摄|移动平台)/);
    readText("batteryCapacity", /电池容量 ([^]*?)(?=快速充电)/, v => Number(v.match(/典型(?:值|容量)[：:][^]*?等效于\s*(\d+)\s*mAh/)?.[1] ?? v.match(/典型容量[：:]\s*(\d+)\s*mAh/)?.[1] ?? v.match(/(\d+)\s*mAh[^]*?典型/)?.[1]) || undefined, "mAh");
    readText("sim", /SIM 卡类型 ([^]*?)(?=网络频段)/);
  }
  assert.ok(specs.chip && specs.screenSize && specs.rearCamera, "官网核心规格解析没有真实值");
  assert.ok(row.releaseFallback, "官方上市月份不等于首售日期，须独立首售证据");
  const sale = await getSourceSnapshot(row.releaseFallback.sourceUrl, options), raw = plainText(sale.html).match(new RegExp(row.releaseFallback.rawPattern))?.[0];
  assert.ok(raw && row.releaseFallback.releaseDate.slice(0, 4) === String(row.releaseYear), "独立首售证据缺失或年份错误");
  const device = { id: row.id, brand: row.brand, market: "CN", category: row.category, series: row.family, family: row.family, variant: row.variant ?? "standard", modelName: row.modelName, generation: baseName.replace(/^(?:OPPO|vivo|荣耀)\s*/, ""), generationOrder: row.releaseYear, releaseYear: row.releaseYear, releaseDate: row.releaseFallback.releaseDate, comparisonGroupId: row.brand.toLowerCase() + "." + row.category + "." + row.group + "." + (row.variant ?? "standard"), configurations, specs, computed: {} };
  const marketRaw = text.match(/全网通[（(][^）)]*[）)]/)?.[0] ?? text.match(/入网型号[：:]\w+/)?.[0];
  const source = { id: device.id, modelName: device.modelName, generation: device.generation, releaseYear: device.releaseYear, sourcePageType: "expanded_core_spec_snapshots", sourceStatus: "verified", officialSpecUrl: page.url, officialSpecEvidence: evidence(page, baseName, title, true), marketEvidence: evidence(page, "中国大陆", marketRaw, true), releaseEvidence: evidence(sale, device.releaseDate, raw), releaseDatePrecision: "day", configurationMethod: "中国官网明确成对价目SKU或运行内存+机身存储成对清单，不以聚合RAMROM交叉推导", configurationEvidence: configurations.map(c => c.evidence), referenceUrls: [page.url, sale.url], fieldGaps: [], notes: "官网静态实际规格与独立中国大陆SKU；真实首售证据优先于发布日，不声称完整五年覆盖。" };
  if (row.variant === "lpddr5t") source.variantEvidence = evidence(page, "LPDDR5T限量版", configurations[0].evidence.rawText, true);
  if (row.launch) {
    const launch = await getSourceSnapshot(row.launch.url, options), raw = plainText(launch.html).match(new RegExp(row.launch.rawPattern))?.[0];
    assert.ok(raw && configurations.some(c => c.memory === row.launch.memory && c.storage === row.launch.storage));
    specs.launchPrice = { ...evidence(launch, row.launch.value, raw, false, "CNY"), priceType: "launch", market: "中国大陆", configuration: row.launch.memory + " 运行内存 + " + row.launch.storage + " 存储，国行", condition: "中国大陆首次公开销售价格，非当前价/国补价" };
    source.referenceUrls.push(launch.url);
  }
  if (row.launchNewsUrl) {
    const launch = await getSourceSnapshot(row.launchNewsUrl, options), launchText = plainText(launch.html);
    const raw = launchText.match(new RegExp(baseName.replace(/[+]/g, "\\+") + "\\s*(?:有|12GB)[^。]*?(?:价格分别|售价分别)[^。]*。"))?.[0];
    const price = row.variant === "lpddr5t" ? 5099 : Number(matches[0][4]);
    assert.ok(raw?.includes(String(price)), "官方发布定价与本版型SKU不符");
    specs.launchPrice = { ...evidence(launch, price, raw, true, "CNY"), priceType: "launch", market: "中国大陆", configuration: configurations[0].memory + " 运行内存 + " + configurations[0].storage + " 存储，国行", condition: "中国大陆官方发布定价，非当前官网建议价或国补优惠价" };
    source.referenceUrls.push(launch.url);
  }
  return { device, source };
}
async function images(row, device, source, official) {
  let gallery, page = official, primaryPage = official;
  if (official && row.variant !== "lpddr5t") try { gallery = readOfficialColorGallery(official.html, device, official.url); } catch {}
  if (row.brand === "OPPO" && official && gallery?.colors.some(c => !c.url)) {
    try {
      const product = await getSourceSnapshot(official.url.replace(/specs\/$/, ""), options), more = readOfficialColorGallery(product.html, device, product.url);
      const plainColor = name => name.replace(/[（(][^）)]*[）)]/g, "").trim();
      gallery.colors = gallery.colors.map(c => { const image = more.colors.find(x => plainColor(x.name) === plainColor(c.name) && x.url); return image ? { ...image, name: plainColor(c.name), imagePage: product } : c; });
      source.referenceUrls.push(product.url);
    } catch { /* 官网展示页没有逐色可核验映射时保留图片缺口。 */ }
  }
  if (gallery?.image && gallery.colors.some(c => !c.url) && row.seriesId) {
    const overview = await getSourceSnapshot("https://detail.zol.com.cn/series/57/" + row.seriesId + "_1.html", options);
    assert.equal(compact(plainText(overview.html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "")), compact(device.modelName));
    const urls = [...new Set([...overview.html.matchAll(/href=["']([^"']*\/picture_index_\d+\/index\d+_\d+_p\d+\.shtml)["']/g)].map(m => new URL(m[1], overview.url).href))].slice(0, 2);
    source.referenceUrls.push(overview.url);
    for (const url of urls) try {
      const p = await getSourceSnapshot(url, options), colors = readZolColorImages(p.html, { seriesId: row.seriesId });
      const colorName = name => name.replace(/[（(][^）)]*[）)]/g, "").trim();
      gallery.colors = gallery.colors.map(c => { const image = colors.find(x => colorName(x.name) === colorName(c.name) && x.url); return !c.url && image ? { ...image, name: colorName(c.name), imagePage: p } : c; });
      source.referenceUrls.push(url);
      if (gallery.colors.every(c => c.url)) break;
    } catch { /* 图库仍不可核验的标准色保留缺口。 */ }
  }
  if (!gallery?.image && row.seriesId) {
    page = await getSourceSnapshot("https://detail.zol.com.cn/series/" + (row.category === "tablet" ? 702 : 57) + "/" + row.seriesId + "_1.html", options);
    primaryPage = page;
    gallery = { image: extractZolProductImage(page.html), colors: readZolColors(page.html).map(name => ({ name })) };
    const urls = [...new Set([...page.html.matchAll(/href=["']([^"']*\/picture_index_\d+\/index\d+_\d+_p\d+\.shtml)["']/g)].map(m => new URL(m[1], page.url).href))].slice(0, 2);
    for (const url of urls) try { const p = await getSourceSnapshot(url, options), colors = readZolColorImages(p.html, { seriesId: row.seriesId }); if (colors.length) { gallery.colors = gallery.colors.map(c => colors.find(x => x.name === c.name) ?? c); if (!gallery.colors.length) gallery.colors = colors; page = p; break; } } catch {}
    source.referenceUrls.push(primaryPage.url, page.url, ...urls);
  }
  gallery ??= { colors: [] };
  const excludedColors = gallery.colors.filter(c => (row.excludeColors ?? []).some(x => x.name === c.name)).map(c => ({ ...c, reason: row.excludeColors.find(x => x.name === c.name).reason }));
  gallery.colors = gallery.colors.filter(c => !excludedColors.some(x => x.name === c.name));
  const photo = (entry, origin = entry.imagePage ?? page) => { const image = { ...entry }; delete image.imagePage; return { ...image, modelName: device.modelName, sourceUrl: origin.url, sourceSnapshotHash: origin.sha256, fetchedAt: origin.fetchedAt, ...license }; };
  source.productImages = { modelName: device.modelName, ...(row.seriesId ? { seriesId: row.seriesId } : {}), ...(page ? { sourceUrl: page.url, sourceSnapshotHash: page.sha256, fetchedAt: page.fetchedAt } : {}), ...license, ...(gallery.image ? { primary: photo(gallery.image, primaryPage) } : {}), colors: gallery.colors.map(c => c.url ? photo(c) : c), ...(excludedColors.length ? { excludedColors } : {}), gaps: [...(!gallery.image ? [row.variant === "lpddr5t" ? "官网基型图库没有逐限量SKU配色映射，限量版不直接沿用普通版主图/颜色；图证待核验。" : "真实对应主图未核实"] : []), ...gallery.colors.filter(c => !c.url).map(c => c.name + "配色图未核实")] };
  if (official && row.variant === "lpddr5t") source.productImages.candidateGallery = { sourceUrl: official.url, sourceSnapshotHash: official.sha256, note: "官网图属于X100基型，仅候选，不注册为限量版验证图。", ...license };
}
for (const row of fixture.targets) {
  if (existing.some(d => d.id === row.id || compact(d.modelName) === compact(row.modelName))) { console.log("PRESENT " + row.id); continue; }
  processed.add(row.id);
  try {
    let page;
    if (row.officialSpecUrl) page = await getSourceSnapshot(row.officialSpecUrl, options);
    const target = { ...row, series: row.family, variant: row.variant ?? "standard", generation: row.modelName.replace(/^(OPPO|vivo|荣耀)\s*/, ""), generationOrder: row.releaseYear, comparisonGroupId: row.brand.toLowerCase() + "." + row.category + "." + row.group + "." + (row.variant ?? "standard"), seriesUrl: "https://detail.zol.com.cn/series/" + (row.category === "tablet" ? 702 : 57) + "/" + row.seriesId + "_1.html", excludeVariants: ["柔光", "艺术", "竞速", "卫星", "典藏", "限定", "限量", "至尊"], ...(row.releaseFallback ? { releaseFallback: { ...row.releaseFallback, pattern: new RegExp(row.releaseFallback.rawPattern) } } : {}) };
    const { device, source } = row.officialImporter ? await officialImport(row, page) : await importZolSeries(target, options);
    assert.ok(device.releaseDate && device.releaseYear === row.releaseYear && device.releaseDate <= fixture.asOf, "缺实际首售完整日期或范围错误");
    if (!row.officialImporter) {
      const p = await getSourceSnapshot(device.configurations[0].evidence.sourceUrl, options), domestic = zolRows(p.html).get("国内发布时间");
      assert.ok(domestic?.match(/20\d{2}年/), "具体SKU缺国内发布时间，中文网页不足以证国行");
      source.marketEvidence = evidence(p, "中国大陆", "国内发布时间 " + domestic);
    }
    if (page && !row.officialImporter) {
      assert.ok(compact(titleOf(page)).includes(compact(row.modelName)), "官网规格身份错误");
      source.officialSpecUrl = page.url; source.officialSpecEvidence = evidence(page, row.modelName, titleOf(page), true); source.referenceUrls.push(page.url);
      if (row.brand === "HONOR") source.officialSpecSnapshotStatus = "technical_route_labels_only";
      if (row.officialWarning) source.withheldOfficialFields = { fields: row.withheldOfficialFields, reason: row.officialWarning, evidence: evidence(page, "withheld", plainText(page.html).match(/上市时间 2023年10月/)?.[0], true) };
      else Object.assign(device.specs, readOfficialAndroidSpecs(row.brand, page));
      if (row.preferOfficialCore) {
        const official = await officialImport(row, page);
        const keys = list => list.map(c => c.memory + "|" + c.storage).sort();
        assert.deepEqual(keys(official.device.configurations), keys(device.configurations), "官网成对配置与已核验逐SKU不一致，需人工核验");
        Object.assign(device.specs, official.device.specs);
        source.configurationEvidence = official.source.configurationEvidence;
        source.notes += " 核心参数优先采用中国官网实际静态值；官网成对SKU与ZOL逐SKU矩阵完全一致，缺失官方字段才保留独立ZOL事实。";
      }
    }
    await images(row, device, source, page);
    source.fieldGaps = required(row.category).filter(field => !device.specs[field]).map(field => ({ field, reason: field === "launchPrice" ? "当前官网建议零售价/参考报价可能调整，不自动当首发价；本配置独立发布定价原文尚未登记" : "已读真实来源中没有本版型可核验字段，留空而不借用同系列/海外同名" }));
    source.referenceUrls = [...new Set(source.referenceUrls)];
    devices.push(device); sources.push(source);
    console.log(row.id + ": " + device.releaseDate + " " + device.configurations.length + "SKU");
  } catch (error) { const record = { id: row.id, brand: row.brand, modelName: row.modelName, category: row.category, releaseYear: row.releaseYear, series: row.family, status: "blocked", reason: error.message, sourceUrls: [row.officialSpecUrl, row.sourceUrl, row.releaseFallback?.sourceUrl].filter(Boolean) }; blocked.push(record); console.log("BLOCKED " + row.id + ": " + error.message); }
}
const inventory = [...new Map(prior.flatMap(db => db.metadata.audit.inventory).map(row => [row.id, row])).values()].filter(row => !processed.has(row.id));
for (const row of inventory) if (existing.some(d => d.id === row.id || (row.modelName && compact(d.modelName) === compact(row.modelName)))) row.status = "present";
for (const device of existing) if (!inventory.some(row => row.id === device.id)) inventory.push({ id: device.id, brand: device.brand, modelName: device.modelName, category: device.category, releaseYear: device.releaseYear, series: device.family, status: "present", sourceUrls: existingSources.find(s => s.id === device.id)?.referenceUrls ?? [] });
for (const device of devices) inventory.push({ id: device.id, brand: device.brand, modelName: device.modelName, category: device.category, releaseYear: device.releaseYear, series: device.family, status: "added", sourceUrls: sources.find(s => s.id === device.id).referenceUrls });
inventory.push(...blocked);
const validation = new Map(["OPPO", "vivo", "HONOR"].map(b => [b, { offline: options.offline, specFieldsChecked: 0, fieldHashesChecked: 0, configurationsChecked: 0, imagePageHashesChecked: 0, sourcePageType: "expanded_core_spec_snapshots", configurationMethod: "官方明确成对SKU或ZOL单值逐SKU；限量版独立device，无容量首值/交叉相乘", coreFieldGapsComplete: true }]));
for (const device of devices) {
  const s = sources.find(s => s.id === device.id), row = fixture.targets.find(r => r.id === device.id), check = validation.get(device.brand), urls = new Set(s.referenceUrls);
  check.specFieldsChecked += Object.keys(device.specs).length;
  for (const field of [...Object.values(device.specs), ...device.configurations.flatMap(c => [c.evidence, c.memoryTypeEvidence]), ...(s.configurationEvidence ?? []), s.releaseEvidence, s.marketEvidence, s.officialSpecEvidence, s.variantEvidence, s.withheldOfficialFields?.evidence].filter(Boolean)) {
    assert.ok(urls.has(field.sourceUrl) && field.rawText?.trim() && field.verifiedAt && field.fetchedAt, device.id + ": 字段证据未登记");
    const p = await getSourceSnapshot(field.sourceUrl, { offline: true }); assert.equal(field.sourceSnapshotHash, p.sha256);
    const text = (plainText(p.html) + " " + [...zolRows(p.html)].map(([k, v]) => k + " " + v).join(" ")).replace(/\s/g, "");
    for (const raw of field.rawText.split("；")) assert.ok(text.includes(raw.replace(/\s/g, "")), device.id + ": 原文不在快照：" + raw);
    check.fieldHashesChecked++;
  }
  for (const c of device.configurations) {
    if (row.officialImporter) {
      assert.ok(readSingleCapacity(c.memory) === c.memory && readSingleCapacity(c.storage) === c.storage && c.evidence.rawText.includes(c.memory + "+" + c.storage));
      assert.equal(/LPDDR5T限量版/.test(c.evidence.rawText), row.variant === "lpddr5t", "限量SKU混并普通版");
    } else {
      const p = await getSourceSnapshot(c.evidence.sourceUrl, { offline: true }), rows = zolRows(p.html);
      const heading = plainText(p.html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
      assert.equal(compact(heading.replace(/[（(][^]*$/, "")), compact(device.modelName));
      assert.equal(readSingleCapacity(rows.get("RAM容量") ?? rows.get("系统内存") ?? rows.get("内存容量")), c.memory);
      assert.equal(readSingleCapacity(rows.get("ROM容量") ?? rows.get("存储容量") ?? rows.get("硬盘容量")), c.storage);
    }
    check.configurationsChecked++;
  }
  assert.equal(new Set(device.configurations.map(c => c.memory + "|" + c.storage)).size, device.configurations.length);
  for (const field of required(device.category)) assert.ok(device.specs[field] || s.fieldGaps.some(g => g.field === field && g.reason));
  for (const g of s.fieldGaps) assert.equal(device.specs[g.field], undefined);
  for (const img of [s.productImages.primary, ...s.productImages.colors.filter(c => c.url)].filter(Boolean)) {
    assert.equal(img.modelName, device.modelName); assert.equal(img.licenseStatus, "unknown"); assert.ok(urls.has(img.sourceUrl));
    const p = await getSourceSnapshot(img.sourceUrl, { offline: true }); assert.equal(img.sourceSnapshotHash, p.sha256); check.imagePageHashesChecked++;
  }
}
for (const [slug, brand] of [["oppo", "OPPO"], ["vivo", "vivo"], ["honor", "HONOR"]]) {
  const selected = devices.filter(d => d.brand === brand), ids = new Set(selected.map(d => d.id)), ownInventory = inventory.filter(r => r.brand === brand), out = value => JSON.stringify(value, null, 2) + "\n";
  const previousAudit = prior.find(db => db.devices[0]?.brand === brand)?.metadata.audit;
  const audit = { replayValidation: validation.get(brand), inventory: ownInventory, pending: ownInventory.filter(r => r.status === "pending"), blocked: ownInventory.filter(r => r.status === "blocked"), checkedThisBatchIds: fixture.targets.filter(r => r.brand === brand && processed.has(r.id)).map(r => r.id), inheritedBlockedIds: ownInventory.filter(r => r.status === "blocked" && !processed.has(r.id)).map(r => r.id), scopeChecks: previousAudit?.scopeChecks ?? [], catalogueEvidence: previousAudit?.catalogueEvidence ?? [], differenceFromExisting: ownInventory.filter(r => r.status !== "present"), enumerationScope: { phone: "既有来源候选及本批指定官网缺项，partial；未列出的型号不等于不存在", tablet: "沿用batch4实际品牌目录候选，partial；本批未重新扩展未知范围", laptop: "本批未开展，partial" }, statusMeaning: { present: "现库已收录", added: "本批真实证据已核验", pending: "未开展关键证据核验", blocked: "本批或继承的此前实际检查不能核验，不等同未做；inheritedBlockedIds明确未在本批重试" } };
  await fs.writeFile(new URL(`../src/data/${slug}-five-year-batch5-devices-db.json`, import.meta.url), out({ metadata: { version: "1.0", generatedAt: new Date().toISOString().slice(0, 10), totalDevices: selected.length, coverage: { market: "CN", minReleaseYear: 2022, asOf: fixture.asOf, scope: fixture.scope, partial: true }, audit }, devices: selected }));
  await fs.writeFile(new URL(`../src/data/${slug}-five-year-batch5-sources.json`, import.meta.url), out(Object.fromEntries(["phone", "tablet", "laptop"].map(category => [category, sources.filter(s => ids.has(s.id) && selected.find(d => d.id === s.id).category === category)]))));
}
console.log("新增" + devices.length + "款/" + devices.reduce((sum, d) => sum + d.configurations.length, 0) + "SKU，本批blocked" + blocked.length);
