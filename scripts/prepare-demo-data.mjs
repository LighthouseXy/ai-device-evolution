import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateDeviceRecords } from "./lib/validate-device-records.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
if (fs.realpathSync(process.cwd()) !== fs.realpathSync(root)) throw new Error("Run only at the isolated sample distribution root");
const marker = JSON.parse(fs.readFileSync(path.join(root, ".sample-distribution.json"), "utf8"));
if (marker.kind !== "devicescope-full-app-synthetic-demo") throw new Error("Not a sample distribution; refusing data writes");
const fixture = JSON.parse(fs.readFileSync("examples/demo-devices.json", "utf8"));
validateDeviceRecords(fixture);
if (fixture.devices.some(device => !/^(Example|Demo) /.test(device.modelName) || !["Example", "Demo"].includes(device.brand))) throw new Error("Only synthetic identities allowed");
const data = {
  "devices-db.json": { metadata: { version: "2.0", totalDevices: fixture.devices.length, synthetic: true }, devices: fixture.devices },
  "price-observations.json": JSON.parse(fs.readFileSync("examples/demo-prices.json", "utf8")),
  "device-model-groups.json": { groups: [], names: {} },
  "device-images.json": {}, "device-image-galleries.json": {},
  "device-image-render-repairs.json": [], "adopted-image-assets.json": [],
  "device-reference-display.json": [], "device-gallery-identity.json": {}, "device-image-byte-cache.json": [],
};
fs.mkdirSync("src/data", { recursive: true });
for (const [name, value] of Object.entries(data)) fs.writeFileSync(path.join("src/data", name), `${JSON.stringify(value, null, 2)}\n`);
console.log(`prepared ${fixture.devices.length} fictional records; 10 runtime JSON files; no production data or media`);
