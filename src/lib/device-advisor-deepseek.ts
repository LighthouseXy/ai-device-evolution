import {
  buildDeviceAdvisorContext,
  runFallbackDeviceAdvisor,
  type DeviceAdvisorInput,
  type DeviceAdvisorOutput,
  type DeviceAdvisorRecommendation,
} from "@/lib/device-advisor";
import type {
  DeepSeekAttemptDiagnostics,
  DeepSeekDiagnostics,
  DeviceAdvisorOutputWithDiagnostics,
} from "@/lib/device-advisor-ai-types";

type DeepSeekResponsePayload = {
  choices?: Array<{
    finish_reason?: string;
    message?: {
      content?: string;
      reasoning_content?: string;
    };
  }>;
};

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-chat";
const DEFAULT_DISCLAIMER = "基于已收录设备数据生成，仅供参考";
const DEEPSEEK_TIMEOUT_MS = 15_000;
const DEEPSEEK_MAX_TOKENS = 900;
const DEEPSEEK_FIELDS = [
  "summary",
  "recommendations",
  "alternatives",
  "tradeoffs",
  "suitableFor",
  "notSuitableFor",
  "confidence",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return undefined;

  const text = value.trim().toLowerCase();
  if (text === "low") return 0.25;
  if (text === "medium") return 0.6;
  if (text === "high") return 0.85;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeStringArray(value: unknown): string[] {
  const items = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return items.map(normalizeText).filter(Boolean);
}

function extractDeepSeekText(data: DeepSeekResponsePayload) {
  const choices = Array.isArray(data.choices) ? data.choices : [];
  for (const choice of choices) {
    const content = choice.message?.content;
    if (typeof content === "string" && content.trim()) {
      return {
        rawText: content,
        finishReason: choice.finish_reason,
        reasoningContent: choice.message?.reasoning_content,
      };
    }
  }

  return {
    rawText: "",
    finishReason: choices[0]?.finish_reason,
    reasoningContent: choices[0]?.message?.reasoning_content,
  };
}

function getMissingFields(value: unknown): string[] {
  if (!isRecord(value)) return ["rootObject"];
  return DEEPSEEK_FIELDS.filter((field) => value[field] === undefined || value[field] === null);
}

function buildDeepSeekPrompt(input: DeviceAdvisorInput): string {
  return [
    "你是 DeviceScope 的 Apple 设备顾问。",
    "本地已经按设备类型、预算接近度和发布时间给出候选；请结合用户场景分析和排序。",
    "只能使用 candidateShortlist 中的 deviceId，事实只能引用对应 facts，不允许编造价格或规格。",
    "只返回紧凑 JSON，不要 Markdown。格式：",
    '{"summary":"...","recommendations":[{"deviceId":"...","matchScore":0.8,"reasons":["..."],"tradeoffs":["..."]}],"alternatives":[{"deviceId":"...","matchScore":0.6}],"tradeoffs":["..."],"suitableFor":["..."],"notSuitableFor":["..."],"confidence":0.8}',
    "recommendations 按优先级排列且最多 3 项；alternatives 最多 3 项，不能与 recommendations 重复。",
    "summary 不超过 80 个汉字；每台设备的 reasons 和 tradeoffs 各最多 2 条且每条只写一句；顶层数组各最多 3 条。",
    "每条事实性理由必须能在该候选 facts 中找到依据；信息不足就明确说明。",
    "只有在用户提供预算上限、所有 candidateShortlist 的 referencePrice 都明确且都超过预算时，才允许 recommendations 和 alternatives 同时为空。",
    "输入数据：",
    JSON.stringify(buildDeviceAdvisorContext(input)),
  ].join("\n");
}

function allowsNoMatch(input: DeviceAdvisorInput): boolean {
  const context = buildDeviceAdvisorContext(input);
  const budgetMax = context.userProfile.budget?.max;
  return (
    typeof budgetMax === "number" &&
    context.candidateShortlist.length > 0 &&
    context.candidateShortlist.every((candidate) => {
      return candidate.referencePrice !== null && candidate.referencePrice > budgetMax;
    })
  );
}

function mentionsBudgetNoMatch(
  summary: string,
  tradeoffs: string[],
  notSuitableFor: string[],
): boolean {
  return /预算|超出|高于|无法|没有|无符合|不符合/.test(
    [summary, ...tradeoffs, ...notSuitableFor].join(" "),
  );
}

function normalizeDeepSeekOutput(
  input: DeviceAdvisorInput,
  value: unknown,
): DeviceAdvisorOutput | null {
  if (!isRecord(value)) return null;

  const context = buildDeviceAdvisorContext(input);
  const candidates = new Map(
    context.candidateShortlist.map((candidate) => [candidate.deviceId, candidate]),
  );
  const summary = normalizeText(value.summary);
  const confidence = normalizeNumber(value.confidence);
  const tradeoffs = normalizeStringArray(value.tradeoffs);
  const suitableFor = normalizeStringArray(value.suitableFor);
  const notSuitableFor = normalizeStringArray(value.notSuitableFor);
  const rawRecommendations = Array.isArray(value.recommendations)
    ? value.recommendations
    : isRecord(value.recommendations)
      ? [value.recommendations]
      : null;
  const rawAlternatives = Array.isArray(value.alternatives)
    ? value.alternatives
    : isRecord(value.alternatives)
      ? [value.alternatives]
      : null;

  if (!summary || confidence === undefined || !rawRecommendations || !rawAlternatives) {
    return null;
  }

  if (!rawRecommendations.length && !rawAlternatives.length) {
    if (
      !allowsNoMatch(input) ||
      !mentionsBudgetNoMatch(summary, tradeoffs, notSuitableFor)
    ) {
      return null;
    }

    return {
      summary,
      recommendations: [],
      alternatives: [],
      tradeoffs: tradeoffs.length ? tradeoffs.slice(0, 4) : ["当前候选均超出预算"],
      suitableFor: suitableFor.length ? suitableFor.slice(0, 4) : ["了解当前价格带"],
      notSuitableFor: notSuitableFor.length
        ? notSuitableFor.slice(0, 4)
        : ["预算不能上调的用户"],
      confidence: Math.max(0, Math.min(1, confidence)),
      source: "ai",
      disclaimer: DEFAULT_DISCLAIMER,
    };
  }

  const audiences = suitableFor.length
    ? suitableFor.slice(0, 4)
    : context.userProfile.useCases.slice(0, 4);
  const exclusions = notSuitableFor.length
    ? notSuitableFor.slice(0, 4)
    : ["需求与候选设备能力不匹配的用户"];
  const used = new Set<string>();
  const toRecommendation = (
    item: unknown,
    alternative: boolean,
  ): DeviceAdvisorRecommendation | null => {
    const record = typeof item === "string" ? { deviceId: item } : item;
    if (!isRecord(record)) return null;

    const deviceId = normalizeText(record.deviceId);
    const candidate = candidates.get(deviceId);
    if (!candidate || used.has(deviceId)) return null;

    const matchScore = normalizeNumber(record.matchScore);
    if (matchScore === undefined) return null;
    used.add(deviceId);

    const reasons = normalizeStringArray(record.reasons);
    const itemTradeoffs = normalizeStringArray(record.tradeoffs);
    return {
      deviceId,
      model: candidate.model,
      series: candidate.series,
      category: candidate.category,
      releaseYear: candidate.releaseYear,
      priceText: candidate.priceText,
      matchScore: Math.max(0, Math.min(1, matchScore)),
      reasons: reasons.length
        ? reasons.slice(0, 3)
        : [alternative ? "模型列为备选方案" : "模型列为优先候选"],
      tradeoffs: itemTradeoffs.length
        ? itemTradeoffs.slice(0, 3)
        : ["仍需结合实际价格和使用习惯确认"],
      suitableFor: audiences.length ? audiences.slice(0, 3) : ["日常使用"],
      notSuitableFor: exclusions.slice(0, 3),
    };
  };

  const recommendations = rawRecommendations
    .map((item) => toRecommendation(item, false))
    .filter((item): item is DeviceAdvisorRecommendation => item !== null)
    .slice(0, context.userProfile.maxResults);
  const alternatives = rawAlternatives
    .map((item) => toRecommendation(item, true))
    .filter((item): item is DeviceAdvisorRecommendation => item !== null)
    .slice(0, 3);
  if (!recommendations.length || !alternatives.length) return null;

  const combinedTradeoffs = tradeoffs.length
    ? tradeoffs
    : recommendations.flatMap((item) => item.tradeoffs);
  return {
    summary,
    recommendations,
    alternatives,
    tradeoffs: combinedTradeoffs.slice(0, 4),
    suitableFor: audiences.length ? audiences : ["日常使用"],
    notSuitableFor: exclusions,
    confidence: Math.max(0, Math.min(1, confidence)),
    source: "ai",
    disclaimer: DEFAULT_DISCLAIMER,
  };
}

function buildDeepSeekRequest(input: DeviceAdvisorInput, retryReason?: string) {
  return {
    model: process.env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL,
    messages: [
      {
        role: "system",
        content: [
          "You are DeviceScope, a careful Apple device advisor.",
          "Return one compact valid JSON object only.",
          "Use only candidate deviceIds and provided facts.",
          retryReason ? "This is a retry after an invalid or truncated answer." : "",
          retryReason ? `Previous failure: ${retryReason}` : "",
        ]
          .filter(Boolean)
          .join(" "),
      },
      {
        role: "user",
        content: buildDeepSeekPrompt(input),
      },
    ],
    thinking: { type: "disabled" },
    temperature: retryReason ? 0 : 0.2,
    max_tokens: DEEPSEEK_MAX_TOKENS,
    response_format: { type: "json_object" },
  };
}

async function callDeepSeek(
  input: DeviceAdvisorInput,
  retryReason: string | undefined,
  phase: DeepSeekAttemptDiagnostics["phase"],
): Promise<{
  output?: DeviceAdvisorOutput;
  retryReason?: string;
  diagnostics: DeepSeekAttemptDiagnostics;
}> {
  const startedAt = Date.now();
  const response = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    signal: AbortSignal.timeout(DEEPSEEK_TIMEOUT_MS),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify(buildDeepSeekRequest(input, retryReason)),
  });

  if (!response.ok) throw new Error(`DeepSeek API returned ${response.status}`);

  let payload: DeepSeekResponsePayload;
  try {
    payload = (await response.json()) as DeepSeekResponsePayload;
  } catch {
    throw new Error("DeepSeek response was not valid JSON");
  }

  const { rawText, finishReason, reasoningContent } = extractDeepSeekText(payload);
  const baseDiagnostics = {
    phase,
    latencyMs: Date.now() - startedAt,
    finishReason,
    hasReasoningContent: Boolean(reasoningContent?.trim()),
    rawTextEmpty: !rawText,
    missingFields: [] as string[],
    partialRepair: false,
  };
  if (!rawText) {
    const reason =
      finishReason === "length"
        ? "DeepSeek response was truncated"
        : "DeepSeek response did not include text output";
    return {
      retryReason: reason,
      diagnostics: { ...baseDiagnostics, retryReason: reason },
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    const reason =
      finishReason === "length"
        ? "DeepSeek response text was truncated"
        : "DeepSeek response text was not valid JSON";
    return {
      retryReason: reason,
      diagnostics: {
        ...baseDiagnostics,
        retryReason: reason,
        parseError: "invalidJson",
        missingFields: ["json"],
      },
    };
  }

  const missingFields = getMissingFields(parsed);
  const output = normalizeDeepSeekOutput(input, parsed);
  if (!output) {
    const reason = "DeepSeek response JSON was missing required fields";
    return {
      retryReason: reason,
      diagnostics: { ...baseDiagnostics, retryReason: reason, missingFields },
    };
  }

  return {
    output,
    diagnostics: {
      ...baseDiagnostics,
      missingFields,
      outputSource: "ai",
    },
  };
}

