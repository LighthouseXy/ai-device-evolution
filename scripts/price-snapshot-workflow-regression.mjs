import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { fetchWithRetry, readHtmlResponse } from "./lib/fetch-with-retry.mjs";
import { normalizeProductName } from "./lib/normalize-product-name.mjs";
import { buildPricePlan } from "./lib/price-plan.mjs";
import { selectedJiUsedItem } from "./lib/ji-used-item.mjs";
import { isValidObservationDate } from "./lib/price-date.mjs";

const chinaMidnight = new Date("2026-09-21T16:01:00Z");
assert.equal(await readHtmlResponse(new Response("中文 ￥5999")), "中文 ￥5999");
const chineseGbk = Uint8Array.from([0xd6, 0xd0, 0xce, 0xc4]);
assert.equal(await readHtmlResponse(new Response(chineseGbk, { headers: { "content-type": "text/html; charset=gb2312" } })), "中文");
const meta = '<meta charset="gbk">';
assert.equal(await readHtmlResponse(new Response(Buffer.concat([Buffer.from(meta), chineseGbk]))), `${meta}中文`);
await assert.rejects(readHtmlResponse(new Response(Uint8Array.from([0xff]))), /encoded data/);
for (const valid of ["2024-02-29", "2026-09-22"]) assert.ok(isValidObservationDate(valid, chinaMidnight));
for (const invalid of ["2026-02-29", "2026-02-31", "2026-13-01", "2026-09-23", "2026-9-22", null]) assert.equal(isValidObservationDate(invalid, chinaMidnight), false);

const usedText = "¥ 5399 已优惠200 9 成新 新机价 ¥6499 华为 Mate 80 Pro 晨曦金 16G+512G 国行 机况 100% 电池寿命 AI点评 验机报告 先验机再付款 库存编号： 4824226 100% 电池寿命 未检出维修痕迹 维修历史 国行 版本 二手良品需人工一机一验";
const usedItem = selectedJiUsedItem(usedText, "https://m2.9ji.com/secondHand/detail/1");
assert.equal(usedItem.product, "华为 Mate 80 Pro 晨曦金 16G+512G 国行");
assert.equal(usedItem.price, 5399, "never use the crossed-out new-device price");
assert.equal(usedItem.mainland, true);
const macTitleOnly = usedText.replace("华为 Mate 80 Pro 晨曦金 16G+512G 国行", "苹果 MacBook Air 2026款 M5版 15.3英寸 星光色 24G 1TB");
assert.equal(selectedJiUsedItem(macTitleOnly, "https://m2.9ji.com/secondHand/detail/1").product, "苹果 MacBook Air 2026款 M5版 15.3英寸 星光色 24G 1TB");
assert.equal(selectedJiUsedItem(macTitleOnly.replace("国行 版本", "港版 版本"), "https://m2.9ji.com/secondHand/detail/1").mainland, false, "a parsed title must never imply the market");
assert.equal(usedItem.batteryHealth, "100%");
for (const health of ["80%以下", "96%-99%", "90%以上"]) {
  assert.equal(selectedJiUsedItem(usedText.replaceAll("100%", health), "https://m2.9ji.com/secondHand/detail/1").batteryHealth, health, "preserve battery ranges and bounds instead of losing their qualifier");
}
assert.equal(usedItem.purchaseNotice, null);
assert.equal(usedItem.functionalInspection, null, "missing inspection details must not imply a pass");
for (const report of ["13项正常", "1项异常 12项正常 屏幕进灰 少量灰点"]) {
  const inspected = selectedJiUsedItem(usedText.replace("二手良品需人工一机一验", `功能检测 ${report} 附件清单 无充电头 二手良品需人工一机一验`), "https://m2.9ji.com/secondHand/detail/1");
  assert.equal(inspected.functionalInspection, report, "compact inspection must preserve defects beyond the exterior summary");
}
assert.equal(selectedJiUsedItem(usedText.replace("AI点评", "参数 麒麟9030 Pro 处理器 AI点评"), "https://m2.9ji.com/secondHand/detail/1").purchaseNotice, null, "stop at the first section marker, not the later parameters section");
const notice = "因检测条件限制，本机暂无法核实原机主eSIM是否已解绑。";
const warnedItem = selectedJiUsedItem(usedText.replace("国行 机况", `国行 ${notice} 机况`), "https://m2.9ji.com/secondHand/detail/1");
assert.equal(warnedItem.product, usedItem.product);
assert.equal(warnedItem.purchaseNotice, notice, "a normal inspection report must not hide a separate purchase limitation");
assert.equal(selectedJiUsedItem(usedText.replace("华为 Mate 80 Pro", "荣耀Magic8 Pro"), "https://m2.9ji.com/secondHand/detail/1").product,
  "荣耀Magic8 Pro 晨曦金 16G+512G 国行", "brand and model do not always have a separating space");
