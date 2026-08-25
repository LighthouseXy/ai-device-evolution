import assert from "node:assert/strict";
import fs from "node:fs";

const { devices } = JSON.parse(fs.readFileSync("src/data/apple-devices-db.json", "utf8"));
const sourceRegistry = JSON.parse(fs.readFileSync("src/data/apple-sources.json", "utf8"));
const sourceRows = Object.values(sourceRegistry).flat();
const devicesByCategory = new Map();
for (const device of devices) {
  const group = devicesByCategory.get(device.category) ?? [];
  group.push(device);
  devicesByCategory.set(device.category, group);
}

// 这些字段直接支撑现有页面的核心展示；新增设备缺失时必须显式处理，不能静默降低质量。
const requiredFields = {
  phone: ["chip", "launchPrice", "displayType", "port", "rearCamera", "frontCamera"],
  tablet: ["chip", "launchPrice", "screenSize", "displayType", "resolution", "port", "rearCamera", "frontCamera"],
  laptop: ["chip", "screenSize", "displayType", "resolution"],
};
const reportFields = [
  "chip",
  "screenSize",
  "weight",
  "launchPrice",
  "displayType",
  "resolution",
  "refreshRate",
  "batteryLife",
  "port",
  "storage",
  "rearCamera",
  "frontCamera",
];
const trustedReferenceHosts = new Set(["tc.people.com.cn", "mobile.zol.com.cn", "www.shihuo.cn", "pro.m.jd.com", "item.m.jd.com", "m2.9ji.com"]);

const hasValue = (device, field) => device.specs?.[field]?.value !== null && device.specs?.[field]?.value !== undefined;
const sourceIds = sourceRows.map((row) => row.id);
assert.equal(new Set(sourceIds).size, sourceRows.length, "来源登记 id 必须唯一");
assert.deepEqual([...sourceIds].sort(), devices.map((device) => device.id).sort(), "来源登记必须与主数据设备一一对应");

const registryById = new Map(sourceRows.map((row) => [row.id, row]));
const devicesById = new Map(devices.map((device) => [device.id, device]));
const normalizeEvidence = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/apple|bionic|chip|[^a-z0-9]/g, "");
const sourceAudit = {
  fields: 0,
  apple: 0,
  reference: 0,
  supportZhCn: 0,
  appleChina: 0,
  rawTextChinese: 0,
  rawTextTechnicalOnly: 0,
};

