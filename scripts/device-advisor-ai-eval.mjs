import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";

const projectRoot = process.cwd();
const nativeRequire = createRequire(import.meta.url);
const ts = nativeRequire("typescript");
const moduleCache = new Map();
const routeUrl = "http://localhost/api/device-advisor";
const fixturePath = path.join(projectRoot, "scripts/fixtures/device-advisor-ai-eval.json");
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

function makeJsonRequest(body) {
  return new Request(routeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function readJsonResponse(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function withOfflineProviderEnv(run) {
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

function emptySummary() {
  return {
    total: 0,
    source: { ai: 0, rules: 0, error: 0 },
    partialRepair: 0,
    finalFallback: 0,
    noMatchEmptyAi: 0,
    confidenceTotal: 0,
    confidenceCount: 0,
    latencyTotalMs: 0,
  };
}

function finalizeSummary(summary) {
  return {
    total: summary.total,
    source: summary.source,
    partialRepair: summary.partialRepair,
    finalFallback: summary.finalFallback,
    noMatchEmptyAi: summary.noMatchEmptyAi,
    averageConfidence:
      summary.confidenceCount > 0 ? Number((summary.confidenceTotal / summary.confidenceCount).toFixed(3)) : null,
    averageLatencyMs:
      summary.total > 0 ? Number((summary.latencyTotalMs / summary.total).toFixed(1)) : null,
  };
}

function updateSummary(summary, result) {
  summary.total += 1;
  summary.source[result.source] = (summary.source[result.source] ?? 0) + 1;
  summary.latencyTotalMs += result.latencyMs;

  if (result.partialRepair) summary.partialRepair += 1;
  if (result.finalFallback) summary.finalFallback += 1;
  if (result.noMatchEmptyAi) summary.noMatchEmptyAi += 1;
  if (typeof result.confidence === "number") {
    summary.confidenceTotal += result.confidence;
    summary.confidenceCount += 1;
  }
}

function classifyResult(sample, status, data, latencyMs) {
  if (!data || typeof data !== "object" || status >= 400) {
    return {
      id: sample.id,
      group: sample.group,
      source: "error",
      status,
      confidence: null,
      latencyMs,
      partialRepair: false,
      finalFallback: false,
      noMatchEmptyAi: false,
      recommendationCount: null,
      alternativeCount: null,
      summary: data?.error ?? null,
    };
  }

  const source = data.source === "ai" || data.source === "rules" ? data.source : "error";
  const recommendations = Array.isArray(data.recommendations) ? data.recommendations : [];
  const alternatives = Array.isArray(data.alternatives) ? data.alternatives : [];
  const disclaimer = typeof data.disclaimer === "string" ? data.disclaimer : "";
  const partialRepair = source === "rules" && disclaimer.includes("AI 输出不完整");

  return {
    id: sample.id,
    group: sample.group,
    source,
    status,
    confidence: typeof data.confidence === "number" ? data.confidence : null,
    latencyMs,
    partialRepair,
    finalFallback: source === "rules" && !partialRepair,
    noMatchEmptyAi: source === "ai" && recommendations.length === 0 && alternatives.length === 0,
    recommendationCount: recommendations.length,
    alternativeCount: alternatives.length,
    summary: typeof data.summary === "string" ? data.summary : null,
  };
}

function printSummary(label, summary) {
  console.log(`${label}:`);
  console.log(JSON.stringify(finalizeSummary(summary), null, 2));
}

async function main() {
  const samples = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const { POST } = loadTsModule("./src/app/api/device-advisor/route.ts");
  const total = emptySummary();
  const byGroup = new Map();
  const results = [];

  await withOfflineProviderEnv(async () => {
    for (const sample of samples) {
      const start = performance.now();
      let response;
      let data;

      try {
        response = await POST(makeJsonRequest(sample.input));
        data = await readJsonResponse(response);
      } catch (error) {
        data = { error: error instanceof Error ? error.message : String(error) };
        response = { status: 500 };
      }

      const latencyMs = Number((performance.now() - start).toFixed(1));
      const result = classifyResult(sample, response.status, data, latencyMs);
      results.push(result);
      updateSummary(total, result);

      const groupSummary = byGroup.get(sample.group) ?? emptySummary();
      byGroup.set(sample.group, groupSummary);
      updateSummary(groupSummary, result);
    }
  });

  console.log(`Device advisor AI eval: ${samples.length} offline samples`);
  printSummary("Overall", total);

  console.log("By group:");
  for (const [group, summary] of byGroup.entries()) {
    console.log(`- ${group}: ${JSON.stringify(finalizeSummary(summary))}`);
  }

  console.log("Cases:");
  for (const result of results) {
    console.log(
      [
        result.id,
        `group=${result.group}`,
        `source=${result.source}`,
        `confidence=${result.confidence ?? "n/a"}`,
        `latencyMs=${result.latencyMs}`,
        `partialRepair=${result.partialRepair}`,
        `finalFallback=${result.finalFallback}`,
        `noMatchEmptyAi=${result.noMatchEmptyAi}`,
      ].join(" | "),
    );
  }
}

await main();