assert.equal(selectedJiUsedItem(usedText.replace("未检出维修痕迹", "官方售后更换小板"), "https://m2.9ji.com/secondHand/detail/1").repairHistory, "官方售后更换小板");
assert.equal(selectedJiUsedItem(usedText.replace("AI点评", ""), "https://m2.9ji.com/secondHand/detail/1"), null);
assert.equal(selectedJiUsedItem(usedText.replace("AI点评", "降价通知"), "https://m2.9ji.com/secondHand/detail/1").price, 5399, "tablet pages without AI commentary retain the selected item boundary");

const script = "scripts/price-snapshot-workflow.mjs";
const appleDataPaths = ["src/data/apple-devices-db.json", "src/data/apple-sources.json"];
const beforePriceSync = appleDataPaths.map((path) => fs.readFileSync(path, "utf8"));
const priceSync = spawnSync(process.execPath, ["--input-type=module", "-e",
  'globalThis.fetch = () => { throw new Error("prices-only must not use network"); }; process.argv.push("--prices-only", "--check"); await import("./scripts/sync-apple-zh-cn-data.mjs");',
], { encoding: "utf8" });
assert.equal(priceSync.status, 0, priceSync.stderr);
assert.deepEqual(appleDataPaths.map((path) => fs.readFileSync(path, "utf8")), beforePriceSync, "prices-only must be idempotent on synchronized data, without altering specifications");
for (const args of [["--field-only=launchPrice"], ["--field-only=weight", "--chip-only"], ["--devices="], ["--devices=missing-device"], ["--devices=iphone-18-pro", "--field-only=mainCamera"]]) {
  const result = spawnSync(process.execPath, ["scripts/sync-apple-zh-cn-data.mjs", ...args, "--offline"], { encoding: "utf8" });
  assert.notEqual(result.status, 0, "targeted specification refresh must reject unsupported or conflicting fields");
}
assert.deepEqual(appleDataPaths.map((path) => fs.readFileSync(path, "utf8")), beforePriceSync, "invalid targeted refresh must never write data");

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
assert.match(help.stdout, /--product/);
assert.match(help.stdout, /--products-only/);
assert.match(help.stdout, /--pages/);
assert.match(help.stdout, /--require/);
assert.match(help.stdout, /--exclude/);
assert.match(help.stdout, /--available/);
assert.match(help.stdout, /--render/);
assert.match(help.stdout, /--compact/);
assert.match(help.stdout, /--match/);
assert.match(help.stdout, /--all-styles/);
assert.match(help.stdout, /validate/);
assert.match(help.stdout, /apply/);
assert.equal(normalizeProductName("  苹果  MacBook\tPro  "), "苹果 MacBook Pro");

