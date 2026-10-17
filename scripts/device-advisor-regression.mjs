import assert from "node:assert/strict";
import { loadTsModule } from "./lib/load-ts-module.mjs";
import { reviewAdvisorFacts } from "./lib/advisor-fact-review.mjs";

const cliArgs = new Set(process.argv.slice(2));

function printHelp() {
  console.log([
    "Device advisor regression script.",
    "",
    "Usage:",
    "  npm run test:device-advisor",
    "  node scripts/device-advisor-regression.mjs",
    "  node scripts/device-advisor-regression.mjs --help",
    "  node scripts/device-advisor-regression.mjs -h",
    "",
    "What it does:",
    "  Runs the fallback device advisor regression scenarios and prints a compact success summary.",
    "  On success, it prints the scenario count and scenario names so coverage is easy to confirm.",
    "  On failure, assertion errors stay unchanged and point directly at the broken scenario.",
    "",
    "Maintenance notes:",
    "  Keep scenarios focused on fallback behavior, not UI or API details.",
    "  Prefer small helper assertions when adding new scenarios so repeated checks stay readable.",
    "  Update the scenario summary only when the scenario list changes.",
  ].join("\n"));
}

if (cliArgs.has("--help") || cliArgs.has("-h")) {
  printHelp();
  process.exit(0);
}

const { buildDeviceAdvisorContext, buildDeviceAdvisorPrompt, runFallbackDeviceAdvisor, groundDeviceAdvisorOutput, normalizeDeviceAdvisorInput, normalizeDeviceAdvisorModelOutput } = loadTsModule("./src/lib/device-advisor.ts");
const { allDevices } = loadTsModule("./src/lib/devices-db.ts");
for (const [id, price, storage] of [["samsung-galaxy-s26-2026", 7799, "256GB"],
  ["samsung-galaxy-s26-plus-2026", 8999, "256GB"], ["samsung-galaxy-s26-plus-2026", 10599, "512GB"]]) {
  const candidate = buildDeviceAdvisorContext({ category: "phone", budget: { min: price, max: price }, conditionPreference: "new_only" })
    .candidateShortlist.find((item) => item.deviceId === id);
  assert.equal(candidate?.referencePrice, price);
  assert.equal(candidate.facts.memory, "12GB");
  assert.equal(candidate.facts.storage, storage);
  assert.match(candidate.facts.priceCondition, /未登录、未下单/);
  assert.match(candidate.facts.priceConfiguration, /CHC/);
}
for (const [id, price, memory, storage] of [
  ["oppo-find-x10-2026", 5499, "12GB", "256GB"],
  ["oppo-find-x10-2026", 6499, "16GB", "512GB"],
  ["oppo-find-x10-pro-max-2026", 6799, "12GB", "256GB"],
  ["oppo-find-x10-e-2026", 4999, "12GB", "256GB"],
  ["xiaomi-18-pro-2026", 5999, "12GB", "256GB"],
  ["xiaomi-18-pro-max-2026", 6999, "12GB", "256GB"],
  ["vivo-x500-2026", 5499, "12GB", "256GB"],
  ["vivo-x500-2026", 5999, "12GB", "512GB"],
  ["vivo-x500-pro-2026", 6499, "12GB", "256GB"],
  ["vivo-x500-pro-max-2026", 6999, "12GB", "256GB"],
  ["oppo-find-x9-2025", 4599, "12GB", "256GB"],
  ["oppo-find-x9-2025", 5299, "12GB", "512GB"],
  ["oppo-find-x9-2025", 5599, "16GB", "512GB"],
  ["oppo-find-x9-pro-2025", 5599, "12GB", "256GB"],
  ["oppo-find-x9-pro-2025", 5999, "12GB", "512GB"],
  ["oppo-find-x9-pro-2025", 6299, "16GB", "512GB"],
  ["oppo-find-x8-pro-2024", 5299, "12GB", "256GB"],
  ["vivo-x300-2025", 4499, "12GB", "256GB"],
  ["vivo-x300-2025", 4999, "12GB", "512GB"],
  ["vivo-x300-2025", 5499, "16GB", "512GB"],
  ["xiaomi-17-2025", 5099, "12GB", "256GB"],
  ["xiaomi-17-2025", 5199, "12GB", "512GB"],
  ["xiaomi-17-2025", 5499, "16GB", "512GB"],
  ["xiaomi-17-pro-2025", 5699, "12GB", "256GB"],
  ["xiaomi-17-pro-2025", 5999, "12GB", "512GB"],
  ["xiaomi-17-pro-2025", 6299, "16GB", "512GB"],
  ["xiaomi-17-pro-max-2025", 6999, "12GB", "512GB"],
  ["xiaomi-17-pro-max-2025", 7299, "16GB", "512GB"],
]) {
  const candidate = buildDeviceAdvisorContext({ category: "phone", budget: { min: price, max: price }, conditionPreference: "new_only" })
    .candidateShortlist.find((item) => item.deviceId === id);
  assert.equal(candidate?.referencePrice, price);
  assert.equal(candidate.facts.memory, memory);
  assert.equal(candidate.facts.storage, storage);
  assert.match(candidate.facts.priceCondition, /未登录、未下单/);
  assert.match(candidate.facts.priceConfiguration, /国行/);
}
for (const [price, memory, storage, label] of [[5699, 12, 512, "512GB"], [6699, 16, 1024, "1TB"]]) {
  const candidate = buildDeviceAdvisorContext({ category: "phone", budget: { min: price, max: price }, minMemoryGb: memory, minStorageGb: storage, conditionPreference: "new_only" })
    .candidateShortlist.find((item) => item.deviceId === "honor-magic8-pro-2025");
  assert.equal(candidate?.referencePrice, price);
  assert.equal(candidate.facts.memory, `${memory}GB`);
  assert.equal(candidate.facts.storage, label);
  assert.match(candidate.facts.priceConfiguration, /国行/);
  if (price === 5699) assert.match(JSON.stringify(candidate), /预估到手价/);
}
for (const [price, storage, gpu, conditionPreference] of [
  [7999, 256, 8, "new_only"],
  [9499, 512, 10, "new_only"],
  [7299, 512, 10, "used_ok"],
]) {
  const candidate = buildDeviceAdvisorContext({ category: "laptop", budget: { min: price, max: price }, minMemoryGb: 16, minStorageGb: storage, conditionPreference })
    .candidateShortlist.find((item) => item.deviceId === "macbook-air-13-m4-2025");
  assert.equal(candidate?.referencePrice, price);
  assert.equal(candidate.facts.storage, `${storage}GB`);
  assert.equal(candidate.facts.gpu, `${gpu} 核`);
  assert.match(candidate.facts.priceConfiguration, /国行/);
  assert.ok(candidate.quotes.every((quote) => quote.referencePrice !== 9400), "unverified mainland-channel quote must not return to the shortlist");
}
const diverseInput = { category: "phone", budget: { max: 16000 } };
const diverse = buildDeviceAdvisorContext(diverseInput).candidateShortlist;
assert.equal(diverse.length, 12);
assert.equal(new Set(diverse.map((candidate) => candidate.deviceId)).size, 12);
assert.deepEqual([...new Set(diverse.map((candidate) => candidate.brand))].sort(),
  ["Apple", "HONOR", "Huawei", "OPPO", "Redmi", "Samsung", "Xiaomi", "vivo"].sort());
