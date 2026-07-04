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

function getRecommendationSignals(output, index = 0) {
  const recommendation = output.recommendations[index];
  if (!recommendation) return [];

  return [...recommendation.reasons, ...recommendation.tradeoffs, ...output.tradeoffs];
}

function assertPrimaryRecommendation(output, category, message) {
  assert.equal(output.source, "rules");
  assert.ok(output.recommendations.length > 0, "should return recommendations");
  assert.equal(output.recommendations[0].category, category, message);
}

function assertHasAny(texts, patterns, message) {
  const joined = texts.join(" | ");
  assert.ok(
    patterns.some((pattern) => pattern.test(joined)),
    `${message}\nActual: ${joined}`,
  );
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
      assertPrimaryRecommendation(output, "phone", "budget_used_battery should stay focused on phones");
      assertHasAny(getRecommendationSignals(output), [/续航/, /二手/, /翻新/, /成色/, /预算/], "budget/battery/refurbished signals should surface");
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
      assertPrimaryRecommendation(output, "tablet", "tablet_study_portable should stay focused on tablets");
      assertHasAny(getRecommendationSignals(output), [/Apple Pencil/, /便携/, /屏幕/, /手写/], "tablet study scenario should surface pencil or portability");
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
      assertPrimaryRecommendation(output, "laptop", "laptop_productivity_usb_c should stay focused on laptops");
      assertHasAny(getRecommendationSignals(output), [/USB-C/, /性能/, /多任务/, /接口/], "laptop productivity scenario should reflect performance or USB-C");
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
      assertPrimaryRecommendation(output, "phone", "iphone_camera_battery should stay focused on phones");
      assertHasAny(getRecommendationSignals(output), [/拍照/, /视频/, /续航/, /MagSafe/], "iphone camera/battery scenario should surface camera or battery signals");
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
      assertPrimaryRecommendation(output, "laptop", "conflict_budget_pressure should stay focused on laptops");
      assert.ok(output.tradeoffs.length > 0, "should surface tradeoffs when constraints conflict");
      assertHasAny([...output.tradeoffs, ...output.notSuitableFor, ...output.recommendations[0].tradeoffs], [/预算/, /性能/, /续航/, /全新/], "conflicting budget scenario should surface an explicit tradeoff");
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
      assertPrimaryRecommendation(output, "tablet", "tablet_pencil_reordered_budget should stay focused on tablets");
      assert.match(output.summary, /¥9,000 - ¥14,000/);
      assertHasAny(getRecommendationSignals(output), [/Apple Pencil/, /全新/, /预算/], "tablet pencil scenario should surface pencil support or condition/budget tradeoffs");
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
      assertPrimaryRecommendation(output, "phone", "phone_condition_battery_pressure should stay focused on phones");
      assertHasAny(getRecommendationSignals(output), [/续航/, /预算/, /全新/, /成色/], "phone condition/battery scenario should surface endurance and condition pressure");
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
      assertPrimaryRecommendation(output, "laptop", "laptop_usb_c_budget_pressure should stay focused on laptops");
      assertHasAny([...getRecommendationSignals(output), ...output.notSuitableFor], [/USB-C/, /性能/, /续航/, /预算/], "laptop usb-c scenario should surface interface or performance tradeoffs");
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