const planResult = run(["plan", "--type", "current", "--category", "phone", "--limit", "5", "--json"]);
assert.equal(planResult.status, 0, planResult.stderr);
const plan = JSON.parse(planResult.stdout);
assert.equal(plan.length, 5);
assert.ok(plan.every((row) => row.category === "phone" && row.priceType === "current"));
assert.ok(plan.every((row) => row.configuration && row.searchQuery.includes("国行")));
const devicesById = new Map(JSON.parse(fs.readFileSync("src/data/devices-db.json", "utf8")).devices.map((device) => [device.id, device]));
const observations = JSON.parse(fs.readFileSync("src/data/price-observations.json", "utf8"));
for (const prices of Object.values(observations.current)) {
  for (const price of [prices].flat()) {
    if (/中国大陆电商渠道参考/.test(price.configuration) && !/国行/.test(price.configuration)) {
      assert.ok(price.excludedReason, "channel-only historical quotes must be retained but excluded until the hardware market is verified");
    }
  }
}
assert.ok(plan.every((row) => row.status === "missing_price" && row.configurationKey && row.market === "CN"));
const completePlan = buildPricePlan([...devicesById.values()], observations, { priceType: "current" });
assert.ok(completePlan.every((row) => row.priority === (row.status === "verify_configuration" ? "P1" : "P2")));
assert.deepEqual(completePlan.map((row) => row.priority), completePlan.map((row) => row.priority).sort());
const brandOrder = completePlan.filter((row) => row.priority === "P2").map((row) => devicesById.get(row.deviceId).brand);
const honorStart = brandOrder.indexOf("HONOR");
assert.ok(honorStart < 0 || brandOrder.slice(honorStart).every((brand) => brand === "HONOR"), "Honor price collection remains behind the four priority brands without overriding configuration verification");
const firstOtherBrand = brandOrder.findIndex((brand) => !["Xiaomi", "Samsung", "OPPO", "vivo"].includes(brand));
assert.ok(firstOtherBrand < 0 || !brandOrder.slice(firstOtherBrand).some((brand) => ["Xiaomi", "Samsung", "OPPO", "vivo"].includes(brand)));
const unverifiedAir = { ...devicesById.get("macbook-air-13-m2-2022"), configurations: undefined };
assert.equal(buildPricePlan([...devicesById.values()].map((device) => device.id === unverifiedAir.id ? unverifiedAir : device), observations, { priceType: "used", limit: 1 })[0].priority, "P1", "apply the limit after prioritizing configuration truth over used-price gaps");
assert.ok(!completePlan.some((row) => row.deviceId === "iphone-17" && row.configurationKey === "8GB|512GB"));
assert.ok(!completePlan.some((row) => row.deviceId === "iphone-17" && row.configurationKey === "8GB|256GB"));
assert.ok(!completePlan.some((row) => row.deviceId === "macbook-air-13-m3-2024" && row.status === "verify_configuration"));
assert.ok(completePlan.some((row) => row.deviceId === "macbook-air-13-m3-2024" && row.status === "missing_price" && row.configurationKey === "24GB|2TB"));
assert.ok(!completePlan.some((row) => row.deviceId === "macbook-air-13-m5-2026"), "verified M5 RAM/storage matrix and all current price tiers close this model's current-price plan");
assert.ok(!completePlan.some((row) => row.deviceId === "macbook-air-15-m5-2026"), "verified 15-inch M5 configurations all have current quotes");
assert.ok(!completePlan.some((row) => row.deviceId === "honor-magic7-pro-2024" && row.configurationKey === "16GB|256GB"));
assert.ok(completePlan.some((row) => row.deviceId === "iphone-8-2017" && row.configurationKey === "2GB|256GB"));
assert.equal(completePlan.filter((row) => row.deviceId === "iphone-8-2017").length, 1, "older generations only target their verified highest configuration");