assert.ok(diverse.some((candidate) => candidate.referencePrice <= 4000), "retain an economical alternative");
assert.ok(diverse.some((candidate) => candidate.referencePrice >= 10000), "retain an upper-price alternative");
assert.ok(diverse.every((candidate) => candidate.referencePrice !== null && candidate.referencePrice <= 16000));
assert.deepEqual(buildDeviceAdvisorContext(diverseInput).candidateShortlist, diverse, "coverage must be deterministic");
for (const key of ["minMemoryGb", "minStorageGb"]) {
  for (const value of [-1, 0, Infinity, "24", null]) {
    assert.equal(normalizeDeviceAdvisorInput({ category: "laptop", [key]: value }), null);
  }
}
for (const input of [
  { minMemoryGb: 24, minStorageGb: 1024 },
  { intent: "开发编程，至少24GB内存，至少1TB存储" },
  { intent: "24GB运行内存、1TB存储" },
  { intent: "开发编程；最低24G内存、至少1T硬盘" },
]) {
  const context = buildDeviceAdvisorContext({ category: "laptop", budget: { max: 20000 }, ...input });
  assert.equal(context.userProfile.minMemoryGb, 24);
  assert.equal(context.userProfile.minStorageGb, 1024);
  assert.ok(context.candidateShortlist.length);
  assert.ok(context.candidateShortlist.every((candidate) => parseInt(candidate.facts.memory) >= 24
    && /TB/.test(candidate.facts.storage) && candidate.referencePrice <= 20000));
}
assert.equal(buildDeviceAdvisorContext({ intent: "不需要至少24GB内存" }).userProfile.minMemoryGb, 0);
for (const intent of ["不需要24GB内存", "最多24GB内存", "24GB内存也可以", "现在用24GB内存"]) {
  assert.equal(buildDeviceAdvisorContext({ intent }).userProfile.minMemoryGb, 0);
}
const plainPhoneConfiguration = buildDeviceAdvisorContext({ category: "phone", budget: { max: 10000 }, intent: "三星，12GB内存、256GB存储，只看国行全新报价" });
assert.equal(plainPhoneConfiguration.userProfile.minMemoryGb, 12);
assert.equal(plainPhoneConfiguration.userProfile.minStorageGb, 256);
assert.ok(plainPhoneConfiguration.candidateShortlist.length);
assert.ok(plainPhoneConfiguration.candidateShortlist.every((candidate) => candidate.quotes.every((quote) =>
  parseInt(quote.facts.memory) >= 12 && parseInt(quote.facts.storage) >= 256)));
const impossible = runFallbackDeviceAdvisor({ category: "laptop", minMemoryGb: 9999 });
assert.equal(impossible.devices.length, 0, "minimum requirements must never be silently relaxed");
assert.match(impossible.answer, /内存至少 9999GB/);
assert.match(runFallbackDeviceAdvisor({ category: "laptop", minMemoryGb: 24, budget: 10000 }).answer, /预算外或价格未知的备选/);
const mixed = buildDeviceAdvisorContext({ category: "tablet", conditionPreference: "used_ok", budget: { min: 5450, max: 5550 } });
assert.ok(mixed.candidateShortlist.some((candidate) => candidate.priceText.startsWith("当前价")));
assert.ok(mixed.candidateShortlist.some((candidate) => candidate.priceText.startsWith("二手价")));
const economical = buildDeviceAdvisorContext({ category: "laptop", budget: { max: 16000 } }).candidateShortlist
  .find((candidate) => candidate.deviceId === "macbook-air-13-m5-2026");
assert.equal(economical.referencePrice, 9999, "budget headroom must not force a more expensive storage tier");
function promptContext(input) {
  return JSON.parse(buildDeviceAdvisorPrompt(input).split("输入数据：\n")[1].split("\n\n请直接")[0]);
}
const focusedCamera = promptContext({ category: "phone", intent: "拍照", budget: 10000 });
assert.ok(focusedCamera.candidateShortlist.some((candidate) => candidate.facts.dxomarkCamera));
assert.ok(focusedCamera.candidateShortlist.every((candidate) => !candidate.facts.rearCamera && !candidate.facts.configurations));
const focusedOffice = promptContext({ category: "phone", intent: "办公", budget: 10000 });
assert.ok(focusedOffice.candidateShortlist.every((candidate) => candidate.quotes.every((quote) =>
  !Object.hasOwn(quote, "priceText") && quote.priceType === "current" && quote.sourceName && quote.observedAt)));
assert.ok(focusedOffice.candidateShortlist.every((candidate) => !candidate.facts.mainCamera));
assert.ok(focusedOffice.candidateShortlist.every((candidate) => !candidate.facts.priceConfiguration
  && candidate.quotes.every((quote) => quote.facts.priceCondition && quote.facts.priceConfiguration)));
