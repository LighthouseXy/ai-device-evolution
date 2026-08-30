import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const script = "scripts/price-snapshot-workflow.mjs";

function run(args, input) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    input,
  });
}

const help = run(["--help"]);
assert.equal(help.status, 0, help.stderr);
assert.match(help.stdout, /plan/);
assert.match(help.stdout, /inspect/);
assert.match(help.stdout, /search/);
assert.match(help.stdout, /--render/);
assert.match(help.stdout, /validate/);
assert.match(help.stdout, /apply/);

const planResult = run(["plan", "--type", "current", "--category", "phone", "--limit", "5", "--json"]);
assert.equal(planResult.status, 0, planResult.stderr);
const plan = JSON.parse(planResult.stdout);
assert.equal(plan.length, 5);
assert.ok(plan.every((row) => row.category === "phone" && row.priceType === "current"));
assert.ok(plan.every((row) => row.configuration && row.searchQuery.includes("国行")));
const devicesById = new Map(JSON.parse(fs.readFileSync("src/data/apple-devices-db.json", "utf8")).devices.map((device) => [device.id, device]));
assert.ok(plan.every((row) => !devicesById.get(row.deviceId).specs.currentPrice?.value));

const candidate = [{
  deviceId: plan[0].deviceId,
  priceType: "current",
  value: 6999,
  sourceUrl: "https://www.shihuo.cn/example",
  sourceName: "识货",
  rawText: "回归测试候选，不写入正式库。",
  configuration: `${plan[0].configuration}，黑色，国行`,
  condition: "全新，页面公开价",
  observedAt: "2026-08-31",
}];
const validResult = run(["validate", "-"], JSON.stringify(candidate));
assert.equal(validResult.status, 0, validResult.stderr);
assert.match(validResult.stdout, /验证通过 1 条/);

const invalidResult = run(["validate", "-"], JSON.stringify([{ ...candidate[0], configuration: "黑色，2TB，国行" }]));
assert.notEqual(invalidResult.status, 0);
assert.match(invalidResult.stderr, /有效运行内存/);

const invalidStorageResult = run(["validate", "-"], JSON.stringify([{
  ...candidate[0],
  configuration: `${plan[0].configuration.split(" + ")[0]}，黑色，2TB，国行`,
}]));
assert.notEqual(invalidStorageResult.status, 0);
assert.match(invalidStorageResult.stderr, /有效存储容量/);

const invalidSearchLimit = run(["search", "iPad Air M3", "--limit", "0"]);
assert.notEqual(invalidSearchLimit.status, 0);
assert.match(invalidSearchLimit.stderr, /1-100/);

console.log("Passed price snapshot workflow regression scenarios: help, plan, validate, reject_invalid_memory, reject_invalid_storage, reject_invalid_search_limit");
