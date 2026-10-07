import assert from "node:assert/strict";
import fs from "node:fs";

const { metadata, devices } = JSON.parse(fs.readFileSync("src/data/devices-db.json", "utf8"));
const manifest = JSON.parse(fs.readFileSync("src/data/device-data-manifest.json", "utf8"));
const expansion = JSON.parse(fs.readFileSync("scripts/fixtures/device-expansion-targets.json", "utf8"));
assert.equal(new Set(expansion.targets.map((target) => target.id)).size, expansion.targets.length, "扩容目标型号不得重复");
for (const target of expansion.targets) {
  assert.ok(["Xiaomi", "Samsung", "OPPO", "vivo"].includes(target.brand), "本批扩容范围仅限四个优先品牌");
  const device = devices.find((item) => item.id === target.id);
  if (device) {
    assert.equal(device.brand, target.brand, `${target.id}: 扩容清单品牌不符`);
    assert.equal(device.modelName, target.modelName, `${target.id}: 扩容清单名称不符`);
  }
}
console.log("expansionCoverage", JSON.stringify(Object.fromEntries(["Xiaomi", "Samsung", "OPPO", "vivo"].map((brand) => {
  const targets = expansion.targets.filter((target) => target.brand === brand);
  return [brand, { included: targets.filter((target) => devices.some((device) => device.id === target.id)).length,
    total: targets.length, missing: targets.filter((target) => !devices.some((device) => device.id === target.id)).map((target) => target.modelName) }];
}))));
const expectedGroups = new Map([
  ["laptop|MacBook|12-inch|base", ["macbook-12-2016", "macbook-12-2017"]],
  ["laptop|MacBook Air|13-inch|base", ["macbook-air-13-2017", "macbook-air-13-2018", "macbook-air-13-2019", "macbook-air-13-intel-2020", "macbook-air-13-m1-2020", "macbook-air-13-m2-2022", "macbook-air-13-m3-2024", "macbook-air-13-m4-2025", "macbook-air-13-m5-2026"]],
  ["laptop|MacBook Air|15-inch|base", ["macbook-air-15-m2-2023", "macbook-air-15-m3-2024", "macbook-air-15-m4-2025", "macbook-air-15-m5-2026"]],
  ["laptop|MacBook Neo|13-inch|base", ["macbook-neo-13-2026"]],
  ["laptop|MacBook Pro|13-inch|base", ["macbook-pro-13-m1-2020", "macbook-pro-13-m2-2022"]],
  ["laptop|MacBook Pro|13-inch-2-port|base", ["macbook-pro-13-2-port-2016", "macbook-pro-13-2-port-2017", "macbook-pro-13-2-port-2019", "macbook-pro-13-2-port-2020"]],
  ["laptop|MacBook Pro|13-inch-4-port|base", ["macbook-pro-13-4-port-2016", "macbook-pro-13-4-port-2017", "macbook-pro-13-4-port-2018", "macbook-pro-13-4-port-2019", "macbook-pro-13-4-port-2020"]],
  ["laptop|MacBook Pro|14-inch|base", ["macbook-pro-14-m3-2023", "macbook-pro-14-m4-2024", "macbook-pro-14-m5-2025"]],
  ["laptop|MacBook Pro|14-inch|pro", ["macbook-pro-14-m1-pro-2021", "macbook-pro-14-m2-pro-2023", "macbook-pro-14-m3-pro-2023", "macbook-pro-14-m4-pro-2024", "macbook-pro-14-m5-pro-2026"]],
  ["laptop|MacBook Pro|14-inch|max", ["macbook-pro-14-m1-max-2021", "macbook-pro-14-m2-max-2023", "macbook-pro-14-m3-max-2023", "macbook-pro-14-m4-max-2024", "macbook-pro-14-m5-max-2026"]],
  ["laptop|MacBook Pro|15-inch|base", ["macbook-pro-15-2016", "macbook-pro-15-2017", "macbook-pro-15-2018", "macbook-pro-15-2019"]],
  ["laptop|MacBook Pro|16-inch|base", ["macbook-pro-16-2019"]],
  ["laptop|MacBook Pro|16-inch|pro", ["macbook-pro-16-m1-pro-2021", "macbook-pro-16-m2-2023", "macbook-pro-16-m3-pro-2023", "macbook-pro-16-m4-2024", "macbook-pro-16-m5-2026"]],
  ["laptop|MacBook Pro|16-inch|max", ["macbook-pro-16-m1-max-2021", "macbook-pro-16-m2-max-2023", "macbook-pro-16-m3-max-2023", "macbook-pro-16-m4-max-2024", "macbook-pro-16-m5-max-2026"]],
  ["phone|iPhone|Air", ["iphone-air"]],
  ["phone|iPhone|Plus", ["iphone-7-plus-2016", "iphone-8-plus-2017", "iphone-14-plus", "iphone-15-plus", "iphone-16-plus"]],
  ["phone|iPhone|Pro Max", ["iphone-xs-max-2018", "iphone-11-pro-max-2019", "iphone-12-pro-max", "iphone-13-pro-max", "iphone-14-pro-max", "iphone-15-pro-max", "iphone-16-pro-max", "iphone-17-pro-max", "iphone-18-pro-max"]],
  ["phone|iPhone|Pro", ["iphone-x-2017", "iphone-xs-2018", "iphone-11-pro-2019", "iphone-12-pro", "iphone-13-pro", "iphone-14-pro", "iphone-15-pro", "iphone-16-pro", "iphone-17-pro", "iphone-18-pro"]],
  ["phone|iPhone|SE", ["iphone-se-1-2016", "iphone-se-2-2020", "iphone-se-3-2022"]],
  ["phone|iPhone|e", ["iphone-16e-2025", "iphone-17e-2026"]],
  ["phone|iPhone|mini", ["iphone-12-mini", "iphone-13-mini"]],
  ["phone|iPhone|standard", ["iphone-7-2016", "iphone-8-2017", "iphone-xr-2018", "iphone-11-2019", "iphone-12", "iphone-13", "iphone-14", "iphone-15", "iphone-16", "iphone-17"]],
  ["tablet|iPad Air|11-inch", ["ipad-air-3rd-2019", "ipad-air-4th-2020", "ipad-air-m1-2022", "ipad-air-m2-2024", "ipad-air-m3-2025", "ipad-air-m4-2025"]],
  ["tablet|iPad Air|13-inch", ["ipad-air-13-m2-2024", "ipad-air-13-m3-2025", "ipad-air-13-m4-2026"]],
  ["tablet|iPad Pro|11-inch", ["ipad-pro-9-7-2016", "ipad-pro-10-5-2017", "ipad-pro-11-1st-2018", "ipad-pro-11-2nd-2020", "ipad-pro-11-m1-2021", "ipad-pro-m2-2022", "ipad-pro-m4-11-2024", "ipad-pro-m5-11-2025"]],
  ["tablet|iPad Pro|13-inch", ["ipad-pro-12-9-2nd-2017", "ipad-pro-12-9-3rd-2018", "ipad-pro-12-9-4th-2020", "ipad-pro-12-9-m1-2021", "ipad-pro-m2-13-2022", "ipad-pro-m4-13-2024", "ipad-pro-m5-13-2025"]],
  ["tablet|iPad mini|standard", ["ipad-mini-5th-2019", "ipad-mini-6th-2021", "ipad-mini-a17-pro-2024"]],
  ["tablet|iPad|standard", ["ipad-5th-2017", "ipad-6th-2018", "ipad-7th-2019", "ipad-8th-2020", "ipad-9th-2021", "ipad-10th-2022", "ipad-a16-2025"]],
]);

