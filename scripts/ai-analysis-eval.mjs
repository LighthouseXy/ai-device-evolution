import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { loadTsModule } from "./lib/load-ts-module.mjs";

const projectRoot = process.cwd();
const routeUrl = "http://localhost/api/ai-analysis";

function parseArgs(argv) {
  const options = { provider: "offline", runs: 1, out: null };

  for (const arg of argv) {
    if (arg.startsWith("--provider=")) options.provider = arg.slice(11);
    else if (arg.startsWith("--runs=")) options.runs = Number(arg.slice(7));
    else if (arg.startsWith("--out=")) options.out = arg.slice(6);
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!new Set(["offline", "openai"]).has(options.provider)) {
    throw new Error("--provider must be offline or openai");
  }
  if (!Number.isInteger(options.runs) || options.runs < 1) {
    throw new Error("--runs must be a positive integer");
  }
  return options;
}

function loadLocalEnv() {
  const envPath = path.join(projectRoot, ".env.local");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || match[1].startsWith("#") || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
  }
}

function changedFields(previousDevice, latestDevice) {
  const fields = [
    ["芯片", "chip"],
    ["运行内存", "memory"],
    ["存储", "storage"],
    ["首发价格", "launchPrice"],
  ];

  return fields
    .filter(([, key]) => previousDevice?.[key] !== latestDevice?.[key])
    .map(([label, key]) => ({
      label,
      previousValue: String(previousDevice?.[key] || "未知"),
      currentValue: String(latestDevice?.[key] || "未知"),
    }));
}

function makeFixture(getDevicesBySeriesFlat, seriesName, analysisType, categoryLabel, variant) {
  const seriesDevices = getDevicesBySeriesFlat(seriesName);
  const devices = variant ? seriesDevices.filter((device) => device.variant === variant) : seriesDevices;
  const latestDevice = devices.at(-1) ?? null;
  const previousDevice = devices.at(-2) ?? null;
  if (!latestDevice) throw new Error(`No devices found for ${seriesName}`);

  return {
    id: `${seriesName.toLowerCase().replaceAll(" ", "-")}-${analysisType}`,
    input: {
      seriesName,
      category: latestDevice.category,
      analysisType,
      categoryLabel,
      devices,
      latestDevice,
      previousDevice,
      changedFields: changedFields(previousDevice, latestDevice),
    },
  };
}

function validateOutput(output, expectedSource) {
  const stringFields = ["summary", "buyingAdvice", "prediction", "disclaimer"];
  const requiredArrays = ["facts", "insights"];
  const issues = [];

  for (const key of stringFields) {
    if (typeof output?.[key] !== "string" || !output[key].trim()) issues.push(key);
  }
  for (const key of requiredArrays) {
    if (!Array.isArray(output?.[key]) || output[key].length === 0) issues.push(key);
  }
  if (!Array.isArray(output?.missingData)) issues.push("missingData");
  if (output?.source !== expectedSource) issues.push("source");
  if (typeof output?.confidence !== "number" || output.confidence < 0 || output.confidence > 1) {
    issues.push("confidence");
  }
  return issues;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  loadLocalEnv();
  if (options.provider === "offline") delete process.env.OPENAI_API_KEY;
  if (options.provider === "openai" && !process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for --provider=openai");
  }

  const { POST } = loadTsModule("./src/app/api/ai-analysis/route.ts");
  const { getDevicesBySeriesFlat } = loadTsModule("./src/lib/devices-db.ts");
  const fixtures = [
    makeFixture(getDevicesBySeriesFlat, "iPhone Pro", "generation_summary", "芯片与智能"),
    makeFixture(getDevicesBySeriesFlat, "iPad Air", "buying_advice", "价格与便携性", "11-inch"),
    makeFixture(getDevicesBySeriesFlat, "MacBook Air", "trend_prediction", "性能与续航", "13-inch"),
  ];
  const results = [];

  for (let run = 1; run <= options.runs; run += 1) {
    for (const fixture of fixtures) {
      const startedAt = performance.now();
      const response = await POST(
        new Request(routeUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fixture.input),
        }),
      );
      const output = await response.json();
      const issues = response.ok ? validateOutput(output, options.provider === "offline" ? "rules" : "ai") : [
        `http_${response.status}`,
      ];
      results.push({
        id: fixture.id,
        run,
        source: output?.source ?? "error",
        confidence: output?.confidence ?? null,
        latencyMs: Number((performance.now() - startedAt).toFixed(1)),
        issues,
        output,
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    provider: options.provider,
    model: options.provider === "openai" ? process.env.OPENAI_MODEL || "gpt-4.1-mini" : null,
    summary: {
      total: results.length,
      passed: results.filter((result) => result.issues.length === 0).length,
      failed: results.filter((result) => result.issues.length > 0).length,
      averageLatencyMs: Number(
        (results.reduce((sum, result) => sum + result.latencyMs, 0) / results.length).toFixed(1),
      ),
      sources: Object.groupBy(results, (result) => result.source),
    },
    results,
  };
  report.summary.sources = Object.fromEntries(
    Object.entries(report.summary.sources).map(([source, entries]) => [source, entries.length]),
  );

  console.log(JSON.stringify(report, null, 2));
  if (options.out) {
    const outputPath = path.resolve(projectRoot, options.out);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  if (report.summary.failed > 0) process.exitCode = 1;
}

await main();
