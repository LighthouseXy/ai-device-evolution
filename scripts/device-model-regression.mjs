import assert from "node:assert/strict";
import fs from "node:fs";
import { loadTsModule } from "./lib/load-ts-module.mjs";

const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const identity = read("src/data/device-model-groups.json");
const originals = read("src/data/devices-db.json").devices;
const sourceById = new Map(originals.map(device => [device.id, device]));
const images = read("src/data/device-images.json");
const { allDevicesFlat, catalogDevicesFlat, getCatalogDevice, getDevicesByComparisonGroupKeyFlat, summaryStatsFlat } = loadTsModule("@/lib/devices-db");
const { getDeviceModelId, organizeDeviceModels } = loadTsModule("@/lib/device-models");
const { getDeviceImageGallery, getDeviceImage, chooseDefaultDeviceImage } = loadTsModule("@/lib/device-images");
assert.ok(!getDeviceImageGallery("xiaomi-mix-fold-4-2024").colors.some(color => color.name === "小米龙鳞纤维版"), "同一龙鳞纤维款式不因品牌前缀重复生成缺图标签");
assert.equal(getDeviceImage("xiaomi-watch-s3-esim-2023").url, images["xiaomi-watch-s3-esim-2023"].url, "eSIM版使用本版本参考图，不借蓝牙版全配色海报");
assert.equal(getDeviceImage("vivo-x100-2023").colorScope, "all_colors");
assert.ok(!getDeviceImageGallery("vivo-x100-2023").colors.some(color => color.image?.url === images["vivo-x100-2023"].url), "默认合集不重复成为具名配色或参考图选项");
assert.notEqual(getDeviceImage("xiaomi-watch-s3-esim-2023").colorScope, "all_colors");
assert.equal(getDeviceImageGallery("huawei-band-7-2022").colorAliases["黑曜石"], "曜石黑");
assert.ok(!getDeviceImageGallery("huawei-band-7-2022").colors.some(color => color.name === "黑曜石"), "来源支持的同色别名不重复显示，原始参数仍保留");
for (const id of ["vivo-pad5e-2025-soft-light", "vivo-x100-lpddr5t-limited-2023"].filter(id => sourceById.has(id) && !images[id])) {
  const image = getDeviceImage(id);
  assert.equal(image?.imageScope, "model_shared");
  assert.notEqual(image?.colorScope, "all_colors");
}
const picture = { url: "single" }, groupPicture = { url: "group", colorScope: "all_colors" };
const bothPicture = { url: "both", viewScope: "front_back" };
const bothGroupPicture = { ...groupPicture, viewScope: "front_back" };
assert.equal(chooseDefaultDeviceImage([picture, groupPicture, bothPicture, bothGroupPicture]), groupPicture);
assert.equal(chooseDefaultDeviceImage([groupPicture, bothPicture]), groupPicture, "默认图不因单色正反图而放弃全配色宣传图");
assert.equal(chooseDefaultDeviceImage([picture, groupPicture]), groupPicture);
assert.equal(chooseDefaultDeviceImage([picture]), picture);
assert.equal(chooseDefaultDeviceImage([]), undefined);
assert.equal(chooseDefaultDeviceImage([picture, bothPicture]), bothPicture, "无合集图时优先准确的正反同框参考图");
const officialGroup = { ...groupPicture, sourceUrl: "https://consumer.huawei.com/cn/phones/own/" };
const retailGroup = { ...groupPicture, sourceUrl: "https://item.jd.com/123.html" };
assert.equal(chooseDefaultDeviceImage([groupPicture, retailGroup, officialGroup]), officialGroup, "符合视角要求时官网优先于电商与媒体");
assert.equal(chooseDefaultDeviceImage([groupPicture, retailGroup]), retailGroup);
const appleChinaGroup = { ...groupPicture, sourceUrl: "https://www.apple.com.cn/shop/buy-iphone/iphone-17" };
assert.equal(chooseDefaultDeviceImage([retailGroup, appleChinaGroup]), appleChinaGroup, "Apple 中国官网也属于一方来源");
assert.equal(chooseDefaultDeviceImage([picture, groupPicture]), groupPicture);
for (const id of ["iphone-14", "iphone-15", "iphone-17"]) {
  const image = getDeviceImage(id);
  assert.equal(image.colorScope, "all_colors");
  assert.equal(image.viewScope, "front_back");
  assert.equal(image.sourceUrl, "https://support.apple.com/zh-cn/108044");
}
const { getPriceConfiguration, getLaunchPriceRows } = loadTsModule("@/lib/device-configurations");
const { buildDeviceAdvisorContext } = loadTsModule("@/lib/device-advisor-rules");
const { formatDeviceSpec } = loadTsModule("@/lib/device-spec-fields");

