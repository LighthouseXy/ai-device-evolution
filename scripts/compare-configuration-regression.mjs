import assert from "node:assert/strict";
import { loadTsModule } from "./lib/load-ts-module.mjs";

const {
  formatConfigurationForComparison,
  formatLatestConfigurationOption,
  formatMemoryForComparison,
  getDeviceConfigurations,
  getPricesForComparison,
  getSharedStorageOptions,
} = loadTsModule("./src/lib/device-configurations.ts");
const { allDevicesFlat, getDevicesByComparisonGroupKeyFlat } = loadTsModule("./src/lib/devices-db.ts");
const devices = new Map(allDevicesFlat.map((device) => [device.id, device]));

assert.deepEqual(
  getSharedStorageOptions(getDevicesByComparisonGroupKeyFlat("iPhone::standard")),
  ["256GB", "512GB"],
  "the selector should contain only storage tiers shared by the latest three generations",
);
assert.equal(
  formatLatestConfigurationOption(getDevicesByComparisonGroupKeyFlat("iPhone::standard"), "256GB"),
  "8GB + 256GB",
  "selector labels should use the latest generation's primary memory tier",
);
assert.equal(
  formatMemoryForComparison(devices.get("iphone-15"), true, "256GB"),
  "6GB",
  "each device should show its own memory in the comparison table",
);
assert.equal(formatMemoryForComparison(devices.get("iphone-17"), true, "256GB"), "8GB");
assert.deepEqual(
  getSharedStorageOptions(getDevicesByComparisonGroupKeyFlat("iPad Air::11-inch")),
  ["128GB", "256GB", "512GB"],
  "the selector should cap shared tiers at three mainstream options",
);

const iphone17 = devices.get("iphone-17");
assert.deepEqual(
  getDeviceConfigurations(iphone17).map((configuration) => configuration.key),
  ["8GB|256GB", "8GB|512GB"],
  "iPhone 17 should expose only its real memory and storage combinations",
);

const iphone8 = devices.get("iphone-8-2017");
assert.deepEqual(
  formatConfigurationForComparison(iphone8, false, "256GB"),
  "2GB + 256GB",
  "devices before the latest three generations should show their own highest configuration",
);

assert.equal(formatConfigurationForComparison(iphone17, true, "256GB"), "8GB + 256GB");
assert.equal(formatConfigurationForComparison(iphone17, true, "64GB"), "");

const iphone12 = devices.get("iphone-12");
assert.equal(
  getPricesForComparison(iphone12, "used").length,
  1,
  "an older device's verified price must remain visible even when it is not the highest configuration",
);

const iphone13 = devices.get("iphone-13");
assert.equal(getPricesForComparison(iphone13, "used")[0]?.configuration.key, "4GB|256GB");

const macbookAirM3 = devices.get("macbook-air-13-m3-2024");
assert.deepEqual(
  getPricesForComparison(macbookAirM3, "current").map((price) => `${price.configuration.key}:${price.value}`),
  ["8GB|256GB:6460", "16GB|256GB:6910", "16GB|512GB:7510"],
  "multiple verified prices for one model should stay separated by configuration",
);

const ipadProM5 = devices.get("ipad-pro-m5-11-2025");
assert.deepEqual(
  getDeviceConfigurations(ipadProM5).map((configuration) => configuration.key),
  ["12GB|256GB", "12GB|512GB", "16GB|1TB", "16GB|2TB"],
  "iPad memory tiers should stay paired with their supported storage tiers",
);

const macbookProM3Max = devices.get("macbook-pro-14-m3-max-2023");
assert.equal(
  formatConfigurationForComparison(macbookProM3Max, true, "2TB"),
  "2TB 存储；运行内存 36GB / 48GB / 64GB / 96GB / 128GB",
  "MacBook independent option lists must not be expanded into unverified combinations",
);

