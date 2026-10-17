import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { getSourceSnapshot } from "./lib/source-snapshot.mjs";
import { readOfficialAndroidSpecs, readOfficialCameraSpecs } from "./lib/android-official-specs.mjs";
import { plainText } from "./lib/zol-device.mjs";

// 对已核对型号的中国官网规格做小批扩展；默认离线，不刷新全库来源。
const { datasets } = JSON.parse(await fs.readFile("src/data/device-data-manifest.json", "utf8"));
const cameras = process.argv.includes("--cameras");
const targets = new Map(JSON.parse(await fs.readFile(cameras ? "scripts/fixtures/android-camera-targets.json" : "scripts/fixtures/android-official-field-targets.json", "utf8"))
  .map((entry) => [entry.id, entry.sourceUrl]));
let added = 0, revised = 0, updatedDevices = 0;
for (const dataset of datasets.filter((item) => (cameras ? ["Huawei", "OPPO", "vivo"] : ["OPPO", "vivo"]).includes(item.brand))) {
  const file = `src/data/${dataset.devices}`;
  const database = JSON.parse(await fs.readFile(file, "utf8"));
  const registry = JSON.parse(await fs.readFile(`src/data/${dataset.sources}`, "utf8"));
  let changed = false, registryChanged = false;
  for (const device of database.devices) {
    if (cameras && !targets.has(device.id)) continue;
    const source = Object.values(registry).flat().find((item) => item.id === device.id);
    const url = targets.get(device.id) ?? source?.officialSpecUrl;
    if (!url || !source || device.category !== "phone") continue;
    const page = await getSourceSnapshot(url, { offline: !process.argv.includes("--fetch") });
    const hostname = new URL(page.url).hostname;
    assert.ok(dataset.brand === "OPPO" ? hostname === "www.oppo.com" && page.url.includes("/cn/")
      : dataset.brand === "Huawei" ? hostname === "consumer.huawei.com" && page.url.includes("/cn/")
        : hostname === "www.vivo.com.cn", `${device.id}: 必须使用该品牌中国官网`);
    const compact = (value) => value.replace(/[\s()（）]/g, "").toLowerCase();
    const title = compact(plainText(page.html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "")).replace(/^(?:oppo|vivo)/, "");
    const expected = compact(device.modelName).replace(/^(?:oppo|vivo)/, "");
    const at = title.indexOf(expected);
    assert.ok(at >= 0 && !/^[a-z\d+]/.test(title.slice(at + expected.length)), `${device.id}: 官网必须是准确型号`);
    if (source.officialSpecUrl !== url) { source.officialSpecUrl = url; registryChanged = true; }
    const fields = cameras ? readOfficialCameraSpecs(dataset.brand, page) : readOfficialAndroidSpecs(dataset.brand, page);
    if (cameras) {
      source.cameraVerification = { sourceUrl: url, sourceSnapshotHash: page.sha256, fetchedAt: page.fetchedAt,
        fields: Object.keys(fields) };
      registryChanged = true;
    }
    const missing = Object.entries(fields).filter(([key, field]) => cameras ? JSON.stringify(device.specs[key]) !== JSON.stringify(field) : !device.specs[key]);
    if (!missing.length) continue;
    const newFields = missing.filter(([key]) => !device.specs[key]).length;
    added += newFields; revised += missing.length - newFields;
    Object.assign(device.specs, Object.fromEntries(missing));
    updatedDevices += 1; changed = true;
  }
  if (changed) await fs.writeFile(file, `${JSON.stringify(database, null, 2)}\n`);
  if (registryChanged) await fs.writeFile(`src/data/${dataset.sources}`, `${JSON.stringify(registry, null, 2)}\n`);
}
console.log(JSON.stringify({ updatedDevices, addedOfficialFields: added, updatedOfficialFields: revised }));
