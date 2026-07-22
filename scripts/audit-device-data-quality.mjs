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
  const registeredUrls = new Set([registry.officialSpecUrl, registry.supportUrl, registry.newsroomUrl].filter(Boolean));
  assert.ok(registeredUrls.size > 0, `${device.id}: 来源登记缺少 URL`);

  for (const [fieldName, field] of Object.entries(device.specs)) {
    sourceAudit.fields += 1;
    assert.ok(["apple", "reference"].includes(field.sourceType), `${device.id}.${fieldName}: sourceType 非法`);
    sourceAudit[field.sourceType] += 1;
    assert.ok(registeredUrls.has(field.sourceUrl), `${device.id}.${fieldName}: sourceUrl 未登记`);

    const url = new URL(field.sourceUrl);
    assert.ok(
      ["support.apple.com", "www.apple.com.cn"].includes(url.hostname),
      `${device.id}.${fieldName}: 来源域名不受信任`,
    );
    assert.ok(field.rawText, `${device.id}.${fieldName}: 缺少中文官网原始证据`);
    if (field.sourceUrl.includes("support.apple.com/zh-cn/")) sourceAudit.supportZhCn += 1;
    if (field.sourceUrl.startsWith("https://www.apple.com.cn/")) sourceAudit.appleChina += 1;
    if (/[\u4e00-\u9fff]/.test(field.rawText)) sourceAudit.rawTextChinese += 1;
    else sourceAudit.rawTextTechnicalOnly += 1;

    if (field.sourceType === "reference") {
      assert.equal(fieldName, "launchPrice", `${device.id}.${fieldName}: reference 仅允许用于首发价`);
      assert.equal(field.confidence, 0.7, `${device.id}.${fieldName}: reference 置信度必须为 0.7`);
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
assert.equal(sourceAudit.supportZhCn + sourceAudit.appleChina, sourceAudit.fields, "仍有字段未使用 Apple 中国简体中文来源");
assert.equal(sourceAudit.reference, 0, "仍有字段使用非 Apple 一方来源");
assert.deepEqual(needsReview, [], "仍有设备来源待人工复核");

const missingLaptopLaunchPrices = devices
  .filter((device) => device.category === "laptop" && !hasValue(device, "launchPrice"))
  .map((device) => device.id)
  .sort();
assert.deepEqual(missingLaptopLaunchPrices, [
  "macbook-pro-14-m4-max-2024",
  "macbook-pro-16-m2-max-2023",
  "macbook-pro-16-m4-2024",
], "MacBook 首发价缺失集合发生变化；仅允许中文官网未明确报价的配置留空");

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
  "macbook-pro-16-m4-2024": 4,
  "macbook-pro-16-m4-max-2024": 4,
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

console.log("coverage", JSON.stringify(coverage));
console.log("sourceAudit", JSON.stringify(sourceAudit));
console.log("needsReview", JSON.stringify(needsReview));
console.log(`device data quality audit passed: ${devices.length} devices, ${sourceAudit.fields} spec fields`);
