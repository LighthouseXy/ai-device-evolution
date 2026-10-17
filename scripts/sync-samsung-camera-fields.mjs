import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { getSourceSnapshot } from "./lib/source-snapshot.mjs";
import { readSamsungCameraSpecs } from "./lib/android-official-specs.mjs";

const { datasets } = JSON.parse(await fs.readFile("src/data/device-data-manifest.json", "utf8"));
let devices = 0, added = 0, revised = 0;
for (const dataset of datasets.filter((entry) => entry.brand === "Samsung")) {
  const file = `src/data/${dataset.devices}`;
  const database = JSON.parse(await fs.readFile(file, "utf8"));
  let changed = false;
  for (const device of database.devices) {
    const model = device.modelName.replace(/^Samsung /, "");
    if (!/^Galaxy S2[456](?:\+| Ultra)?$/.test(model)) continue;
    const series = model.match(/S\d+/)[0].toLowerCase(), ultra = model.endsWith("Ultra");
    const url = `https://www.samsung.com.cn/smartphones/galaxy-${series}${ultra ? "-ultra" : ""}/`;
    const page = await getSourceSnapshot(url, { offline: true });
    assert.ok(page.html.includes(model.replace("+", "")), `${device.id}: 官网缺少目标型号`);
    let updated = false;
    for (const [key, field] of Object.entries(readSamsungCameraSpecs(page, model))) {
      if (JSON.stringify(device.specs[key]) === JSON.stringify(field)) continue;
      if (device.specs[key]) revised++; else added++;
      device.specs[key] = field; updated = true;
    }
    if (updated) { devices++; changed = true; }
  }
  if (changed) await fs.writeFile(file, `${JSON.stringify(database, null, 2)}\n`);
}
console.log(JSON.stringify({ updatedDevices: devices, addedOfficialFields: added, updatedOfficialFields: revised }));
