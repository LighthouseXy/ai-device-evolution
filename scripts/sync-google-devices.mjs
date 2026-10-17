import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { getSourceSnapshot } from "./lib/source-snapshot.mjs";
import { googleArticle, googleText, readGooglePhones } from "./lib/google-device.mjs";

const options = { offline: process.argv.includes("--offline"), refresh: process.argv.includes("--refresh") };
const rows = [];
for (const id of [7158570, 16043605]) {
  const page = await getSourceSnapshot(`https://support.google.com/pixelphone/answer/${id}?hl=zh-Hans`, options);
  const imported = readGooglePhones(page);
  const text = googleText(googleArticle(page.html)).replace(/[;\s]/g, "");
  for (const { device, source } of imported) {
    assert.ok(text.includes(source.releaseEvidence.rawText));
    for (const field of [...Object.values(device.specs), ...device.configurations.map(c => c.evidence)]) {
      assert.ok(text.includes(field.rawText.replace(/[;\s]/g, "")), `${device.id}: 字段原文不在快照：${field.rawText.slice(0, 100)}`);
      assert.equal(field.sourceSnapshotHash, page.sha256);
    }
  }
  rows.push(...imported);
}
assert.equal(new Set(rows.map(row => row.device.id)).size, rows.length);
assert.ok(rows.every(row => row.device.market === "GLOBAL" && !row.device.specs.launchPrice));
const generatedAt = rows.map(row => row.source.releaseEvidence.verifiedAt).sort().at(-1);
const output = { metadata: { version: "1.0", generatedAt, totalDevices: rows.length,
  coverage: { minReleaseYear: 2017, asOf: "2026-10-11", market: "GLOBAL", partial: true,
    scope: "官方新旧 Pixel 手机型号表；平板、笔记本和手表另批补入，不代表 Google 全品类已完成" } },
  devices: rows.map(row => row.device) };
const sources = { phone: rows.map(row => row.source), tablet: [], laptop: [], watch: [], band: [] };
for (const [name, data] of [["google-devices-db.json", output], ["google-sources.json", sources]]) {
  const file = new URL(`../src/data/${name}`, import.meta.url), text = JSON.stringify(data, null, 2) + "\n";
  if (process.argv.includes("--check")) assert.equal(await fs.readFile(file, "utf8"), text, `${name}: 离线重放不同`);
  else await fs.writeFile(file, text);
}
console.log(`Google: ${rows.length} 款官方手机 / ${rows.reduce((n, row) => n + row.device.configurations.length, 0)} 个绑定配置；非国行价格留空`);
