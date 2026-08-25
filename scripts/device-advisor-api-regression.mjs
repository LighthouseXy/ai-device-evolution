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
  });
}

const basicInput = {
  category: "phone",
  useCases: ["通勤"],
  replacementIntent: "replace",
  maxResults: 3,
};

const scenarios = [
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
          assert.match(userMessage, /answer、recommendedDeviceIds、confidence/);
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
            answer: "综合通勤需求，优先考虑 iPhone 17；如果更看重性能，可以查看 iPhone 17 Pro。",
            recommendedDeviceIds: ["iphone-17", "iphone-17-pro"],
            confidence: 0.66,
          }));
        }, () => callRoute(basicInput)).then(async (response) => {
          const data = await response.json();
          assert.equal(response.status, 200);
          assert.equal(data.source, "ai");
          assert.equal(data.devices[0].model, "iPhone 17");
          assert.equal(data.devices[1].model, "iPhone 17 Pro");
          assert.doesNotMatch(data.devices[0].priceText, /伪造/);
        })),
  },
  {
    name: "deepseek_deduplicates_ids",
    run: () =>
      withDeepSeekProviderEnv(() =>
        withMockedFetch(async () => makeDeepSeekResponse(JSON.stringify({
          answer: "推荐 iPhone 17，并把 iPhone 17 Pro 作为性能更强的选择。",
          recommendedDeviceIds: ["iphone-17", "iphone-17", "iphone-17-pro"],
          confidence: "0.78",
        })), () => callRoute(basicInput)).then(async (response) => {
          const data = await response.json();
          assert.equal(response.status, 200);
          assert.equal(data.source, "ai");
          assert.deepEqual(data.devices.map((item) => item.deviceId), [
            "iphone-17",
            "iphone-17-pro",
          ]);
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
