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
  phone: ["chip", "launchPrice", "displayType", "refreshRate", "port", "rearCamera", "frontCamera"],
  tablet: ["screenSize", "displayType", "resolution", "port", "rearCamera", "frontCamera"],
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
  supportEnglishUs: 0,
  appleLocaleUnspecified: 0,
  rawTextChinese: 0,
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
      ["support.apple.com", "www.apple.com", "www.apple.com.cn"].includes(url.hostname),
      `${device.id}.${fieldName}: 来源域名不受信任`,
    );
    if (field.sourceUrl.includes("support.apple.com/en-us/")) sourceAudit.supportEnglishUs += 1;
    if (field.sourceUrl.startsWith("https://www.apple.com/")) sourceAudit.appleLocaleUnspecified += 1;
    if (typeof field.rawText === "string" && /[\u4e00-\u9fff]/.test(field.rawText)) sourceAudit.rawTextChinese += 1;

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
// P5 起所有已收录字段都必须落到明确地区的 Apple 官方来源，避免来源地区再次退化为不可审计状态。
assert.equal(sourceAudit.appleLocaleUnspecified, 0, "仍有字段使用未标地区的 Apple 产品页来源");
assert.equal(sourceAudit.reference, 0, "仍有字段使用非 Apple 一方来源");
assert.deepEqual(needsReview, [], "仍有设备来源待人工复核");

// 这些值曾因共享产品页抓取而串到相邻型号，固定回归断言可阻止同类错误重新进入比较结果。
const correctedSpecs = {
  "iphone-16-plus": {
    launchPrice: 6999,
    weight: 199,
    dimensions: "160.9 x 77.8 x 7.80 mm",
    screenSize: 6.7,
    resolution: "2796 x 1290",
    wifi: "802.11be Wi-Fi 7",
    ultraWide: "12MP, 13mm, f/2.2",
  },
  "iphone-16e-2025": {
    launchPrice: 4499,
    weight: 167,
    dimensions: "146.7 x 71.5 x 7.80 mm",
    resolution: "2532 x 1170",
    wifi: "Wi-Fi 6 (802.11ax)",
    bluetooth: "Bluetooth 5.3",
    hasMagSafe: false,
  },
  "iphone-17-pro-max": {
    launchPrice: 9999,
    weight: 233,
    dimensions: "163.4 x 78.0 x 8.75 mm",
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

console.log("coverage", JSON.stringify(coverage));
console.log("sourceAudit", JSON.stringify(sourceAudit));
console.log("needsReview", JSON.stringify(needsReview));
console.log(`device data quality audit passed: ${devices.length} devices, ${sourceAudit.fields} spec fields`);