const groupedIds = new Set();
for (const device of originals) {
  const field = device.specs.colors;
  if (!Array.isArray(field?.value) || !field.fetchedAt || !field.sourceSnapshotHash) continue;
  const palette = getDeviceImageGallery(device.id);
  for (const rawColor of field.value) {
    const color = palette?.colorAliases?.[rawColor] ?? rawColor;
    assert.ok(palette?.colors.some(entry => entry.name === color || entry.name.endsWith(` · ${color}`) || entry.name.includes(color)),
    `${device.id}: 已知配色 ${color} 不能因缺图从页面消失`);
  }
}
for (const group of identity.groups) {
  assert.ok(Object.hasOwn(group.editions, group.id));
  const model = getCatalogDevice(group.id);
  assert.equal(model.model, group.model);
  assert.equal(model.editions.length, Object.keys(group.editions).length);
  const base = sourceById.get(group.id);
  const gallery = getDeviceImageGallery(group.id);
  assert.ok(gallery, `${group.id}: 归并后保留已知图片与缺失款式`);
  const imageIdentity = url => url?.replace(/_\d+x\d+(?=\/)/g, "");
  const displayedUrls = new Set([images[group.id]?.url, ...gallery.colors.map(color => color.image?.url)].filter(Boolean).map(imageIdentity));
  for (const [id, label] of Object.entries(group.editions)) {
    assert.ok(!groupedIds.has(id), `${id}: 不能归入两个机型`);
    groupedIds.add(id);
    const original = sourceById.get(id);
    assert.ok(original && label);
    for (const key of group.kind === "version" ? ["brand", "market", "category", "tier"] : ["brand", "market", "category", "family", "releaseYear", "generation", "tier"]) {
      assert.deepEqual(original[key], base[key], `${id}: 不能跨品牌、地区、年份或产品线合并`);
    }
    for (const key of group.kind === "version" ? ["screenSize"] : ["screenSize", "resolution", "batteryCapacity", "hasNFC", "cellular"]) {
      const normalize = value => group.kind === "version" && typeof value === "string"
        && value.match(/(\d+(?:\.\d+)?)\s*英寸/g)?.length === 1 ? Number(value.match(/(\d+(?:\.\d+)?)\s*英寸/)[1]) : value;
      const before = normalize(base.specs[key]?.value), after = normalize(original.specs[key]?.value);
      if (group.kind !== "version" || (before != null && after != null)) {
        assert.deepEqual(after, before, `${id}.${key}: 不同尺寸不能作为同款版本合并`);
      }
    }
    assert.strictEqual(getCatalogDevice(id), model, `${id}: 旧链接必须回到整理后的同款`);
    assert.deepEqual(model.editions.find(edition => edition.device.id === id).device,
      allDevicesFlat.find(device => device.id === id), `${id}: 不改写来源版型和报价绑定`);
    if (images[id]) assert.ok(displayedUrls.has(imageIdentity(images[id].url)), `${id}: 归并后仍保留原款式主图`);
    else assert.ok(gallery.colors.some(color => color.name === label && !color.image), `${id}: 缺失款式图片不伪造`);
    const groupModels = getDevicesByComparisonGroupKeyFlat(original.comparisonGroupId);
    assert.ok(groupModels.includes(model), `${id}: 旧系列链接不能丢失`);
    assert.equal(new Set(groupModels.map(device => getDeviceModelId(device.id))).size, groupModels.length);
  }
  assert.equal(new Set(gallery.colors.map(color => color.name)).size, gallery.colors.length, "配色款式标签不重复");
  const launchRows = getLaunchPriceRows(model);
  assert.ok(Object.values(group.editions).every(label => launchRows.some(row => row.configuration === label || row.configuration.startsWith(`${label} · `))));
}
for (const [id, name] of Object.entries(identity.names)) {
  assert.ok(sourceById.has(id));
  assert.equal(getCatalogDevice(id).model, name);
}
assert.equal(allDevicesFlat.length, 991, "来源记录不能因目录整理被删除");
assert.equal(catalogDevicesFlat.length, 926);
assert.equal(summaryStatsFlat.modelCount, 926);
assert.deepEqual(Object.fromEntries(["phone", "tablet", "laptop"].map(category =>
  [category, catalogDevicesFlat.filter(device => device.category === category).length])), { phone: 475, tablet: 152, laptop: 115 });
const modelIdentities = catalogDevicesFlat.map(device => [device.brand, device.category, device.releaseYear,
  device.model.replace(/[\s()（）]/g, "").toLowerCase()].join("|"));
assert.equal(new Set(modelIdentities).size, modelIdentities.length, "全目录不得重复同品牌同年份同型号");
for (const category of ["phone", "tablet", "laptop", "watch", "band"]) {
  const candidates = buildDeviceAdvisorContext({ category, maxResults: 3 }).candidateShortlist;
  assert.equal(new Set(candidates.map(candidate => getDeviceModelId(candidate.deviceId))).size, candidates.length,
    `${category}: 不让同机型配色挤占AI候选`);
}

