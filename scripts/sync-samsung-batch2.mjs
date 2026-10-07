import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { importZolSeries, plainText, zolRows, readRelease, readSingleCapacity, extractZolProductImage } from "./lib/zol-device.mjs";
import { getSourceSnapshot } from "./lib/source-snapshot.mjs";
import { readZolColors, readZolColorImages } from "./lib/device-images.mjs";

const fixture = JSON.parse(await fs.readFile("scripts/fixtures/samsung-batch2-expansion.json", "utf8"));
const history = JSON.parse(await fs.readFile("scripts/fixtures/samsung-history-expansion.json", "utf8"));
const options = { offline: process.argv.includes("--offline"), refresh: process.argv.includes("--refresh") };
assert.ok(!(options.offline && options.refresh));
const existing = (await Promise.all(["samsung-devices-db", "samsung-history-devices-db"].map(async name =>
  JSON.parse(await fs.readFile(`src/data/${name}.json`, "utf8")).devices))).flat();
const devices = [], sources = { phone: [], tablet: [], laptop: [] }, skipped = [];
const modelIdentity = value => value.replace(/^Samsung[（(]三星[）)]|^Samsung|^三星/i, "")
  .replace(/\s*\d+(?:\.\d+)?GB\s*[+/][^]*$/i, "").replace(/[（(][^]*$/, "").replace(/系列$/, "")
  .replace(/\b(?:WLAN|WiFi|5G)\b/gi, "").replace(/[\s-]/g, "").toLowerCase();
const evidence = (page, value, rawText) => ({ value, rawText, evidenceKind: "excerpt", sourceUrl: page.url,
  sourceType: page.url.includes("samsung.com.cn") ? "official" : "reference", confidence: page.url.includes("samsung.com.cn") ? 1 : 0.8,
  verifiedAt: page.fetchedAt.slice(0, 10), fetchedAt: page.fetchedAt, sourceSnapshotHash: page.sha256 });
const families = { "galaxy-tab-s": "Samsung Galaxy Tab S", "galaxy-tab-s-plus": "Samsung Galaxy Tab S Plus",
  "galaxy-tab-s-ultra": "Samsung Galaxy Tab S Ultra", "galaxy-tab-s-lite": "Samsung Galaxy Tab S Lite",
  "galaxy-tab-a": "Samsung Galaxy Tab A", "galaxy-tab-a-plus": "Samsung Galaxy Tab A Plus", "galaxy-a5x": "Samsung Galaxy A5x",
  "galaxy-a6x": "Samsung Galaxy A6x", "galaxy-a7x": "Samsung Galaxy A7x", "galaxy-a8s": "Samsung Galaxy A8s",
  "galaxy-a9s": "Samsung Galaxy A9s", "galaxy-s-fe": "Samsung Galaxy S FE", "galaxy-s-edge": "Samsung Galaxy S Edge", "galaxy-s-e": "Samsung Galaxy S E" };
const seriesUrl = row => row.seriesId ? `https://detail.zol.com.cn/series/${row.category === "tablet" ? 702 : 57}/${row.seriesId}_1.html`
  : `https://detail.zol.com.cn/${row.category === "tablet" ? "tablepc" : "cell_phone"}/index${row.productId}.shtml`;
const launches = {
  "galaxy-s10e": [4999, "6GB", "128GB", "三星S10e[^]*?6GB\\+128GB售价4999元"],
  "galaxy-a53": [3299, "8GB", "128GB", "8\\+128GB 售价 3299"],
  "galaxy-a54": [2999, "8GB", "128GB", "新机共有 8GB\\+128GB 以及 8GB\\+256GB 两个版本可选，售价分别为 2999 元和 3399 元"],
  "galaxy-a55": [2999, "8GB", "256GB", "8GB RAM \\+ 256GB 存储空间[^]*?2999 元"],
  "galaxy-a56": [2999, "8GB", "256GB", "8GB\\+256GB 版 2999 元"],
  "galaxy-a9s": [3499, "6GB", "128GB", "三星A9s售价为3499元"],
  "galaxy-s21-fe": [4599, "8GB", "128GB", "8GB\\+128GB：4599 元"],
  "galaxy-s23-fe": [4399, "8GB", "128GB", "8GB\\+128GB 版 4399 元"],
  "galaxy-tab-s6-lite": [2799, "4GB", "64GB", "4GB\\+64GB版本售价2799元"],
  "galaxy-tab-a8": [1399, "4GB", "64GB", "4\\+64GB Wi-Fi 版 1399 元"],
  "galaxy-tab-a9-plus": [1399, "4GB", "64GB", "4GB\\+64GB WLAN 版 1399 元"],
  "galaxy-tab-s10-plus": [6999, "12GB", "256GB", "Galaxy Tab S10\\+ 12\\+256GB：6999 元"],
  "galaxy-tab-s10-ultra": [8999, "12GB", "256GB", "Galaxy Tab S10 Ultra 12\\+256GB：8999 元"],
};
for (const row of fixture.targets) {
  const category = row.category ?? "phone", id = `samsung-${row.slug}-${row.year}`;
  assert.ok(!existing.some(device => device.id === id), `${id}: 已登记设备不能重复`);
  try {
    const market = fixture.markets[row.marketKey], marketPage = await getSourceSnapshot(market.url, options), marketText = plainText(marketPage.html);
    const marketExcerpt = marketText.match(new RegExp(market.pattern))?.[0];
    const identityPage = market.identityUrl ? await getSourceSnapshot(market.identityUrl, options) : marketPage;
    const identityExcerpt = plainText(identityPage.html).match(new RegExp(market.identityPattern ?? ".{0,100}(?:国行|国内|中国|西安).{0,150}"))?.[0];
    assert.ok(marketExcerpt && identityExcerpt, `${id}: 国行发布/销售原文缺失`);
    const { device, source } = await importZolSeries({ ...row, id, category, brand: "Samsung", minYear: 2017, releaseYear: row.year,
      modelName: `Samsung ${row.name}`, expectedName: row.expectedName ?? `三星${row.name}`, family: families[row.group],
      generation: row.name.replace(/^Galaxy /, ""), variant: category === "tablet" ? "wifi" : "standard",
      comparisonGroupId: `samsung.${category}.${row.group}.${category === "tablet" ? "wifi" : "standard"}`, seriesUrl: seriesUrl(row),
      ...(market.date ? { releaseFallback: { sourceUrl: market.url, releaseDate: market.date, pattern: new RegExp(market.datePattern) } } : {}),
      excludeVariants: ["Thom Browne", "限量", "定制", "单卡版", "双4G", "移动4G", ...(row.excludeVariants ?? []),
        ...(category === "tablet" ? ["5G", "LTE", "键盘", "套装"] : [])],
    }, options);
    const excluded = [];
    for (const configuration of device.configurations) {
      const page = await getSourceSnapshot(configuration.evidence.sourceUrl, options), rows = zolRows(page.html);
      const title = plainText(page.html.match(/<h1[^>]*>([^]*?)<\/h1>/i)?.[1] ?? "").replace(/参数$/, "");
      assert.ok((Array.isArray(row.expectedName) ? row.expectedName : [row.expectedName ?? row.name]).some(name => modelIdentity(name) === modelIdentity(title)), `${id}: 保留配置的具体标题不匹配型号`);
      const memory = readSingleCapacity(rows.get("RAM容量") ?? rows.get("系统内存")), storage = readSingleCapacity(rows.get("ROM容量") ?? rows.get("存储容量"));
      if (!memory || !storage || !row.pairs.some(([ram, rom]) => ram === memory && rom === storage)) excluded.push({ sourceUrl: page.url,
        reason: "参数不是单值实际SKU，或配置未纳入本批国行核验范围" });
    }
    device.configurations = device.configurations.filter(c => !excluded.some(item => item.sourceUrl === c.evidence.sourceUrl));
    assert.ok(device.configurations.length, `${id}: 无可信国行SKU`);
    for (const key of ["memory", "storage"]) device.specs[key] = { ...device.configurations[0].evidence,
      value: [...new Set(device.configurations.map(c => c[key]))].join(" / "), note: "仅汇总独立SKU的单值配置，不作多值首选或笛卡尔组合。" };
    source.excludedConfigurations = [...(source.excludedConfigurations ?? []), ...excluded];
    source.marketEvidence = evidence(identityPage, "中国大陆已发布销售", identityExcerpt);
    source.configurationMarketEvidence = evidence(marketPage, "该型号国行发布/销售范围", marketExcerpt);
    source.referenceUrls.push(market.url, identityPage.url);
    if (!market.date) { delete device.releaseDate; source.releaseEvidence.value = String(row.year);
      source.releaseEvidence.note = "未取得中国大陆正式首销日原文，仅保留核验年份，不把发布/预售或海外日期当首销日。"; }
    if (row.chipCorrection) {
      const rawText = marketText.match(new RegExp(row.chipCorrection.pattern))?.[0];
      assert.ok(rawText, `${id}: 芯片纠正原文缺失`);
      device.specs.chip = { ...evidence(marketPage, row.chipCorrection.value, rawText), note: row.chipCorrection.reason };
      source.fieldCorrections = [{ field: "chip", reason: row.chipCorrection.reason }];
    }
    if (row.slug === "galaxy-s23-fe") {
      const weight = marketText.match(/机身重量为 209g/)?.[0];
      const camera = marketText.match(/前置 1000 万像素镜头（F2.4）/)?.[0];
      assert.ok(weight && camera, "S23 FE: 国行重量/前摄纠正证据缺失");
      device.specs.weight = { ...evidence(marketPage, 209, weight), unit: "g" };
      device.specs.frontCamera = evidence(marketPage, "1000万像素", camera);
      source.fieldCorrections.push({ field: "weight", reason: "参数页误写168g；按国行发布报道明确209g纠正。" });
      source.fieldCorrections.push({ field: "frontCamera", reason: "参数页误写1200万；国行发布报道为1000万像素。" });
    }
    if (row.slug === "galaxy-tab-s11") {
      delete device.specs.chip;
      source.fieldGaps.push({ field: "chip", reason: "具体参数页只写天玑9000系列，未精确到芯片型号；不借用海外或Ultra规格补齐标准版。" });
    }
    if (launches[row.slug]) {
      const [value, ram, rom, pattern] = launches[row.slug], rawText = marketText.match(new RegExp(pattern))?.[0];
      assert.ok(rawText, `${id}: 首发价原文缺失`);
      if (device.configurations.some(c => c.memory === ram && c.storage === rom)) {
        device.specs.launchPrice = { ...evidence(marketPage, value, rawText), unit: "CNY", market: "中国大陆", priceType: "launch",
          configuration: `${ram} 运行内存 + ${rom} 存储，国行`, condition: "正式发布的最低配置指导价，不使用现价、国补、尝鲜或免费升杯价" };
        source.fieldGaps = source.fieldGaps.filter(gap => gap.field !== "launchPrice");
      }
    }
    const overview = await getSourceSnapshot(seriesUrl(row), options), image = extractZolProductImage(overview.html);
    source.imageLicense = "unknown";
    if (image) source.productImage = { ...image, modelName: device.modelName, sourceUrl: overview.url, sourceName: "中关村在线",
      fetchedAt: overview.fetchedAt, sourceSnapshotHash: overview.sha256 };
    source.colorNames = readZolColors(overview.html);
    const pictureHref = [...overview.html.matchAll(/href=["']([^"']*\/picture_index_\d+\/index\d+_\d+_p\d+\.shtml)["']/g)][0]?.[1];
    if (pictureHref) try {
      const gallery = await getSourceSnapshot(new URL(pictureHref, overview.url).href, options);
      source.colorGallery = { sourceUrl: gallery.url, fetchedAt: gallery.fetchedAt, sourceSnapshotHash: gallery.sha256,
        colors: readZolColorImages(gallery.html, row.seriesId ? { seriesId: row.seriesId } : { productId: row.productId }) };
      source.referenceUrls.push(gallery.url);
    } catch (error) { source.imageGaps = [{ field: "colorGallery", reason: error.message }]; }
    source.notes = `国行报道与具体SKU参数交叉核验；仅登记${device.configurations.length}个实际配置。不同网络版本、特别版与海外版本不混用。公开产品图许可unknown；图库仅对应具体型号，不表示国行配色全部覆盖。`;
    source.referenceUrls = [...new Set(source.referenceUrls)];
    devices.push(device); sources[category].push(source);
    console.log(JSON.stringify({ id, configurations: device.configurations.length, image: Boolean(source.productImage), colors: source.colorGallery?.colors.length ?? 0 }));
  } catch (error) { skipped.push({ id, name: row.name, year: row.year, sourceUrl: seriesUrl(row), reason: error.message }); console.warn(`${id}: ${error.message}`); }
}

const existingImageEvidence = [];
for (const row of fixture.metadata.existingImageEvidence) {
  const page = await getSourceSnapshot(row.sourceUrl, options);
  assert.match(plainText(page.html.match(/<title[^>]*>([^]*?)<\/title>/i)?.[1] ?? ""), /Galaxy S22[（(]/);
  const colors = readZolColorImages(page.html, { productId: row.productId }).filter(color => row.colorNames.includes(color.name));
  assert.equal(colors.length, row.colorNames.length);
  existingImageEvidence.push({ ...row, productImage: { ...colors[0], modelName: "Samsung Galaxy S22", sourceUrl: page.url, sourceName: "中关村在线",
    fetchedAt: page.fetchedAt, sourceSnapshotHash: page.sha256 }, colorGallery: { sourceUrl: page.url, fetchedAt: page.fetchedAt,
    sourceSnapshotHash: page.sha256, colors } });
}

// ponytail: 清单仅穷尽所列公开目录/系列页面；验证跳转的分页显式留缺口，不声称全品牌市场全集。
const catalog = new Map(), catalogEvidence = [], catalogGaps = [];
const normalize = modelIdentity;
const addCandidate = (name, url, page) => {
  const rawName = name;
  name = name.replace(/^三星|^Samsung（三星）/, "").replace(/\s*\d+(?:\.\d+)?GB\s*[+/][^]*$/i, "").replace(/[（(][^]*$/, "").replace(/系列$/, "").trim();
  const key = normalize(name); if (!key) return;
  const item = catalog.get(key) ?? { brand: "Samsung", name, category: /Tab|P200|P205|T\d{3}/i.test(name) ? "tablet" : "phone", series: /^Galaxy\s+(?:Tab\s+)?([A-Z]+)/i.exec(name)?.[1] ?? "other", catalogSources: [], sourceUrls: [] };
  item.sourceUrls = [...new Set([...item.sourceUrls, url])];
  if (page) item.catalogSources.push({ sourceUrl: page.url, rawText: rawName, fetchedAt: page.fetchedAt, sourceSnapshotHash: page.sha256 });
  catalog.set(key, item);
};
for (const url of fixture.catalogUrls) try {
  const page = await getSourceSnapshot(url, options);
  assert.ok(!page.html.includes("service.zol.com.cn/checking") && /<h[13]\b/.test(page.html), "目录返回验证跳转，没有有效产品列表");
  const members = [...page.html.matchAll(/<h3[^>]*>\s*<a[^>]*href=["']([^"']+)["'][^>]*>([^]*?)<\/a>/g)]
    .map(([, href, html]) => ({ name: plainText(html.replace(/<span[^>]*>[^]*?<\/span>/g, "")), url: new URL(href, url).href }))
    .filter(item => /三星|Samsung/.test(item.name) && /\/(?:series|cell_phone|tablepc)\//.test(item.url));
  assert.ok(members.length, "有效目录没有三星型号条目");
  catalogEvidence.push({ sourceUrl: url, fetchedAt: page.fetchedAt, sourceSnapshotHash: page.sha256, members: members.length });
  for (const member of members) addCandidate(member.name, member.url, page);
} catch (error) { catalogGaps.push({ sourceUrl: url, reason: error.message }); }
for (const row of [...history.targets, ...fixture.targets]) addCandidate(row.name, row.seriesUrl ?? seriesUrl(row));
for (const row of fixture.catalogSeries) {
  const page = await getSourceSnapshot(row.sourceUrl, options);
  const name = plainText(page.html.match(/<h1[^>]*>([^]*?)<\/h1>/i)?.[1] ?? "");
  assert.ok(normalize(name) === normalize(row.name), `清单系列身份不一致：${row.sourceUrl}`);
  addCandidate(row.name, row.sourceUrl, page);
}
const existingSources = (await Promise.all(["samsung-sources", "samsung-history-sources"].map(async name =>
  Object.values(JSON.parse(await fs.readFile(`src/data/${name}.json`, "utf8"))).flat()))).flat();
for (const device of existing) {
  const source = existingSources.find(item => item.id === device.id);
  const url = source?.officialSpecUrl ?? source?.referenceUrls?.[0];
  assert.ok(url, `${device.id}: 已有设备缺少清单来源`);
  addCandidate(device.modelName, url);
}
for (const row of fixture.blockedModels) addCandidate(row.name, row.sourceUrl);
const inventory = [...catalog.values()];
for (let offset = 0; offset < inventory.length; offset += 3) await Promise.all(inventory.slice(offset, offset + 3).map(async item => {
  const key = normalize(item.name), old = existing.find(d => normalize(d.modelName) === key), added = devices.find(d => normalize(d.modelName) === key);
  const target = [...history.targets, ...fixture.targets].find(row => normalize(row.name) === key);
  const blocked = fixture.blockedModels.find(row => normalize(row.name) === key), skip = skipped.find(row => normalize(row.name) === key);
  if (blocked?.category) item.category = blocked.category;
  item.year = old?.releaseYear ?? added?.releaseYear ?? target?.year ?? blocked?.year ?? null;
  item.status = old ? "covered_existing" : added ? "added_batch2" : blocked || skip ? "blocked" : "pending";
  item.deviceId = old?.id ?? added?.id ?? null;
  item.reason = blocked?.reason ?? skip?.reason ?? (item.status === "pending" ? "目录候选；大陆市场、日期与独立SKU尚未完整核验" : "已入库的核验型号；不代表全部SKU已收录");
  if (blocked) {
    const page = await getSourceSnapshot(blocked.marketUrl ?? blocked.sourceUrl, options), rows = zolRows(page.html);
    const rawText = rows.has("RAM容量") ? `${plainText(page.html.match(/<h1[^>]*>([^]*?)<\/h1>/i)?.[1] ?? "")}；RAM容量 ${rows.get("RAM容量")}；ROM容量 ${rows.get("ROM容量")}`
      : plainText(page.html).match(/.{0,80}(?:中国大陆之外发布的Galaxy Book|国行版本已经正式发售|Galaxy Z Flip6).{0,100}/)?.[0];
    if (rawText) item.blockerEvidence = evidence(page, "blocked", rawText);
  }
  if (item.year && item.status !== "pending") return;
  try {
    let page = await getSourceSnapshot(item.sourceUrls[0], options);
    assert.ok(!page.html.includes("service.zol.com.cn/checking"), "目录候选详情为验证跳转");
    const productId = item.sourceUrls[0].match(/index(\d+)\.shtml/)?.[1] ?? [...page.html.matchAll(/href=["']\/((?:cell_phone|tablepc))\/index(\d+)\.shtml["'][^>]*>([^]*?)<\/a>/g)]
      .find(([, , , name]) => normalize(plainText(name)) === key)?.[2];
    if (!productId) throw new Error("系列页未取得身份匹配的具体SKU");
    page = await getSourceSnapshot(`https://detail.zol.com.cn/${Math.floor(Number(productId)/1000)+1}/${productId}/param.shtml`, options);
    const rows = zolRows(page.html), release = readRelease(rows, { minYear: 2000 });
    item.year = release?.year ?? item.year;
    item.yearEvidence = evidence(page, item.year, rows.get("上市日期") ?? rows.get("上市时间") ?? "参数页缺少上市年份");
    if (item.year && item.year < 2017) { item.status = "out_of_scope"; item.reason = "参数页发布年份早于2017"; }
    if (item.year && item.year >= 2017 && /^(?:galaxys9|galaxys10|galaxynote8)/.test(key)) {
      const ram = rows.get("RAM容量"), rom = rows.get("ROM容量");
      if (!readSingleCapacity(ram) || !readSingleCapacity(rom)) { item.status = "blocked";
        item.reason = `参数为多值，不能绑定独立SKU：RAM ${ram ?? "缺失"}；ROM ${rom ?? "缺失"}`; item.configurationConflictEvidence = evidence(page, "blocked", item.reason); }
    }
  } catch (error) { item.detailGap = error.message; }
}));
assert.ok(devices.length >= fixture.expectedDevices, `回归不得静默缩减已核验${fixture.expectedDevices}台为${devices.length}`);
assert.equal(new Set(devices.map(d => d.id)).size, devices.length);
for (const device of devices) {
  assert.ok(device.releaseYear >= 2017 && device.releaseYear <= 2026 && device.configurations.length);
  for (const configuration of device.configurations) assert.match(configuration.evidence.sourceSnapshotHash, /^[a-f0-9]{64}$/);
}
const groups = new Map();
for (const device of devices) groups.set(device.comparisonGroupId, [...(groups.get(device.comparisonGroupId) ?? []), device]);
for (const group of groups.values()) group.sort((a, b) => a.releaseYear - b.releaseYear).forEach((d, i) => d.generationOrder = i + 1);
await fs.writeFile("src/data/samsung-batch2-devices-db.json", `${JSON.stringify({ metadata: { version: "1.0", totalDevices: devices.length,
  scope: fixture.scope, skipped, existingImageEvidence, catalogEvidence, catalogGaps, coverageInventory: inventory,
  pending: inventory.filter(item => item.status === "pending"), blocked: inventory.filter(item => item.status === "blocked"),
  coverageScope: "所列公开目录与历史已核验系列页的全部实际条目；受验证页影响不等于三星大陆市场全集。待核验项目保持pending，未证实大陆发售的海外产品不入库。" }, devices }, null, 2)}\n`);
await fs.writeFile("src/data/samsung-batch2-sources.json", `${JSON.stringify(sources, null, 2)}\n`);
console.log(JSON.stringify({ devices: devices.length, configurations: devices.reduce((n, d) => n + d.configurations.length, 0), inventory: inventory.length, catalogGaps: catalogGaps.length, skipped }));