assert.match(buildDeviceAdvisorPrompt({ category: "phone" }), /未提供某字段不等于设备没有该能力/);
for (const [price, memory, storage, gpu] of [[9999, "16GB", "512GB", "8 核"], [26499, "32GB", "4TB", "10 核"]]) {
  const candidate = buildDeviceAdvisorContext({ category: "laptop", budget: { min: price, max: price }, conditionPreference: "new_only" }).candidateShortlist.find((item) => item.deviceId === "macbook-air-13-m5-2026");
  assert.equal(candidate?.facts.memory, memory);
  assert.equal(candidate?.facts.storage, storage);
  assert.equal(candidate?.facts.cpu, "10 核");
  assert.equal(candidate?.facts.gpu, gpu, "the model must receive the verified GPU tier of the priced configuration");
}
const ipadProOneTb = buildDeviceAdvisorContext({ category: "tablet", budget: { min: 15899, max: 15899 }, conditionPreference: "new_only" }).candidateShortlist.find((item) => item.deviceId === "ipad-pro-m5-11-2025");
assert.equal(ipadProOneTb?.facts.memory, "16GB");
assert.equal(ipadProOneTb?.facts.storage, "1TB");
assert.match(ipadProOneTb.facts.priceCondition, /标准玻璃/);
for (const [deviceId, price] of [["oppo-find-x9-ultra-2026", 8499], ["vivo-x300-ultra-2026", 8999]]) {
  const candidate = buildDeviceAdvisorContext({ category: "phone", budget: { min: price, max: price }, conditionPreference: "new_only" }).candidateShortlist.find((item) => item.deviceId === deviceId);
  assert.equal(candidate?.facts.memory, "16GB");
  assert.equal(candidate?.facts.storage, "512GB");
  assert.match(candidate.facts.priceCondition, /不含/);
}
const galaxyOneTb = buildDeviceAdvisorContext({ category: "phone", budget: { min: 12999, max: 12999 }, conditionPreference: "new_only" }).candidateShortlist.find((item) => item.deviceId === "samsung-galaxy-s26-ultra-2026");
assert.equal(galaxyOneTb?.facts.memory, "16GB");
assert.equal(galaxyOneTb?.facts.storage, "1TB");
assert.match(galaxyOneTb.facts.priceCondition, /券后到手价/);
const iphone17eLarger = buildDeviceAdvisorContext({ category: "phone", budget: { min: 7299, max: 7299 }, conditionPreference: "new_only" }).candidateShortlist.find((item) => item.deviceId === "iphone-17e-2026");
assert.equal(iphone17eLarger?.facts.memory, "8GB");
assert.equal(iphone17eLarger?.facts.storage, "512GB");
assert.match(iphone17eLarger.facts.priceCondition, /不含折抵换购/);
const ipadAirOneTb = buildDeviceAdvisorContext({ category: "tablet", budget: { min: 8599, max: 8599 }, conditionPreference: "used_ok" }).candidateShortlist.find((item) => item.deviceId === "ipad-air-13-m4-2026");
assert.equal(ipadAirOneTb?.facts.memory, "12GB");
assert.equal(ipadAirOneTb?.facts.storage, "1TB");
assert.match(ipadAirOneTb.facts.priceCondition, /功能检测13项正常/);
const iphone17Larger = buildDeviceAdvisorContext({ category: "phone", budget: { min: 6589, max: 6589 }, conditionPreference: "used_ok" }).candidateShortlist.find((item) => item.deviceId === "iphone-17");
assert.equal(iphone17Larger?.facts.memory, "8GB");
assert.equal(iphone17Larger?.facts.storage, "512GB");
assert.match(iphone17Larger.facts.priceCondition, /电池寿命96%/);
for (const [id, price] of [["iphone-17-pro", 8799], ["iphone-17-pro-max", 9399]]) {
  const candidate = buildDeviceAdvisorContext({ category: "phone", budget: { min: price, max: price }, conditionPreference: "used_ok" })
    .candidateShortlist.find((item) => item.deviceId === id);
  assert.equal(candidate?.facts.memory, "12GB");
  assert.equal(candidate?.facts.storage, "512GB", "the advisor must use the configuration attached to the matching quote");
  assert.match(candidate.facts.priceCondition, /功能检测21项正常/);
  assert.match(candidate.facts.priceCondition, /实际结算和库存/);
}
const mate80 = allDevices.find((device) => device.id === "huawei-mate-80-pro-2025");
const mate80OneTb = buildDeviceAdvisorContext({ category: "phone", budget: { min: 5999, max: 5999 }, conditionPreference: "used_ok" }).candidateShortlist.find((item) => item.deviceId === mate80.id);
assert.equal(mate80OneTb?.facts.storage, "1TB");
assert.equal(mate80OneTb?.facts.chip, "麒麟 9030 Pro");
for (const [value, memory, chip] of [[4599, "12GB", "麒麟 9030"], [5399, "16GB", "麒麟 9030 Pro"]]) {
  const candidate = buildDeviceAdvisorContext({ category: "phone", budget: { min: value, max: value }, conditionPreference: "used_ok" })
    .candidateShortlist.find((item) => item.deviceId === mate80.id);
  assert.equal(candidate?.facts.memory, memory);
  assert.equal(candidate?.facts.chip, chip);
  assert.match(candidate.facts.priceCondition, /电池|成新/);
}
for (const [value, memory, storage, chip] of [[5999, "12GB", "256GB", "麒麟 9030"], [6999, "16GB", "512GB", "麒麟 9030 Pro"]]) {
  const candidate = buildDeviceAdvisorContext({ category: "phone", budget: { min: value, max: value }, conditionPreference: "new_only" })
    .candidateShortlist.find((item) => item.deviceId === mate80.id);
  assert.equal(candidate?.facts.chip, chip, "the selected price must carry its own chip, not the highest model option");
  assert.equal(candidate.facts.memory, memory);
  assert.equal(candidate.facts.storage, storage);
  assert.match(candidate.facts.priceCondition, /未复核商家库存/);
}

