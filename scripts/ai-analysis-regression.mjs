import assert from "node:assert/strict";
import { loadTsModule } from "./lib/load-ts-module.mjs";

const {
  buildAnalysisPrompt,
  normalizeAiAnalysisOutput,
  normalizeAnalysisInput,
  runFallbackAnalysis,
} = loadTsModule("./src/lib/ai-analysis.ts");
const { getDevicesBySeriesFlat } = loadTsModule("./src/lib/devices-db.ts");
const { POST } = loadTsModule("./src/app/api/ai-analysis/route.ts");

const devices = getDevicesBySeriesFlat("iPhone").slice(-4);
const latestDevice = devices.at(-1) ?? null;
const previousDevice = devices.at(-2) ?? null;

const baseInput = {
  seriesName: "iPhone",
  category: "phone",
  analysisType: "generation_summary",
  categoryLabel: "芯片与智能",
  devices,
  latestDevice,
  previousDevice,
  changedFields: [
    {
      label: "芯片",
      previousValue: previousDevice?.chip ?? "未知",
      currentValue: latestDevice?.chip ?? "未知",
    },
    {
      label: "AI 能力",
      previousValue: String(previousDevice?.aiFeatureLevel ?? "未知"),
      currentValue: String(latestDevice?.aiFeatureLevel ?? "未知"),
    },
  ],
};

function assertValidOutput(output, source) {
  assert.equal(output.source, source);
  assert.equal(output.disclaimer, "基于已收录数据生成，仅供参考");
  assert.ok(output.summary.length > 0, "summary should not be empty");
  assert.ok(output.facts.length > 0, "facts should not be empty");
  assert.ok(output.insights.length > 0, "insights should not be empty");
  assert.ok(output.buyingAdvice.length > 0, "buyingAdvice should not be empty");
  assert.ok(output.prediction.length > 0, "prediction should not be empty");
  assert.ok(Array.isArray(output.missingData), "missingData should be an array");
  assert.ok(output.confidence >= 0 && output.confidence <= 1, "confidence should be clamped");
}

const normalizedInput = normalizeAnalysisInput(baseInput);
assert.ok(normalizedInput, "valid input should normalize");
assert.equal(normalizedInput.seriesName, "iPhone");
assert.equal(normalizedInput.devices.length, devices.length);

const fallbackOutput = runFallbackAnalysis(normalizedInput);
assertValidOutput(fallbackOutput, "rules");
assert.match(fallbackOutput.summary, /iPhone|芯片|智能/);

const prompt = buildAnalysisPrompt(normalizedInput);
assert.match(prompt, /输出必须是纯 JSON 对象/);
assert.match(prompt, /source 必须固定为 "ai"/);
assert.doesNotMatch(prompt, /```/);

const repairedAiOutput = normalizeAiAnalysisOutput({
  summary: "iPhone 在芯片与智能维度继续小步升级。",
  facts: ["芯片字段存在变化"],
  insights: ["变化主要来自结构化数据字段"],
  buyingAdvice: "适合结合预算和旧机状态判断。",
  prediction: "下一代仍应保守观察。",
  missingData: [],
  confidence: "1.5",
  source: "ai",
  disclaimer: "",
});
assert.ok(repairedAiOutput, "AI output with minor drift should normalize");
assertValidOutput(repairedAiOutput, "ai");
assert.equal(repairedAiOutput.confidence, 1);
assert.deepEqual(repairedAiOutput.missingData, ["当前数据不足"]);

assert.equal(normalizeAnalysisInput({ ...baseInput, devices: [] }), null);
assert.equal(
  normalizeAiAnalysisOutput({
    summary: "缺少关键数组",
    facts: ["事实"],
    buyingAdvice: "建议",
    prediction: "预测",
    confidence: 0.5,
    source: "ai",
    disclaimer: "基于已收录数据生成，仅供参考",
  }),
  null,
);

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.OPENAI_API_KEY;
const originalConsoleError = console.error;
try {
  process.env.OPENAI_API_KEY = "regression-test-key";
  let observedSignal = null;
  globalThis.fetch = async (_url, options) => {
    observedSignal = options.signal;
    return Response.json({
      output_text: JSON.stringify({
        summary: "真实模型路由回归摘要。",
        facts: ["已收录数据存在芯片变化。"],
        insights: ["该变化属于渐进式升级。"],
        buyingAdvice: "结合预算判断。",
        prediction: "继续保守观察。",
        missingData: ["真实使用体验数据不足。"],
        confidence: 0.8,
        source: "ai",
        disclaimer: "由路由覆盖为固定声明",
      }),
    });
  };
  const aiResponse = await POST(new Request("http://localhost/api/ai-analysis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(baseInput),
  }));
  assert.equal(aiResponse.status, 200);
  assertValidOutput(await aiResponse.json(), "ai");
  assert.ok(observedSignal instanceof AbortSignal, "OpenAI request should include a timeout signal");

  console.error = () => {};
  globalThis.fetch = async () => new Response("upstream error", { status: 500 });
  const fallbackResponse = await POST(new Request("http://localhost/api/ai-analysis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(baseInput),
  }));
  assert.equal(fallbackResponse.status, 200);
  assertValidOutput(await fallbackResponse.json(), "rules");
} finally {
  globalThis.fetch = originalFetch;
  console.error = originalConsoleError;
  if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalApiKey;
}

console.log("Passed AI analysis regression scenarios: normalize_input, fallback_rules, prompt_contract, normalize_ai_output, openai_route_timeout, upstream_fallback");