class DeepSeekAdvisorError extends Error {
  diagnostics: DeepSeekDiagnostics;

  constructor(message: string, diagnostics: DeepSeekDiagnostics) {
    super(message);
    this.name = "DeepSeekAdvisorError";
    this.diagnostics = diagnostics;
  }
}

function withDiagnostics(
  output: DeviceAdvisorOutput,
  diagnostics: DeepSeekDiagnostics,
): DeviceAdvisorOutputWithDiagnostics {
  return { ...output, _diagnostics: diagnostics };
}

export async function fetchDeepSeekAdvisor(
  input: DeviceAdvisorInput,
): Promise<DeviceAdvisorOutputWithDiagnostics> {
  if (!process.env.DEEPSEEK_API_KEY) return runFallbackDeviceAdvisor(input);

  const initial = await callDeepSeek(input, undefined, "initial");
  if (initial.output) {
    return withDiagnostics(initial.output, {
      provider: "deepseek",
      retryUsed: false,
      attempts: [initial.diagnostics],
      final: { source: "ai", partialRepair: false, finalFallback: false },
    });
  }

  const retry = await callDeepSeek(input, initial.retryReason, "retry");
  if (retry.output) {
    return withDiagnostics(retry.output, {
      provider: "deepseek",
      retryUsed: true,
      retryReason: initial.retryReason,
      attempts: [initial.diagnostics, retry.diagnostics],
      final: { source: "ai", partialRepair: false, finalFallback: false },
    });
  }

  throw new DeepSeekAdvisorError(
    retry.retryReason ?? initial.retryReason ?? "DeepSeek response was not usable",
    {
      provider: "deepseek",
      retryUsed: true,
      retryReason: initial.retryReason,
      attempts: [initial.diagnostics, retry.diagnostics],
      final: { source: "rules", partialRepair: false, finalFallback: true },
    },
  );
}

export function fallbackDeepSeekAdvisorAfterError(
  input: DeviceAdvisorInput,
  error: unknown,
): DeviceAdvisorOutputWithDiagnostics {
  const fallback = runFallbackDeviceAdvisor(input);
  return error instanceof DeepSeekAdvisorError
    ? withDiagnostics(fallback, error.diagnostics)
    : fallback;
}
