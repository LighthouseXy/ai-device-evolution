import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { loadTsModule } from "./lib/load-ts-module.mjs";

const projectRoot = process.cwd();
const routeUrl = "http://localhost/api/device-advisor";
const fixturePath = path.join(projectRoot, "scripts/fixtures/device-advisor-ai-eval.json");
const envKeys = ["AI_PROVIDER", "OPENAI_API_KEY", "DEEPSEEK_API_KEY"];

function parseArgs(argv) {
  const options = {
    provider: "offline",
    runs: 1,
    out: null,
    limit: null,
  };

  for (const arg of argv) {
    if (arg.startsWith("--provider=")) {
      options.provider = arg.slice("--provider=".length);
    } else if (arg.startsWith("--runs=")) {
      options.runs = Number(arg.slice("--runs=".length));
    } else if (arg.startsWith("--out=")) {
      options.out = arg.slice("--out=".length);
    } else if (arg.startsWith("--limit=")) {
      options.limit = Number(arg.slice("--limit=".length));
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.provider !== "offline" && options.provider !== "deepseek") {
    throw new Error("--provider must be offline or deepseek");
  }

  if (!Number.isInteger(options.runs) || options.runs < 1) {
    throw new Error("--runs must be a positive integer");
  }

  if (options.limit !== null && (!Number.isInteger(options.limit) || options.limit < 1)) {
    throw new Error("--limit must be a positive integer");
  }

  return options;
}

function loadLocalEnvFile() {
  const envPath = path.join(projectRoot, ".env.local");
  if (!fileExists(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed
      .slice(separator + 1)
      .trim()
      .replace(/^["']|["']$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function fileExists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
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

function withProviderEnv(provider, run) {
  if (provider === "offline") {
    return withOfflineProviderEnv(run);
  }

  loadLocalEnvFile();
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error("DEEPSEEK_API_KEY is required for --provider=deepseek");
  }

  const snapshot = new Map(envKeys.map((key) => [key, process.env[key]]));
  process.env.AI_PROVIDER = "deepseek";
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
    latenciesMs: [],
    initialLatencyTotalMs: 0,
    initialLatencyCount: 0,
    retryLatencyTotalMs: 0,
    retryLatencyCount: 0,
    retryUsed: 0,
    retryReasons: new Map(),
    missingFields: new Map(),
  };
}

function percentile(values, percentileValue) {
  if (values.length === 0) return null;

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil((percentileValue / 100) * sorted.length) - 1;
  return sorted[Math.min(Math.max(index, 0), sorted.length - 1)];
}

function mapTopN(map, limit = 10) {
  return Object.fromEntries(
    Array.from(map.entries())
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, limit),
  );
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
    latencyP50Ms:
      summary.latenciesMs.length > 0 ? Number(percentile(summary.latenciesMs, 50).toFixed(1)) : null,
    latencyP95Ms:
      summary.latenciesMs.length > 0 ? Number(percentile(summary.latenciesMs, 95).toFixed(1)) : null,
    averageInitialLatencyMs:
      summary.initialLatencyCount > 0
        ? Number((summary.initialLatencyTotalMs / summary.initialLatencyCount).toFixed(1))
        : null,
    averageRetryLatencyMs:
      summary.retryLatencyCount > 0
        ? Number((summary.retryLatencyTotalMs / summary.retryLatencyCount).toFixed(1))
        : null,
    retryUsed: summary.retryUsed,
    retryRate:
      summary.total > 0 ? Number((summary.retryUsed / summary.total).toFixed(3)) : null,
    retryReasons: mapTopN(summary.retryReasons),
    missingFieldsTopN: mapTopN(summary.missingFields),
  };
}

function updateSummary(summary, result) {
  summary.total += 1;
  summary.source[result.source] = (summary.source[result.source] ?? 0) + 1;
  summary.latencyTotalMs += result.latencyMs;
  summary.latenciesMs.push(result.latencyMs);

  if (result.partialRepair) summary.partialRepair += 1;
  if (result.finalFallback) summary.finalFallback += 1;
  if (result.noMatchEmptyAi) summary.noMatchEmptyAi += 1;
  if (typeof result.confidence === "number") {
    summary.confidenceTotal += result.confidence;
    summary.confidenceCount += 1;
  }

  if (typeof result.initialLatencyMs === "number") {
    summary.initialLatencyTotalMs += result.initialLatencyMs;
    summary.initialLatencyCount += 1;
  }

  if (typeof result.retryLatencyMs === "number") {
    summary.retryLatencyTotalMs += result.retryLatencyMs;
    summary.retryLatencyCount += 1;
  }

  if (result.retryUsed) {
    summary.retryUsed += 1;
    if (result.retryReason) {
      summary.retryReasons.set(result.retryReason, (summary.retryReasons.get(result.retryReason) ?? 0) + 1);
    }
  }

  for (const field of result.missingFields) {
    summary.missingFields.set(field, (summary.missingFields.get(field) ?? 0) + 1);
  }
}

function normalizeAttemptDiagnostics(value) {
  if (!value || typeof value !== "object") return null;

  const missingFields = Array.isArray(value.missingFields)
    ? value.missingFields.filter((item) => typeof item === "string")
    : [];

  return {
    phase: typeof value.phase === "string" ? value.phase : null,
    latencyMs: typeof value.latencyMs === "number" ? value.latencyMs : null,
    finishReason: typeof value.finishReason === "string" ? value.finishReason : null,
    retryReason: typeof value.retryReason === "string" ? value.retryReason : null,
    hasReasoningContent: value.hasReasoningContent === true,
    rawTextEmpty: value.rawTextEmpty === true,
    parseError: typeof value.parseError === "string" ? value.parseError : null,
    missingFields,
    outputSource: value.outputSource === "ai" || value.outputSource === "rules" ? value.outputSource : null,
    partialRepair: value.partialRepair === true,
  };
}

function normalizeDiagnostics(data, source, latencyMs, partialRepair, finalFallback) {
  const diagnostics = data && typeof data === "object" ? data._diagnostics : null;
  const attempts = Array.isArray(diagnostics?.attempts)
    ? diagnostics.attempts.map((item) => normalizeAttemptDiagnostics(item)).filter(Boolean)
    : [];
  const initial = attempts.find((item) => item.phase === "initial") ?? null;
  const retry = attempts.find((item) => item.phase === "retry") ?? null;
  const retryUsed = diagnostics?.retryUsed === true || Boolean(retry);
  const retryReason =
    typeof diagnostics?.retryReason === "string"
      ? diagnostics.retryReason
      : initial?.retryReason ?? null;

  return {
    initial,
    retry,
    final: {
      source,
      confidence: typeof data?.confidence === "number" ? data.confidence : null,
      latencyMs,
      partialRepair,
      finalFallback,
    },
    retryUsed,
    retryReason,
    missingFields: Array.from(new Set(attempts.flatMap((item) => item.missingFields))),
  };
}

function classifyResult(sample, status, data, latencyMs) {
  if (!data || typeof data !== "object" || status >= 400) {
    const diagnostics = normalizeDiagnostics(data, "error", latencyMs, false, false);
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
      stages: diagnostics,
      retryUsed: diagnostics.retryUsed,
      retryReason: diagnostics.retryReason,
      missingFields: diagnostics.missingFields,
      initialLatencyMs: diagnostics.initial?.latencyMs ?? null,
      retryLatencyMs: diagnostics.retry?.latencyMs ?? null,
    };
  }

  const source = data.source === "ai" || data.source === "rules" ? data.source : "error";
  const recommendations = Array.isArray(data.recommendations) ? data.recommendations : [];
  const alternatives = Array.isArray(data.alternatives) ? data.alternatives : [];
  const disclaimer = typeof data.disclaimer === "string" ? data.disclaimer : "";
  const partialRepair = source === "rules" && disclaimer.includes("AI 输出不完整");
  const finalFallback = source === "rules" && !partialRepair;
  const diagnostics = normalizeDiagnostics(data, source, latencyMs, partialRepair, finalFallback);

  return {
    id: sample.id,
    group: sample.group,
    source,
    status,
    confidence: typeof data.confidence === "number" ? data.confidence : null,
    latencyMs,
    partialRepair,
    finalFallback,
    noMatchEmptyAi: source === "ai" && recommendations.length === 0 && alternatives.length === 0,
    recommendationCount: recommendations.length,
    alternativeCount: alternatives.length,
    summary: typeof data.summary === "string" ? data.summary : null,
    stages: diagnostics,
    retryUsed: diagnostics.retryUsed,
    retryReason: diagnostics.retryReason,
    missingFields: diagnostics.missingFields,
    initialLatencyMs: diagnostics.initial?.latencyMs ?? null,
    retryLatencyMs: diagnostics.retry?.latencyMs ?? null,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const loadedSamples = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const samples = options.limit === null ? loadedSamples : loadedSamples.slice(0, options.limit);
  const { POST } = loadTsModule("./src/app/api/device-advisor/route.ts");
  const total = emptySummary();
  const byGroup = new Map();
  const bySample = new Map();
  const results = [];

  await withProviderEnv(options.provider, async () => {
    for (const sample of samples) {
      for (let run = 1; run <= options.runs; run += 1) {
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
        const result = {
          run,
          ...classifyResult(sample, response.status, data, latencyMs),
        };

        results.push(result);
        updateSummary(total, result);

        const groupSummary = byGroup.get(sample.group) ?? emptySummary();
        byGroup.set(sample.group, groupSummary);
        updateSummary(groupSummary, result);

        const sampleSummary = bySample.get(sample.id) ?? emptySummary();
        bySample.set(sample.id, sampleSummary);
        updateSummary(sampleSummary, result);
      }
    }
  });

  const output = {
    metadata: {
      provider: options.provider,
      runs: options.runs,
      sampleCount: samples.length,
      totalCalls: results.length,
      generatedAt: new Date().toISOString(),
    },
    summary: finalizeSummary(total),
    byGroup: Object.fromEntries(
      Array.from(byGroup.entries()).map(([group, summary]) => [group, finalizeSummary(summary)]),
    ),
    bySample: Object.fromEntries(
      Array.from(bySample.entries()).map(([sampleId, summary]) => [sampleId, finalizeSummary(summary)]),
    ),
    runs: results,
  };

  console.log(
    `Device advisor AI eval: ${samples.length} ${options.provider} samples x ${options.runs} run(s)`,
  );
  console.log("Overall:");
  console.log(JSON.stringify(output.summary, null, 2));

  console.log("By group:");
  for (const [group, summary] of Object.entries(output.byGroup)) {
    console.log(`- ${group}: ${JSON.stringify(summary)}`);
  }

  console.log("Cases:");
  for (const result of results) {
    console.log(
      [
        result.id,
        `run=${result.run}`,
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

  if (options.out) {
    const outPath = path.resolve(projectRoot, options.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
    console.log(`Wrote result file: ${path.relative(projectRoot, outPath)}`);
  }
}

await main();
