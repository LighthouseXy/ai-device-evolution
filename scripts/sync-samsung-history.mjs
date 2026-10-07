import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { importZolSeries, plainText, zolRows, extractZolProductImage } from "./lib/zol-device.mjs";
import { getSourceSnapshot } from "./lib/source-snapshot.mjs";
import { readZolColors, readZolColorImages } from "./lib/device-images.mjs";

const fixture = JSON.parse(await fs.readFile("scripts/fixtures/samsung-history-expansion.json", "utf8"));
const options = { offline: process.argv.includes("--offline"), refresh: process.argv.includes("--refresh") };
assert.ok(!(options.offline && options.refresh));
const existing = JSON.parse(await fs.readFile("src/data/samsung-devices-db.json", "utf8")).devices;
const devices = [], sources = { phone: [], tablet: [], laptop: [] }, skipped = [];
const evidence = (page, value, rawText, sourceType = "reference") => ({ value, rawText, evidenceKind: "excerpt", sourceUrl: page.url,
  sourceType, confidence: sourceType === "official" ? 1 : 0.8, verifiedAt: page.fetchedAt.slice(0, 10), fetchedAt: page.fetchedAt, sourceSnapshotHash: page.sha256 });
const capacities = (value) => [...(value ?? "").matchAll(/\d+(?:\.\d+)?\s*(?:GB|TB)/gi)].map(([value]) => value.replace(/\s/g, "").toUpperCase());
const families = { "galaxy-s": "Samsung Galaxy S", "galaxy-s-plus": "Samsung Galaxy S Plus", "galaxy-s-ultra": "Samsung Galaxy S Ultra",
  "galaxy-note": "Samsung Galaxy Note", "galaxy-note-plus": "Samsung Galaxy Note Plus", "galaxy-note-ultra": "Samsung Galaxy Note Ultra",
  "galaxy-z-fold": "Samsung Galaxy Z Fold", "galaxy-z-flip": "Samsung Galaxy Z Flip", "galaxy-tab-s": "Samsung Galaxy Tab S",
  "galaxy-tab-s-plus": "Samsung Galaxy Tab S Plus", "galaxy-tab-s-ultra": "Samsung Galaxy Tab S Ultra" };
