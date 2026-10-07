import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { getSourceSnapshot } from "./lib/source-snapshot.mjs";
import { plainText, readZolOptionalSpecs } from "./lib/zol-device.mjs";
import { samsungProductRows } from "./lib/android-official-specs.mjs";

// 只重放已核验参数快照中的明确字段，官网值不覆盖；有型号混淆/隔离记录的页面不再扩展。
const { datasets } = JSON.parse(await fs.readFile("src/data/device-data-manifest.json", "utf8"));
const exclusions = JSON.parse(await fs.readFile("scripts/fixtures/android-spec-exclusions.json", "utf8"));
const { repairs } = JSON.parse(await fs.readFile("scripts/fixtures/samsung-official-field-repairs.json", "utf8"));
let devices = 0, fields = 0, excludedFields = 0;
for (const dataset of datasets.filter((item) => item.brand !== "Apple")) {
  const file = `src/data/${dataset.devices}`;
  const database = JSON.parse(await fs.readFile(file, "utf8"));
  const sourceFile = `src/data/${dataset.sources}`;
  const sourceData = JSON.parse(await fs.readFile(sourceFile, "utf8"));
  const registry = Object.values(sourceData).flat();
  let changed = false, sourceChanged = false;
  for (const device of database.devices) {
    const source = registry.find((item) => item.id === device.id);
    for (const [field, reason] of Object.entries(exclusions[device.id] ?? {})) {
      const prior = device.specs[field];
      if (!prior || prior.sourceType !== "reference") continue;
      (source.fieldCorrections ??= []).push({ field, reason, action: "removed", priorEvidence: prior });
      delete device.specs[field]; changed = true; sourceChanged = true; excludedFields += 1;
    }
    const repair = repairs.find((entry) => entry.id === device.id);
    if (repair) {
      assert.equal(repair.modelName, device.modelName);
      const page = await getSourceSnapshot(repair.referenceUrls[0], { offline: true });
      assert.equal(page.sha256, repair.sourceSnapshotHash);
      assert.ok(page.html.includes(`value="${repair.modelCode}"`));
      assert.equal(plainText(page.html.match(/<h1[^>]*>([^]*?)<\/h1>/)?.[1] ?? ""), device.modelName.replace(/^Samsung /, ""));
      const rows = samsungProductRows(page.html);
      assert.equal(rows.get("内存(GB)") + "GB", repair.configuration.memory);
      assert.equal(rows.get("存储 (GB)") + "GB", repair.configuration.storage);
      assert.equal(rows.get("OS"), repair.specs.operatingSystem.value);
      assert.equal(`主屏：${rows.get("类型")}；外屏：${rows.get("类型 (外屏)")}`, repair.specs.displayType.value);
      for (const [key, value] of Object.entries(repair.specs)) {
        if (JSON.stringify(device.specs[key]) !== JSON.stringify(value)) { device.specs[key] = value; changed = true; }
      }
      const references = [...new Set([...source.referenceUrls ?? [], ...repair.referenceUrls])];
      if (JSON.stringify(references) !== JSON.stringify(source.referenceUrls)) { source.referenceUrls = references; sourceChanged = true; }
    }
    if (source?.fieldCorrections?.length || source?.withheldSpecifications?.length) continue;
    const urls = source?.referenceUrls ?? [];
    const configurationUrl = device.configurations?.[0]?.evidence?.sourceUrl;
    const parameter = (configurationUrl && urls.includes(configurationUrl) && configurationUrl.endsWith("/param.shtml") ? configurationUrl : null)
      ?? urls.find((url) => /^https:\/\/detail\.zol\.com\.cn\/\d+\/\d+\/param\.shtml$/.test(url));
    if (!parameter) continue;
    const page = await getSourceSnapshot(parameter, { offline: true });
    const missing = Object.entries(readZolOptionalSpecs(page)).filter(([key]) => !device.specs[key]);
    if (!missing.length) continue;
    Object.assign(device.specs, Object.fromEntries(missing));
    devices += 1; fields += missing.length; changed = true;
  }
  if (changed) await fs.writeFile(file, `${JSON.stringify(database, null, 2)}\n`);
  if (sourceChanged) await fs.writeFile(sourceFile, `${JSON.stringify(sourceData, null, 2)}\n`);
}
console.log(JSON.stringify({ updatedDevices: devices, addedReferenceFields: fields, excludedFields }));