const usedPlanResult = run(["plan", "--type", "used", "--category", "phone", "--limit", "10000", "--json"]);
assert.equal(usedPlanResult.status, 0, usedPlanResult.stderr);
const usedPlan = JSON.parse(usedPlanResult.stdout);
assert.ok(usedPlan.every((row) => row.priority === "P3"));
assert.ok(usedPlan.some((row) => row.deviceId === "xiaomi-mi-10-ultra-2020"));
assert.ok(!usedPlan.some((row) => row.deviceId === "iphone-17" && row.configurationKey === "8GB|512GB"), "verified 512GB used quote fills only the used-price gap");
const overseas = structuredClone(observations);
overseas.current["iphone-17"] = { value: 4000, configuration: "8GB 运行内存 + 256GB 存储，美版", condition: "全新", market: "US" };
assert.ok(buildPricePlan([...devicesById.values()], overseas, { priceType: "current" }).some((row) => row.deviceId === "iphone-17" && row.configurationKey === "8GB|256GB"), "overseas quotes cannot fill mainland gaps");
const excluded = structuredClone(observations);
const opened = structuredClone(observations);
opened.current["iphone-17"] = { value: 5000, configuration: "8GB 运行内存 + 256GB 存储，国行", condition: "全新仅拆封" };
assert.ok(buildPricePlan([...devicesById.values()], opened, { priceType: "current" }).some((row) => row.deviceId === "iphone-17" && row.configurationKey === "8GB|256GB"), "open-box quotes must not close new-device price gaps");
excluded.current["iphone-17"] = { value: 4000, configuration: "8GB 运行内存 + 256GB 存储，国行", condition: "全新", excludedReason: "测试：报价不适合作为参考" };
assert.ok(buildPricePlan([...devicesById.values()], excluded, { priceType: "current" }).some((row) => row.deviceId === "iphone-17" && row.configurationKey === "8GB|256GB"), "excluded quotes must not fill price gaps");

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
for (const sourceUrl of [
  "https://item.jd.com/100000000001.html",
  "https://item.taobao.com/item.htm?id=100000000001",
  "https://detail.tmall.com/item.htm?id=100000000001",
  "https://mobile.yangkeduo.com/goods.html?goods_id=100000000001",
]) {
  const platformResult = run(["validate", "-"], JSON.stringify([{ ...candidate[0], sourceUrl, sourceName: new URL(sourceUrl).hostname }]));
  assert.equal(platformResult.status, 0, `${sourceUrl}: ${platformResult.stderr}`);
}
for (const condition of ["二手公开价", "当前价", "全新仅拆封", "全新资源机", "全新，自营退货", "准新品，基本全新", "全新翻新机"]) {
  const rejected = run(["validate", "-"], JSON.stringify([{ ...candidate[0], condition }]));
  assert.notEqual(rejected.status, 0, `${condition} must not be accepted as an ordinary new-device quote`);
  assert.match(rejected.stderr, /普通新机价/);
}
const channelOnly = run(["validate", "-"], JSON.stringify([{ ...candidate[0], configuration: `${plan[0].configuration}，中国大陆电商渠道参考` }]));
assert.notEqual(channelOnly.status, 0);
assert.match(channelOnly.stderr, /电商渠道不代表硬件版本/);
for (const unknownMarket of [false, true]) {
const preserveBaseline = spawnSync(process.execPath, ["--input-type=module", "-e", `
  import fs from "node:fs";
  import assert from "node:assert/strict";
  const read = fs.readFileSync;
  const database = JSON.parse(read("src/data/devices-db.json", "utf8"));
  const original = database.devices.find((device) => device.id === "iphone-17").specs.currentPrice;
  if (${unknownMarket}) original.configuration = "白色，256GB";
  fs.readFileSync = (path, ...args) => path === "src/data/price-observations.json" ? JSON.stringify({ current: {}, used: {} })
    : path === "src/data/devices-db.json" ? JSON.stringify(database) : read(path, ...args);
  let writes = 0;
  fs.writeFileSync = (path, text) => {
    assert.equal(path, "src/data/price-observations.json", "test must never write other files");
    const entries = JSON.parse(text).current["iphone-17"];
    assert.equal(entries.length, 2);
    assert.deepEqual(entries[0], ${unknownMarket} ? { ...original, excludedReason: "原始报价未明确国行配置，待复核" } : original, "preserve evidence without laundering an unknown version into a mainland quote");
    assert.match(entries[1].configuration, /512GB/);
    writes++;
  };
  process.argv = [process.execPath, "${script}", "apply", "-"];
  await import("./${script}");
  assert.equal(writes, 1);
`], { encoding: "utf8", input: JSON.stringify([{ ...candidate[0], deviceId: "iphone-17", configuration: "8GB 运行内存 + 512GB 存储，国行" }]) });
assert.equal(preserveBaseline.status, 0, preserveBaseline.stderr);
}
for (const observedAt of ["2026-02-31", "9999-01-01"]) {
  const result = run(["validate", "-"], JSON.stringify([{ ...candidate[0], observedAt }]));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /真实的 YYYY-MM-DD/);
}
const excludedResult = run(["validate", "-"], JSON.stringify([{ ...candidate[0], excludedReason: "已核实的异常报价" }]));
assert.equal(excludedResult.status, 0, excludedResult.stderr);
assert.match(excludedResult.stdout, /验证通过 1 条/);
assert.notEqual(run(["validate", "-"], JSON.stringify([{ ...candidate[0], excludedReason: false }])).status, 0);

const zolResult = run(["validate", "-"], JSON.stringify([{
  ...candidate[0],
  sourceUrl: "https://detail.zol.com.cn/example",
  sourceName: "ZOL 中关村在线",
}]));
assert.equal(zolResult.status, 0, zolResult.stderr);
assert.match(zolResult.stdout, /验证通过 1 条/);

