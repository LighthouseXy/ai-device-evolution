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

const { runFallbackDeviceAdvisor } = loadTsModule("./src/lib/device-advisor.ts");

function pickRecommendationTitles(output) {
  return output.recommendations.map((item) => item.model);
}

function assertSimpleFallback(output, category, maxResults = 3) {
  assert.equal(output.source, "rules");
  assert.ok(output.recommendations.length > 0, "should return recommendations");
  assert.equal(output.recommendations.length, maxResults);
  assert.ok(
    output.recommendations.every((item) => item.category === category),
    "fallback should stay inside the selected category",
  );
  assert.equal(
    new Set(output.recommendations.map((item) => item.deviceId)).size,
    output.recommendations.length,
    "fallback recommendations should not contain duplicate devices",
  );
  assert.match(output.disclaimer, /仅按设备类型、预算和发布时间排序/);
  assert.match(output.tradeoffs.join(" "), /不分析性能、续航、影像等偏好/);
}

const scenarios = [
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
      assert.match(output.recommendations[0].reasons.join(" "), /预算/);
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
      assert.match(output.summary, /按预算接近度和发布时间排序/);
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
      assertSimpleFallback(output, "tablet");
      assert.match(output.summary, /¥9,000 - ¥14,000/);
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
  scenario.expect(output);
  console.log(`✓ ${scenario.name}: ${pickRecommendationTitles(output).join(", ")}`);
}

console.log(`Passed ${scenarios.length} device advisor regression scenarios: ${scenarioNames.join(", ")}`);
