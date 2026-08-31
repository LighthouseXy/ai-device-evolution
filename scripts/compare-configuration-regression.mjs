import assert from "node:assert/strict";
import { loadTsModule } from "./lib/load-ts-module.mjs";

const {
  getDeviceConfigurations,
  formatConfigurationsForComparison,
  getPriceForComparison,
} = loadTsModule("./src/lib/device-configurations.ts");
const { allDevicesFlat } = loadTsModule("./src/lib/devices-db.ts");
const devices = new Map(allDevicesFlat.map((device) => [device.id, device]));

const iphone17 = devices.get("iphone-17");
assert.deepEqual(
  getDeviceConfigurations(iphone17).map((configuration) => configuration.key),
  ["8GB|256GB", "8GB|512GB"],
  "iPhone 17 should expose only its real memory and storage combinations",
);

const iphone8 = devices.get("iphone-8-2017");
assert.deepEqual(
  formatConfigurationsForComparison(iphone8, false),
  "2GB + 256GB",
  "devices older than five generations should expose only their highest configuration",
);

const iphone12 = devices.get("iphone-12");
assert.equal(
  getPriceForComparison(iphone12, "used", false),
  null,
  "an older device price from a lower configuration must not be shown as the highest configuration price",
);

const iphone13 = devices.get("iphone-13");
assert.equal(getPriceForComparison(iphone13, "used", true)?.configuration.key, "4GB|256GB");

const ipadProM5 = devices.get("ipad-pro-m5-11-2025");
assert.deepEqual(
  getDeviceConfigurations(ipadProM5).map((configuration) => configuration.key),
  ["12GB|256GB", "12GB|512GB", "16GB|1TB", "16GB|2TB"],
  "iPad memory tiers should stay paired with their supported storage tiers",
);

const macbookProM3Max = devices.get("macbook-pro-14-m3-max-2023");
assert.equal(
  formatConfigurationsForComparison(macbookProM3Max, true),
  "运行内存 36GB / 48GB / 64GB / 96GB / 128GB；存储 1TB / 2TB / 4TB / 8TB",
  "MacBook independent option lists must not be expanded into unverified combinations",
);

console.log("Passed compare configuration scenarios: latest_device_options, legacy_highest_only, legacy_price_match, recent_price_match, ipad_memory_tiers, macbook_independent_options");
