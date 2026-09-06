import assert from "node:assert/strict";
import { loadTsModule } from "./lib/load-ts-module.mjs";

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

const { buildDeviceAdvisorContext, buildDeviceAdvisorPrompt, runFallbackDeviceAdvisor } = loadTsModule("./src/lib/device-advisor.ts");

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
      assertSimpleFallback(output, "phone", 1);
      assert.equal(output.devices[0]?.deviceId, "xiaomi-15-ultra-2025");
      assert.match(output.devices[0]?.priceText ?? "", /当前价 ¥6,499（中关村在线电商报价，2026-09-07）/);
      const candidate = buildDeviceAdvisorContext(input).candidateShortlist[0];
      assert.equal(candidate.brand, "Xiaomi");
      assert.equal(candidate.facts.memory, "12GB / 16GB");
      assert.equal(candidate.facts.configurations, "12GB+256GB / 16GB+512GB / 16GB+1TB");
      assert.equal(candidate.facts.dxomarkCamera, "159 分（Camera v6）");
      assert.match(buildDeviceAdvisorPrompt(input), /协议不同的分数不可直接比较高低/);
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
      assert.match(output.devices[0]?.priceText ?? "", /当前价 ¥14,500（识货，2026-08-31）/);
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
      assert.ok(output.devices.some((device) => /识货，2026-08-24/.test(device.priceText)));
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
      assertSimpleFallback(output, "tablet", 1);
      assert.match(output.answer, /¥9,000 - ¥14,000/);
      assert.equal(output.devices[0]?.deviceId, "ipad-pro-m4-13-2024");
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
      budget: { min: 5200, max: 5250, currency: "CNY" },
      useCases: ["学习", "绘画"],
      conditionPreference: "used_ok",
      maxResults: 3,
    },
    expect(output) {
      assertSimpleFallback(output, "tablet", 2);
      assert.deepEqual(output.devices.map((device) => device.deviceId), ["ipad-pro-m2-2022", "ipad-air-m4-2025"]);
      assert.match(output.devices[0]?.priceText ?? "", /二手价 ¥5,249（九机二手良品，2026-08-31）/);
      assert.match(output.devices[1]?.priceText ?? "", /二手价 ¥5,229（京东 99 成新二手平板电脑折扣榜，2026-08-25）/);
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
      assertSimpleFallback(output, "tablet", 1);
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
      assertSimpleFallback(output, "tablet");
      assert.deepEqual(output.devices.map((device) => device.deviceId), ["ipad-10th-2022", "ipad-mini-6th-2021", "ipad-air-4th-2020"]);
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
      assert.deepEqual(output.devices.map((device) => device.deviceId), ["ipad-pro-11-2nd-2020", "ipad-mini-a17-pro-2024", "ipad-pro-11-1st-2018"]);
      assert.ok(output.devices.every((device) => /二手价 .*（九机二手良品，2026-08-25）/.test(device.priceText)));
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
      assertSimpleFallback(output, "tablet", 1);
      assert.equal(output.devices[0]?.deviceId, "ipad-pro-m2-13-2022");
      assert.match(output.devices[0]?.priceText ?? "", /二手价 ¥5,499（九机二手良品，2026-08-31）/);
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
    expect(output) {
      assertSimpleFallback(output, "phone", 1);
      assert.equal(output.devices[0]?.deviceId, "iphone-15");
      assert.match(output.devices[0]?.priceText ?? "", /当前价 ¥5,599（京东，2026-08-25）/);
    },
  },
  {
    name: "tablet_current_mainland_ipad_air_m2_price",
    input: {
      category: "tablet",
      budget: { min: 5490, max: 5510, currency: "CNY" },
      useCases: ["学习", "绘画"],
      conditionPreference: "new_only",
      maxResults: 3,
    },
    expect(output) {
      assertSimpleFallback(output, "tablet", 1);
      assert.equal(output.devices[0]?.deviceId, "ipad-air-m2-2024");
      assert.match(output.devices[0]?.priceText ?? "", /当前价 ¥5,500（识货，2026-08-31）/);
    },
  },
  {
    name: "tablet_current_mainland_ipad_air_13_m2_price",
    input: {
      category: "tablet",
      budget: { min: 5650, max: 5670, currency: "CNY" },
      useCases: ["学习", "绘画"],
      conditionPreference: "new_only",
      maxResults: 3,
    },
    expect(output) {
      assertSimpleFallback(output, "tablet", 1);
      assert.equal(output.devices[0]?.deviceId, "ipad-air-13-m2-2024");
      assert.match(output.devices[0]?.priceText ?? "", /当前价 ¥5,660（识货，2026-08-31）/);
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
      assert.deepEqual(output.devices.map((device) => device.deviceId), ["iphone-14", "iphone-13-pro-max", "iphone-14-plus"]);
      assert.match(output.devices[2]?.priceText ?? "", /二手价 ¥2,359（九机二手良品，2026-08-31）/);
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
        "iphone-13-mini",
        "iphone-11-pro-2019",
        "iphone-12-mini",
      ]);
      assert.match(output.devices[0]?.priceText ?? "", /二手价 ¥1,239（京东 6英以下屏幕二手手机好评榜，2026-08-25）/);
      assert.match(output.devices[1]?.priceText ?? "", /二手价 ¥1,219（九机二手良品，2026-08-31）/);
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
      assertSimpleFallback(output, "phone", 2);
      assert.equal(output.devices[0]?.deviceId, "iphone-13-pro");
      assert.match(output.devices[0]?.priceText ?? "", /二手价 ¥2,299（京东二手手机好评榜，2026-08-25）/);
      assert.equal(output.devices[1]?.deviceId, "iphone-12-pro-max");
      assert.match(output.devices[1]?.priceText ?? "", /二手价 ¥2,299（九机二手良品，2026-08-31）/);
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
      assertSimpleFallback(output, "phone", 2);
      assert.equal(output.devices[0]?.deviceId, "iphone-13-pro-max");
      assert.match(output.devices[0]?.priceText ?? "", /二手价 ¥2,388（京东 NFC 二手手机热卖榜，2026-08-25）/);
      assert.equal(output.devices[1]?.deviceId, "iphone-14-plus");
      assert.match(output.devices[1]?.priceText ?? "", /二手价 ¥2,359（九机二手良品，2026-08-31）/);
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
      assertSimpleFallback(output, "phone", 1);
      assert.equal(output.devices[0]?.deviceId, "iphone-13");
      assert.match(output.devices[0]?.priceText ?? "", /二手价 ¥1,949（京东苹果二手手机热卖榜，2026-08-25）/);
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
        "macbook-air-13-m2-2022",
        "macbook-neo-13-2026",
      ]);
      assert.match(output.devices[0]?.priceText ?? "", /二手价 ¥3,979（京东爱回收严选官方旗舰店，2026-08-25）/);
      assert.match(output.devices[1]?.priceText ?? "", /二手价 ¥3,749（九机二手良品，2026-08-31）/);
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
      assertSimpleFallback(output, "laptop", 1);
      assert.equal(output.devices[0]?.deviceId, "macbook-pro-14-m5-pro-2026");
      assert.match(output.devices[0]?.priceText ?? "", /二手价 ¥17,199（九机二手良品，2026-08-31）/);
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
      assertSimpleFallback(output, "laptop", 2);
      assert.deepEqual(
        output.devices.map((device) => device.deviceId),
        ["macbook-air-15-m4-2025", "macbook-pro-14-m3-2023"],
      );
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