const xiaomiUltra = getDevicesByComparisonGroupKeyFlat("xiaomi.phone.xiaomi-ultra.standard");
assert.equal(xiaomiUltra.length, 7, "the second-brand pilot should include the full Ultra product line");
assert.deepEqual(
  getDeviceConfigurations(devices.get("xiaomi-mi-10-ultra-2020")).map((configuration) => configuration.key),
  ["16GB|512GB"],
  "devices older than the latest five generations should keep only the highest configuration",
);
assert.deepEqual(
  getDeviceConfigurations(devices.get("xiaomi-mi-11-ultra-2021")).map((configuration) => configuration.key),
  ["8GB|256GB", "12GB|256GB", "12GB|512GB"],
  "recent generations should keep their real configuration matrix",
);
assert.deepEqual(
  getDeviceConfigurations(devices.get("xiaomi-15-ultra-2025")).map((configuration) => configuration.key),
  ["12GB|256GB", "16GB|512GB", "16GB|1TB"],
  "explicit configuration matrices must not expand into unsupported memory and storage pairs",
);
assert.equal(
  formatLatestConfigurationOption(xiaomiUltra, "512GB"),
  "12GB + 512GB",
  "the selector should use the latest generation's primary verified combination",
);
assert.equal(getPricesForComparison(devices.get("xiaomi-15-ultra-2025"), "current")[0]?.value, 6499);
assert.equal(getPricesForComparison(devices.get("xiaomi-17-ultra-2025"), "current")[0]?.value, 6999);
assert.deepEqual(
  [
    "xiaomi-17-ultra-2025",
    "xiaomi-15-ultra-2025",
    "xiaomi-14-ultra-2024",
    "xiaomi-13-ultra-2023",
    "xiaomi-12s-ultra-2022",
    "xiaomi-mi-11-ultra-2021",
  ].map((id) => getPricesForComparison(devices.get(id), "used")[0]?.value),
  [5149, 3619, 2569, 1809, 1219, 1299],
  "verified Xiaomi Ultra used-price snapshots should remain available",
);
assert.equal(getPricesForComparison(devices.get("xiaomi-mi-10-ultra-2020"), "used").length, 0);

const oppoFindXUltra = getDevicesByComparisonGroupKeyFlat("oppo.phone.find-x-ultra.standard");
assert.equal(oppoFindXUltra.length, 3, "the OPPO pilot should include the complete Find X Ultra lineage");
assert.deepEqual(
  getSharedStorageOptions(oppoFindXUltra),
  ["256GB", "512GB"],
  "OPPO configuration options should include only storage tiers shared by all three generations",
);
assert.deepEqual(
  getDeviceConfigurations(devices.get("oppo-find-x9-ultra-2026")).map((configuration) => configuration.key),
  ["12GB|256GB", "12GB|512GB", "16GB|512GB", "16GB|1TB"],
  "OPPO configurations must preserve the official memory and storage combinations",
);
assert.equal(formatLatestConfigurationOption(oppoFindXUltra, "512GB"), "12GB + 512GB");
assert.equal(
  devices.get("oppo-find-x9-ultra-2026").mainCameraMp,
  200,
  "Chinese 2 亿像素 wording should normalize to 200MP for comparison",
);

const vivoXUltra = getDevicesByComparisonGroupKeyFlat("vivo.phone.x-ultra.standard");
assert.equal(vivoXUltra.length, 3, "the vivo pilot should include every released X Ultra generation");
assert.deepEqual(getSharedStorageOptions(vivoXUltra), ["256GB", "512GB", "1TB"]);
assert.deepEqual(
  getDeviceConfigurations(devices.get("vivo-x300-ultra-2026")).map((configuration) => configuration.key),
  ["12GB|256GB", "12GB|512GB", "16GB|512GB", "16GB|1TB"],
  "vivo configurations must preserve the official memory and storage combinations",
);
assert.equal(devices.get("vivo-x300-ultra-2026").mainCameraMp, 200);
assert.deepEqual(
  ["oppo-find-x7-ultra-2024", "oppo-find-x8-ultra-2025", "oppo-find-x9-ultra-2026"]
    .map((id) => getPricesForComparison(devices.get(id), "used")[0]?.value),
  [2499, 4099, 6599],
  "verified OPPO used-price snapshots should remain available",
);
assert.deepEqual(
  ["vivo-x100-ultra-2024", "vivo-x200-ultra-2025", "vivo-x300-ultra-2026"]
    .map((id) => getPricesForComparison(devices.get(id), "used")[0]?.value),
  [undefined, 4059, 6499],
  "vivo should expose only uniquely matched used-price snapshots",
);
assert.deepEqual(
  devices.get("huawei-pura-80-ultra-2025").configurations,
  [
    { memory: "16GB", storage: "512GB" },
    { memory: "16GB", storage: "1TB" },
  ],
  "HUAWEI Pura Ultra configurations must preserve official China variants",
);
assert.equal(devices.get("huawei-pura-70-ultra-2024").benchmarks[0].score, 163);
assert.equal(devices.get("huawei-pura-80-ultra-2025").benchmarks[0].score, 175);
assert.deepEqual(
  ["huawei-pura-70-ultra-2024", "huawei-pura-80-ultra-2025"]
    .map((id) => getPricesForComparison(devices.get(id), "used")[0]?.value),
  [2899, 4749],
  "verified HUAWEI Pura Ultra used-price snapshots should remain available",
);

console.log("Passed compare configuration scenarios: shared_storage_options, latest_configuration_label, memory_table_value, mainstream_cap, latest_device_options, legacy_highest_only, legacy_price_visible, multi_configuration_prices, ipad_memory_tiers, macbook_independent_options, explicit_second_brand_configurations, xiaomi_used_prices, oppo_official_configurations, vivo_official_configurations, domestic_ultra_used_prices, huawei_pura_ultra_pilot, huawei_pura_used_prices");