for (const budget of [5000, { max: 5000, currency: "CNY" }]) {
  const input = normalizeDeviceAdvisorInput({ category: "phone", budget });
  const profile = buildDeviceAdvisorContext(input).userProfile;
  assert.equal(profile.budget.min, null, "an upper limit must not become an exact-price budget");
  assert.equal(profile.budget.max, 5000);
}
for (const budget of [-1, { min: -1 }, { max: 1000, currency: "USD" }]) {
  assert.equal(normalizeDeviceAdvisorInput({ category: "phone", budget }), null);
}
const priceInput = { category: "laptop", budget: { min: 9400, max: 9500 }, conditionPreference: "new_only" };
const airQuote = buildDeviceAdvisorContext(priceInput).candidateShortlist.find((item) => item.deviceId === "macbook-air-13-m4-2025");
assert.equal(airQuote?.referencePrice, 9499, "budget matching must consider every verified configuration, not just the first quote");
assert.equal(airQuote.facts.memory, "16GB");
assert.equal(airQuote.facts.storage, "512GB");
assert.match(airQuote.facts.priceConfiguration, /10 核 GPU/);
assert.ok(airQuote.facts.priceCondition);
const oneResult = { category: "phone", maxResults: 1 };
const ids = buildDeviceAdvisorContext(oneResult).candidateShortlist.slice(0, 4).map((item) => item.deviceId);
const namedCandidates = buildDeviceAdvisorContext(oneResult).candidateShortlist;
assert.equal(groundDeviceAdvisorOutput(oneResult, { answer: namedCandidates[1].model, recommendedDeviceIds: [namedCandidates[0].deviceId], recommendedQuoteIds: [namedCandidates[0].quotes[0].quoteId], confidence: 0.8 }), null, "text must not introduce a different candidate than the device links");
const proMax = namedCandidates.find((candidate) => candidate.deviceId === "iphone-17-pro-max");
if (proMax) assert.ok(groundDeviceAdvisorOutput(oneResult, { answer: proMax.model, recommendedDeviceIds: [proMax.deviceId], recommendedQuoteIds: [proMax.quotes[0].quoteId], confidence: 0.8 }), "overlapping model names must not reject a legitimate Pro Max");
assert.equal(groundDeviceAdvisorOutput(oneResult, { answer: "测试", recommendedDeviceIds: ids.slice(0, 2), recommendedQuoteIds: ids.slice(0, 2).map((id) => `${id}:q0`), confidence: 0.8 }), null);
assert.equal(normalizeDeviceAdvisorModelOutput({ answer: "测试", recommendedDeviceIds: ids, recommendedQuoteIds: ids.map((id) => `${id}:q0`), confidence: 0.8 }).recommendedDeviceIds.length, 4, "normalization must not hide excessive recommendations before validation");
const offerInput = { category: "laptop", conditionPreference: "used_ok", budget: { max: 16000 } };
const offerCandidates = buildDeviceAdvisorContext(offerInput).candidateShortlist;
const twoOffers = offerCandidates.find((candidate) => candidate.quotes.length === 2
  && candidate.quotes[0].priceText.startsWith("二手价") && candidate.quotes[1].priceText.startsWith("当前价"));
assert.ok(twoOffers, "keep both new and used offers when both fit the budget");
const offerOutput = { answer: twoOffers.model, recommendedDeviceIds: [twoOffers.deviceId], recommendedQuoteIds: [twoOffers.quotes[1].quoteId], confidence: 0.8 };
const reviewInput = promptContext(offerInput);
const reviewOutput = groundDeviceAdvisorOutput(offerInput, offerOutput);
assert.deepEqual(reviewAdvisorFacts(reviewOutput, reviewInput), { status: "pending_manual_review", flags: [] });
assert.deepEqual(reviewAdvisorFacts({ source: "rules" }, reviewInput), { status: "not_applicable", flags: [] });
const evidenceQuote = twoOffers.quotes[1];
assert.deepEqual(reviewAdvisorFacts({ ...reviewOutput, answer: `${evidenceQuote.referencePrice}元，${evidenceQuote.facts.memory}+${evidenceQuote.facts.storage}` }, reviewInput).flags, []);
assert.deepEqual(reviewAdvisorFacts({ ...reviewOutput, answer: "价格￥123,456，配置2GB+64GB。" }, reviewInput).flags,
  ["unverified_amount:123456", "unverified_configuration:2+64"]);
assert.deepEqual(reviewAdvisorFacts({ ...reviewOutput, answer: "预算16000元。" }, reviewInput).flags, []);
assert.equal(reviewAdvisorFacts({ ...reviewOutput, answer: "没有风扇，性能永不下降" }, reviewInput).status, "pending_manual_review", "unflagged qualitative claims must never be labelled verified");
assert.equal(groundDeviceAdvisorOutput(offerInput, offerOutput).devices[0].priceText, twoOffers.quotes[1].priceText);
assert.equal(groundDeviceAdvisorOutput(offerInput, { ...offerOutput, answer: `${twoOffers.model} 还有 ${twoOffers.quotes[0].referencePrice} 元的报价` }), null, "do not discuss an unselected offer price");
assert.equal(groundDeviceAdvisorOutput(offerInput, { ...offerOutput, recommendedQuoteIds: ["invented-quote"] }), null);
assert.equal(groundDeviceAdvisorOutput(offerInput, { ...offerOutput, recommendedQuoteIds: [offerCandidates.find((candidate) => candidate !== twoOffers).quotes[0].quoteId] }), null, "never mix a device with another device's quote");
assert.equal(groundDeviceAdvisorOutput(offerInput, { ...offerOutput, recommendedDeviceIds: [twoOffers.deviceId, twoOffers.deviceId], recommendedQuoteIds: twoOffers.quotes.map((quote) => quote.quoteId) }), null, "conflicting quotes for one device must not be silently deduplicated");
for (const recommendedQuoteIds of [undefined, null, [], [1], [""]]) {
  assert.equal(normalizeDeviceAdvisorModelOutput({ ...offerOutput, recommendedQuoteIds }), null);
}
assert.ok(offerCandidates.every((candidate) => candidate.quotes.length <= 2
  && candidate.quotes.every((quote) => quote.referencePrice <= 16000)));
const largerMemoryOffers = buildDeviceAdvisorContext({ ...offerInput, minMemoryGb: 24 }).candidateShortlist;
assert.ok(largerMemoryOffers.every((candidate) => candidate.quotes.every((quote) => parseInt(quote.facts.memory) >= 24)));

function pickRecommendationTitles(output) {
  return output.devices.map((item) => item.model);
}

function assertSimpleFallback(output, category, maxResults = 3) {
  assert.equal(output.source, "rules");
  assert.ok(output.devices.length > 0, "should return device links");
  assert.equal(output.devices.length, maxResults);
  assert.ok(
    output.devices.every((item) => item.category === category),
    "fallback should stay inside the selected category",
  );
  assert.equal(
    new Set(output.devices.map((item) => item.deviceId)).size,
    output.devices.length,
    "fallback device links should not contain duplicates",
  );
  assert.match(output.disclaimer, /接口兼容性/);
  assert.match(output.disclaimer, /缺失价格不参与预算匹配/);
  assert.match(output.answer, /不分析性能、续航、影像等使用偏好/);
}

