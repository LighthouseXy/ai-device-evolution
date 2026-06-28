import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const projectRoot = process.cwd();
const nativeRequire = createRequire(import.meta.url);
const ts = nativeRequire("typescript");
const moduleCache = new Map();
const routeUrl = "http://localhost/api/device-advisor";
const envKeys = ["AI_PROVIDER", "OPENAI_API_KEY", "DEEPSEEK_API_KEY"];

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

const { POST } = loadTsModule("./src/app/api/device-advisor/route.ts");
const originalFetch = globalThis.fetch;

function makeJsonRequest(body, { raw = false } = {}) {
  const init = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  };

  if (raw) {
    return new Request(routeUrl, { ...init, body });
  }

  return new Request(routeUrl, { ...init, body: JSON.stringify(body) });
}

async function readJsonResponse(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function callRoute(body, options = {}) {
  return POST(makeJsonRequest(body, options));
}

function assertErrorResponse(response, expectedStatus, fragment) {
  assert.equal(response.status, expectedStatus);
  return readJsonResponse(response).then((data) => {
    assert.ok(data && typeof data.error === "string", "should return an error payload");
    assert.match(data.error, fragment);
  });
}

function withDisabledProviderEnv(run) {
  const snapshot = new Map(envKeys.map((key) => [key, process.env[key]]));

  for (const key of envKeys) {
    delete process.env[key];
  }

  return Promise.resolve()
    .then(run)
    .finally(() => {
      for (const [key, value] of snapshot) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    });
}

function withDeepSeekProviderEnv(run) {
  const snapshot = new Map(envKeys.map((key) => [key, process.env[key]]));
  process.env.AI_PROVIDER = "deepseek";
  process.env.DEEPSEEK_API_KEY = "dummy-deepseek-key";
  delete process.env.OPENAI_API_KEY;

  return Promise.resolve()
    .then(run)
    .finally(() => {
      for (const [key, value] of snapshot) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    });
}

function withMockedFetch(mockFetch, run) {
  globalThis.fetch = mockFetch;
  return Promise.resolve()
    .then(run)
    .finally(() => {
      globalThis.fetch = originalFetch;
    });
}

function makeJsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const scenarios = [
  {
    name: "empty_body",
    run: () => callRoute(undefined, { raw: true }),
    expect(response) {
      return assertErrorResponse(response, 400, /合法 JSON/);
    },
  },
  {
    name: "empty_string_body",
    run: () => callRoute("", { raw: true }),
    expect(response) {
      return assertErrorResponse(response, 400, /合法 JSON/);
    },
  },
  {
    name: "invalid_json",
    run: () => {
      const request = new Request(routeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      });
      return POST(request);
    },
    expect(response) {
      return assertErrorResponse(response, 400, /合法 JSON/);
    },
  },
  {
    name: "unknown_fields_only",
    run: () => callRoute({ foo: "bar", baz: 1 }),
    expect(response) {
      return assertErrorResponse(response, 400, /缺少必要字段/);
    },
  },
  {
    name: "invalid_field_types",
    run: () => callRoute({ category: 123, useCases: 1, performancePreference: true }),
    expect(response) {
      return assertErrorResponse(response, 400, /字段格式不正确/);
    },
  },
  {
    name: "max_results_zero",
    run: () => callRoute({
      category: "phone",
      useCases: ["通勤"],
      replacementIntent: "replace",
      maxResults: 0,
    }),
    expect(response) {
      return response.json().then((data) => {
        assert.equal(response.status, 200);
        assert.ok(Array.isArray(data.recommendations), "should return recommendations");
        assert.equal(data.recommendations.length, 1);
      });
    },
  },
  {
    name: "max_results_negative",
    run: () => callRoute({
      category: "phone",
      useCases: ["通勤"],
      replacementIntent: "replace",
      maxResults: -1,
    }),
    expect(response) {
      return response.json().then((data) => {
        assert.equal(response.status, 200);
        assert.ok(Array.isArray(data.recommendations), "should return recommendations");
        assert.equal(data.recommendations.length, 1);
      });
    },
  },
  {
    name: "max_results_large",
    run: () => callRoute({
      category: "phone",
      useCases: ["通勤"],
      replacementIntent: "replace",
      maxResults: 999,
    }),
    expect(response) {
      return response.json().then((data) => {
        assert.equal(response.status, 200);
        assert.ok(Array.isArray(data.recommendations), "should return recommendations");
        assert.equal(data.recommendations.length, 3);
      });
    },
  },
  {
    name: "deepseek_retry_length_then_valid",
    run: () =>
      withDeepSeekProviderEnv(() =>
        withMockedFetch(async (inputUrl, init) => {
          const requestBody = JSON.parse(init.body);
          const messages = Array.isArray(requestBody.messages) ? requestBody.messages : [];
          const isRetry = messages.some((message) => {
            return typeof message.content === "string" && message.content.includes("This is a retry after an invalid or truncated answer.");
          });

          if (!isRetry) {
            return makeJsonResponse({
              choices: [
                {
                  finish_reason: "length",
                  message: {
                    content: "",
                    reasoning_content: "truncated",
                  },
                },
              ],
            });
          }

          return makeJsonResponse({
            choices: [
              {
                finish_reason: "stop",
                message: {
                  content: JSON.stringify({
                    summary: "修复后返回的推荐结果。",
                    recommendations: [
                      {
                        deviceId: "iphone-15",
                        model: "iPhone 15",
                        series: "iPhone",
                        category: "phone",
                        releaseYear: 2023,
                        priceText: "首发价 ¥5,999",
                        matchScore: 0.7,
                        reasons: ["电池表现稳定"],
                        tradeoffs: ["价格高于预算"],
                        suitableFor: ["通勤"],
                        notSuitableFor: ["严格预算"],
                      },
                    ],
                    tradeoffs: ["价格高于预算"],
                    suitableFor: ["通勤"],
                    notSuitableFor: ["严格预算"],
                    alternatives: [
                      {
                        deviceId: "iphone-15-pro",
                        model: "iPhone 15 Pro",
                        series: "iPhone",
                        category: "phone",
                        releaseYear: 2023,
                        priceText: "首发价 ¥7,999",
                        matchScore: 0.6,
                        reasons: ["性能更强"],
                        tradeoffs: ["更贵"],
                        suitableFor: ["性能需求"],
                        notSuitableFor: ["低预算"],
                      },
                    ],
                    confidence: 0.66,
                    source: "ai",
                    disclaimer: "基于已收录设备数据生成，仅供参考",
                  }),
                },
              },
            ],
          });
        }, () => callRoute({
          category: "phone",
          useCases: ["通勤"],
          replacementIntent: "replace",
          maxResults: 3,
        })).then(async (response) => {
          assert.equal(response.status, 200);
          const data = await response.json();
          assert.equal(data.source, "ai");
          assert.equal(data.recommendations[0].model, "iPhone 15");
          assert.equal(data.alternatives[0].model, "iPhone 15 Pro");
        })),
  },
  {
    name: "deepseek_type_drift_repair",
    run: () =>
      withDeepSeekProviderEnv(() =>
        withMockedFetch(async () =>
          makeJsonResponse({
            choices: [
              {
                finish_reason: "stop",
                message: {
                  content: JSON.stringify({
                    summary: "类型漂移但可修复。",
                    recommendations: [
                      {
                        deviceId: "iphone-15",
                        model: "iPhone 15",
                        series: "iPhone",
                        category: "phone",
                        releaseYear: 2023,
                        priceText: "首发价 ¥5,999",
                        matchScore: 0.7,
                        reasons: "续航稳定",
                        tradeoffs: "价格偏高",
                        suitableFor: "通勤",
                        notSuitableFor: "严格预算",
                      },
                    ],
                    tradeoffs: "价格偏高",
                    suitableFor: "通勤",
                    notSuitableFor: "严格预算",
                    alternatives: {
                      deviceId: "iphone-15-pro",
                      model: "iPhone 15 Pro",
                      series: "iPhone",
                      category: "phone",
                      releaseYear: 2023,
                      priceText: "首发价 ¥7,999",
                      matchScore: 0.6,
                      reasons: "性能更强",
                      tradeoffs: "更贵",
                      suitableFor: "性能需求",
                      notSuitableFor: "低预算",
                    },
                    confidence: "0.78",
                    source: "ai",
                    disclaimer: "",
                  }),
                },
              },
            ],
          }), () => callRoute({
            category: "phone",
            useCases: ["通勤"],
            replacementIntent: "replace",
            maxResults: 3,
          })).then(async (response) => {
            assert.equal(response.status, 200);
            const data = await response.json();
            assert.equal(data.source, "ai");
            assert.equal(data.recommendations[0].tradeoffs[0], "价格偏高");
            assert.equal(data.alternatives[0].model, "iPhone 15 Pro");
            assert.equal(data.confidence, 0.78);
          })),
  },
];

await withDisabledProviderEnv(async () => {
  console.log(`Running ${scenarios.length} device advisor API regression scenarios: ${scenarios.map((scenario) => scenario.name).join(", ")}`);

  for (const scenario of scenarios) {
    const response = await scenario.run();
    if (typeof scenario.expect === "function") {
      await scenario.expect(response);
    }
    console.log(`✓ ${scenario.name}`);
  }

  console.log(`Passed ${scenarios.length} device advisor API regression scenarios: ${scenarios.map((scenario) => scenario.name).join(", ")}`);
});
