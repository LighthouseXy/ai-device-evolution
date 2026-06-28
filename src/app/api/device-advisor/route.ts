import { NextResponse } from "next/server";
import {
  buildDeviceAdvisorPrompt,
  deviceAdvisorOutputSchema,
  normalizeDeviceAdvisorInput,
  normalizeDeviceAdvisorOutput,
  runFallbackDeviceAdvisor,
  type DeviceAdvisorInput,
  type DeviceAdvisorOutput,
} from "@/lib/device-advisor";

type OpenAIResponsesPayload = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
      output_text?: string;
    }>;
  }>;
};

type DeepSeekResponsePayload = {
  choices?: Array<{
    finish_reason?: string;
    message?: {
      content?: string;
      reasoning_content?: string;
    };
  }>;
};

const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-chat";
const DEFAULT_DISCLAIMER = "基于已收录设备数据生成，仅供参考";

type Provider = "openai" | "deepseek";

function resolveProvider(): Provider | null {
  const configured = process.env.AI_PROVIDER?.trim().toLowerCase();

  if (configured === "openai" && process.env.OPENAI_API_KEY) return "openai";
  if (configured === "deepseek" && process.env.DEEPSEEK_API_KEY) return "deepseek";
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.DEEPSEEK_API_KEY) return "deepseek";

  return null;
}

function extractOpenAIText(data: OpenAIResponsesPayload): string {
  if (typeof data.output_text === "string" && data.output_text.trim().length > 0) {
    return data.output_text;
  }

  const output = Array.isArray(data.output) ? data.output : [];
  const parts: string[] = [];

  for (const item of output) {
    const content = Array.isArray(item.content) ? item.content : [];
    for (const entry of content) {
      const text = typeof entry.text === "string" ? entry.text : entry.output_text;
      if (typeof text === "string" && text.trim().length > 0) {
        parts.push(text);
      }
    }
  }

  return parts.join("\n").trim();
}

type DeepSeekExtraction = {
  rawText: string;
  finishReason?: string;
  reasoningContent?: string;
};

function extractDeepSeekText(data: DeepSeekResponsePayload): DeepSeekExtraction {
  const choices = Array.isArray(data.choices) ? data.choices : [];
  for (const choice of choices) {
    const content = choice.message?.content;
    if (typeof content === "string" && content.trim().length > 0) {
      return {
        rawText: content,
        finishReason: choice.finish_reason,
        reasoningContent: choice.message?.reasoning_content,
      };
    }
  }

  const firstChoice = choices[0];
  return {
    rawText: "",
    finishReason: firstChoice?.finish_reason,
    reasoningContent: firstChoice?.message?.reasoning_content,
  };
}

function normalizeDeepSeekStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const items = value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
    return items.length > 0 ? items : [];
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return [value.trim()];
  }

  return undefined;
}

function normalizeDeepSeekRecommendation(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const record = value as Record<string, unknown>;
  return {
    ...record,
    reasons: normalizeDeepSeekStringArray(record.reasons) ?? record.reasons,
    tradeoffs: normalizeDeepSeekStringArray(record.tradeoffs) ?? record.tradeoffs,
    suitableFor: normalizeDeepSeekStringArray(record.suitableFor) ?? record.suitableFor,
    notSuitableFor: normalizeDeepSeekStringArray(record.notSuitableFor) ?? record.notSuitableFor,
  };
}

function normalizeDeepSeekRecommendationList(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeDeepSeekRecommendation(item));
  }

  if (value && typeof value === "object") {
    return [normalizeDeepSeekRecommendation(value)];
  }

  return value;
}

function repairDeepSeekOutput(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const record = value as Record<string, unknown>;

  return {
    ...record,
    recommendations: normalizeDeepSeekRecommendationList(record.recommendations),
    alternatives: normalizeDeepSeekRecommendationList(record.alternatives),
    tradeoffs: normalizeDeepSeekStringArray(record.tradeoffs) ?? record.tradeoffs,
    suitableFor: normalizeDeepSeekStringArray(record.suitableFor) ?? record.suitableFor,
    notSuitableFor: normalizeDeepSeekStringArray(record.notSuitableFor) ?? record.notSuitableFor,
    confidence: normalizeDeepSeekConfidence(record.confidence),
    source: record.source === "ai" || record.source === "rules" ? record.source : "ai",
    disclaimer:
      typeof record.disclaimer === "string" && record.disclaimer.trim().length > 0
        ? record.disclaimer
        : DEFAULT_DISCLAIMER,
  };
}