const scenarios = [
  {
    name: "phone_cross_brand_xiaomi_camera",
    input: {
      category: "phone",
      budget: { min: 6400, max: 6500, currency: "CNY" },
      performancePreference: "camera",
      useCases: ["摄影", "视频"],
      conditionPreference: "new_only",
      maxResults: 3,
    },
    expect(output, input) {
      assertSimpleFallback(output, "phone", 3);
      assert.deepEqual(output.devices.map((device) => device.deviceId), ["oppo-find-x10-2026", "vivo-x500-pro-2026", "xiaomi-15-ultra-2025"]);
      assert.match(output.devices[2]?.priceText ?? "", /当前价 ¥6,499（中关村在线电商报价，2026-09-07）/);
      const candidate = buildDeviceAdvisorContext(input).candidateShortlist.find((item) => item.deviceId === "xiaomi-15-ultra-2025");
      assert.equal(candidate.brand, "Xiaomi");
      assert.equal(candidate.facts.memory, "16GB");
      assert.equal(candidate.facts.storage, "512GB");
      assert.equal(candidate.facts.configurations, undefined);
      assert.equal(candidate.facts.batteryCapacityMah, 6000);
      assert.equal(candidate.facts.batteryLife, undefined);
      const cameraSpecs = allDevices.find((device) => device.id === candidate.deviceId).specs;
      assert.equal(candidate.facts.rearCamera, cameraSpecs.rearCamera.value, "rearCamera must not be silently replaced with only the main lens");
      assert.equal(candidate.facts.telephoto, cameraSpecs.telephoto.value);
      assert.match(buildDeviceAdvisorPrompt(input), /不能仅凭 mAh 大小/);
      assert.equal(candidate.facts.dxomarkCamera, "159 分（Camera v6）");
      assert.match(buildDeviceAdvisorPrompt(input), /协议不同的分数不可直接比较高低/);
    },
  },
  {
    name: "phone_used_xiaomi_price",
    input: {
      category: "phone",
      budget: { min: 3500, max: 3700, currency: "CNY" },
      performancePreference: "camera",
      useCases: ["摄影"],
      conditionPreference: "used_ok",
      maxResults: 3,
    },
    expect(output) {
      assertSimpleFallback(output, "phone", 3);
      assert.deepEqual(pickRecommendationTitles(output), ["小米 15 Ultra", "Samsung Galaxy S24 Ultra", "小米 15"]);
      assert.match(output.devices[1]?.priceText ?? "", /二手价 ¥3,629（九机二手，2026-09-07）/);
      assert.match(output.devices[0]?.priceText ?? "", /二手价 ¥3,619（九机二手，2026-09-07）/);
      assert.match(output.devices[2]?.priceText ?? "", /缺货标价，仅供参考/);
      const xiaomi15 = buildDeviceAdvisorContext({ category: "phone", budget: { min: 3599, max: 3599 }, conditionPreference: "new_only" })
        .candidateShortlist.find((candidate) => candidate.deviceId === "xiaomi-15-2024");
      assert.equal(xiaomi15?.facts.memory, "12GB");
      assert.equal(xiaomi15?.facts.storage, "256GB");
      assert.match(xiaomi15?.facts.priceCondition ?? "", /暂时缺货/);
    },
  },
  {
    name: "budget_used_battery",
    input: {
      category: "phone",
      budget: { max: 4500, currency: "CNY" },
      performancePreference: "battery",
      useCases: ["通勤", "长时间使用"],
      conditionPreference: "refurbished_ok",
      batteryPriority: "high",
      replacementIntent: "replace",
      maxResults: 3,
    },
    expect(output) {
      assertSimpleFallback(output, "phone");
      assert.match(output.answer, /预算/);
    },
  },
  {
    name: "tablet_study_portable",
    input: {
      category: "tablet",
      performancePreference: "portable",
      useCases: ["学习", "记笔记", "上课"],
      interfaceNeed: "pencil",
      conditionPreference: "new_only",
      replacementIntent: "first_device",
      maxResults: 3,
    },
    expect(output) {
      assertSimpleFallback(output, "tablet");
    },
  },
  {
    name: "laptop_productivity_usb_c",
    input: {
      category: "laptop",
      budget: { min: 9000, max: 16000, currency: "CNY" },
      performancePreference: "performance",
      useCases: ["办公", "开发", "多任务"],
      interfaceNeed: "usb_c",
      replacementIntent: "upgrade",
      maxResults: 3,
    },
    expect(output) {
      assertSimpleFallback(output, "laptop");
      assert.match(output.devices[0]?.priceText ?? "", /当前价 ¥9,999（Apple 中国大陆在线商店，2026-09-26）/);
      assert.match(output.devices[0]?.priceText ?? "", /16GB 运行内存 \+ 512GB 存储/);
    },
  },
  {
    name: "iphone_camera_battery",
    input: {
      category: "phone",
      performancePreference: "camera",
      useCases: ["拍照", "视频", "日常"],
      batteryPriority: "high",
      interfaceNeed: "magsafe",
      replacementIntent: "replace",
      maxResults: 3,
    },
    expect(output) {
      assertSimpleFallback(output, "phone");
    },
  },
  {
    name: "conflict_budget_pressure",
    input: {
      category: "laptop",
      budget: { max: 3000, currency: "CNY" },
      performancePreference: "performance",
      useCases: ["剪辑", "开发"],
      conditionPreference: "new_only",
      batteryPriority: "high",
      interfaceNeed: "usb_c",
      replacementIntent: "upgrade",
      maxResults: 3,
    },
    expect(output) {
      assertSimpleFallback(output, "laptop");
      assert.match(output.answer, /按对应成色的预算接近度和发布时间/);
      assert.match(output.answer, /没有已收录的预算内报价/);
      assert.ok(output.devices.every((device) => !/当前价 ¥6,460/.test(device.priceText)), "channel-only M3 quote must not return as a mainland budget alternative");
      assert.ok(output.devices.every((device) => !/当前价 ¥8,000/.test(device.priceText)), "unverified mainland quotes must not participate in fallback ranking");
    },
  },
  {
    name: "tablet_pencil_reordered_budget",
    input: {
      category: "tablet",
      budget: { min: 14000, max: 9000, currency: "CNY" },
      performancePreference: "portable",
      useCases: ["记笔记", "上课", "绘画"],
      conditionPreference: "used_ok",
      batteryPriority: "high",
      interfaceNeed: "pencil",
      replacementIntent: "first_device",
      maxResults: 3,
    },
    expect(output) {
      assertSimpleFallback(output, "tablet", 3);
      assert.match(output.answer, /¥9,000 - ¥14,000/);
      assert.equal(output.devices[0]?.deviceId, "ipad-air-13-m4-2026");
      assert.deepEqual(new Set(output.devices.map((device) => device.deviceId)), new Set(["ipad-air-13-m4-2026", "ipad-air-m4-2025", "ipad-pro-m5-11-2025"]));
    },
  },
  {
    name: "tablet_used_mainland_price",
    input: {
      category: "tablet",
      budget: { max: 3000, currency: "CNY" },
      useCases: ["学习", "追剧"],
      conditionPreference: "used_ok",
      maxResults: 3,
    },
    expect(output) {
      assertSimpleFallback(output, "tablet");
      assert.equal(output.devices[0]?.deviceId, "ipad-a16-2025");
      assert.match(output.devices[0]?.priceText ?? "", /二手价 ¥2,909（京东 99 成新二手平板电脑榜，2026-08-24）/);
    },
  },
  {
    name: "tablet_used_mainland_ipad_air_m4_price",
    input: {
      category: "tablet",
      budget: { min: 4659, max: 4659, currency: "CNY" },
      useCases: ["学习", "绘画"],
      conditionPreference: "used_ok",
      maxResults: 3,
    },
    expect(output) {
      assertSimpleFallback(output, "tablet", 1);
      assert.equal(output.devices[0]?.deviceId, "ipad-air-m4-2025");
      assert.match(output.devices[0]?.priceText ?? "", /二手价 ¥4,659（九机二手单机详情，2026-09-22）/);
    },
  },
  {
    name: "tablet_used_mainland_ipad_mini_price",
    input: {
      category: "tablet",
      budget: { min: 2450, max: 2520, currency: "CNY" },
      useCases: ["阅读", "便携"],
      conditionPreference: "used_ok",
      maxResults: 3,
    },
    expect(output) {
      assertSimpleFallback(output, "tablet", 2);
      assert.equal(output.devices[0]?.deviceId, "ipad-mini-a17-pro-2024");
      assert.match(output.devices[0]?.priceText ?? "", /二手价 ¥2,499（九机二手良品，2026-08-25）/);
    },
  },
  {
    name: "tablet_used_mainland_legacy_prices",
    input: {
      category: "tablet",
      budget: { min: 2050, max: 2200, currency: "CNY" },
      useCases: ["学习", "阅读"],
      conditionPreference: "used_ok",
      maxResults: 3,
    },
    expect(output) {
      assertSimpleFallback(output, "tablet", 1);
      assert.deepEqual(output.devices.map((device) => device.deviceId), ["ipad-10th-2022"]);
      assert.ok(output.devices.every((device) => /二手价 .*（九机二手良品，2026-08-25）/.test(device.priceText)));
    },
  },
  {
    name: "tablet_used_mainland_ipad_pro_prices",
    input: {
      category: "tablet",
      budget: { min: 2400, max: 2650, currency: "CNY" },
      useCases: ["绘画", "视频剪辑"],
      conditionPreference: "used_ok",
      maxResults: 3,
    },
    expect(output) {
      assertSimpleFallback(output, "tablet");
      assert.deepEqual(output.devices.map((device) => device.deviceId), ["ipad-mini-a17-pro-2024", "ipad-mini-6th-2021", "ipad-pro-11-2nd-2020"]);
      assert.ok([output.devices[0], output.devices[2]].every((device) => /二手价 .*（九机二手良品，2026-08-25）/.test(device.priceText)));
      assert.match(output.devices[1]?.priceText ?? "", /二手价 ¥2,459（九机二手单机详情，2026-09-22）/);
    },
  },
  {
    name: "tablet_used_mainland_ipad_pro_m2_13_price",
    input: {
      category: "tablet",
      budget: { min: 5450, max: 5550, currency: "CNY" },
      useCases: ["绘画", "视频剪辑"],
      conditionPreference: "used_ok",
      maxResults: 3,
    },
    expect(output) {
      assertSimpleFallback(output, "tablet", 2);
      assert.equal(output.devices[1]?.deviceId, "ipad-pro-m2-13-2022");
      assert.match(output.devices[1]?.priceText ?? "", /二手价 ¥5,499（九机二手良品，2026-08-31）/);
    },
  },
  {
    name: "phone_current_mainland_iphone15_price",
    input: {
      category: "phone",
      budget: { min: 5590, max: 5610, currency: "CNY" },
      useCases: ["日常", "拍照"],
      conditionPreference: "new_only",
      maxResults: 3,
    },
    expect(output, input) {
      assertSimpleFallback(output, "phone", 3);
      assert.deepEqual(pickRecommendationTitles(output), ["OPPO Find X9", "OPPO Find X9 Pro", "荣耀 Magic6 Pro"]);
      assert.match(output.devices[2]?.priceText ?? "", /当前价 ¥5,600（ZOL 中关村在线，2026-09-07）/);
      const iphone = buildDeviceAdvisorContext(input).candidateShortlist.find((candidate) => candidate.deviceId === "iphone-15");
      assert.match(iphone?.priceText ?? "", /当前价 ¥5,599（京东，2026-08-25）/);
    },
  },
  {
    name: "phone_current_mainland_samsung_s25_price",
    input: {
      category: "phone",
      budget: { min: 6989, max: 7009, currency: "CNY" },
      useCases: ["日常", "拍照"],
      conditionPreference: "new_only",
      maxResults: 3,
    },
    expect(output, input) {
      assertSimpleFallback(output, "phone", 3);
      assert.deepEqual(pickRecommendationTitles(output), ["vivo X500 Pro Max", "小米 18 Pro Max", "HUAWEI Mate 80 Pro"]);
      const samsung = buildDeviceAdvisorContext(input).candidateShortlist.find((candidate) => candidate.deviceId === "samsung-galaxy-s25-ultra-2025");
      assert.match(samsung?.priceText ?? "", /当前价 ¥6,999（三星中国商城，2026-09-07）/);
    },
  },
  {
    name: "tablet_reject_channel_only_ipad_air_m2_price",
    input: {
      category: "tablet",
      budget: { min: 5490, max: 5510, currency: "CNY" },
      useCases: ["学习", "绘画"],
      conditionPreference: "new_only",
      maxResults: 3,
    },
    expect(output) {
      assertSimpleFallback(output, "tablet", 3);
      assert.match(output.answer, /没有已收录的预算内报价/);
      assert.ok(output.devices.every((device) => !/当前价 ¥5,500/.test(device.priceText)));
    },
  },
  {
    name: "tablet_reject_channel_only_ipad_air_13_m2_price",
    input: {
      category: "tablet",
      budget: { min: 5650, max: 5670, currency: "CNY" },
      useCases: ["学习", "绘画"],
      conditionPreference: "new_only",
      maxResults: 3,
    },
    expect(output) {
      assertSimpleFallback(output, "tablet", 3);
      assert.match(output.answer, /没有已收录的预算内报价/);
      assert.ok(output.devices.every((device) => !/当前价 ¥5,660/.test(device.priceText)));
    },
  },
  {
    name: "phone_condition_battery_pressure",
    input: {
      category: "phone",
      budget: { max: 2500, currency: "CNY" },
      performancePreference: "battery",
      useCases: ["通勤", "长时间使用"],
      conditionPreference: "used_ok",
      batteryPriority: "high",
      interfaceNeed: "magsafe",
      replacementIntent: "replace",
      maxResults: 3,
    },
    expect(output) {
      assertSimpleFallback(output, "phone");
      assert.ok(!output.devices.some((device) => device.deviceId === "iphone-se-1-2016"));
      assert.equal(output.devices[0]?.deviceId, "iphone-14");
      assert.match(output.devices[0]?.priceText ?? "", /二手价 ¥2,449（京东商务二手手机热卖榜，2026-08-25）/);
      assert.ok(output.devices.every((device) => device.deviceId.startsWith("iphone-")));
      assert.match(output.answer, /先按接口兼容性筛选/);
    },
  },
  {
    name: "phone_used_mainland_iphone12_se2_prices",
    input: {
      category: "phone",
      budget: { min: 750, max: 800, currency: "CNY" },
      useCases: ["备用机"],
      conditionPreference: "used_ok",
      maxResults: 3,
    },
    expect(output) {
      assertSimpleFallback(output, "phone", 2);
      assert.deepEqual(output.devices.map((device) => device.deviceId), ["iphone-12", "iphone-se-2-2020"]);
      assert.match(output.devices[0]?.priceText ?? "", /二手价 ¥788（京东商务二手手机热卖榜，2026-08-25）/);
      assert.match(output.devices[1]?.priceText ?? "", /二手价 ¥779（九机二手良品，2026-08-31）/);
    },
  },
  {
    name: "phone_used_mainland_iphone11_price",
    input: {
      category: "phone",
      budget: { min: 850, max: 900, currency: "CNY" },
      useCases: ["备用机"],
      conditionPreference: "used_ok",
      maxResults: 3,
    },
    expect(output) {
      assertSimpleFallback(output, "phone", 1);
      assert.equal(output.devices[0]?.deviceId, "iphone-11-2019");
      assert.match(output.devices[0]?.priceText ?? "", /二手价 ¥873（京东商务二手手机热卖榜，2026-08-25）/);
    },
  },
  {
    name: "phone_used_mainland_legacy_prices",
    input: {
      category: "phone",
      budget: { min: 1100, max: 1250, currency: "CNY" },
      useCases: ["备用机", "小屏"],
      conditionPreference: "used_ok",
      maxResults: 3,
    },
    expect(output) {
      assertSimpleFallback(output, "phone", 3);
      assert.deepEqual(output.devices.map((device) => device.deviceId), [
        "xiaomi-12s-ultra-2022",
        "iphone-13-mini",
        "iphone-12-mini",
      ]);
      assert.match(output.devices[1]?.priceText ?? "", /二手价 ¥1,239（京东 6英以下屏幕二手手机好评榜，2026-08-25）/);
      assert.match(output.devices[0]?.priceText ?? "", /二手价 ¥1,219（九机二手，2026-09-07）/);
      assert.match(output.devices[2]?.priceText ?? "", /二手价 ¥1,189（九机二手良品，2026-08-31）/);
    },
  },
  {
    name: "phone_used_mainland_iphone13_pro_price",
    input: {
      category: "phone",
      budget: { min: 2250, max: 2320, currency: "CNY" },
      useCases: ["拍照"],
      conditionPreference: "used_ok",
      maxResults: 3,
    },
    expect(output) {
      assertSimpleFallback(output, "phone", 3);
      assert.equal(output.devices[1]?.deviceId, "iphone-13-pro");
      assert.match(output.devices[1]?.priceText ?? "", /二手价 ¥2,299（京东二手手机好评榜，2026-08-25）/);
      assert.equal(output.devices[2]?.deviceId, "iphone-12-pro-max");
      assert.match(output.devices[2]?.priceText ?? "", /二手价 ¥2,299（九机二手良品，2026-08-31）/);
      assert.equal(output.devices[0]?.deviceId, "honor-magic6-pro-2024");
      assert.match(output.devices[0]?.priceText ?? "", /二手价 ¥2,279（九机二手，2026-09-07）/);
    },
  },
  {
    name: "phone_used_mainland_iphone13_pro_max_price",
    input: {
      category: "phone",
      budget: { min: 2350, max: 2400, currency: "CNY" },
      useCases: ["拍照", "大屏"],
      conditionPreference: "used_ok",
      maxResults: 3,
    },
    expect(output) {
      assertSimpleFallback(output, "phone", 3);
      assert.equal(output.devices[2]?.deviceId, "iphone-13-pro-max");
      assert.match(output.devices[2]?.priceText ?? "", /二手价 ¥2,388（京东 NFC 二手手机热卖榜，2026-08-25）/);
      assert.equal(output.devices[1]?.deviceId, "iphone-14-plus");
      assert.match(output.devices[1]?.priceText ?? "", /二手价 ¥2,359（九机二手良品，2026-08-31）/);
      assert.equal(output.devices[0]?.deviceId, "redmi-k80-2024");
      assert.match(output.devices[0]?.priceText ?? "", /¥2,399.*缺货标价/);
    },
  },
  {
    name: "phone_used_mainland_iphone13_price",
    input: {
      category: "phone",
      budget: { min: 1800, max: 2000, currency: "CNY" },
      useCases: ["通勤", "拍照"],
      conditionPreference: "used_ok",
      maxResults: 3,
    },
    expect(output) {
      assertSimpleFallback(output, "phone", 3);
      assert.equal(output.devices[2]?.deviceId, "iphone-13");
      assert.match(output.devices[2]?.priceText ?? "", /二手价 ¥1,949（京东苹果二手手机热卖榜，2026-08-25）/);
      assert.equal(output.devices[1]?.deviceId, "xiaomi-13-ultra-2023");
      assert.match(output.devices[1]?.priceText ?? "", /二手价 ¥1,809（九机二手，2026-09-07）/);
      assert.equal(output.devices[0]?.deviceId, "redmi-k80-2024");
      assert.match(output.devices[0]?.priceText ?? "", /¥1,999.*缺货标价/);
    },
  },
  {
    name: "phone_used_mainland_iphone17e_price",
    input: {
      category: "phone",
      budget: { min: 3250, max: 3270, currency: "CNY" },
      useCases: ["日常", "拍照"],
      conditionPreference: "used_ok",
      maxResults: 3,
    },
    expect(output) {
      assertSimpleFallback(output, "phone", 1);
      assert.equal(output.devices[0]?.deviceId, "iphone-17e-2026");
      assert.match(output.devices[0]?.priceText ?? "", /二手价 ¥3,259（九机二手良品，2026-08-31）/);
    },
  },
  {
    name: "laptop_used_mainland_price",
    input: {
      category: "laptop",
      budget: { min: 2000, max: 3000, currency: "CNY" },
      useCases: ["办公", "学习"],
      conditionPreference: "used_ok",
      interfaceNeed: "usb_c",
      maxResults: 3,
    },
    expect(output) {
      assertSimpleFallback(output, "laptop", 1);
      assert.equal(output.devices[0]?.deviceId, "macbook-air-13-m1-2020");
      assert.match(output.devices[0]?.priceText ?? "", /二手价 ¥2,709（京东爱回收严选官方旗舰店，2026-08-25）/);
    },
  },
  {
    name: "laptop_used_mainland_m2_neo_prices",
    input: {
      category: "laptop",
      budget: { min: 3500, max: 4200, currency: "CNY" },
      useCases: ["办公", "学习"],
      conditionPreference: "used_ok",
      interfaceNeed: "usb_c",
      maxResults: 3,
    },
    expect(output) {
      assertSimpleFallback(output, "laptop", 2);
      assert.deepEqual(output.devices.map((device) => device.deviceId), [
        "macbook-neo-13-2026",
        "macbook-air-13-m2-2022",
      ]);
      assert.match(output.devices[1]?.priceText ?? "", /二手价 ¥3,979（京东爱回收严选官方旗舰店，2026-08-25）/);
      assert.match(output.devices[0]?.priceText ?? "", /二手价 ¥3,749（九机二手良品，2026-08-31）/);
    },
  },
  {
    name: "laptop_used_mainland_air_m2_m3_price",
    input: {
      category: "laptop",
      budget: { min: 4500, max: 5000, currency: "CNY" },
      useCases: ["办公", "学习"],
      conditionPreference: "used_ok",
      interfaceNeed: "usb_c",
      maxResults: 3,
    },
    expect(output) {
      assertSimpleFallback(output, "laptop", 2);
      assert.deepEqual(output.devices.map((device) => device.deviceId), [
        "macbook-air-13-m3-2024",
        "macbook-air-15-m2-2023",
      ]);
      assert.match(output.devices[0]?.priceText ?? "", /二手价 ¥4,799（九机二手良品，2026-08-25）/);
      assert.match(output.devices[1]?.priceText ?? "", /二手价 ¥4,799（九机二手良品，2026-08-31）/);
    },
  },
  {
    name: "laptop_used_mainland_m1_neo_prices",
    input: {
      category: "laptop",
      budget: { min: 3300, max: 3800, currency: "CNY" },
      useCases: ["办公", "学习"],
      conditionPreference: "used_ok",
      interfaceNeed: "usb_c",
      maxResults: 3,
    },
    expect(output) {
      assertSimpleFallback(output, "laptop", 2);
      assert.deepEqual(output.devices.map((device) => device.deviceId), [
        "macbook-neo-13-2026",
        "macbook-pro-13-m1-2020",
      ]);
      assert.match(output.devices[0]?.priceText ?? "", /二手价 ¥3,749（九机二手良品，2026-08-31）/);
      assert.match(output.devices[1]?.priceText ?? "", /二手价 ¥3,399（九机二手良品，2026-08-31）/);
    },
  },
  {
    name: "laptop_used_mainland_m5_pro_price",
    input: {
      category: "laptop",
      budget: { min: 17000, max: 17300, currency: "CNY" },
      useCases: ["开发", "视频剪辑"],
      conditionPreference: "used_ok",
      maxResults: 3,
    },
    expect(output) {
      assertSimpleFallback(output, "laptop", 2);
      assert.equal(output.devices[1]?.deviceId, "macbook-pro-14-m5-pro-2026");
      assert.match(output.devices[1]?.priceText ?? "", /二手价 ¥17,199（九机二手良品，2026-08-31）/);
    },
  },
  {
    name: "laptop_used_mainland_macbook_pro_m3_price",
    input: {
      category: "laptop",
      budget: { min: 7850, max: 7950, currency: "CNY" },
      useCases: ["开发", "视频剪辑"],
      conditionPreference: "used_ok",
      maxResults: 3,
    },
    expect(output) {
      assertSimpleFallback(output, "laptop", 1);
      assert.deepEqual(output.devices.map((device) => device.deviceId), ["macbook-air-15-m4-2025"], "screen-defective M3 quote must not enter the advisor budget");
      assert.ok(
        output.devices.every((device) =>
          /二手价 ¥7,899（九机二手良品，2026-08-25）/.test(device.priceText ?? ""),
        ),
      );
    },
  },
  {
    name: "laptop_used_mainland_macbook_air_m4_price",
    input: {
      category: "laptop",
      budget: { min: 8600, max: 8700, currency: "CNY" },
      useCases: ["移动办公", "开发"],
      conditionPreference: "used_ok",
      maxResults: 3,
    },
    expect(output) {
      assertSimpleFallback(output, "laptop", 2);
      assert.deepEqual(output.devices.map((device) => device.deviceId), [
        "macbook-air-15-m5-2026",
        "macbook-air-13-m4-2025",
      ]);
      assert.match(output.devices[0]?.priceText ?? "", /二手价 ¥8,699（九机二手良品，2026-08-31）/);
      assert.match(output.devices[1]?.priceText ?? "", /二手价 ¥8,649（九机二手良品，2026-08-25）/);
    },
  },
  {
    name: "laptop_usb_c_budget_pressure",
    input: {
      category: "laptop",
      budget: { max: 2800, currency: "CNY" },
      performancePreference: "performance",
      useCases: ["剪辑", "开发", "多任务"],
      conditionPreference: "new_only",
      batteryPriority: "high",
      interfaceNeed: "usb_c",
      replacementIntent: "upgrade",
      maxResults: 3,
    },
    expect(output) {
      assertSimpleFallback(output, "laptop");
    },
  },
];

const scenarioNames = scenarios.map((scenario) => scenario.name);
console.log(`Running ${scenarios.length} device advisor regression scenarios: ${scenarioNames.join(", ")}`);

for (const scenario of scenarios) {
  const output = runFallbackDeviceAdvisor(scenario.input);
  scenario.expect(output, scenario.input);
  console.log(`✓ ${scenario.name}: ${pickRecommendationTitles(output).join(", ")}`);
}

console.log(`Passed ${scenarios.length} device advisor regression scenarios: ${scenarioNames.join(", ")}`);
