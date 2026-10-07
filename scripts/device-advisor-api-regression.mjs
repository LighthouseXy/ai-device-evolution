import assert from "node:assert/strict";
import { loadTsModule } from "./lib/load-ts-module.mjs";

const routeUrl = "http://localhost/api/device-advisor";
const envKeys = ["AI_PROVIDER", "OPENAI_API_KEY", "DEEPSEEK_API_KEY"];

const { POST } = loadTsModule("./src/app/api/device-advisor/route.ts");
const originalFetch = globalThis.fetch;

function makeJsonRequest(body, { raw = false } = {}) {
  const init = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  };
  return new Request(routeUrl, {
    ...init,
    body: raw ? body : JSON.stringify(body),
  });
}

function callRoute(body, options = {}) {
  return POST(makeJsonRequest(body, options));
}

function assertErrorResponse(response, expectedStatus, fragment) {
  assert.equal(response.status, expectedStatus);
  return response.json().then((data) => {
    assert.ok(data && typeof data.error === "string", "should return an error payload");
    assert.match(data.error, fragment);
  });
}

function withEnv(values, run) {
  const snapshot = new Map(envKeys.map((key) => [key, process.env[key]]));
  for (const key of envKeys) delete process.env[key];
  Object.assign(process.env, values);

  return Promise.resolve()
    .then(run)
    .finally(() => {
      for (const [key, value] of snapshot) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });
}

function withDisabledProviderEnv(run) {
  return withEnv({}, run);
}