function normalizeDeepSeekOutput(
  input: DeviceAdvisorInput,
  value: unknown,
): DeviceAdvisorOutput | null {
  const repaired = repairDeepSeekOutput(value);
  const normalized = normalizeDeviceAdvisorOutput(repaired);
  if (normalized) {
    return normalized;
  }

  if (!repaired || typeof repaired !== "object" || Array.isArray(repaired)) {
    return null;
  }

  const record = repaired as Record<string, unknown>;
  const fallback = runFallbackDeviceAdvisor(input);
  const scaffold = {
    summary:
      typeof record.summary === "string" && record.summary.trim().length > 0
        ? record.summary.trim()
        : fallback.summary,
    recommendations:
      Array.isArray(record.recommendations) && record.recommendations.length > 0
        ? record.recommendations
        : fallback.recommendations,
    tradeoffs:
      normalizeDeepSeekStringArray(record.tradeoffs) ??
      (fallback.tradeoffs.length ? fallback.tradeoffs : ["当前条件下仍需结合预算和使用场景判断"]),
    suitableFor:
      normalizeDeepSeekStringArray(record.suitableFor) ??
      (fallback.suitableFor.length ? fallback.suitableFor : ["日常使用"]),
    notSuitableFor:
      normalizeDeepSeekStringArray(record.notSuitableFor) ??
      (fallback.notSuitableFor.length ? fallback.notSuitableFor : ["极端偏科需求"]),
    alternatives:
      Array.isArray(record.alternatives) && record.alternatives.length > 0
        ? record.alternatives
        : fallback.alternatives,
    confidence: normalizeDeepSeekConfidence(record.confidence) ?? fallback.confidence,
    source: "ai",
    disclaimer: DEFAULT_DISCLAIMER,
  };

  return normalizeDeviceAdvisorOutput(scaffold);
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength).trimEnd()}\n...[truncated]`;
}

function normalizeDeepSeekConfidence(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const text = value.trim().toLowerCase();
  if (!text) {
    return undefined;
  }

  if (text === "low") return 0.25;
  if (text === "medium") return 0.6;
  if (text === "high") return 0.85;

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function buildOpenAIRequest(input: DeviceAdvisorInput) {
  return {
    model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
    instructions: [
      "You are DeviceScope, a careful Apple device advisor.",
      "Respond with a single valid JSON object only.",
      "Do not use markdown code fences or any extra prose.",
      "Only recommend devices from the provided candidate list.",
      "Do not invent missing prices, specs, or unsupported claims.",
    ].join(" "),
    input: buildDeviceAdvisorPrompt(input),
    temperature: 0.2,
    max_output_tokens: 900,
    text: {
      format: {
        type: "json_schema",
        name: "device_advisor_output",
        strict: true,
        schema: deviceAdvisorOutputSchema,
      },
    },
  };
}

function buildDeepSeekRequest(input: DeviceAdvisorInput) {
  return {
    model: process.env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL,
    messages: [
      {
        role: "system",
        content: [
          "You are DeviceScope, a careful Apple device advisor.",
          "Respond with a single valid JSON object only.",
          "Do not use markdown code fences or any extra prose.",
          "Only recommend devices from the provided candidate list.",
          "Do not invent missing prices, specs, or unsupported claims.",
        ].join(" "),
      },
      {
        role: "user",
        content: buildDeviceAdvisorPrompt(input),
      },
    ],
    temperature: 0.2,
    max_tokens: 900,
    response_format: { type: "json_object" },
  };
}

function buildDeepSeekRetryRequest(
  input: DeviceAdvisorInput,
  reason: string,
  reasoningContent?: string,
) {
  const compactContext =
    typeof reasoningContent === "string" && reasoningContent.trim().length > 0
      ? truncateText(reasoningContent.trim(), 6000)
      : "";

  return {
    model: process.env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL,
    messages: [
      {
        role: "system",
        content: [
          "You are DeviceScope, a careful Apple device advisor.",
          "This is a retry after an invalid or truncated answer.",
          "Return a single valid JSON object only.",
          "Do not use markdown code fences or any extra prose.",
          `Previous failure: ${reason}`,
        ].join(" "),
      },
      {
        role: "user",
        content: compactContext
          ? [
              "Convert the following analysis into the final DeviceScope device-advisor JSON object.",
              "Keep only the schema fields summary, recommendations, tradeoffs, suitableFor, notSuitableFor, alternatives, confidence, source, disclaimer.",
              "Stay grounded in the candidate shortlist discussed below.",
              "Do not leave recommendations or alternatives empty; always choose the closest candidate devices even if all are over budget.",
              "Do not repeat the analysis or add prose.",
              "",
              compactContext,
            ].join("\n")
          : buildDeviceAdvisorPrompt(input),
      },
    ],
    temperature: 0,
    max_tokens: compactContext ? 1600 : 1200,
    response_format: { type: "json_object" },
  };
}

async function fetchOpenAIAdvisor(input: DeviceAdvisorInput): Promise<DeviceAdvisorOutput> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return runFallbackDeviceAdvisor(input);

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(buildOpenAIRequest(input)),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API returned ${response.status}`);
  }

  let payload: OpenAIResponsesPayload;
  try {
    payload = (await response.json()) as OpenAIResponsesPayload;
  } catch {
    throw new Error("OpenAI response was not valid JSON");
  }

  const rawText = extractOpenAIText(payload);
  if (!rawText) {
    throw new Error("OpenAI response did not include text output");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error("OpenAI response text was not valid JSON");
  }

  const normalized = normalizeDeviceAdvisorOutput(parsed);
  if (!normalized) {
    throw new Error("OpenAI response JSON was missing required fields");
  }

  return {
    ...normalized,
    source: "ai",
    disclaimer: DEFAULT_DISCLAIMER,
  };
}

