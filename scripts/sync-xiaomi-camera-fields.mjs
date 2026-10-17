import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { getSourceSnapshot } from "./lib/source-snapshot.mjs";
import { assertZolModel, readZolCameraSpecs } from "./lib/zol-device.mjs";

const targets = new Set(JSON.parse(await fs.readFile("scripts/fixtures/xiaomi-camera-targets.json", "utf8")));
const { datasets } = JSON.parse(await fs.readFile("src/data/device-data-manifest.json", "utf8"));
let devices = 0, added = 0, revised = 0;
for (const dataset of datasets.filter((entry) => entry.brand === "Xiaomi")) {
  const file = `src/data/${dataset.devices}`, sourceFile = `src/data/${dataset.sources}`;
  const database = JSON.parse(await fs.readFile(file, "utf8")), registry = JSON.parse(await fs.readFile(sourceFile, "utf8"));
  let changed = false;
  for (const device of database.devices.filter((entry) => targets.has(entry.id))) {
    const source = Object.values(registry).flat().find((entry) => entry.id === device.id);
    assert.ok(source && !source.fieldCorrections?.length && !source.withheldSpecifications?.length, `${device.id}: 来源已隔离，不自动扩展`);
    const url = source.referenceUrls.find((entry) => /^https:\/\/detail\.zol\.com\.cn\/.*(?:\/param\.shtml|\/param_\d+_0_1\.html)$/.test(entry));
    assert.ok(url, `${device.id}: 无已登记中国参数来源`);
    const page = await getSourceSnapshot(url, { offline: true });
    assertZolModel(page, device.modelName);
    const fields = readZolCameraSpecs(page);
    assert.ok(fields.mainCamera && fields.rearCamera, `${device.id}: 镜头无法完整绑定`);
    let updated = false;
    for (const [key, field] of Object.entries(fields)) {
      if (device.specs[key]?.sourceType === "official" || JSON.stringify(device.specs[key]) === JSON.stringify(field)) continue;
      if (device.specs[key]) revised++; else added++;
      device.specs[key] = field; updated = true;
    }
    if (updated) { devices++; changed = true; }
    targets.delete(device.id);
  }
  if (changed) await fs.writeFile(file, `${JSON.stringify(database, null, 2)}\n`);
}
assert.equal(targets.size, 0, `未找到目标：${[...targets]}`);
console.log(JSON.stringify({ updatedDevices: devices, addedReferenceFields: added, updatedReferenceFields: revised }));