function withDeepSeekProviderEnv(run) {
  return withEnv(
    { AI_PROVIDER: "deepseek", DEEPSEEK_API_KEY: "dummy-deepseek-key" },
    run,
  );
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

function makeDeepSeekResponse(content, finishReason = "stop") {
  return makeJsonResponse({
    choices: [{ finish_reason: finishReason, message: { content } }],
    usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
  });
}

const basicInput = {
  category: "phone",
  useCases: ["通勤"],
  replacementIntent: "replace",
  maxResults: 3,
};
const { buildDeviceAdvisorContext } = loadTsModule("./src/lib/device-advisor.ts");
const [firstCandidate, secondCandidate] = buildDeviceAdvisorContext(basicInput).candidateShortlist;
const validIds = [firstCandidate.deviceId, secondCandidate.deviceId];
const validQuoteIds = [firstCandidate.quotes[0].quoteId, secondCandidate.quotes[0].quoteId];
const validAnswer = `推荐 ${firstCandidate.model}，也可以查看 ${secondCandidate.model}。`;

const scenarios = [
  ...[false, true].map((escapeSelection) => ({
    name: escapeSelection ? "deepseek_retry_cannot_escape_selection" : "deepseek_retry_limits_prose_to_selected_quote",
    run: () => {
      let calls = 0;
      return withDeepSeekProviderEnv(() => withMockedFetch(async (_url, init) => {
        calls++;
        const userPrompt = JSON.parse(init.body).messages.find((message) => message.role === "user").content;
        const context = JSON.parse(userPrompt.split("输入数据：\n")[1].split("\n\n请直接")[0]);
        if (calls === 2) {
          assert.equal(context.candidateShortlist.length, 1);
          assert.equal(context.candidateShortlist[0].deviceId, firstCandidate.deviceId);
          assert.deepEqual(context.candidateShortlist[0].quotes.map((quote) => quote.quoteId), [validQuoteIds[0]]);
        }
        const chosen = calls === 2 && escapeSelection ? 1 : 0;
        return makeDeepSeekResponse(JSON.stringify({
          answer: calls === 1 ? validAnswer : (chosen ? secondCandidate.model : firstCandidate.model),
          recommendedDeviceIds: [validIds[chosen]], recommendedQuoteIds: [validQuoteIds[chosen]], confidence: 0.7,
        }));
      }, () => callRoute({ ...basicInput, maxResults: 1 })).then(async (response) => {
        const data = await response.json();
        assert.equal(calls, 2);
        assert.equal(data.source, escapeSelection ? "rules" : "ai");
        assert.match(data._diagnostics.retryReason, /unselected_model/);
        if (!escapeSelection) assert.equal(data.answer, firstCandidate.model, "use the complete rewritten answer, not a local text splice");
      }));
    },
  })),
  {
    name: "deepseek_selects_non_default_quote",
    run: () => {
      const input = { category: "laptop", conditionPreference: "used_ok", budget: { max: 16000 } };
      const candidate = buildDeviceAdvisorContext(input).candidateShortlist.find((item) => item.quotes.length === 2);
      assert.ok(candidate);
      const quote = candidate.quotes[1];
      return withDeepSeekProviderEnv(() => withMockedFetch(async () => makeDeepSeekResponse(JSON.stringify({
        answer: `推荐 ${candidate.model}，参考 ${quote.priceText}。`,
        recommendedDeviceIds: [candidate.deviceId], recommendedQuoteIds: [quote.quoteId], confidence: 0.7,
      })), () => callRoute(input)).then(async (response) => {
        const data = await response.json();
        assert.equal(data.source, "ai");
        assert.equal(data.devices[0].quoteId, quote.quoteId);
        assert.equal(data.devices[0].priceText, quote.priceText);
        assert.notEqual(data.devices[0].priceText, candidate.priceText);
      }));
    },
  },
  ...[-1, { max: 5000, currency: "USD" }, { min: 1000, max: "invalid" }].map((budget, index) => ({
    name: `invalid_budget_${index + 1}`,
    run: () => callRoute({ ...basicInput, budget }),
    expect: (response) => assertErrorResponse(response, 400, /字段格式不正确/),
  })),
  {
    name: "deepseek_excess_ids_rejects_whole_answer",
    run: () => withDeepSeekProviderEnv(() => withMockedFetch(async () => makeDeepSeekResponse(JSON.stringify({
      answer: validAnswer,
      recommendedDeviceIds: validIds, recommendedQuoteIds: validQuoteIds, confidence: 0.8,
    })), () => callRoute({ ...basicInput, maxResults: 1 })).then(async (response) => {
      const data = await response.json();
      assert.equal(data.source, "rules");
      assert.equal(data.devices.length, 1);
      assert.match(data.answer, /AI 暂不可用/);
    })),
  },
  {
    name: "empty_body",
    run: () => callRoute(undefined, { raw: true }),
    expect: (response) => assertErrorResponse(response, 400, /合法 JSON/),
  },
  {
    name: "empty_string_body",
    run: () => callRoute("", { raw: true }),
    expect: (response) => assertErrorResponse(response, 400, /合法 JSON/),
  },
  {
    name: "invalid_json",
    run: () => callRoute("{", { raw: true }),
    expect: (response) => assertErrorResponse(response, 400, /合法 JSON/),
  },
  {
    name: "unknown_fields_only",
    run: () => callRoute({ foo: "bar", baz: 1 }),
    expect: (response) => assertErrorResponse(response, 400, /缺少必要字段/),
  },
  {
    name: "invalid_field_types",
    run: () => callRoute({ category: 123, useCases: 1, performancePreference: true }),
    expect: (response) => assertErrorResponse(response, 400, /字段格式不正确/),
  },
  ...[
    ["max_results_zero", 0, 1],
    ["max_results_negative", -1, 1],
    ["max_results_large", 999, 3],
  ].map(([name, maxResults, expectedCount]) => ({
    name,
    run: () => callRoute({ ...basicInput, maxResults }),
    async expect(response) {
      const data = await response.json();
      assert.equal(response.status, 200);
      assert.ok(Array.isArray(data.devices), "should return device links");
      assert.equal(data.devices.length, expectedCount);
      assert.equal(typeof data.answer, "string");
    },
  })),
  {
    name: "deepseek_retry_length_then_valid",
    run: () =>
      withDeepSeekProviderEnv(() =>
        withMockedFetch(async (_url, init) => {
          const requestBody = JSON.parse(init.body);
          assert.deepEqual(requestBody.thinking, { type: "disabled" });
          const messages = Array.isArray(requestBody.messages) ? requestBody.messages : [];
          const userMessage = messages.find((message) => message.role === "user")?.content ?? "";
          assert.match(userMessage, /answer、recommendedDeviceIds、recommendedQuoteIds、confidence/);
          assert.match(userMessage, /低于 min 或高于 max.*不得称为预算内/);
          assert.match(userMessage, /首发价仅供历史参考，不代表当前市场价，也不得用于判断是否符合预算/);
          const retry = messages.some((message) =>
            typeof message.content === "string" &&
            message.content.includes("This is a retry after an invalid or truncated answer."),
          );

          if (!retry) {
            return makeJsonResponse({
              choices: [{
                finish_reason: "length",
                message: { content: "", reasoning_content: "truncated" },
              }],
            });
          }

          return makeDeepSeekResponse(JSON.stringify({
            answer: validAnswer,
            recommendedDeviceIds: validIds,
            recommendedQuoteIds: validQuoteIds,
            confidence: 0.66,
          }));
        }, () => callRoute(basicInput)).then(async (response) => {
          const data = await response.json();
          assert.equal(response.status, 200);
          assert.equal(data.source, "ai");
          assert.equal(data.devices[0].model, firstCandidate.model);
          assert.equal(data.devices[1].model, secondCandidate.model);
          assert.deepEqual(data._diagnostics.attempts[1].usage, { promptTokens: 100, completionTokens: 20, totalTokens: 120 });
          assert.doesNotMatch(data.devices[0].priceText, /伪造/);
        })),
  },
  {
    name: "deepseek_deduplicates_ids",
    run: () =>
      withDeepSeekProviderEnv(() =>
        withMockedFetch(async () => makeDeepSeekResponse(JSON.stringify({
          answer: validAnswer,
          recommendedDeviceIds: [validIds[0], ...validIds],
          recommendedQuoteIds: [validQuoteIds[0], ...validQuoteIds],
          confidence: "0.78",
        })), () => callRoute(basicInput)).then(async (response) => {
          const data = await response.json();
          assert.equal(response.status, 200);
          assert.equal(data.source, "ai");
          assert.deepEqual(data.devices.map((item) => item.deviceId), validIds);
          assert.equal(data.confidence, 0.78);
        })),
  },
  {
    name: "deepseek_invalid_output_falls_back_to_rules",
    run: () =>
      withDeepSeekProviderEnv(() =>
        withMockedFetch(async () => makeDeepSeekResponse(JSON.stringify({
          answer: "缺少设备 ID 字段。",
          confidence: 0.4,
        })), () => callRoute(basicInput)).then(async (response) => {
          const data = await response.json();
          assert.equal(response.status, 200);
          assert.equal(data.source, "rules");
          assert.match(data.disclaimer, /AI 不可用/);
          assert.ok(data.devices.length > 0);
        })),
  },
  {
    name: "deepseek_accepts_honest_no_match",
    run: () =>
      withDeepSeekProviderEnv(() =>
        withMockedFetch(async () => makeDeepSeekResponse(JSON.stringify({
          answer: "当前候选都超过 3000 元预算，因此暂不推荐具体设备。",
          recommendedDeviceIds: [],
          recommendedQuoteIds: [],
          confidence: 0.72,
        })), () => callRoute({
          ...basicInput,
          budget: { max: 3000, currency: "CNY" },
        })).then(async (response) => {
          const data = await response.json();
          assert.equal(response.status, 200);
          assert.equal(data.source, "ai");
          assert.deepEqual(data.devices, []);
          assert.match(data.answer, /暂不推荐/);
        })),
  },
  {
    name: "deepseek_unknown_only_falls_back_to_rules",
    run: () =>
      withDeepSeekProviderEnv(() =>
        withMockedFetch(async () => makeDeepSeekResponse(JSON.stringify({
          answer: "推荐一个不存在的设备。",
          recommendedDeviceIds: ["unknown-device"],
          recommendedQuoteIds: ["unknown-device:q0"],
          confidence: 0.9,
        })), () => callRoute(basicInput)).then(async (response) => {
          const data = await response.json();
          assert.equal(response.status, 200);
          assert.equal(data.source, "rules");
          assert.ok(data.devices.length > 0);
        })),
  },
];

await withDisabledProviderEnv(async () => {
  const names = scenarios.map((scenario) => scenario.name);
  console.log(`Running ${scenarios.length} device advisor API regression scenarios: ${names.join(", ")}`);

  for (const scenario of scenarios) {
    const response = await scenario.run();
    if (typeof scenario.expect === "function") await scenario.expect(response);
    console.log(`✓ ${scenario.name}`);
  }

  console.log(`Passed ${scenarios.length} device advisor API regression scenarios: ${names.join(", ")}`);
});
