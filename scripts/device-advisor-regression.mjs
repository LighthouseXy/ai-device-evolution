import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const projectRoot = process.cwd();
const nativeRequire = createRequire(import.meta.url);
const ts = nativeRequire("typescript");
const moduleCache = new Map();

function fileExists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function resolveCandidate(request, parentDir) {
  const direct = request.startsWith("@/")
    ? path.join(projectRoot, "src", request.slice(2))
    : request.startsWith(".")
      ? path.resolve(parentDir, request)
      : null;

  if (!direct) return null;

  const attempts = [
    direct,
    `${direct}.ts`,
    `${direct}.tsx`,
    `${direct}.mts`,
    `${direct}.cts`,
    `${direct}.js`,
    `${direct}.mjs`,
    `${direct}.cjs`,
    `${direct}.json`,
    path.join(direct, "index.ts"),
    path.join(direct, "index.tsx"),
    path.join(direct, "index.mts"),
    path.join(direct, "index.js"),
    path.join(direct, "index.json"),
  ];

  return attempts.find((candidate) => fileExists(candidate)) ?? null;
}

function transpileTs(sourceText, filename) {
  return ts.transpileModule(sourceText, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      resolveJsonModule: true,
      jsx: ts.JsxEmit.ReactJSX,
      allowJs: true,
    },
    fileName: filename,
  }).outputText;
}

function loadModule(resolvedPath) {
  if (moduleCache.has(resolvedPath)) {
    return moduleCache.get(resolvedPath).exports;
  }

  if (resolvedPath.endsWith(".json")) {
    const value = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
    moduleCache.set(resolvedPath, { exports: value });
    return value;
  }

  const sourceText = fs.readFileSync(resolvedPath, "utf8");
  const compiled = transpileTs(sourceText, resolvedPath);
  const compiledModule = { exports: {} };
  moduleCache.set(resolvedPath, compiledModule);

  const localRequire = (request) => {
    const resolved = resolveCandidate(request, path.dirname(resolvedPath));
    if (resolved) return loadModule(resolved);
    return nativeRequire(request);
  };

  const wrapped = new Function("require", "module", "exports", "__filename", "__dirname", compiled);
  wrapped(localRequire, compiledModule, compiledModule.exports, resolvedPath, path.dirname(resolvedPath));
  return compiledModule.exports;
}

function loadTsModule(relativePath) {
  const resolved = resolveCandidate(relativePath, projectRoot);
  if (!resolved) {
    throw new Error(`Cannot resolve module: ${relativePath}`);
  }
  return loadModule(resolved);
}

const { runFallbackDeviceAdvisor } = loadTsModule("./src/lib/device-advisor.ts");

function pickRecommendationTitles(output) {
  return output.recommendations.map((item) => item.model);
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
      assert.equal(output.source, "rules");
      assert.ok(output.recommendations.length > 0, "should return recommendations");
      assert.equal(output.recommendations[0].category, "phone");
      assertHasAny(
        [...output.recommendations[0].reasons, ...output.recommendations[0].tradeoffs, ...output.tradeoffs],
        [/续航/, /二手/, /翻新/, /成色/, /预算/],
        "budget/battery/refurbished signals should surface",
      );
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
      assert.equal(output.source, "rules");
      assert.ok(output.recommendations.length > 0, "should return recommendations");
      assert.equal(output.recommendations[0].category, "tablet");
      assertHasAny(
        [...output.recommendations[0].reasons, ...output.recommendations[0].tradeoffs],
        [/Apple Pencil/, /便携/, /屏幕/, /手写/],
        "tablet study scenario should surface pencil or portability",
      );
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
      assert.equal(output.source, "rules");
      assert.ok(output.recommendations.length > 0, "should return recommendations");
      assert.equal(output.recommendations[0].category, "laptop");
      assertHasAny(
        [...output.recommendations[0].reasons, ...output.recommendations[0].tradeoffs],
        [/USB-C/, /性能/, /多任务/, /接口/],
        "laptop productivity scenario should reflect performance or USB-C",
      );
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
      assert.equal(output.source, "rules");
      assert.ok(output.recommendations.length > 0, "should return recommendations");
      assert.equal(output.recommendations[0].category, "phone");
      assertHasAny(
        [...output.recommendations[0].reasons, ...output.recommendations[0].tradeoffs],
        [/拍照/, /视频/, /续航/, /MagSafe/],
        "iphone camera/battery scenario should surface camera or battery signals",
      );
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
      assert.equal(output.source, "rules");
      assert.ok(output.recommendations.length > 0, "should return recommendations");
      assert.ok(output.tradeoffs.length > 0, "should surface tradeoffs when constraints conflict");
      assertHasAny(
        [...output.tradeoffs, ...output.notSuitableFor, ...output.recommendations[0].tradeoffs],
        [/预算/, /性能/, /续航/, /全新/],
        "conflicting budget scenario should surface an explicit tradeoff",
      );
    },
  },
];

for (const scenario of scenarios) {
  const output = runFallbackDeviceAdvisor(scenario.input);
  scenario.expect(output);
  console.log(`✓ ${scenario.name}: ${pickRecommendationTitles(output).join(", ")}`);
}

console.log(`Passed ${scenarios.length} device advisor regression scenarios.`);
