import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { importZolSeries, plainText, zolRows, extractZolProductImage } from "./lib/zol-device.mjs";
import { getSourceSnapshot } from "./lib/source-snapshot.mjs";
import { readZolColors, readZolColorImages } from "./lib/device-images.mjs";

const fixture = JSON.parse(await fs.readFile(new URL("./fixtures/android-five-year-batch3.json", import.meta.url), "utf8"));
const options = { offline: process.argv.includes("--offline"), refresh: process.argv.includes("--refresh") };
const manifest = JSON.parse(await fs.readFile(new URL("../src/data/device-data-manifest.json", import.meta.url), "utf8"));
const inventory = [], existing = [], devices = [], sources = [], blocked = [], pending = [], scopeChecks = [];
for (const dataset of manifest.datasets.filter((row) => ["OPPO", "vivo", "HONOR"].includes(row.brand) && !row.devices.includes("batch3"))) {
  const db = JSON.parse(await fs.readFile(new URL(`../src/data/${dataset.devices}`, import.meta.url), "utf8"));
  const refs = Object.values(JSON.parse(await fs.readFile(new URL(`../src/data/${dataset.sources}`, import.meta.url), "utf8"))).flat();
  existing.push(...db.devices);
  inventory.push(...db.devices.map((device) => ({ id: device.id, brand: device.brand, modelName: device.modelName, releaseYear: device.releaseYear, series: device.family, status: "present", sourceUrls: [...new Set([refs.find((ref) => ref.id === device.id)?.officialSpecUrl, ...(refs.find((ref) => ref.id === device.id)?.referenceUrls ?? [])].filter(Boolean))] })));
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
  const target = { ...row, category: "phone", series: row.family, variant: row.variant ?? "standard", generation: row.modelName.replace(/^(?:OPPO|vivo|荣耀)\s*/, ""), generationOrder, comparisonGroupId: `${row.brand.toLowerCase()}.phone.${row.group}.${row.variant ?? "standard"}`, excludeVariants: row.excludeVariants ?? ["天玑版", "竞速版", "卫星", "典藏", "限定"], seriesUrl: `https://detail.zol.com.cn/series/57/${row.seriesId}_1.html`, ...(row.releaseFallback ? { releaseFallback: { ...row.releaseFallback, pattern: new RegExp(row.releaseFallback.rawPattern) } } : {}) };
  try {
    const { device, source } = await importZolSeries(target, options);
    assert.ok(device.releaseDate && device.releaseYear === row.releaseYear, `${row.id}: 无完整日期或首售年份不符`);
    for (const config of device.configurations) {
      const page = await getSourceSnapshot(config.evidence.sourceUrl, options), domestic = zolRows(page.html).get("国内发布时间");
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
        source.referenceUrls.push(page.url);
      } catch (error) { source.officialSpecGap = { attemptedUrl: officialSpecUrl, reason: error.message }; }
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
    let imagePage = overview, colors = readZolColors(overview.html).map((name) => ({ name })), primary = extractZolProductImage(overview.html);
    const gaps = [];
    for (const url of galleryUrls) {
      try {
        const page = await getSourceSnapshot(url, options), entries = readZolColorImages(page.html, row.imageProductId ? { productId: row.imageProductId } : { seriesId: row.seriesId });
        if (entries.length) { colors = [...colors.map((color) => entries.find((entry) => entry.name === color.name) ?? color), ...entries.filter((entry) => !colors.some((color) => color.name === entry.name))]; imagePage = page; break; }
      } catch (error) { gaps.push(error.message); }
    }
    const excludedColors = colors.filter((color) => (row.allowedColors && !row.allowedColors.includes(color.name)) || (row.excludeColors ?? []).some((entry) => entry.name === color.name))
      .map((color) => ({ name: color.name, reason: row.allowedColors ? "属于其他版型，不能并入此独立特别版" : row.excludeColors.find((entry) => entry.name === color.name).reason, ...(specialEvidence ? { evidence: specialEvidence } : {}) }));
    colors = colors.filter((color) => !excludedColors.some((entry) => entry.name === color.name));
    if (row.allowedColors || excludedColors.length) primary = colors.find((color) => color.url);
    source.productImages = { modelName: device.modelName, seriesId: row.seriesId, ...(row.imageProductId ? { productId: row.imageProductId } : {}), sourceUrl: imagePage.url, sourceSnapshotHash: imagePage.sha256, fetchedAt: imagePage.fetchedAt, ...license,
      ...(primary ? { primary: { ...primary, modelName: device.modelName, sourceUrl: (row.allowedColors || excludedColors.length) ? imagePage.url : overview.url, sourceSnapshotHash: (row.allowedColors || excludedColors.length) ? imagePage.sha256 : overview.sha256, fetchedAt: imagePage.fetchedAt, ...license } } : {}),
      colors: colors.map((color) => color.url ? { ...color, modelName: device.modelName, sourceUrl: imagePage.url, sourceSnapshotHash: imagePage.sha256, fetchedAt: imagePage.fetchedAt, ...license } : color), galleryUrls, ...(excludedColors.length ? { excludedColors } : {}), gaps: [...gaps, ...(!primary ? ["真实对应主图未核实"] : []), ...colors.filter((color) => !color.url).map((color) => `${color.name}配色图未核实`)] };
    source.referenceUrls = [...new Set([...source.referenceUrls, overviewUrl, ...galleryUrls])];
    source.notes += " 本批只收实际核验SKU，未推导配置组合；五年目录仍为持续扩展的有来源已知候选，图片版权许可未知。";
    devices.push(device); sources.push(source);
    inventory.push({ id: row.id, brand: row.brand, modelName: device.modelName, releaseYear: device.releaseYear, series: row.family, status: "added", sourceUrls: source.referenceUrls });
    console.log(`${row.id}: ${device.releaseDate} ${device.configurations.length}SKU ${colors.filter((color) => color.url).length}/${colors.length}图 官网${Boolean(source.officialSpecUrl)}`);
  } catch (error) {
    const record = { id: row.id, brand: row.brand, modelName: row.modelName, releaseYear: row.releaseYear, series: row.family, status: "blocked", reason: error.message, sourceUrls: [target.seriesUrl] };
    if (row.id === "oppo-k13-turbo-pro-2025") {
      record.configurationConflicts = [];
      for (const id of [2133486, 2134007, 2134008]) {
        const page = await getSourceSnapshot(`https://detail.zol.com.cn/${Math.floor(id / 1000) + 1}/${id}/param.shtml`, options), rows = zolRows(page.html);
        const title = plainText(page.html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
        record.configurationConflicts.push(evidence(page, "不收录冲突配置", `${title}；RAM容量 ${rows.get("RAM容量")}；ROM容量 ${rows.get("ROM容量")}`));
        record.sourceUrls.push(page.url);
      }
      record.reason += "；具体12GB/16GB标题与RAM行8GB冲突，不能用标题覆盖或首值绕过门禁；需独立真实SKU补证后再导入。";
    }
    blocked.push(record); inventory.push(record); console.log(`BLOCKED ${row.id}: ${error.message}`);
  }
}
for (const row of fixture.pendingCandidates.filter((row) => !existing.some((device) => device.id === row.id) && !devices.some((device) => device.id === row.id))) {
  try {
    const page = await getSourceSnapshot(row.sourceUrl, options), title = plainText(page.html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
    if (!row.articlePattern) assert.equal(compact(title), compact(row.modelName));
    const params = zolRows(page.html), intro = plainText(page.html).match(/系列手机，是[^。]+/)?.[0] ?? `${params.has("上市日期") ? "上市日期" : "国内发布时间"} ${params.get("上市日期") ?? params.get("国内发布时间")}`;
    const article = row.articlePattern ? plainText(page.html).match(new RegExp(row.articlePattern))?.[0] : undefined;
    if (row.articlePattern) assert.ok(article, "候选报道身份年份原文不符");
    const year = Number((article ?? intro).match(/(20\d{2})(?:年|\/)/)?.[1]); assert.equal(year, row.releaseYear);
    pending.push({ ...row, series: row.family, status: "pending", reason: "仅核验候选目录或报道身份年份；国行实际首售、独立SKU与配色本批尚未开展", sourceUrls: [page.url], sourceEvidence: evidence(page, row.modelName, article ?? title), listedYearEvidence: evidence(page, year, article ?? intro), yearBasis: row.articlePattern ? "发布报道年份；首售尚未核验" : "目录或参数年份；首售尚未核验", marketVerification: "尚未核验" });
  } catch (error) { blocked.push({ ...row, series: row.family, status: "blocked", reason: `候选目录实际核验失败：${error.message}`, sourceUrls: [row.sourceUrl] }); }
}
inventory.push(...pending, ...blocked.filter((row) => !inventory.some((entry) => entry.id === row.id)));
for (const row of fixture.scopeChecks) {
  const page = await getSourceSnapshot(row.sourceUrl, options), rawText = plainText(page.html).match(new RegExp(row.rawPattern))?.[0];
  assert.ok(rawText, `${row.modelName}: 范围排除必须有原文`);
  scopeChecks.push({ ...row, evidence: evidence(page, row.status, rawText) });
}
assert.ok(devices.length >= 20, "本批已核验不足20款");
for (const [slug, brand] of [["oppo", "OPPO"], ["vivo", "vivo"], ["honor", "HONOR"]]) {
  const selected = devices.filter((device) => device.brand === brand), ids = new Set(selected.map((device) => device.id));
  const out = (value) => `${JSON.stringify(value, null, 2)}\n`;
  await fs.writeFile(new URL(`../src/data/${slug}-five-year-batch3-devices-db.json`, import.meta.url), out({ metadata: { version: "1.0", generatedAt: new Date().toISOString().slice(0, 10), totalDevices: selected.length, coverage: { market: "CN", minReleaseYear: 2022, asOf: "2026-10-06", scope: "持续扩展的来源已知候选；非品牌全量，未处理不等于不存在。" }, audit: { inventory: inventory.filter((row) => row.brand === brand), pending: pending.filter((row) => row.brand === brand), blocked: blocked.filter((row) => row.brand === brand), scopeChecks: scopeChecks.filter((row) => row.brand === brand), differenceFromExisting: inventory.filter((row) => row.brand === brand && row.status !== "present"), statusMeaning: { present: "现有数据已收录", added: "本批已核验新增", pending: "SKU等关键证据本批未开展", blocked: "实际检查证据仍不能核验", outsideScope: "来源证实年份或市场在范围外" } } }, devices: selected }));
  await fs.writeFile(new URL(`../src/data/${slug}-five-year-batch3-sources.json`, import.meta.url), out({ phone: sources.filter((source) => ids.has(source.id)), tablet: [], laptop: [] }));
}
console.log(`新增${devices.length}款/${devices.reduce((sum, device) => sum + device.configurations.length, 0)}SKU，pending${pending.length}，blocked${blocked.length}`);
