import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { importZolSeries, plainText, zolRows, extractZolProductImage, readSingleCapacity } from "./lib/zol-device.mjs";
import { getSourceSnapshot } from "./lib/source-snapshot.mjs";
import { readZolColors, readZolColorImages, readOfficialColorGallery } from "./lib/device-images.mjs";

const fixture = JSON.parse(await fs.readFile(new URL("./fixtures/android-five-year-batch4.json", import.meta.url), "utf8"));
const options = { offline: process.argv.includes("--offline"), refresh: process.argv.includes("--refresh") };
const manifest = JSON.parse(await fs.readFile(new URL("../src/data/device-data-manifest.json", import.meta.url), "utf8"));
const inventory = [], existing = [], devices = [], sources = [], blocked = [], pending = [], scopeChecks = [], catalogueEvidence = [];
const priorFixture = JSON.parse(await fs.readFile(new URL(`./fixtures/${fixture.pendingFromFixture}`, import.meta.url), "utf8"));
fixture.pendingCandidates = [...priorFixture.pendingCandidates, ...(fixture.articleCandidates ?? [])];
for (const dataset of manifest.datasets.filter((row) => ["OPPO", "vivo", "HONOR"].includes(row.brand) && !row.devices.includes("batch4"))) {
  const db = JSON.parse(await fs.readFile(new URL(`../src/data/${dataset.devices}`, import.meta.url), "utf8"));
  const refs = Object.values(JSON.parse(await fs.readFile(new URL(`../src/data/${dataset.sources}`, import.meta.url), "utf8"))).flat();
  existing.push(...db.devices);
  inventory.push(...db.devices.map((device) => ({ id: device.id, brand: device.brand, modelName: device.modelName, releaseYear: device.releaseYear, category: device.category, series: device.family, status: "present", sourceUrls: [...new Set([refs.find((ref) => ref.id === device.id)?.officialSpecUrl, ...(refs.find((ref) => ref.id === device.id)?.referenceUrls ?? [])].filter(Boolean))] })));
}
assert.ok(fixture.targets.length >= 20 && fixture.targets.length <= 30);
assert.equal(new Set(fixture.targets.map((row) => row.id)).size, fixture.targets.length);
assert.ok(fixture.targets.every((row) => !existing.some((device) => device.id === row.id)), "重复已有id");
const compact = (value) => value.replace(/[（(][^]*$/, "").replace(/参数$/, "").replace(/\s/g, "").toLowerCase();
assert.ok(fixture.targets.every((row) => !existing.some((device) => compact(device.modelName) === compact(row.modelName))), "重复已有实际型号");
const evidence = (page, value, rawText, official = false) => ({ value, rawText, evidenceKind: "excerpt", sourceUrl: page.url, sourceType: official ? "official" : "reference", confidence: official ? 1 : 0.8, verifiedAt: page.fetchedAt.slice(0, 10), fetchedAt: page.fetchedAt, sourceSnapshotHash: page.sha256 });
const license = { licenseStatus: "unknown", licenseNote: "仅核验型号与公开图片URL；未取得版权授权或核验商业使用许可，不默认具有转载许可。" };
const orders = new Map();
for (const row of fixture.targets) {
  const key = `${row.brand}.${row.family}`, generationOrder = (orders.get(key) ?? 0) + 1;
  orders.set(key, generationOrder);
  const officialSpecUrl = row.brand === "vivo" && row.modelName.startsWith("iQOO") ? row.officialSpecUrl?.replace("/iqoo/param/", "/vivo/param/iqoo").replace("iqooneo7racing", "iqooneo7js") : row.officialSpecUrl;
  const target = { ...row, category: row.category, series: row.family, variant: row.variant ?? "standard", generation: row.modelName.replace(/^(?:OPPO|vivo|荣耀)\s*/, ""), generationOrder, comparisonGroupId: `${row.brand.toLowerCase()}.${row.category}.${row.group}.${row.variant ?? "standard"}`, excludeVariants: row.excludeVariants ?? ["天玑版", "竞速版", "卫星", "典藏", "限定"], seriesUrl: `https://detail.zol.com.cn/series/${row.category === "tablet" ? 702 : 57}/${row.seriesId}_1.html`, ...(row.releaseFallback ? { releaseFallback: { ...row.releaseFallback, pattern: new RegExp(row.releaseFallback.rawPattern) } } : {}) };
  try {
    assert.ok(!row.verificationWarning, row.verificationWarning);
    const { device, source } = await importZolSeries(target, options);
    assert.ok((device.releaseDate || row.releaseDatePrecision === "year") && device.releaseYear === row.releaseYear, `${row.id}: 无完整日期或首售年份不符`);
    if (row.releaseDatePrecision === "year") {
      const page = await getSourceSnapshot(row.releaseEvidenceYear.sourceUrl, options), text = plainText(page.html), yearText = text.match(new RegExp(row.releaseEvidenceYear.yearPattern))?.[0], saleText = text.match(new RegExp(row.releaseEvidenceYear.rawPattern))?.[0];
      assert.ok(yearText && saleText && yearText.startsWith(String(device.releaseYear)), "年份精度的实际已售证据缺失");
      delete device.releaseDate;
      source.releaseEvidence = evidence(page, String(device.releaseYear), `${yearText}；${saleText}`);
      source.releaseDatePrecision = "year";
      source.releaseDateConflicts = [];
      for (const conflict of row.releaseDateConflicts) {
        const report = await getSourceSnapshot(conflict.sourceUrl, options), raw = plainText(report.html).match(new RegExp(conflict.rawPattern))?.[0];
        assert.ok(raw, "冲突日期报告缺少实际开售原文");
        source.releaseDateConflicts.push(evidence(report, conflict.date, raw)); source.referenceUrls.push(report.url);
      }
      source.notes += " 国行2024年已售；不同渠道报道出现10月16日上架开售/10月25日正式首销冲突，仅保留year精度，不挑选任意日。2023海外同名11.5英寸骁龙685不并入。";
      source.referenceUrls.push(page.url);
    }
    if (row.expectedChipPattern) for (const config of device.configurations) {
      const page = await getSourceSnapshot(config.evidence.sourceUrl, options), rows = zolRows(page.html);
      assert.match(rows.get("处理器型号") ?? rows.get("CPU型号") ?? "", new RegExp(row.expectedChipPattern), "同名海外SKU芯片不符");
      assert.equal(Number((rows.get("屏幕尺寸") ?? "").match(/\d+(?:\.\d+)?/)?.[0]), row.expectedScreenSize, "同名海外SKU屏幕尺寸不符");
    }
    for (const config of device.configurations) {
      const page = await getSourceSnapshot(config.evidence.sourceUrl, options), domestic = zolRows(page.html).get("国内发布时间");
      if (row.category === "tablet") continue;
      assert.ok(domestic && /20\d\d年/.test(domestic), `${row.id}: 缺国内发布时间，中文网页不足以证明国行`);
      source.marketEvidence ??= evidence(page, "中国大陆", `国内发布时间 ${domestic}`);
    }
    if (officialSpecUrl) {
      try {
        const page = await getSourceSnapshot(officialSpecUrl, options), text = plainText(page.html);
        const title = plainText(page.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
        const name = compact(row.modelName).replace(/^(?:oppo|vivo|荣耀)/, "");
        assert.ok(compact(title).includes(name) && /(?:RAM|运行内存|存储|容量|内存)/i.test(text) && /(?:电池|充电)/.test(text), "官网不是该型号可用规格页");
        source.officialSpecUrl = page.url;
        source.officialSpecEvidence = evidence(page, device.modelName, title, true);
        if (row.brand === "HONOR") { source.officialSpecSnapshotStatus = "technical_route_labels_only"; source.officialSpecSnapshotNote = "这是型号技术参数路由，不是产品展示页；当前静态HTML快照仅返回技术栏目标签，具体数值需JS/API加载。本批不将这些标签作为官网参数值证据，全部具体参数仍取逐SKU原文。"; }
        source.referenceUrls.push(page.url);
      } catch (error) { source.officialSpecGap = { attemptedUrl: officialSpecUrl, reason: error.message }; }
    }
    if (row.category === "tablet") {
      if (source.officialSpecUrl) source.marketEvidence = { ...source.officialSpecEvidence, value: "中国大陆", note: "制造商中国区域官方网站的型号规格页，并有独立SKU和实际已售日期；不是仅凭网页为中文认定国行。" };
      else if (row.officialProductUrl) {
        const page = await getSourceSnapshot(row.officialProductUrl, options), title = plainText(page.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
        const identityText = row.officialProductRawPattern ? plainText(page.html).match(new RegExp(row.officialProductRawPattern))?.[0] : title;
        assert.ok(identityText && compact(identityText).includes(compact(row.modelName)), "中国官网产品身份不符");
        source.officialProductUrl = page.url;
        source.referenceUrls.push(page.url);
        source.marketEvidence = evidence(page, "中国大陆", identityText, true);
        source.marketEvidence.note = "制造商中国区域产品/官方商城身份，结合实际首售报道和逐SKU参数核实国行；此页不具完整规格，不登记officialSpecUrl。";
      }
      assert.ok(source.marketEvidence, `${row.id}: 平板缺少已核实的制造商中国区域产品身份`);
    }
    let specialEvidence;
    if (row.specialEditionEvidence) {
      const page = await getSourceSnapshot(row.specialEditionEvidence.url, options), text = plainText(page.html).match(new RegExp(row.specialEditionEvidence.rawPattern))?.[0];
      assert.ok(text, "独立特别版证据缺失");
      specialEvidence = evidence(page, "独立特别版", text, true); source.specialEditionEvidence = specialEvidence; source.referenceUrls.push(page.url);
    }
    const overviewUrl = row.imageProductId ? `https://detail.zol.com.cn/cell_phone/index${row.imageProductId}.shtml` : target.seriesUrl;
    const overview = await getSourceSnapshot(overviewUrl, options);
    const galleryUrls = [...new Set([...overview.html.matchAll(/href=["']([^"']*\/picture_index_\d+\/index\d+_\d+_p\d+\.shtml)["']/g)].map((match) => new URL(match[1], overview.url).href))].slice(0, 2);
    const configurationPages = await Promise.all(device.configurations.map((config) => getSourceSnapshot(config.evidence.sourceUrl, options)));
    source.versionVerification = { variant: device.variant, checkedSkuTitles: configurationPages.map((page) => ({ title: plainText(page.html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? ""), sourceUrl: page.url, sourceSnapshotHash: page.sha256 })), excludedTitleTerms: target.excludeVariants, note: "独立SKU标题逐条核验，柔光/艺术/超轻/蜂窝等特殊版不并入标准；未明确网络类型的条目不推断WiFi-only。" };
    if (row.category === "tablet") {
      const listingHref = overview.html.match(/href=["']([^"']+param_\d+_0_1\.html)["']/)?.[1];
      const listing = listingHref ? await getSourceSnapshot(new URL(listingHref, overview.url).href, options) : overview;
      const excluded = new Map();
      for (const [, href, html] of `${overview.html}\n${listing.html}`.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
        const name = plainText(html), id = href.match(/\/tablepc\/index(\d+)\.shtml/)?.[1], term = target.excludeVariants.find((term) => name.includes(term));
        if (id && term && compact(name) === compact(row.modelName)) excluded.set(id, { name, term, sourceUrl: `https://detail.zol.com.cn/${Math.floor(Number(id) / 1000) + 1}/${id}/param.shtml`, sourceEvidence: evidence(listing, name, name) });
      }
      source.versionVerification.excludedVersionSkus = [...excluded.values()];
    }
    const declaredColors = configurationPages.flatMap((page) => (zolRows(page.html).get("机壳颜色") ?? "").split(/[,，、]/).map((name) => name.trim()).filter(Boolean));
    let imagePage = overview, colors = [...new Set([...readZolColors(overview.html), ...declaredColors])].map((name) => ({ name })), primary = extractZolProductImage(overview.html);
    const gaps = [];
    for (const url of galleryUrls) {
      try {
        const page = await getSourceSnapshot(url, options), entries = readZolColorImages(page.html, row.imageProductId ? { productId: row.imageProductId } : { seriesId: row.seriesId });
        if (entries.length) { colors = [...colors.map((color) => entries.find((entry) => entry.name === color.name) ?? color), ...entries.filter((entry) => !colors.some((color) => color.name === entry.name))]; imagePage = page; break; }
      } catch (error) { gaps.push(error.message); }
    }
    if (row.standardColorEvidence) {
      const page = await getSourceSnapshot(row.standardColorEvidence.sourceUrl, options), raw = plainText(page.html).match(new RegExp(row.standardColorEvidence.rawPattern))?.[0];
      assert.ok(raw, "标准/柔光配色划分缺少实际原文");
      source.standardColorEvidence = evidence(page, row.verifiedColors.join("、"), raw); source.referenceUrls.push(page.url);
      for (const name of row.verifiedColors) if (!colors.some((color) => color.name === name)) colors.push({ name });
    }
    const excludedColors = colors.filter((color) => (row.allowedColors && !row.allowedColors.includes(color.name)) || (row.excludeColors ?? []).some((entry) => entry.name === color.name))
      .map((color) => ({ name: color.name, reason: row.allowedColors ? "属于其他版型，不能并入此独立特别版" : row.excludeColors.find((entry) => entry.name === color.name).reason, ...(color.url ? { candidateImageUrl: color.url, sourceUrl: imagePage.url, sourceSnapshotHash: imagePage.sha256, ...license } : {}), ...(specialEvidence ? { evidence: specialEvidence } : {}), ...(source.standardColorEvidence ? { evidence: source.standardColorEvidence } : {}) }));
    colors = colors.filter((color) => !excludedColors.some((entry) => entry.name === color.name));
    if (row.allowedColors || excludedColors.length) primary = colors.find((color) => color.url);
    source.productImages = { modelName: device.modelName, seriesId: row.seriesId, ...(row.imageProductId ? { productId: row.imageProductId } : {}), sourceUrl: imagePage.url, sourceSnapshotHash: imagePage.sha256, fetchedAt: imagePage.fetchedAt, ...license,
      ...(primary ? { primary: { ...primary, modelName: device.modelName, sourceUrl: (row.allowedColors || excludedColors.length) ? imagePage.url : overview.url, sourceSnapshotHash: (row.allowedColors || excludedColors.length) ? imagePage.sha256 : overview.sha256, fetchedAt: imagePage.fetchedAt, ...license } } : {}),
      colors: colors.map((color) => color.url ? { ...color, modelName: device.modelName, sourceUrl: imagePage.url, sourceSnapshotHash: imagePage.sha256, fetchedAt: imagePage.fetchedAt, ...license } : color), galleryUrls, ...(excludedColors.length ? { excludedColors } : {}), gaps: [...gaps, ...(!primary ? ["真实对应主图未核实"] : []), ...colors.filter((color) => !color.url).map((color) => `${color.name}配色图未核实`)] };
    if (row.useOfficialColorGallery) {
      const page = await getSourceSnapshot(source.officialSpecUrl, options), gallery = readOfficialColorGallery(page.html, device, page.url);
      assert.ok(gallery.colors.length && gallery.colors.every((color) => color.url), "该型号官网完整配色图未核实");
      const photo = (entry) => ({ ...entry, modelName: device.modelName, sourceUrl: page.url, sourceSnapshotHash: page.sha256, fetchedAt: page.fetchedAt, ...license });
      source.productImages = { ...source.productImages, sourceUrl: page.url, sourceSnapshotHash: page.sha256, primary: photo(gallery.image), colors: gallery.colors.map(photo), gaps: [] };
    }
    source.referenceUrls = [...new Set([...source.referenceUrls, overviewUrl, ...galleryUrls])];
    for (const field of ["rearCamera", "frontCamera"]) if (!device.specs[field] && !source.fieldGaps.some((gap) => gap.field === field)) source.fieldGaps.push({ field, reason: "逐SKU来源没有可核验的摄像头像素原文，不按同系列或相似型号补齐" });
    source.notes += " 本批只收实际核验SKU，未推导配置组合；五年目录仍为持续扩展的有来源已知候选，图片版权许可未知。";
    devices.push(device); sources.push(source);
    for (const term of new Set(source.versionVerification.excludedVersionSkus?.map((sku) => sku.term) ?? [])) {
      const skus = source.versionVerification.excludedVersionSkus.filter((sku) => sku.term === term);
      const suffix = { "柔光": "soft-light", "艺术": "artist", "超轻": "lightweight", "限量": "limited", "限定": "limited", "LTE": "lte", "蜂窝": "cellular", "5G版": "5g", "全网通版": "cellular", "悦享": "special" }[term] ?? "special";
      pending.push({ id: `${row.id}-${suffix}`, brand: row.brand, modelName: `${row.modelName} ${term}版`, releaseYear: null, parentListedYear: row.releaseYear, category: "tablet", series: row.family, status: "pending", reason: "特殊版在真实逐SKU目录独立列出，已从标准版排除；其国行首售、准确配置和版本专属图片本批尚未开展，不继承基型日期", listedConfigurations: skus, sourceUrls: [...new Set(skus.flatMap((sku) => [sku.sourceEvidence.sourceUrl, sku.sourceUrl]))], sourceEvidence: skus[0].sourceEvidence, marketVerification: "基型国行已核验，独立特殊版尚未开展", yearBasis: "特殊版独立首售年份未知，不继承基型年份" });
    }
    inventory.push({ id: row.id, brand: row.brand, modelName: device.modelName, releaseYear: device.releaseYear, category: device.category, series: row.family, status: "added", sourceUrls: source.referenceUrls });
    console.log(`${row.id}: ${device.releaseDate ?? `${device.releaseYear}(year精度)`} ${device.configurations.length}SKU ${source.productImages.colors.filter((color) => color.url).length}/${source.productImages.colors.length}图 官网${Boolean(source.officialSpecUrl)}`);
  } catch (error) {
    const record = { id: row.id, brand: row.brand, modelName: row.modelName, releaseYear: row.releaseYear, category: row.category, series: row.family, status: "blocked", reason: row.observedFailure?.reason ?? error.message, ...(row.observedFailure ? { diagnostic: row.observedFailure.diagnostic, replayError: error.message } : {}), sourceUrls: [target.seriesUrl, ...(row.verificationUrls ?? []), ...(row.observedFailure ? [row.observedFailure.diagnostic.sourceUrl] : [])] };
    blocked.push(record); inventory.push(record); console.log(`BLOCKED ${row.id}: ${error.message}`);
  }
}
const catalogueSeries = new Map();
for (const row of fixture.catalogues) {
  try {
    const page = await getSourceSnapshot(row.url, options), links = [...new Set([...page.html.matchAll(/\/series\/702\/(\d+)_1\.html/g)].map((match) => match[1]))];
    assert.ok(links.length, "实际响应没有系列导航（不可把搜索索引当成功抓取的目录）");
    catalogueEvidence.push({ brand: row.brand, category: "tablet", status: "verified_partial", sourceUrls: [page.url], seriesIds: links, evidence: evidence(page, links.length, page.html.match(/<a\b[^>]*href=["'][^"']*\/series\/702\/\d+_1\.html[^>]*>/)?.[0]), enumeration: "数量由此页实际可见唯一系列链接计算；仅公开导航，不包含隐藏历史目录和所有特殊SKU" });
    for (const seriesId of links) catalogueSeries.set(`${row.brand}.${seriesId}`, { brand: row.brand, seriesId, catalogueUrl: page.url });
  } catch (error) { catalogueEvidence.push({ ...row, category: "tablet", status: "blocked", reason: error.message, enumeration: "实际目录不可读，下面仅使用已核验的具体系列索引补充，仍partial" }); }
}
for (const row of fixture.extraCatalogueSeries ?? []) catalogueSeries.set(`${row.brand}.${row.seriesId}`, row);
const entries = [...catalogueSeries.values()];
for (let offset = 0; offset < entries.length; offset += 3) {
  const records = await Promise.all(entries.slice(offset, offset + 3).map(async (row) => {
    const url = `https://detail.zol.com.cn/series/702/${row.seriesId}_1.html`;
    try {
      const page = await getSourceSnapshot(url, options), title = plainText(page.html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
      assert.ok(title && /Pad|平板|Waterplay/i.test(title), "目录系列没有可核验的平板型号h1");
      let intro = plainText(page.html).match(/系列平板电脑，是[^。]+/)?.[0], year = Number(intro?.match(/(20\d{2})年/)?.[1]) || null, yearPage = page;
      if (!year) {
        const id = page.html.match(/\/tablepc\/index(\d+)\.shtml/)?.[1];
        if (id) {
          try {
            const detail = await getSourceSnapshot(`https://detail.zol.com.cn/${Math.floor(Number(id) / 1000) + 1}/${id}/param.shtml`, options);
            const name = plainText(detail.html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
            assert.equal(compact(name), compact(title), "历史型号参数身份不符");
            const rows = zolRows(detail.html), raw = rows.get("上市时间") ?? rows.get("上市日期");
            if (raw?.match(/20\d{2}年/)) { intro = `上市时间 ${raw}`; year = Number(raw.match(/20\d{2}/)[0]); yearPage = detail; }
          } catch { /* 仅范围枚举，未知年份留空且不宣称属于2022以后。 */ }
        }
      }
      return { id: `${row.brand.toLowerCase()}-tablet-catalogue-${row.seriesId}`, brand: row.brand, modelName: title, releaseYear: year, category: "tablet", series: /MagicPad/i.test(title) ? "荣耀MagicPad" : /平板X/.test(title) ? "荣耀平板X" : /平板V/.test(title) ? "荣耀平板V" : /平板GT/.test(title) ? "荣耀平板GT" : /Pad Air/i.test(title) ? `${row.brand === "vivo" && /^iQOO/.test(title) ? "iQOO" : row.brand} Pad Air` : /^iQOO/.test(title) ? "iQOO Pad" : row.brand === "HONOR" ? "荣耀平板" : `${row.brand} Pad`, seriesId: row.seriesId, sourceUrls: [...new Set([row.catalogueUrl, page.url, yearPage.url])], sourceEvidence: evidence(page, title, title), ...(intro ? { listedYearEvidence: evidence(yearPage, year, intro) } : {}), marketVerification: "尚未开展", yearBasis: "目录或参数年份，不等于中国大陆首售年份；未知年份未假定属于五年范围" };
    } catch (error) { return { id: `${row.brand.toLowerCase()}-tablet-catalogue-${row.seriesId}`, ...row, category: "tablet", status: "blocked", reason: `目录系列实际检查失败：${error.message}`, sourceUrls: [row.catalogueUrl, url] }; }
  }));
  for (const record of records) {
    const present = inventory.find((row) => row.sourceUrls?.includes(record.sourceUrls.at(-1)) || (row.modelName && record.modelName && compact(row.modelName) === compact(record.modelName)));
    if (present) { present.catalogueSourceUrls = record.sourceUrls; continue; }
    if (record.releaseYear && record.releaseYear < 2022) { scopeChecks.push({ ...record, status: "outsideScope", reason: "目录原文明确推出年份早于2022，不纳入本次五年范围" }); continue; }
    if (record.status === "blocked") blocked.push(record);
    else pending.push({ ...record, status: "pending", reason: "仅完成目录实际枚举；国行首售日期、网络/柔光等独立版型、逐SKU及图片尚未开展，不宣称已售或完整覆盖" });
  }
}
for (const row of fixture.pendingCandidates.filter((row) => !existing.some((device) => device.id === row.id) && !devices.some((device) => device.id === row.id) && !blocked.some((device) => device.id === row.id))) {
  try {
    const page = await getSourceSnapshot(row.sourceUrl, options), title = plainText(page.html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
    if (!row.articlePattern) assert.equal(compact(title), compact(row.modelName));
    const params = zolRows(page.html), intro = plainText(page.html).match(/系列手机，是[^。]+/)?.[0] ?? `${params.has("上市日期") ? "上市日期" : "国内发布时间"} ${params.get("上市日期") ?? params.get("国内发布时间")}`;
    const article = row.articlePattern ? plainText(page.html).match(new RegExp(row.articlePattern))?.[0] : undefined;
    if (row.articlePattern) assert.ok(article, "候选报道身份年份原文不符");
    const published = row.articleYearPattern ? plainText(page.html).match(new RegExp(row.articleYearPattern))?.[0] : undefined;
    const year = Number((published ?? article ?? intro).match(/(20\d{2})(?:年|\/|-)/)?.[1]); assert.equal(year, row.releaseYear);
    pending.push({ ...row, category: row.category ?? "phone", series: row.family, status: "pending", reason: "仅核验候选目录或报道身份年份；国行实际首售、独立SKU与配色本批尚未开展", sourceUrls: [page.url], sourceEvidence: evidence(page, row.modelName, article ?? title), listedYearEvidence: evidence(page, year, published ?? article ?? intro), yearBasis: row.articlePattern ? "发布报道年份；首售尚未核验" : "目录或参数年份；首售尚未核验", marketVerification: "尚未核验" });
  } catch (error) { blocked.push({ ...row, category: row.category ?? "phone", series: row.family, status: "blocked", reason: `候选目录实际核验失败：${error.message}`, sourceUrls: [row.sourceUrl] }); }
}
inventory.push(...pending, ...blocked.filter((row) => !inventory.some((entry) => entry.id === row.id)));
for (const row of fixture.scopeChecks) {
  const page = await getSourceSnapshot(row.sourceUrl, options), rawText = plainText(page.html).match(new RegExp(row.rawPattern))?.[0];
  assert.ok(rawText, `${row.modelName}: 范围排除必须有原文`);
  scopeChecks.push({ ...row, evidence: evidence(page, row.status, rawText) });
}
assert.ok(devices.length >= 20, "本批已核验不足20款");
const validations = new Map(["OPPO", "vivo", "HONOR"].map((brand) => [brand, { offline: options.offline, specFieldsChecked: 0, fieldHashesChecked: 0, configurationsChecked: 0, imagePageHashesChecked: 0, configurationMethod: "原始独立SKU页h1 + RAM/ROM单值 + 特殊版标题排除；无汇总首值或交叉相乘", coreFieldGapsComplete: true, sourcePageType: "expanded_core_spec_snapshots" }]));
const checkedPages = new Map();
const snapshot = (url) => { if (!checkedPages.has(url)) checkedPages.set(url, getSourceSnapshot(url, { offline: true })); return checkedPages.get(url); };
for (const device of devices) {
  const source = sources.find((row) => row.id === device.id), check = validations.get(device.brand), target = fixture.targets.find((row) => row.id === device.id);
  const urls = new Set([source.officialSpecUrl, ...source.referenceUrls].filter(Boolean));
  assert.equal(source.sourcePageType, "expanded_core_spec_snapshots");
  check.specFieldsChecked += Object.keys(device.specs).length;
  assert.equal(source.releaseEvidence.value, device.releaseDate ?? String(device.releaseYear));
  assert.ok((device.releaseDate ? device.releaseDate <= "2026-10-06" : source.releaseDatePrecision === "year") && device.market === "CN" && source.marketEvidence);
  for (const field of [...Object.values(device.specs), ...device.configurations.map((config) => config.evidence), source.releaseEvidence, source.marketEvidence, source.officialSpecEvidence, source.standardColorEvidence, ...(source.releaseDateConflicts ?? [])].filter(Boolean)) {
    assert.ok(urls.has(field.sourceUrl) && field.rawText?.trim() && field.fetchedAt && field.verifiedAt, `${device.id}: 字段登记或原文缺失`);
    const page = await snapshot(field.sourceUrl);
    assert.equal(field.sourceSnapshotHash, page.sha256, `${device.id}: 字段快照hash不符`);
    const text = `${plainText(page.html)} ${[...zolRows(page.html)].map(([key, value]) => `${key} ${value}`).join(" ")}`.replace(/\s/g, "");
    for (const part of field.rawText.split("；")) assert.ok(text.includes(part.replace(/\s/g, "")), `${device.id}: 字段原文不在声明快照中：${part}`);
    check.fieldHashesChecked++;
  }
  for (const config of device.configurations) {
    const page = await snapshot(config.evidence.sourceUrl), rows = zolRows(page.html);
    const title = plainText(page.html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
    assert.equal(compact(title), compact(device.modelName), `${device.id}: 独立SKU型号身份错误`);
    assert.ok(!(target.excludeVariants ?? []).some((term) => title.includes(term)), `${device.id}: 特殊版错误合并`);
    const memory = rows.get("RAM容量") ?? rows.get("系统内存") ?? rows.get("内存容量"), storage = rows.get("ROM容量") ?? rows.get("存储容量") ?? rows.get("硬盘容量");
    assert.equal(readSingleCapacity(memory), config.memory, `${device.id}: RAM逐SKU事实不符`);
    assert.equal(readSingleCapacity(storage), config.storage, `${device.id}: ROM逐SKU事实不符`);
    check.configurationsChecked++;
  }
  const required = device.category === "phone" ? ["chip", "memory", "storage", "launchPrice", "displayType", "port", "rearCamera", "frontCamera"] : ["chip", "memory", "storage", "launchPrice", "screenSize", "displayType", "resolution", "port", "rearCamera", "frontCamera"];
  for (const field of required) assert.ok(device.specs[field] || source.fieldGaps.some((gap) => gap.field === field && gap.reason?.trim()), `${device.id}.${field}: 核心缺口未登记`);
  assert.equal(new Set(source.fieldGaps.map((gap) => gap.field)).size, source.fieldGaps.length);
  for (const gap of source.fieldGaps) assert.equal(device.specs[gap.field], undefined, `${device.id}: 缺口与已填值矛盾`);
  for (const entry of [source.productImages.primary, ...source.productImages.colors.filter((color) => color.url)].filter(Boolean)) {
    assert.equal(entry.modelName, device.modelName);
    assert.equal(entry.licenseStatus, "unknown");
    assert.ok(urls.has(entry.sourceUrl));
    const page = await snapshot(entry.sourceUrl); assert.equal(entry.sourceSnapshotHash, page.sha256);
    check.imagePageHashesChecked++;
  }
}
for (const [slug, brand] of [["oppo", "OPPO"], ["vivo", "vivo"], ["honor", "HONOR"]]) {
  const selected = devices.filter((device) => device.brand === brand), ids = new Set(selected.map((device) => device.id));
  const out = (value) => `${JSON.stringify(value, null, 2)}\n`;
  await fs.writeFile(new URL(`../src/data/${slug}-five-year-batch4-devices-db.json`, import.meta.url), out({ metadata: { version: "1.0", generatedAt: new Date().toISOString().slice(0, 10), totalDevices: selected.length, coverage: { market: "CN", minReleaseYear: 2022, asOf: "2026-10-06", scope: "持续扩展的来源已知候选；非品牌全量，未处理不等于不存在。" }, audit: { replayValidation: validations.get(brand), inventory: inventory.filter((row) => row.brand === brand), pending: pending.filter((row) => row.brand === brand), blocked: blocked.filter((row) => row.brand === brand), scopeChecks: scopeChecks.filter((row) => row.brand === brand), catalogueEvidence: catalogueEvidence.filter((row) => row.brand === brand), enumerationScope: { tablet: "ZOL品牌目录首屏和可见系列导航实际枚举；历史隐藏系列、教育版、海外/蜂窝/柔光等SKU不承诺穷尽；未知年份未假定属于五年范围", phone: "延续既有来源候选，仍partial", laptop: "本批未枚举，partial" }, differenceFromExisting: inventory.filter((row) => row.brand === brand && row.status !== "present"), statusMeaning: { present: "现有数据已收录", added: "本批已核验新增", pending: "SKU等关键证据本批未开展", blocked: "实际检查证据仍不能核验", outsideScope: "来源证实年份或市场在范围外" } } }, devices: selected }));
  await fs.writeFile(new URL(`../src/data/${slug}-five-year-batch4-sources.json`, import.meta.url), out(Object.fromEntries(["phone", "tablet", "laptop"].map((category) => [category, sources.filter((source) => ids.has(source.id) && selected.find((device) => device.id === source.id).category === category)]))));
}
console.log(`新增${devices.length}款/${devices.reduce((sum, device) => sum + device.configurations.length, 0)}SKU，pending${pending.length}，blocked${blocked.length}`);