const deprecatedSpecKeys = ["hdmi", "sdxc", "magsafe"];
const canonicalBooleanKeys = [
  "hasCrashDetection",
  "hasHDMI",
  "hasMagSafe",
  "hasNFC",
  "hasSDXC",
  "hasSOS",
  "hasTouchId",
  "hasUWB",
  "magicKeyboard",
];
const pollutedTextPattern = /^(?:\s*:root\{|\s*!function\()|globalNavData/i;
const trustedHostsByType = new Map(
  ["official", "reference"].map((sourceType) => [
    sourceType,
    new Set(manifest.publishers.filter((publisher) => publisher.sourceType === sourceType).flatMap((publisher) => publisher.hosts)),
  ]),
);

assert.equal(devices.filter((device) => device.brand === "Apple" && ["phone", "tablet", "laptop"].includes(device.category)).length, 131, "Apple 原有三品类应保留 131 台设备");
for (const [brand, minimum] of [["Xiaomi", 70], ["Huawei", 40]]) {
  const models = devices.filter((device) => device.brand === brand);
  assert.ok(models.length >= minimum, `${brand}: 未达到本批设备扩容数量`);
  assert.equal(new Set(models.map((device) => device.modelName.toLowerCase().replace(/\s+/g, ""))).size, models.length,
    `${brand}: 不得将同型号的配置或配色重复计入数量`);
  for (const category of ["phone", "tablet", "laptop"]) assert.ok(models.some((device) => device.category === category), `${brand}: 未覆盖${category}`);
}
assert.equal(metadata.totalDevices, devices.length, "metadata.totalDevices 与实际设备数不一致");
assert.equal(new Set(devices.map((device) => device.id)).size, devices.length, "设备 id 必须唯一");
assert.deepEqual(metadata.brands, [...new Set(devices.map((device) => device.brand))], "metadata.brands 与设备不一致");
assert.deepEqual(metadata.markets, [...new Set(devices.map((device) => device.market))], "metadata.markets 与设备不一致");

const groups = new Map();
const comparisonGroupIdentities = new Map();
const devicesByComparisonGroup = new Map();
const devicesById = new Map(devices.map((device) => [device.id, device]));
for (const device of devices) {
  assert.ok(["phone", "tablet", "laptop", "watch", "band"].includes(device.category), `${device.id}: category 非法`);
  assert.ok(device.brand, `${device.id}: 缺少 brand`);
  assert.ok(device.market, `${device.id}: 缺少 market`);
  assert.ok(device.comparisonGroupId, `${device.id}: 缺少 comparisonGroupId`);
  const comparisonIdentity = JSON.stringify([
    device.brand,
    device.market,
    device.category,
    device.family,
    device.variant,
    device.tier ?? null,
  ]);
  assert.ok(
    !comparisonGroupIdentities.has(device.comparisonGroupId)
      || comparisonGroupIdentities.get(device.comparisonGroupId) === comparisonIdentity,
    `${device.id}: comparisonGroupId 被不同产品组复用`,
  );
  comparisonGroupIdentities.set(device.comparisonGroupId, comparisonIdentity);
  const comparisonGroup = devicesByComparisonGroup.get(device.comparisonGroupId) ?? [];
  comparisonGroup.push(device);
  devicesByComparisonGroup.set(device.comparisonGroupId, comparisonGroup);
  assert.ok(device.family, `${device.id}: 缺少 family`);
  assert.ok(device.variant, `${device.id}: 缺少 variant`);
  assert.ok(Number.isInteger(device.generationOrder) && device.generationOrder > 0, `${device.id}: generationOrder 非法`);
  if (device.brand === "Apple" && device.category === "laptop") {
    assert.ok(["base", "pro", "max"].includes(device.tier), `${device.id}: laptop tier 非法`);
  } else if (device.brand === "Apple") {
    assert.equal(device.tier, undefined, `${device.id}: 非 laptop 不应设置 tier`);
  }

  if (device.configurations) {
    assert.ok(Array.isArray(device.configurations) && device.configurations.length > 0, `${device.id}: configurations 非法`);
    const configurationKeys = device.configurations.map(({ memory, storage, chip, cpuCores, gpuCores }) => JSON.stringify([memory, storage, chip, cpuCores, gpuCores]));
    assert.equal(new Set(configurationKeys).size, configurationKeys.length, `${device.id}: configurations 重复`);
    for (const configuration of device.configurations) {
      assert.match(configuration.memory, /^\d+(?:\.\d+)?(?:GB|TB)$/, `${device.id}: configuration memory 非法`);
      assert.match(configuration.storage, device.category === "laptop"
        ? /^\d+(?:\.\d+)?(?:GB|TB)(?: \+ \d+(?:\.\d+)?(?:GB|TB))?$/
        : /^\d+(?:\.\d+)?(?:GB|TB)$/, `${device.id}: configuration storage 非法`);
      for (const key of ["cpuCores", "gpuCores"]) if (configuration[key] !== undefined) assert.ok(Number.isInteger(configuration[key]) && configuration[key] > 0, `${device.id}: configuration ${key} 非法`);
      assert.ok(String(device.specs.memory?.value).includes(configuration.memory), `${device.id}: configuration memory 未登记到 specs`);
      assert.ok(String(device.specs.storage?.value).includes(configuration.storage), `${device.id}: configuration storage 未登记到 specs`);
      if (configuration.chip) assert.ok(String(device.specs.chip?.value).includes(configuration.chip), `${device.id}: configuration chip 与机型不一致`);
      if (configuration.evidence) {
        const evidence = configuration.evidence;
        assert.equal(evidence.evidenceKind, "excerpt");
        assert.ok(evidence.rawText && evidence.fetchedAt);
        assert.match(evidence.sourceSnapshotHash, /^[a-f0-9]{64}$/);
        assert.ok(trustedHostsByType.get(evidence.sourceType)?.has(new URL(evidence.sourceUrl).hostname));
      }
    }
  }

  for (const benchmark of device.benchmarks ?? []) {
    assert.ok(benchmark.provider && benchmark.metric && benchmark.protocolVersion, `${device.id}: benchmark 元数据缺失`);
    assert.ok(Number.isFinite(benchmark.score), `${device.id}: benchmark score 非法`);
    assert.match(benchmark.verifiedAt, /^\d{4}-\d{2}-\d{2}$/, `${device.id}: benchmark verifiedAt 非法`);
    assert.ok(
      trustedHostsByType.get("reference")?.has(new URL(benchmark.sourceUrl).hostname),
      `${device.id}: benchmark 来源域名不受信任`,
    );
  }

  for (const key of deprecatedSpecKeys) {
    assert.ok(!Object.hasOwn(device.specs, key), `${device.id}: 禁止使用旧字段 ${key}`);
  }

  for (const [key, field] of Object.entries(device.specs ?? {})) {
    assert.ok(field && typeof field === "object" && Object.hasOwn(field, "value"), `${device.id}.${key}: 字段结构非法`);
    assert.ok(typeof field.sourceUrl === "string", `${device.id}.${key}: sourceUrl 缺失`);
    assert.match(field.sourceUrl, /^https:\/\//, `${device.id}.${key}: sourceUrl 非法`);
    assert.ok(["official", "reference"].includes(field.sourceType), `${device.id}.${key}: sourceType 非法`);
    const hostname = new URL(field.sourceUrl).hostname;
    assert.ok(trustedHostsByType.get(field.sourceType)?.has(hostname), `${device.id}.${key}: 来源域名与 sourceType 不匹配`);
    assert.ok(typeof field.confidence === "number" && field.confidence >= 0 && field.confidence <= 1, `${device.id}.${key}: confidence 非法`);
    assert.ok(typeof field.verifiedAt === "string", `${device.id}.${key}: verifiedAt 缺失`);
    assert.match(field.verifiedAt, /^\d{4}-\d{2}-\d{2}$/, `${device.id}.${key}: verifiedAt 非法`);
    if (typeof field.value === "string") {
      assert.ok(!pollutedTextPattern.test(field.value), `${device.id}.${key}: value 含网页脚本或样式污染`);
    }
    if (typeof field.rawText === "string") {
      assert.ok(!pollutedTextPattern.test(field.rawText), `${device.id}.${key}: rawText 含网页脚本或样式污染`);
    }
    if (typeof field.summaryText === "string") {
      assert.equal(field.evidenceKind, "summary", `${device.id}.${key}: 整理文本必须标明类型`);
      assert.ok(!pollutedTextPattern.test(field.summaryText), `${device.id}.${key}: summaryText 含网页污染`);
    }
  }

  if (device.specs?.colors?.value !== null && device.specs?.colors?.value !== undefined) {
    assert.ok(Array.isArray(device.specs.colors.value), `${device.id}.colors: 必须为数组`);
    assert.ok(device.specs.colors.value.every((color) => typeof color === "string"), `${device.id}.colors: 颜色必须为字符串`);
  }

  for (const key of canonicalBooleanKeys) {
    if (device.specs?.[key]?.value !== null && device.specs?.[key]?.value !== undefined) {
      assert.equal(typeof device.specs[key].value, "boolean", `${device.id}.${key}: 必须为 boolean`);
    }
  }

  const key = [device.category, device.family, device.variant, device.tier].filter(Boolean).join("|");
  if (device.brand === "Apple" && ["phone", "tablet", "laptop"].includes(device.category)) {
    const group = groups.get(key) ?? [];
    group.push(device);
    groups.set(key, group);
  }
}

for (const device of devices) {
  const magnitude = device.computed?.generationUpgradeMagnitude;
  if (!magnitude) continue;
  const comparedTo = magnitude.comparedTo ?? null;

  for (const [key, field] of Object.entries(device.computed ?? {})) {
    assert.equal(field.sourceType, "computed", `${device.id}.${key}: sourceType 必须为 computed`);
    assert.ok(typeof field.confidence === "number" && field.confidence >= 0 && field.confidence <= 1, `${device.id}.${key}: confidence 非法`);
    assert.match(field.computedAt, /^\d{4}-\d{2}-\d{2}$/, `${device.id}.${key}: computedAt 非法`);
    assert.match(field.verifiedAt, /^\d{4}-\d{2}-\d{2}$/, `${device.id}.${key}: verifiedAt 非法`);
  }

  if (device.generationOrder === 1) {
    assert.equal(comparedTo, null, `${device.id}: 比较组第一代不应引用前代`);
    assert.equal(magnitude.value, null, `${device.id}: 比较组第一代升级幅度应为空`);
    continue;
  }

  assert.ok(comparedTo, `${device.id}: 后续代际缺少 comparedTo`);
  const previous = devicesById.get(comparedTo);
  assert.ok(previous, `${device.id}: comparedTo 设备不存在`);
  assert.equal(previous.comparisonGroupId, device.comparisonGroupId, `${device.id}: comparedTo comparisonGroupId 不一致`);
  assert.equal(previous.generationOrder, device.generationOrder - 1, `${device.id}: comparedTo 不是直接前代`);

  assert.ok(Number.isFinite(magnitude.value) && magnitude.value >= 1 && magnitude.value <= 10, `${device.id}: 后续代际升级幅度必须为 1-10`);
}

assert.deepEqual(
  [...groups].map(([key, group]) => [key, group.map((device) => device.id).sort()]).sort(),
  [...expectedGroups].map(([key, ids]) => [key, [...ids].sort()]).sort(),
  "严格比较组与预期不一致",
);

for (const [key, group] of devicesByComparisonGroup) {
  const sorted = [...group].sort((left, right) => left.generationOrder - right.generationOrder);
  assert.equal(new Set(sorted.map((device) => device.generationOrder)).size, sorted.length, `${key}: generationOrder 重复`);
  for (let index = 0; index < sorted.length; index += 1) {
    assert.equal(sorted[index].generationOrder, index + 1, `${key}: generationOrder 必须从 1 连续排列`);
    if (index > 0) {
      assert.ok(sorted[index].releaseYear >= sorted[index - 1].releaseYear, `${key}: 发布年份倒序`);
    }
  }
  console.log(`${key}\t${group.length}\t${sorted.map((device) => device.id).join(",")}`);
}

const specFields = devices.flatMap((device) => Object.values(device.specs ?? {}));
const sourceUrls = specFields.map((field) => field?.sourceUrl).filter(Boolean);
const rawTexts = specFields.map((field) => field?.rawText).filter((value) => typeof value === "string");
const sourceAudit = {
  specFields: specFields.length,
  official: specFields.filter((field) => field?.sourceType === "official").length,
  supportZhCn: sourceUrls.filter((url) => /support\.apple\.com\/zh-cn\//.test(url)).length,
  supportZhTw: sourceUrls.filter((url) => /support\.apple\.com\/zh-tw\//.test(url)).length,
  appleChina: sourceUrls.filter((url) => url.startsWith("https://www.apple.com.cn/")).length,
  reference: specFields.filter((field) => field?.sourceType === "reference").length,
  rawTextEnglishLike: rawTexts.filter((text) => /[A-Za-z]{3}/.test(text)).length,
  rawTextChineseLike: rawTexts.filter((text) => /[\u4e00-\u9fff]/.test(text)).length,
};

assert.equal(sourceAudit.official + sourceAudit.reference, sourceAudit.specFields, "规格来源必须标记为官方或受信任第三方");

console.log("sourceAudit", JSON.stringify(sourceAudit));
console.log(`device taxonomy validation passed: ${devices.length} devices, ${comparisonGroupIdentities.size} groups`);