const white = getCatalogDevice("huawei-watch-6-pro-43-white-2026");
const ceramicPrice = sourceById.get("huawei-watch-6-pro-43-ceramic-2026").specs.launchPrice;
assert.equal(getPriceConfiguration(white, ceramicPrice).description, "陶瓷白 · 陶瓷表带");
assert.equal(getPriceConfiguration(white, { ...ceramicPrice, configuration: "国行 HUAWEI WATCH 6 Pro 46mm 钛空银" }), null);
assert.equal(getPriceConfiguration(white, { ...ceramicPrice, market: "US" }), null);
assert.match(getCatalogDevice("huawei-watch-6-pro-46-space-2026").specs.wearableWeight, /太空探索.*60/);
assert.match(getLaunchPriceRows(white).find(row => row.configuration.startsWith("陶瓷白")).amount, /4,899/);
assert.equal(getDeviceModelId("xiaomi-band-9-2024"), getDeviceModelId("xiaomi-band-9-nfc-2024"));
assert.equal(getDeviceModelId("vivo-watch-3-2023"), getDeviceModelId("vivo-watch-3-esim-2023"));
assert.notEqual(getDeviceModelId("xiaomi-band-9-2024"), getDeviceModelId("xiaomi-band-9-pro-2024"));
assert.notEqual(getDeviceModelId("samsung-galaxy-tab-s7-fe-wifi-2021"), getDeviceModelId("samsung-galaxy-tab-s7-fe-lte-2021"), "不同处理器的 Tab S7 FE 不能无条件归并");
assert.notEqual(getDeviceModelId("huawei-watch-6-pro-43-white-2026"), getDeviceModelId("huawei-watch-6-pro-46-brown-2026"));
assert.equal(getDevicesByComparisonGroupKeyFlat(getCatalogDevice("vivo-watch-6-esim-2026").comparisonGroupId).at(-1).id,
  "vivo-watch-6-2026", "版本归并后仍按真实代际排序");
assert.deepEqual(getDevicesByComparisonGroupKeyFlat("samsung.watch.galaxy-watch.44mm").map(device => device.id),
  ["samsung-galaxy-watch4-44-2021", "samsung-galaxy-watch5-44-2022", "samsung-galaxy-watch7-44-2024", "samsung-galaxy-watch8-44-2025", "samsung-galaxy-watch9-44-2026"],
  "同尺寸早期单版本不能因新款版本归并而被拆出代际时间线");
assert.ok(getDevicesByComparisonGroupKeyFlat("samsung.watch.galaxy-watch.44mm").every(device => device.variant === "44mm"));

const band4 = getCatalogDevice("xiaomi-band-4-nfc-2019");
assert.match(formatDeviceSpec(band4, { key: "batteryCapacity", unit: "mAh" }), /标准版：135mAh\nNFC版：125mAh/);
assert.match(formatDeviceSpec(band4, { key: "hasNFC" }), /标准版：待补充\nNFC版：支持/, "缺失不当成不支持");
assert.deepEqual(getLaunchPriceRows(band4).map(row => [row.configuration, row.amount]), [["标准版", "¥169"], ["NFC版", "¥229"]]);
assert.match(formatDeviceSpec(getCatalogDevice("vivo-watch-3-2023"), { key: "batteryLife" }), /蓝牙版.*16天[\s\S]*eSIM版.*7天/);
const x100 = getCatalogDevice("vivo-x100-lpddr5t-limited-2023");
assert.match(formatDeviceSpec(x100, { key: "memoryType" }), /LPDDR5X款：LPDDR5X[\s\S]*LPDDR5T限量款：LPDDR5T/);
const limitedPrice = allDevicesFlat.find(device => device.id === "vivo-x100-lpddr5t-limited-2023").launchPrices[0];
assert.match(getPriceConfiguration(x100, limitedPrice).description, /LPDDR5T限量款.*16GB.*1TB/);
assert.equal(getPriceConfiguration(x100, { ...limitedPrice, sourceUrl: "https://example.com/unknown" }), null, "不能凭同容量把未知版本报价绑定到基础款");

// 模拟字段冲突/缺失：不把一个款式的数值、单位或“支持”套到整款。
const original = allDevicesFlat.find(device => device.id === "oppo-watch-se-gray-2022");
const brown = allDevicesFlat.find(device => device.id === "oppo-watch-se-brown-2022");
const sample = organizeDeviceModels([
  { ...original, screenSize: 1.75, specs: { screenSize: 1.75, hasNFC: true, weight: 31 } },
  { ...brown, screenSize: 1.6, specs: { screenSize: 1.6, hasNFC: false } },
])[0];
assert.equal(sample.screenSize, undefined);
assert.match(formatDeviceSpec(sample, { key: "screenSize", unit: " 英寸" }), /1.75 英寸/);
assert.match(formatDeviceSpec(sample, { key: "hasNFC" }), /深云灰：支持\n墨棕：不支持/);
assert.match(formatDeviceSpec(sample, { key: "weight", unit: "g" }), /墨棕：待补充/);
assert.deepEqual(sample.editions[0].device.specs.hasNFC, true);
console.log(`device model organization passed: ${originals.length} source records → ${catalogDevicesFlat.length} models, ${identity.groups.length} merged groups`);
