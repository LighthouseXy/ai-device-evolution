// ==================== AI 分析 API 路由 ====================
// POST /api/ai-analysis
// 有 OPENAI_API_KEY 时调用真实 AI，否则退回规则 fallback

import { NextResponse } from "next/server";
import {
  buildAnalysisPrompt,
  normalizeAiAnalysisOutput,
  normalizeAnalysisInput,
  runFallbackAnalysis,
  type AiAnalysisInput,
  type AiAnalysisOutput,
} from "@/lib/ai-analysis";

type OpenAIResponsesPayload = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
      output_text?: string;
    }>;
  }>;
};

const OPENAI_API_URL = "https://api.openai.com/v1/responses";
// 默认模型仅作兜底，建议通过 OPENAI_MODEL 覆盖，以避免硬编码到过时模型。
const DEFAULT_MODEL = "gpt-4.1-mini";
const DEFAULT_DISCLAIMER = "基于已收录数据生成，仅供参考";

function parseRequestBody(body: unknown): AiAnalysisInput | null {
  return normalizeAnalysisInput(body);
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

function buildOpenAIRequest(input: AiAnalysisInput) {
  return {
    model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
    instructions: [
      "You are DeviceScope, a careful Apple device generation observation engine.",
      "Respond with a single valid JSON object only.",
      "Do not use markdown code fences or any extra prose.",
      "Follow the user's prompt precisely and do not invent missing values.",
    ].join(" "),
    input: buildAnalysisPrompt(input),
    temperature: 0.2,
    max_output_tokens: 500,
    text: {
      format: {
        type: "json_schema",
        name: "ai_analysis_output",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: [
            "summary",
            "facts",
            "insights",
            "buyingAdvice",
            "prediction",
            "missingData",
            "confidence",
            "source",
            "disclaimer",
          ],
          properties: {
            summary: { type: "string" },
            facts: {
              type: "array",
              items: { type: "string" },
              minItems: 1,
              maxItems: 3,
            },
            insights: {
              type: "array",
              items: { type: "string" },
              minItems: 1,
              maxItems: 3,
            },
            buyingAdvice: { type: "string" },
            prediction: { type: "string" },
            missingData: {
              type: "array",
              items: { type: "string" },
              minItems: 1,
              maxItems: 3,
            },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            source: { type: "string", enum: ["ai"] },
            disclaimer: { type: "string" },
          },
        },
      },
    },
  };
}

async function fetchOpenAIAnalysis(input: AiAnalysisInput): Promise<AiAnalysisOutput> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return runFallbackAnalysis(input);
  }

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(15000),
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

  const normalized = normalizeAiAnalysisOutput(parsed);
  if (!normalized) {
    throw new Error("OpenAI response JSON was missing required fields");
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

  const input = parseRequestBody(body);
  if (!input) {
    return NextResponse.json(
      {
        error:
          "缺少必要字段或字段格式不正确：seriesName, category, categoryLabel, devices",
      },
      { status: 400 },
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(runFallbackAnalysis(input));
  }

  try {
    const result = await fetchOpenAIAnalysis(input);
    return NextResponse.json(result);
  } catch (error) {
    console.error("AI analysis failed, using fallback:", error);
    return NextResponse.json(runFallbackAnalysis(input));
  }
}