const multiConfigurationResult = run(["validate", "-"], JSON.stringify([
  {
    ...candidate[0],
    deviceId: "macbook-air-13-m3-2024",
    configuration: "8GB 运行内存 + 256GB 存储，国行",
  },
  {
    ...candidate[0],
    deviceId: "macbook-air-13-m3-2024",
    configuration: "16GB 运行内存 + 256GB 存储，国行",
  },
]));
assert.equal(multiConfigurationResult.status, 0, multiConfigurationResult.stderr);
assert.match(multiConfigurationResult.stdout, /验证通过 2 条/);

const invalidResult = run(["validate", "-"], JSON.stringify([{ ...candidate[0], configuration: "黑色，999TB，国行" }]));
assert.notEqual(invalidResult.status, 0);
assert.match(invalidResult.stderr, /有效运行内存/);

const invalidStorageResult = run(["validate", "-"], JSON.stringify([{
  ...candidate[0],
  configuration: `${plan[0].configuration.split(" + ")[0]}，黑色，999TB，国行`,
}]));
assert.notEqual(invalidStorageResult.status, 0);
assert.match(invalidStorageResult.stderr, /有效存储容量/);

for (const [deviceId, configuration] of [
  ["iphone-17", "2GB 运行内存 + 256GB 存储"],
  ["iphone-17", "8GB 运行内存 + 1256GB 存储"],
  ["honor-magic7-pro-2024", "16GB 运行内存 + 256GB 存储"],
  ["honor-magic8-pro-2025", "512GB 存储"],
]) {
  const result = run(["validate", "-"], JSON.stringify([{ ...candidate[0], deviceId, configuration: `${configuration}，国行` }]));
  assert.notEqual(result.status, 0, `${deviceId}: ${configuration} must fail validation`);
}
const samsungQuotes = [observations.current["samsung-galaxy-s26-ultra-2026"]].flat();
for (const overrides of [
  { configuration: `${plan[0].configuration}，美版` },
  { configuration: `${plan[0].configuration}，国行/港版混发` },
  { configuration: plan[0].configuration },
  { market: "US" }, { unit: "USD" },
]) assert.notEqual(run(["validate", "-"], JSON.stringify([{ ...candidate[0], ...overrides }])).status, 0, "unknown or overseas versions must not be imported as mainland CNY prices");
const samsungResult = run(["validate", "-"], JSON.stringify(samsungQuotes.map((quote) => ({ ...quote, deviceId: "samsung-galaxy-s26-ultra-2026", priceType: "current" }))));
assert.equal(samsungResult.status, 0, samsungResult.stderr);
const coreVariants = [8, 10].map((cores) => ({ ...candidate[0], deviceId: "macbook-air-13-m3-2024", configuration: `8GB 运行内存 + 256GB 存储，${cores} 核 GPU，国行` }));
assert.equal(run(["validate", "-"], JSON.stringify(coreVariants)).status, 0, "distinct GPU variants must both survive ingestion");

const invalidSearchLimit = run(["search", "iPad Air M3", "--limit", "0"]);
assert.notEqual(invalidSearchLimit.status, 0);
assert.match(invalidSearchLimit.stderr, /1-100/);

const invalidSearchPages = run(["search", "iPad Air M3", "--pages", "0"]);
assert.notEqual(invalidSearchPages.status, 0);
assert.match(invalidSearchPages.stderr, /1-5/);

const originalFetch = globalThis.fetch;
let fetchAttempts = 0;
try {
  globalThis.fetch = async () => {
    fetchAttempts += 1;
    if (fetchAttempts === 1) throw new TypeError("fetch failed");
    return new Response("ok");
  };
  assert.equal((await fetchWithRetry("https://example.com", { timeoutMs: 100 })).status, 200);
  assert.equal(fetchAttempts, 2);
} finally {
  globalThis.fetch = originalFetch;
}

console.log("Passed price snapshot workflow regression scenarios: help, filtered_search_options, normalized_product_names, product_name_listing, paginated_search, inspect_sku_filter_help, plan, observation_aware_plan, validate, reject_invalid_memory, reject_invalid_storage, reject_invalid_search_limit, reject_invalid_search_pages, transient_fetch_retry");