for (const device of devices) {
  const registry = registryById.get(device.id);
  assert.equal(registry.category, device.category, `${device.id}: 来源登记类别与主数据不一致`);
  assert.equal(registry.modelName, device.modelName, `${device.id}: 来源登记型号与主数据不一致`);
  assert.equal(registry.releaseYear, device.releaseYear, `${device.id}: 来源登记年份与主数据不一致`);
  const registeredUrls = new Set([
    registry.officialSpecUrl,
    registry.supportUrl,
    registry.newsroomUrl,
    ...(registry.referenceUrls ?? []),
  ].filter(Boolean));
  assert.ok(registeredUrls.size > 0, `${device.id}: 来源登记缺少 URL`);

  for (const [fieldName, field] of Object.entries(device.specs)) {
    sourceAudit.fields += 1;
    assert.ok(["apple", "reference"].includes(field.sourceType), `${device.id}.${fieldName}: sourceType 非法`);
    sourceAudit[field.sourceType] += 1;
    assert.ok(registeredUrls.has(field.sourceUrl), `${device.id}.${fieldName}: sourceUrl 未登记`);

    const url = new URL(field.sourceUrl);
    if (field.sourceType === "apple") {
      assert.ok(["support.apple.com", "www.apple.com.cn"].includes(url.hostname), `${device.id}.${fieldName}: Apple 来源域名不受信任`);
    } else {
      assert.ok(trustedReferenceHosts.has(url.hostname), `${device.id}.${fieldName}: 第三方来源域名不受信任`);
    }
    assert.ok(field.rawText, `${device.id}.${fieldName}: 缺少原始证据`);
    if (/support\.apple\.com\/zh-(?:cn|tw)\//.test(field.sourceUrl)) sourceAudit.supportZhCn += 1;
    if (field.sourceUrl.startsWith("https://www.apple.com.cn/")) sourceAudit.appleChina += 1;
    if (/[\u4e00-\u9fff]/.test(field.rawText)) sourceAudit.rawTextChinese += 1;
    else sourceAudit.rawTextTechnicalOnly += 1;

    if (field.sourceType === "reference") {
      assert.ok(["launchPrice", "currentPrice", "usedPrice"].includes(fieldName), `${device.id}.${fieldName}: reference 仅允许用于价格字段`);
      assert.equal(field.confidence, 0.7, `${device.id}.${fieldName}: reference 置信度必须为 0.7`);
      assert.equal(field.priceType, fieldName.replace("Price", ""), `${device.id}.${fieldName}: priceType 与字段不一致`);
      assert.equal(field.market, "中国大陆", `${device.id}.${fieldName}: 缺少中国大陆市场限定`);
      assert.ok(field.configuration, `${device.id}.${fieldName}: 缺少价格配置`);
      assert.ok(field.condition, `${device.id}.${fieldName}: 缺少成色或价格状态`);
      assert.match(field.observedAt, /^\d{4}-\d{2}-\d{2}$/, `${device.id}.${fieldName}: observedAt 非法`);
      assert.ok(field.sourceName, `${device.id}.${fieldName}: 缺少来源名称`);
    }
  }

  const screenSize = device.specs.screenSize;
  if (screenSize?.rawText) {
    assert.ok(
      String(screenSize.rawText).includes(String(screenSize.value)),
      `${device.id}.screenSize: 原始证据不包含结构化尺寸`,
    );
  }

  const chip = device.specs.chip;
  if (chip?.rawText) {
    const value = normalizeEvidence(chip.value);
    const rawText = normalizeEvidence(chip.rawText);
    assert.ok(value.includes(rawText) || rawText.includes(value), `${device.id}.chip: 原始证据与结构化芯片不一致`);
  }
}

const coverage = {};
for (const [category, categoryDevices] of devicesByCategory) {
  coverage[category] = Object.fromEntries(
    reportFields.map((field) => [field, `${categoryDevices.filter((device) => hasValue(device, field)).length}/${categoryDevices.length}`]),
  );
  for (const field of requiredFields[category]) {
    const missing = categoryDevices.filter((device) => !hasValue(device, field)).map((device) => device.id);
    assert.deepEqual(missing, [], `${category}.${field}: 核心字段缺失 ${missing.join(", ")}`);
  }
}

const needsReview = sourceRows.filter((row) => row.sourceStatus === "needs_review").map((row) => row.id);
assert.ok(sourceRows.every((row) => ["verified", "needs_review"].includes(row.sourceStatus)), "来源登记状态非法");
assert.equal(sourceAudit.supportZhCn + sourceAudit.appleChina + sourceAudit.reference, sourceAudit.fields, "仍有字段未使用已登记来源");
assert.equal(sourceAudit.reference, 26, "第三方价格字段数量发生变化");
assert.deepEqual(needsReview, [], "仍有设备来源待人工复核");

const missingLaptopLaunchPrices = devices
  .filter((device) => device.category === "laptop" && !hasValue(device, "launchPrice"))
  .map((device) => device.id)
  .sort();
assert.deepEqual(missingLaptopLaunchPrices, [
  "macbook-12-2017",
  "macbook-air-13-2017",
  "macbook-pro-13-4-port-2017",
  "macbook-pro-13-4-port-2020",
  "macbook-pro-14-m1-max-2021",
  "macbook-pro-14-m2-max-2023",
  "macbook-pro-14-m3-max-2023",
  "macbook-pro-14-m4-max-2024",
  "macbook-pro-15-2017",
  "macbook-pro-16-m1-max-2021",
  "macbook-pro-16-m2-max-2023",
  "macbook-pro-16-m3-max-2023",
  "macbook-pro-16-m4-2024",
], "MacBook 首发价缺失集合发生变化；仅允许中文官网未明确报价的配置留空");

const currentPriceSnapshots = {
  "ipad-a16-2025": 2830,
  "ipad-air-13-m4-2026": 6100,
  "ipad-air-m4-2025": 4540,
  "ipad-pro-m5-11-2025": 8590,
  "ipad-pro-m5-13-2025": 8690,
  "ipad-mini-a17-pro-2024": 4799,
  "iphone-16": 5399,
  "iphone-16-plus": 5999,
  "iphone-17": 5380,
  "iphone-17-pro": 7270,
  "iphone-17-pro-max": 8210,
  "iphone-air": 7999,
  "iphone-17e-2026": 4499,
  "macbook-air-13-m5-2026": 8000,
  "macbook-air-15-m5-2026": 11999,
  "macbook-pro-14-m5-2025": 13200,
  "macbook-pro-14-m5-pro-2026": 19999,
  "macbook-pro-14-m5-max-2026": 33999,
  "macbook-pro-16-m5-2026": 24999,
  "macbook-pro-16-m5-max-2026": 35999,
  "macbook-neo-13-2026": 5499,
};
const appleStoreCurrentPrices = new Set([
  "ipad-mini-a17-pro-2024",
  "iphone-16",
  "iphone-16-plus",
  "iphone-air",
  "iphone-17e-2026",
  "macbook-air-15-m5-2026",
  "macbook-pro-14-m5-pro-2026",
  "macbook-pro-14-m5-max-2026",
  "macbook-pro-16-m5-2026",
  "macbook-pro-16-m5-max-2026",
  "macbook-neo-13-2026",
]);
for (const [deviceId, price] of Object.entries(currentPriceSnapshots)) {
  const field = devicesById.get(deviceId)?.specs.currentPrice;
  const isAppleStore = appleStoreCurrentPrices.has(deviceId);
  assert.equal(field?.value, price, `${deviceId}.currentPrice: 当前价格快照发生回归`);
  assert.equal(field?.observedAt, "2026-08-24", `${deviceId}.currentPrice: 采集日期发生回归`);
  assert.equal(field?.sourceType, isAppleStore ? "apple" : "reference", `${deviceId}.currentPrice: 来源类型发生回归`);
  assert.equal(field?.confidence, isAppleStore ? 1 : 0.7, `${deviceId}.currentPrice: 置信度发生回归`);
  assert.equal(
    field?.sourceName,
    isAppleStore ? "Apple 中国大陆在线商店" : "识货",
    `${deviceId}.currentPrice: 来源发生回归`,
  );
}
assert.equal(
  devices.filter((device) => hasValue(device, "currentPrice")).length,
  Object.keys(currentPriceSnapshots).length,
  "当前价格只能来自已核验静态快照",
);

const usedPriceSnapshots = {
  "macbook-air-13-m1-2020": [2709, "京东爱回收严选官方旗舰店", "2026-08-25", /二手.*8 成新.*80%-90%/],
  "macbook-air-13-m2-2022": [3979, "京东爱回收严选官方旗舰店", "2026-08-25", /二手.*8 成新.*90% 以上/],
  "macbook-air-13-m3-2024": [4799, "九机二手良品", "2026-08-25", /二手.*9 成新.*91%-95%.*未检出维修痕迹/],
  "iphone-11-2019": [873, "京东商务二手手机热卖榜", "2026-08-25", /二手.*9 成新.*品牌电池效率 100%/],
  "iphone-12": [788, "京东商务二手手机热卖榜", "2026-08-25", /二手.*9 成新.*三方屏幕.*电池效率随机/],
  "iphone-13": [1949, "京东苹果二手手机热卖榜", "2026-08-25", /二手.*99 新.*原装屏.*已更换电池.*100%/],
  "iphone-13-pro-max": [2388, "京东 NFC 二手手机热卖榜", "2026-08-25", /二手.*95 新.*三方屏幕.*100%/],
  "iphone-14": [2449, "京东商务二手手机热卖榜", "2026-08-25", /二手.*99 新/],
  "iphone-14-pro": [3749, "京东 NFC 二手手机热卖榜", "2026-08-25", /二手.*99 新/],
  "iphone-14-pro-max": [3899, "京东 NFC 二手手机热卖榜", "2026-08-25", /二手.*99 新/],
  "iphone-15": [3299, "京东苹果二手手机热卖榜", "2026-08-24", /二手.*99 新/],
  "iphone-15-pro": [4449, "京东 NFC 二手手机热卖榜", "2026-08-25", /二手.*99 新/],
  "ipad-a16-2025": [2909, "京东 99 成新二手平板电脑榜", "2026-08-24", /二手.*99 新/],
  "ipad-pro-m5-11-2025": [8089, "京东 99 成新二手平板电脑榜", "2026-08-24", /二手.*99 新/],
};
for (const [deviceId, [price, sourceName, observedAt, conditionPattern]] of Object.entries(usedPriceSnapshots)) {
  const field = devicesById.get(deviceId)?.specs.usedPrice;
  assert.equal(field?.value, price, `${deviceId}.usedPrice: 二手价格快照发生回归`);
  assert.equal(field?.sourceType, "reference", `${deviceId}.usedPrice: 来源类型发生回归`);
  assert.equal(field?.confidence, 0.7, `${deviceId}.usedPrice: 置信度发生回归`);
  assert.equal(field?.sourceName, sourceName, `${deviceId}.usedPrice: 来源发生回归`);
  assert.equal(field?.observedAt, observedAt, `${deviceId}.usedPrice: 采集日期发生回归`);
  assert.match(field?.condition ?? "", conditionPattern, `${deviceId}.usedPrice: 成色发生回归`);
}
assert.equal(
  devices.filter((device) => hasValue(device, "usedPrice")).length,
  Object.keys(usedPriceSnapshots).length,
  "二手价格只能来自已核验静态快照",
);

const splitMacBookSpecs = {
  "macbook-pro-14-m4-pro-2024": ["Apple M4 Pro 芯片", "24GB / 48GB / 64GB", 16999],
  "macbook-pro-14-m4-max-2024": ["Apple M4 Max 芯片", "36GB / 48GB / 64GB / 128GB", null],
  "macbook-pro-16-m2-2023": ["Apple M2 Pro 芯片", "16GB / 32GB", 19999],
  "macbook-pro-16-m2-max-2023": ["Apple M2 Max 芯片", "32GB / 64GB / 96GB", null],
  "macbook-pro-16-m4-2024": ["Apple M4 Pro 芯片", "24GB / 48GB / 64GB", null],
  "macbook-pro-16-m4-max-2024": ["Apple M4 Max 芯片", "36GB / 48GB / 64GB / 128GB", 27999],
  "macbook-pro-14-m5-pro-2026": ["Apple M5 Pro 芯片", "24GB / 48GB / 64GB", 17999],
  "macbook-pro-14-m5-max-2026": ["Apple M5 Max 芯片", "36GB / 48GB / 64GB / 128GB", 29999],
  "macbook-pro-16-m5-2026": ["Apple M5 Pro 芯片", "24GB / 48GB / 64GB", 21999],
  "macbook-pro-16-m5-max-2026": ["Apple M5 Max 芯片", "36GB / 48GB / 64GB / 128GB", 31999],
};
for (const [deviceId, [chip, memory, launchPrice]] of Object.entries(splitMacBookSpecs)) {
  const device = devicesById.get(deviceId);
  assert.equal(device.specs.chip?.value, chip, `${deviceId}.chip: 芯片档位发生回归`);
  assert.equal(device.specs.memory?.value, memory, `${deviceId}.memory: 内存配置发生回归`);
  assert.equal(device.specs.launchPrice?.value ?? null, launchPrice, `${deviceId}.launchPrice: 首发价发生回归`);
}

const recalculatedUpgradeScores = {
  "macbook-air-13-m4-2025": 4,
  "iphone-14": 5,
  "iphone-14-pro": 9,
  "ipad-air-m3-2025": 3,
  "ipad-pro-m4-11-2024": 8,
  "ipad-pro-m4-13-2024": 8,
  "macbook-air-15-m4-2025": 4,
  "macbook-pro-14-m5-pro-2026": 3,
  "macbook-pro-14-m5-max-2026": 3,
  "macbook-pro-16-m5-2026": 3,
  "macbook-pro-16-m5-max-2026": 3,
};
for (const [deviceId, score] of Object.entries(recalculatedUpgradeScores)) {
  const magnitude = devicesById.get(deviceId).computed.generationUpgradeMagnitude;
  assert.equal(magnitude.value, score, `${deviceId}: 代际升级幅度发生回归`);
  assert.ok(magnitude.comparedTo, `${deviceId}: 重算记录缺少直接前代`);
  assert.equal(magnitude.confidence, 0.9, `${deviceId}: 重算记录 confidence 非 0.9`);
}

// 这些值曾因共享产品页抓取而串到相邻型号，固定回归断言可阻止同类错误重新进入比较结果。
const correctedSpecs = {
  "ipad-air-m2-2024": {
    screenSize: 10.86,
  },
  "ipad-air-m3-2025": {
    screenSize: 10.86,
  },
  "ipad-pro-m4-11-2024": {
    screenSize: 11.1,
  },
  "ipad-pro-m4-13-2024": {
    screenSize: 13,
  },
  "ipad-pro-m5-11-2025": {
    screenSize: 11.1,
  },
  "ipad-pro-m5-13-2025": {
    screenSize: 13,
  },
  "iphone-16-plus": {
    launchPrice: 6999,
    weight: 199,
    dimensions: "160.9 x 77.8 x 7.8 毫米",
    screenSize: 6.7,
    resolution: "2796 x 1290 像素分辨率，460 ppi",
    wifi: "802.11be 无线局域网，具备 2x2 MIMO 技术",
    ultraWide: "1200 万像素超广角：13 毫米焦距，ƒ/2.2 光圈和 120° 视角，100% Focus Pixels",
  },
  "iphone-16e-2025": {
    launchPrice: 4499,
    weight: 167,
    dimensions: "146.7 x 71.5 x 7.8 毫米",
    resolution: "2532 x 1170 像素分辨率，460 ppi",
    wifi: "802.11ax 无线局域网，具备 2x2 MIMO 技术",
    bluetooth: "蓝牙 5.3",
  },
  "iphone-17-pro-max": {
    launchPrice: 9999,
    weight: 231,
    dimensions: "163.4 x 78 x 8.75 毫米",
  },
  "iphone-14-plus": {
    launchPrice: 6999,
  },
  "iphone-14-pro-max": {
    launchPrice: 8999,
  },
  "iphone-15-plus": {
    launchPrice: 6999,
  },
  "iphone-se-2-2020": {
    launchPrice: 3299,
  },
  "iphone-se-3-2022": {
    launchPrice: 3499,
  },
};
for (const [deviceId, fields] of Object.entries(correctedSpecs)) {
  const device = devicesById.get(deviceId);
  for (const [fieldName, expected] of Object.entries(fields)) {
    assert.deepEqual(device.specs[fieldName]?.value, expected, `${deviceId}.${fieldName}: 已核验字段发生回归`);
  }
}
assert.equal(devicesById.get("iphone-16e-2025").specs.hasMagSafe, undefined, "中文官网未明确声明的否定项不应推断补值");
assert.equal(devicesById.get("iphone-15").specs.refreshRate, undefined, "中文官网未明确声明的 60Hz 不应推断补值");

const expandedIPhoneLaunchPrices = {
  "iphone-7-2016": 5388,
  "iphone-7-plus-2016": 6388,
  "iphone-se-1-2016": 3288,
  "iphone-8-2017": 5888,
  "iphone-8-plus-2017": 6688,
  "iphone-x-2017": 8388,
  "iphone-xr-2018": 6499,
  "iphone-xs-2018": 8699,
  "iphone-xs-max-2018": 9599,
  "iphone-11-2019": 5499,
  "iphone-11-pro-2019": 8699,
  "iphone-11-pro-max-2019": 9599,
  "iphone-17e-2026": 4499,
};
for (const [deviceId, launchPrice] of Object.entries(expandedIPhoneLaunchPrices)) {
  assert.equal(devicesById.get(deviceId)?.specs.launchPrice?.value, launchPrice, `${deviceId}.launchPrice: 首发价发生回归`);
}

console.log("coverage", JSON.stringify(coverage));
console.log("sourceAudit", JSON.stringify(sourceAudit));
console.log("needsReview", JSON.stringify(needsReview));
console.log(`device data quality audit passed: ${devices.length} devices, ${sourceAudit.fields} spec fields`);
