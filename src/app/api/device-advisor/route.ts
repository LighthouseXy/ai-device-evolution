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

function extractDeepSeekText(data: { choices?: Array<{ message?: { content?: string } }> }): string {
  const choices = Array.isArray(data.choices) ? data.choices : [];
  for (const choice of choices) {
    const content = choice.message?.content;
    if (typeof content === "string" && content.trim().length > 0) {
      return content;
    }
  }
  return "";
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

async function fetchDeepSeekAdvisor(input: DeviceAdvisorInput): Promise<DeviceAdvisorOutput> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return runFallbackDeviceAdvisor(input);

  const response = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(buildDeepSeekRequest(input)),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek API returned ${response.status}`);
  }

  let payload: { choices?: Array<{ message?: { content?: string } }> };
  try {
    payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  } catch {
    throw new Error("DeepSeek response was not valid JSON");
  }

  const rawText = extractDeepSeekText(payload);
  if (!rawText) {
    throw new Error("DeepSeek response did not include text output");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error("DeepSeek response text was not valid JSON");
  }

  const normalized = normalizeDeviceAdvisorOutput(parsed);
  if (!normalized) {
    throw new Error("DeepSeek response JSON was missing required fields");
  }

  return {
    ...normalized,
    source: "ai",
    disclaimer: DEFAULT_DISCLAIMER,
  };
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