async function callDeepSeek(
  input: DeviceAdvisorInput,
  requestBody: Record<string, unknown>,
): Promise<{ output?: DeviceAdvisorOutput; retryReason?: string; reasoningContent?: string }> {
  const response = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek API returned ${response.status}`);
  }

  let payload: DeepSeekResponsePayload;
  try {
    payload = (await response.json()) as DeepSeekResponsePayload;
  } catch {
    throw new Error("DeepSeek response was not valid JSON");
  }

  const { rawText, finishReason, reasoningContent } = extractDeepSeekText(payload);
  if (!rawText) {
    return {
      retryReason:
        finishReason === "length"
          ? "DeepSeek response was truncated"
          : reasoningContent
            ? "DeepSeek response did not include usable text output"
            : "DeepSeek response did not include text output",
      reasoningContent,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return {
      retryReason:
        finishReason === "length"
          ? "DeepSeek response text was truncated"
          : "DeepSeek response text was not valid JSON",
      reasoningContent,
    };
  }

  const normalized = normalizeDeepSeekOutput(input, parsed);
  if (!normalized) {
    return {
      retryReason:
        finishReason === "length"
          ? "DeepSeek response JSON was truncated or missing required fields"
          : "DeepSeek response JSON was missing required fields",
      reasoningContent,
    };
  }

  return {
    output: {
      ...normalized,
      source: "ai",
      disclaimer: DEFAULT_DISCLAIMER,
    },
  };
}

async function fetchDeepSeekAdvisor(input: DeviceAdvisorInput): Promise<DeviceAdvisorOutput> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return runFallbackDeviceAdvisor(input);

  const initial = await callDeepSeek(input, buildDeepSeekRequest(input));
  if (initial.output) {
    return initial.output;
  }

  if (!initial.retryReason) {
    throw new Error("DeepSeek response was not usable");
  }

  const retry = await callDeepSeek(
    input,
    buildDeepSeekRetryRequest(input, initial.retryReason, initial.reasoningContent),
  );
  if (retry.output) {
    return retry.output;
  }

  throw new Error(retry.retryReason ?? initial.retryReason);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须为合法 JSON" }, { status: 400 });
  }

  const input = normalizeDeviceAdvisorInput(body);
  if (!input) {
    return NextResponse.json(
      {
        error:
          "缺少必要字段或字段格式不正确：budget, category, performancePreference, useCases, intent, replacementIntent, maxResults",
      },
      { status: 400 },
    );
  }

  const provider = resolveProvider();
  if (!provider) {
    return NextResponse.json(runFallbackDeviceAdvisor(input));
  }

  try {
    const result = await (provider === "deepseek"
      ? fetchDeepSeekAdvisor(input)
      : fetchOpenAIAdvisor(input));
    return NextResponse.json(result);
  } catch (error) {
    console.error("Device advisor failed, using fallback:", error);
    return NextResponse.json(runFallbackDeviceAdvisor(input));
  }
}
