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
const { getDeviceImageGallery } = loadTsModule("@/lib/device-images");
const { getPriceConfiguration, getLaunchPriceRows } = loadTsModule("@/lib/device-configurations");
const { buildDeviceAdvisorContext } = loadTsModule("@/lib/device-advisor-rules");
const { formatDeviceSpec } = loadTsModule("@/lib/device-spec-fields");

const groupedIds = new Set();
for (const group of identity.groups) {
  assert.ok(Object.hasOwn(group.editions, group.id));
  const model = getCatalogDevice(group.id);
  assert.equal(model.model, group.model);
  assert.equal(model.editions.length, Object.keys(group.editions).length);
  const base = sourceById.get(group.id);
  const gallery = getDeviceImageGallery(group.id);
  const displayedUrls = new Set([images[group.id].url, ...gallery.colors.map(color => color.image?.url)]);
  for (const [id, label] of Object.entries(group.editions)) {
    assert.ok(!groupedIds.has(id), `${id}: 不能归入两个机型`);
    groupedIds.add(id);
    const original = sourceById.get(id);
    assert.ok(original && label);
    for (const key of ["brand", "market", "category", "family", "releaseYear", "generation", "tier"]) {
      assert.deepEqual(original[key], base[key], `${id}: 不能跨品牌、地区、年份或产品线合并`);
    }
    for (const key of ["screenSize", "resolution", "batteryCapacity", "hasNFC", "cellular"]) {
      assert.deepEqual(original.specs[key]?.value, base.specs[key]?.value, `${id}.${key}: 不同硬件/功能不能按颜色合并`);
    }
    assert.strictEqual(getCatalogDevice(id), model, `${id}: 旧链接必须回到整理后的同款`);
    assert.deepEqual(model.editions.find(edition => edition.device.id === id).device,
      allDevicesFlat.find(device => device.id === id), `${id}: 不改写来源版型和报价绑定`);
    assert.ok(displayedUrls.has(images[id].url), `${id}: 归并后仍保留原款式主图`);
    const groupModels = getDevicesByComparisonGroupKeyFlat(original.comparisonGroupId);
    assert.ok(groupModels.includes(model), `${id}: 旧系列链接不能丢失`);
    assert.equal(new Set(groupModels.map(device => getDeviceModelId(device.id))).size, groupModels.length);
  }
  assert.equal(new Set(gallery.colors.map(color => color.name)).size, gallery.colors.length, "配色款式标签不重复");
  const launchRows = getLaunchPriceRows(model);
  assert.ok(Object.values(group.editions).every(label => launchRows.some(row => row.configuration === label)));
}
for (const [id, name] of Object.entries(identity.names)) {
  assert.ok(sourceById.has(id));
  assert.equal(getCatalogDevice(id).model, name);
}
assert.equal(allDevicesFlat.length, 991, "来源记录不能因目录整理被删除");
assert.equal(catalogDevicesFlat.length, 970);
assert.equal(summaryStatsFlat.modelCount, 970);
assert.deepEqual(Object.fromEntries(["phone", "tablet", "laptop"].map(category =>
  [category, catalogDevicesFlat.filter(device => device.category === category).length])), { phone: 477, tablet: 160, laptop: 115 });
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
assert.notEqual(getDeviceModelId("xiaomi-band-9-2024"), getDeviceModelId("xiaomi-band-9-nfc-2024"));
assert.notEqual(getDeviceModelId("vivo-watch-3-2023"), getDeviceModelId("vivo-watch-3-esim-2023"));
assert.notEqual(getDeviceModelId("huawei-watch-6-pro-43-white-2026"), getDeviceModelId("huawei-watch-6-pro-46-brown-2026"));
assert.equal(getDevicesByComparisonGroupKeyFlat(getCatalogDevice("vivo-watch-6-esim-2026").comparisonGroupId).at(-1).id,
  "vivo-watch-6-esim-2026", "材质合并到既有网络分支后仍按真实代际排序");

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