// 只使用发布报道明确列出的配置定价；不读取ZOL当前参考报价或尝鲜升杯价格。
const launches = {
  "galaxy-s8": [5688, "4GB", "64GB", /三星S8（4\+64GB）售价为5688元/],
  "galaxy-s8-plus": [6188, "4GB", "64GB", /S8\+（4\+64GB）售价为6188元/],
  "galaxy-note9": [6999, "6GB", "128GB", /国行版三星Note 9 6GB\+128GB版本定价6999元/],
  "galaxy-note10": [6599, "8GB", "256GB", /Note10 8GB\+256GB售价6599元/],
  "galaxy-note10-plus-5g": [7999, "12GB", "256GB", /Note10\+5G版 12GB\+256GB售价7999元/],
  "galaxy-note20": [7399, "8GB", "256GB", /三星Galaxy Note 20 5G版本 8GB\+256GB 售价 7399 元/],
  "galaxy-note20-ultra": [9199, "12GB", "256GB", /三星Galaxy Note 20 Ultra 5G版本12GB\+256GB售价 9199 元/],
  "galaxy-s20": [6999, "12GB", "128GB", /三星S20 5G手机12GB\+128GB售价6999元/],
  "galaxy-s20-plus": [7999, "12GB", "128GB", /三星S20\+ 5G手机12GB\+128GB售价7999元/],
  "galaxy-s20-ultra": [9999, "12GB", "256GB", /三星S20 Ultra 5G手机12GB\+256GB售价9999元/],
  "galaxy-s21": [4999, "8GB", "128GB", /Galaxy S21 5G 8GB\+128GB售价为4999元/],
  "galaxy-s21-ultra": [9699, "12GB", "256GB", /S21 Ultra 5G 12GB\+256GB售价为9699元/],
  "galaxy-s22": [4999, "8GB", "128GB", /三星 Galaxy S22：[^]*?8G\+128G 版本售 4999 元/],
  "galaxy-s22-plus": [6599, "8GB", "128GB", /三星 Galaxy S22\+：[^]*?8G\+128G 版本售 6599 元/],
  "galaxy-s22-ultra": [9699, "12GB", "256GB", /三星 Galaxy S22 Ultra：[^]*?12G\+256G 版本售 9699 元/],
  "galaxy-s23": [5199, "8GB", "128GB", /三星 Galaxy S23： 8GB \+ 128GB：5199 元/],
  "galaxy-s23-plus": [6999, "8GB", "256GB", /三星 Galaxy S23\+： 8GB \+ 256GB：6999 元/],
  "galaxy-s23-ultra": [8999, "8GB", "256GB", /三星 Galaxy S23 Ultra： 8GB \+ 256GB：8999 元/],
  "galaxy-z-fold2": [16999, "12GB", "512GB", /三星 Galaxy Z Fold2 5G 国行发布会，公布了该机在国内的售价——16999 元（512GB）/],
  "galaxy-z-fold3": [14999, "12GB", "512GB", /三星 Galaxy Z Fold3 5G 带来了[^]*?12GB\+512GB 版本建议零售价 14,999 元/],
  "galaxy-z-flip3": [7599, "8GB", "128GB", /三星 Galaxy Z Flip3 5G 提供[^]*?8GB\+128GB 版本建议零售价 7,599 元/],
  "galaxy-z-fold4": [12999, "12GB", "256GB", /12GB \+ 256GB：12999 元/],
  "galaxy-z-flip4": [7499, "8GB", "256GB", /三星 Galaxy Z Flip4 国行正式发布，\s*256GB 版售价 7499 元/],
  "galaxy-z-fold5": [12999, "12GB", "512GB", /Galaxy Z Fold 5 12GB\+512GB 12999 元/],
  "galaxy-z-flip5": [7499, "8GB", "256GB", /Galaxy Z Flip 5 8GB\+256GB 7499 元/],
};
const releaseDates = {
  note10: ["2019-09-12", /9月12日全渠道开售/], s20: ["2020-03-20", /3月20日正式开售/],
  fold2: ["2020-09-25", /新机将于 9 月 25 日正式开售/], z5: ["2023-08-11", /8 月 11 日消息，三星 Galaxy Z Flip 5 \/ Fold 5 折叠屏今日正式开售/],
  tabs8: ["2022-03-04", /将于 3 月 4 日正式开卖/],
};

