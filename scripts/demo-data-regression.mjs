import assert from "node:assert/strict";
import fs from "node:fs";
import { loadTsModule } from "./lib/load-ts-module.mjs";
import { validateDeviceRecords } from "./lib/validate-device-records.mjs";
const fixture = JSON.parse(fs.readFileSync("examples/demo-devices.json", "utf8"));
const generated = JSON.parse(fs.readFileSync("src/data/devices-db.json", "utf8"));
assert.deepEqual(generated.devices, fixture.devices);
assert.equal(validateDeviceRecords(generated).records, 30);
assert.equal(new Set(generated.devices.map(device => device.brand)).size, 2);
assert.equal(new Set(generated.devices.map(device => device.category)).size, 5);
for (const device of generated.devices) {
  assert.match(device.modelName, /^(Example|Demo) /);
  for (const field of Object.values(device.specs)) assert.equal(new URL(field.sourceUrl).hostname, "example.invalid");
}
const { catalogDevicesFlat, getCatalogSeriesOptions, getDevicesByComparisonGroupKeyFlat } = loadTsModule("@/lib/devices-db");
assert.equal(catalogDevicesFlat.length, 30);
assert.equal(getCatalogSeriesOptions(2).length, 10);
for (const series of getCatalogSeriesOptions(2)) assert.equal(getDevicesByComparisonGroupKeyFlat(series.key).length, 3);
for (const filename of ["device-images.json", "device-image-galleries.json", "device-image-render-repairs.json", "adopted-image-assets.json", "device-reference-display.json", "device-gallery-identity.json", "device-image-byte-cache.json"]) {
  assert.equal(Object.keys(JSON.parse(fs.readFileSync(`src/data/${filename}`, "utf8"))).length, 0);
}
const broken = structuredClone(generated); broken.devices.push(broken.devices[0]);
assert.throws(() => validateDeviceRecords(broken));
process.env.OPENAI_API_KEY = ""; process.env.DEEPSEEK_API_KEY = ""; process.env.AI_PROVIDER = "";
globalThis.fetch = () => { throw new Error("Network denied in synthetic regression"); };
const { POST } = loadTsModule("@/app/api/device-advisor/route");
const input = { budget: { min: 1000, max: 5000 }, category: "phone", performancePreference: "balanced", useCases: ["Demo"], intent: "Demo synthetic only", replacementIntent: "first_device", maxResults: 3 };
const response = await POST(new Request("http://localhost/api/device-advisor", { method: "POST", body: JSON.stringify(input) }));
assert.equal(response.status, 200);
const output = await response.json();
assert.equal(output.source, "rules");
assert.ok(output.devices.length > 0 && output.devices.length <= 3);
for (const device of output.devices) assert.ok(catalogDevicesFlat.some(item => item.id === device.deviceId));
const css = fs.readFileSync("src/app/globals.css", "utf8");
assert.ok(!/url\(\s*["']?https?:/i.test(css));
console.log("30 records, 2 fictional brands, 5 categories, 10 three-generation groups, no media, duplicate negative, and real advisor API rules fallback passed");