for (const row of fixture.targets) {
  const category = row.category ?? "phone", id = `samsung-${row.slug}-${row.year}`;
  assert.ok(!existing.some((device) => device.id === id), `${id}: 已登记设备不能重复`);
  try {
    const market = fixture.markets[row.marketKey], marketPage = await getSourceSnapshot(market.url, options);
    const marketText = plainText(marketPage.html), marketExcerpt = marketText.match(new RegExp(market.pattern))?.[0];
    assert.ok(marketExcerpt, `${id}: 中国大陆发布证据缺失`);
    const identityPage = market.identityUrl ? await getSourceSnapshot(market.identityUrl, options) : marketPage;
    const identityText = plainText(identityPage.html);
    const identityExcerpt = market.identityPattern ? identityText.match(new RegExp(market.identityPattern))?.[0]
      : identityText.match(/.{0,100}(?:国行|中国市场|中国发布|国内|中国线上).{0,180}/)?.[0];
    assert.ok(identityExcerpt, `${id}: 页面中文不足以证明中国大陆销售`);
    const seriesUrl = row.seriesUrl ?? (row.seriesId ? `https://detail.zol.com.cn/series/${category === "tablet" ? 702 : 57}/${row.seriesId}_1.html`
      : `https://detail.zol.com.cn/cell_phone/index${row.productId}.shtml`);
    const { device, source } = await importZolSeries({ ...row, id, category, brand: "Samsung", minYear: 2017,
      releaseYear: row.year, modelName: `Samsung ${row.name}`, expectedName: row.expectedName ?? `三星${row.name}`,
      family: families[row.group], generation: row.name.replace(/^Galaxy /, ""), comparisonGroupId: `samsung.${category}.${row.group}.${category === "tablet" ? "wifi" : "standard"}`,
      variant: category === "tablet" ? "wifi" : "standard", seriesUrl,
      excludeVariants: ["Thom Browne", "限量", "定制", "单卡版", "双4G", "移动4G", ...(row.excludeVariants ?? []), ...(category === "tablet" ? ["5G版", "LTE", "键盘", "套装"] : [])],
    }, options);
    const excluded = [];
    for (const configuration of device.configurations) {
      const page = await getSourceSnapshot(configuration.evidence.sourceUrl, options), rows = zolRows(page.html);
      const memory = rows.get("RAM容量") ?? rows.get("系统内存") ?? rows.get("内存容量");
      const storage = rows.get("ROM容量") ?? rows.get("存储容量") ?? rows.get("硬盘容量");
      const single = capacities(memory).length === 1 && capacities(storage).length === 1;
      const allowed = row.pairs.some(([ram, rom]) => ram === configuration.memory && rom === configuration.storage);
      if (!single || !allowed) excluded.push({ sourceUrl: page.url, name: configuration.evidence.rawText.split("；")[0],
        reason: !single ? "内存或存储参数为多值，不能取首值建立配置" : "配置未纳入已核验国行范围，不借用海外或特殊版本" });
    }
    device.configurations = device.configurations.filter((configuration) => !excluded.some((item) => item.sourceUrl === configuration.evidence.sourceUrl));
    assert.ok(device.configurations.length, `${id}: 无参数单值且属于国行的独立SKU`);
    assert.match(device.specs.chip?.value ?? "", /骁龙|Snapdragon/i, `${id}: 本批旗舰国行不能混入Exynos`);
    for (const key of ["memory", "storage"]) {
      const values = device.configurations.map((configuration) => configuration[key]);
      const first = device.configurations[0];
      device.specs[key] = { ...first.evidence, value: [...new Set(values)].join(" / "),
        note: "仅汇总本批保留的单值实际国行配置；逐配置来源保留独立快照。" };
    }
    source.excludedConfigurations = [...(source.excludedConfigurations ?? []), ...excluded];
    source.referenceUrls.push(market.url, identityPage.url);
    source.marketEvidence = evidence(identityPage, "中国大陆已发布销售", identityExcerpt, identityPage.url.includes("samsung.com.cn") ? "official" : "reference");
    source.configurationMarketEvidence = evidence(marketPage, "本型号国行配置与发布范围", marketExcerpt, market.url.includes("samsung.com.cn") ? "official" : "reference");
    if (releaseDates[row.marketKey]) {
      const [date, pattern] = releaseDates[row.marketKey], rawText = marketText.match(pattern)?.[0];
      assert.ok(rawText, `${id}: 国行首销日期原文缺失`);
      device.releaseDate = date;
      source.releaseEvidence = evidence(marketPage, date, rawText);
    } else if (row.marketKey === "tabs9") {
      // ponytail: 参数页08-06与中国批次未绑定；未取得明确首销原文前只保留上市年份。
      delete device.releaseDate;
      source.releaseEvidence.value = String(row.year);
      source.releaseEvidence.note = "原参数页08-06日期未核验为中国大陆首销，仅采用年份；中国发布会为08-03。";
    }
    if (row.slug === "galaxy-z-flip") {
      const rawText = marketText.match(/骁龙855 Plus处理器，配备8GB内存与256GB机身存储/)?.[0];
      assert.ok(rawText, `${id}: 4G版骁龙855 Plus国行补证缺失`);
      device.specs.chip = { ...evidence(marketPage, "高通 骁龙855 Plus", rawText), note: "ZOL参数只写855；按国行发布报道补证855 Plus，未混入5G版865 Plus。" };
      source.fieldCorrections = [{ field: "chip", reason: "具体ZOL页面省略Plus后缀；国行发布报道明确855 Plus" }];
    }
    if (launches[row.slug]) {
      const [value, memory, storage, pattern] = launches[row.slug], rawText = marketText.match(pattern)?.[0];
      assert.ok(rawText, `${id}: 明确首发配置定价原文缺失`);
      if (device.configurations.some((configuration) => configuration.memory === memory && configuration.storage === storage)) {
        device.specs.launchPrice = { ...evidence(marketPage, value, rawText), unit: "CNY", priceType: "launch", market: "中国大陆",
          configuration: `${memory} 运行内存 + ${storage} 存储，国行`, condition: "该已核验配置的中国大陆正式发布定价；不含尝鲜/升杯/限时活动" };
        source.fieldGaps = source.fieldGaps.filter(({ field }) => field !== "launchPrice");
      }
    }
    source.notes = `中国大陆发布/销售报道与具体SKU参数页交叉核验；仅登记本批${device.configurations.length}个实际单值配置，不表示全部配置已覆盖。${category === "tablet" ? "只取Wi-Fi/WLAN本体，5G/LTE/键盘套装不混用。" : "本批国行旗舰使用骁龙参数，未借用海外Exynos。"}未核验的首发价和当前价留空。${row.notes ?? ""}`;
    const overview = await getSourceSnapshot(seriesUrl, options), image = extractZolProductImage(overview.html);
    if (image) source.productImage = { ...image, modelName: device.modelName, sourceUrl: overview.url, sourceName: "中关村在线",
      fetchedAt: overview.fetchedAt, sourceSnapshotHash: overview.sha256 };
    source.colorNames = readZolColors(overview.html);
    source.imageLicense = "unknown";
    source.notes += "产品图仅记录公开来源与型号身份，未核验授权许可；图库配色未宣称国行配色完整覆盖。";
    const pictureHref = [...overview.html.matchAll(/href=["']([^"']*\/picture_index_\d+\/index\d+_\d+_p\d+\.shtml)["']/g)][0]?.[1];
    if (pictureHref) {
      try {
        const gallery = await getSourceSnapshot(new URL(pictureHref, overview.url).href, options);
        source.colorGallery = { sourceUrl: gallery.url, fetchedAt: gallery.fetchedAt, sourceSnapshotHash: gallery.sha256,
          colors: readZolColorImages(gallery.html, row.seriesId ? { seriesId: row.seriesId } : { productId: row.productId }) };
        source.referenceUrls.push(gallery.url);
      } catch (error) { source.imageGaps = [{ field: "colorGallery", reason: error.message }]; }
    }
    source.referenceUrls = [...new Set(source.referenceUrls)];
    devices.push(device); sources[category].push(source);
    console.log(JSON.stringify({ id, configurations: device.configurations.length, image: Boolean(source.productImage), colors: source.colorGallery?.colors.length ?? 0 }));
  } catch (error) { skipped.push({ id, reason: error.message }); console.warn(`${id}: ${error.message}`); }
}
assert.ok(devices.length >= fixture.expectedDevices, `本批已验证${fixture.expectedDevices}台；回归不得静默缩减为${devices.length}台`);
assert.equal(new Set(devices.map((device) => device.id)).size, devices.length);
for (const device of devices) {
  assert.ok(device.releaseYear >= 2017 && device.releaseYear <= 2026);
  assert.ok(device.configurations.length);
  assert.equal(new Set(device.configurations.map(({ memory, storage }) => `${memory}/${storage}`)).size, device.configurations.length);
  for (const configuration of device.configurations) assert.match(configuration.evidence.sourceSnapshotHash, /^[a-f0-9]{64}$/);
}
const groups = new Map();
for (const device of devices) groups.set(device.comparisonGroupId, [...(groups.get(device.comparisonGroupId) ?? []), device]);
for (const group of groups.values()) group.sort((a, b) => a.releaseYear - b.releaseYear).forEach((device, i) => { device.generationOrder = i + 1; });
const generatedAt = devices.flatMap((device) => device.configurations.map(({ evidence }) => evidence.verifiedAt)).sort().at(-1);
await fs.writeFile("src/data/samsung-history-devices-db.json", `${JSON.stringify({ metadata: { version: "1.0", totalDevices: devices.length, generatedAt,
  scope: fixture.scope, skipped, remainingGaps: fixture.remainingGaps }, devices }, null, 2)}\n`);
await fs.writeFile("src/data/samsung-history-sources.json", `${JSON.stringify(sources, null, 2)}\n`);
console.log(JSON.stringify({ devices: devices.length, configurations: devices.reduce((sum, device) => sum + device.configurations.length, 0), skipped }));
