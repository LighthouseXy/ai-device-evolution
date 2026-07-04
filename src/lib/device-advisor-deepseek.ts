import {
  buildDeviceAdvisorPrompt,
  normalizeDeviceAdvisorOutput,
  runFallbackDeviceAdvisor,
  type DeviceAdvisorInput,
  type DeviceAdvisorOutput,
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

type DeepSeekExtraction = {
  rawText: string;
  finishReason?: string;
  reasoningContent?: string;
};

type DeepSeekPromptPayload = {
  userProfile?: Record<string, unknown>;
  candidateShortlist?: unknown[];
};

type ParsedDeepSeekPrompt = {
  prefix: string;
  payload: DeepSeekPromptPayload;
  postfix: string;
};

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-chat";
const DEFAULT_DISCLAIMER = "基于已收录设备数据生成，仅供参考";
const PARTIAL_AI_REPAIR_DISCLAIMER = "AI 输出不完整，已结合规则结果补齐，仅供参考";
const DEEPSEEK_SHORTLIST_LIMIT = 8;
const DEEPSEEK_MAX_TOKENS = 1600;
const DEEPSEEK_RETRY_MAX_TOKENS = 2400;
const DEEPSEEK_REQUIRED_FIELDS = [
  "summary",
  "recommendations",
  "tradeoffs",
  "suitableFor",
  "notSuitableFor",
  "alternatives",
  "confidence",
  "source",
  "disclaimer",
] as const;

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

function getDeepSeekMissingFields(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return ["rootObject"];
  }

  const record = value as Record<string, unknown>;
  const missing: string[] = [];
  for (const field of DEEPSEEK_REQUIRED_FIELDS) {
    const item = record[field];
    if (item === undefined || item === null) {
      missing.push(field);
      continue;
    }

    if (field === "summary" || field === "source" || field === "disclaimer") {
      if (typeof item !== "string" || item.trim().length === 0) missing.push(field);
    } else if (
      field === "recommendations" ||
      field === "alternatives" ||
      field === "tradeoffs" ||
      field === "suitableFor" ||
      field === "notSuitableFor"
    ) {
      if (!Array.isArray(item)) missing.push(field);
    } else if (field === "confidence" && typeof normalizeDeepSeekConfidence(item) !== "number") {
      missing.push(field);
    }
  }

  return missing;
}

function normalizeDeepSeekOutput(
  input: DeviceAdvisorInput,
  value: unknown,
): { output: DeviceAdvisorOutput; usedRuleScaffold: boolean } | null {
  const repaired = repairDeepSeekOutput(value);
  const normalized = normalizeDeviceAdvisorOutput(repaired);
  if (normalized) {
    return {
      output: normalized,
      usedRuleScaffold: false,
    };
  }

  if (!repaired || typeof repaired !== "object" || Array.isArray(repaired)) {
    return null;
  }

  const record = repaired as Record<string, unknown>;
  const aiNoMatch = normalizeDeepSeekNoMatchOutput(input, record);
  if (aiNoMatch) {
    return {
      output: aiNoMatch,
      usedRuleScaffold: false,
    };
  }

  // DeepSeek 有时只返回部分可用字段；用规则结果补齐结构时，source 必须保持 rules。
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
    source: "rules",
    disclaimer: PARTIAL_AI_REPAIR_DISCLAIMER,
  };

  const scaffolded = normalizeDeviceAdvisorOutput(scaffold);
  if (!scaffolded) {
    return null;
  }

  return {
    output: scaffolded,
    usedRuleScaffold: true,
  };
}

function buildDeepSeekPrompt(input: DeviceAdvisorInput): string {
  const prompt = buildDeviceAdvisorPrompt(input);
  const parsedPrompt = parseDeepSeekPromptPayload(prompt);
  if (!parsedPrompt) {
    return prompt;
  }

  const { prefix, payload, postfix } = parsedPrompt;
  const trimmedPayload = {
    ...payload,
    candidateShortlist: prioritizeDeepSeekShortlist(payload).slice(0, DEEPSEEK_SHORTLIST_LIMIT),
  };

  return [
    prefix.trimEnd(),
    JSON.stringify(trimmedPayload, null, 2),
    "额外要求：优先推荐 candidateShortlist 中价格明确且预算内或最接近预算的候选。",
    "只有在用户提供预算上限、所有候选都有 numeric referencePrice、且所有 referencePrice 都高于预算时，才允许返回 recommendations: [] 和 alternatives: []。",
    "如果候选价格缺失或无法判断预算内外，不要返回空数组；必须选择最接近的候选，并在 tradeoffs 中说明价格信息不足。",
    postfix.trimStart(),
  ].join("\n\n");
}

function parseDeepSeekPromptPayload(prompt: string): ParsedDeepSeekPrompt | null {
  const marker = "输入数据：\n";
  const suffix = "\n\n请直接返回 JSON。";
  const start = prompt.indexOf(marker);
  const end = prompt.lastIndexOf(suffix);

  if (start === -1 || end === -1 || end <= start + marker.length) {
    return null;
  }

  const prefix = prompt.slice(0, start + marker.length);
  const payloadText = prompt.slice(start + marker.length, end);
  const postfix = prompt.slice(end);

  let payload: DeepSeekPromptPayload;
  try {
    payload = JSON.parse(payloadText) as DeepSeekPromptPayload;
  } catch {
    return null;
  }

  return { prefix, payload, postfix };
}

function prioritizeDeepSeekShortlist(payload: DeepSeekPromptPayload): unknown[] {
  const shortlist = Array.isArray(payload.candidateShortlist) ? payload.candidateShortlist : [];
  const budgetMax = getDeepSeekBudgetMax(payload);

  if (budgetMax === undefined) {
    return shortlist;
  }

  return [...shortlist].sort((left, right) => {
    const leftPrice = getDeepSeekNumber((left as Record<string, unknown>)?.referencePrice);
    const rightPrice = getDeepSeekNumber((right as Record<string, unknown>)?.referencePrice);
    const leftHasPrice = leftPrice !== undefined ? 0 : 1;
    const rightHasPrice = rightPrice !== undefined ? 0 : 1;
    if (leftHasPrice !== rightHasPrice) return leftHasPrice - rightHasPrice;

    if (leftPrice !== undefined && rightPrice !== undefined) {
      const leftOverBudget = leftPrice > budgetMax ? 1 : 0;
      const rightOverBudget = rightPrice > budgetMax ? 1 : 0;
      if (leftOverBudget !== rightOverBudget) return leftOverBudget - rightOverBudget;

      const leftDistance = Math.abs(leftPrice - budgetMax);
      const rightDistance = Math.abs(rightPrice - budgetMax);
      if (leftDistance !== rightDistance) return leftDistance - rightDistance;
    }

    const leftScore = getDeepSeekNumber((left as Record<string, unknown>)?.totalScore) ?? 0;
    const rightScore = getDeepSeekNumber((right as Record<string, unknown>)?.totalScore) ?? 0;
    return rightScore - leftScore;
  });
}

function getDeepSeekBudgetMax(payload: DeepSeekPromptPayload): number | undefined {
  const budget = payload.userProfile?.budget;
  if (!budget || typeof budget !== "object" || Array.isArray(budget)) {
    return undefined;
  }

  return getDeepSeekNumber((budget as Record<string, unknown>).max);
}

function getDeepSeekNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function normalizeDeepSeekNoMatchOutput(
  input: DeviceAdvisorInput,
  record: Record<string, unknown>,
): DeviceAdvisorOutput | null {
  const summary = typeof record.summary === "string" ? record.summary.trim() : "";
  const tradeoffs = normalizeDeepSeekStringArray(record.tradeoffs);
  const notSuitableFor = normalizeDeepSeekStringArray(record.notSuitableFor);
  const suitableFor = normalizeDeepSeekStringArray(record.suitableFor);
  const recommendations = Array.isArray(record.recommendations) ? record.recommendations : null;
  const alternatives = Array.isArray(record.alternatives) ? record.alternatives : null;
  const confidence = normalizeDeepSeekConfidence(record.confidence);

  if (!summary || !tradeoffs || !tradeoffs.length || !notSuitableFor || !notSuitableFor.length) {
    return null;
  }

  if (!recommendations || !alternatives || recommendations.length !== 0 || alternatives.length !== 0) {
    return null;
  }

  if (confidence === undefined) {
    return null;
  }

  // 空推荐只在“预算明确且候选价格均超预算”时接受为合法 AI 输出，避免误吞正常推荐场景。
  if (!deepSeekInputAllowsNoMatch(input) || !summaryMentionsBudgetNoMatch(summary, tradeoffs, notSuitableFor)) {
    return null;
  }

  return {
    summary,
    recommendations: [],
    tradeoffs,
    suitableFor: suitableFor?.length ? suitableFor : ["预算无解判断"],
    notSuitableFor,
    alternatives: [],
    confidence: Math.max(0, Math.min(1, confidence)),
    source: "ai",
    disclaimer:
      typeof record.disclaimer === "string" && record.disclaimer.trim().length > 0
        ? record.disclaimer.trim()
        : DEFAULT_DISCLAIMER,
  };
}

function deepSeekInputAllowsNoMatch(input: DeviceAdvisorInput): boolean {
  const prompt = buildDeviceAdvisorPrompt(input);
  const parsedPrompt = parseDeepSeekPromptPayload(prompt);
  if (!parsedPrompt) {
    return false;
  }

  const { payload } = parsedPrompt;
  const budgetMax = getDeepSeekBudgetMax(payload);
  if (budgetMax === undefined) {
    return false;
  }

  const shortlist = prioritizeDeepSeekShortlist(payload).slice(0, DEEPSEEK_SHORTLIST_LIMIT);
  if (!shortlist.length) {
    return false;
  }

  const prices = shortlist.map((item) =>
    getDeepSeekNumber((item as Record<string, unknown>)?.referencePrice),
  );
  return prices.every((price) => price !== undefined && price > budgetMax);
}

function summaryMentionsBudgetNoMatch(
  summary: string,
  tradeoffs: string[],
  notSuitableFor: string[],
): boolean {
  const text = [summary, ...tradeoffs, ...notSuitableFor].join(" ");
  return /预算|超出|高于|无法|没有|无符合|不符合/.test(text);
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
        content: buildDeepSeekPrompt(input),
      },
    ],
    temperature: 0.2,
    max_tokens: DEEPSEEK_MAX_TOKENS,
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
        content: [
          "Repair the previous answer into a valid DeviceScope device-advisor JSON object.",
          "Use the candidate data and rules below as the source of truth.",
          "Every recommendation and alternative must copy all required item fields from candidateShortlist: deviceId, model, series, category, releaseYear, priceText, matchScore, reasons, tradeoffs, suitableFor, notSuitableFor.",
          "Keep recommendations and alternatives empty only when the no-match rule in the prompt is satisfied.",
          "If prices are missing or budget fit is unclear, choose the closest candidates and explain the uncertainty in tradeoffs.",
          "Return JSON only.",
          "",
          buildDeepSeekPrompt(input),
          compactContext ? ["", "Previous analysis context:", compactContext].join("\n") : "",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
    temperature: 0,
    max_tokens: compactContext ? DEEPSEEK_RETRY_MAX_TOKENS : DEEPSEEK_MAX_TOKENS,
    response_format: { type: "json_object" },
  };
}

async function callDeepSeek(
  input: DeviceAdvisorInput,
  requestBody: Record<string, unknown>,
  phase: DeepSeekAttemptDiagnostics["phase"],
): Promise<{
  output?: DeviceAdvisorOutput;
  retryReason?: string;
  reasoningContent?: string;
  diagnostics: DeepSeekAttemptDiagnostics;
}> {
  const startedAt = Date.now();
  const baseDiagnostics = (): DeepSeekAttemptDiagnostics => ({
    phase,
    latencyMs: Date.now() - startedAt,
    hasReasoningContent: false,
    rawTextEmpty: false,
    missingFields: [],
    partialRepair: false,
  });

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
    const retryReason =
      finishReason === "length"
        ? "DeepSeek response was truncated"
        : reasoningContent
          ? "DeepSeek response did not include usable text output"
          : "DeepSeek response did not include text output";
    return {
      retryReason,
      reasoningContent,
      diagnostics: {
        ...baseDiagnostics(),
        finishReason,
        retryReason,
        hasReasoningContent: typeof reasoningContent === "string" && reasoningContent.trim().length > 0,
        rawTextEmpty: true,
      },
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    const retryReason =
      finishReason === "length"
        ? "DeepSeek response text was truncated"
        : "DeepSeek response text was not valid JSON";
    return {
      retryReason,
      reasoningContent,
      diagnostics: {
        ...baseDiagnostics(),
        finishReason,
        retryReason,
        hasReasoningContent: typeof reasoningContent === "string" && reasoningContent.trim().length > 0,
        parseError: "invalidJson",
        missingFields: ["json"],
      },
    };
  }

  const missingFields = getDeepSeekMissingFields(parsed);
  const normalized = normalizeDeepSeekOutput(input, parsed);
  if (!normalized) {
    const retryReason =
      finishReason === "length"
        ? "DeepSeek response JSON was truncated or missing required fields"
        : "DeepSeek response JSON was missing required fields";
    return {
      retryReason,
      reasoningContent,
      diagnostics: {
        ...baseDiagnostics(),
        finishReason,
        retryReason,
        hasReasoningContent: typeof reasoningContent === "string" && reasoningContent.trim().length > 0,
        missingFields,
      },
    };
  }

  const outputSource = normalized.usedRuleScaffold ? "rules" : "ai";
  return {
    output: {
      ...normalized.output,
      source: outputSource,
      disclaimer: normalized.usedRuleScaffold
        ? PARTIAL_AI_REPAIR_DISCLAIMER
        : DEFAULT_DISCLAIMER,
    },
    diagnostics: {
      ...baseDiagnostics(),
      finishReason,
      hasReasoningContent: typeof reasoningContent === "string" && reasoningContent.trim().length > 0,
      missingFields,
      outputSource,
      partialRepair: normalized.usedRuleScaffold,
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

function withDeepSeekDiagnostics(
  output: DeviceAdvisorOutput,
  diagnostics: DeepSeekDiagnostics,
): DeviceAdvisorOutputWithDiagnostics {
  return {
    ...output,
    _diagnostics: diagnostics,
  };
}

export async function fetchDeepSeekAdvisor(
  input: DeviceAdvisorInput,
): Promise<DeviceAdvisorOutputWithDiagnostics> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return runFallbackDeviceAdvisor(input);

  const initial = await callDeepSeek(input, buildDeepSeekRequest(input), "initial");
  if (initial.output) {
    return withDeepSeekDiagnostics(initial.output, {
      provider: "deepseek",
      retryUsed: false,
      attempts: [initial.diagnostics],
      final: {
        source: initial.output.source,
        partialRepair: initial.diagnostics.partialRepair,
        finalFallback: false,
      },
    });
  }

  if (!initial.retryReason) {
    throw new Error("DeepSeek response was not usable");
  }

  const retry = await callDeepSeek(
    input,
    buildDeepSeekRetryRequest(input, initial.retryReason, initial.reasoningContent),
    "retry",
  );
  if (retry.output) {
    return withDeepSeekDiagnostics(retry.output, {
      provider: "deepseek",
      retryUsed: true,
      retryReason: initial.retryReason,
      attempts: [initial.diagnostics, retry.diagnostics],
      final: {
        source: retry.output.source,
        partialRepair: retry.diagnostics.partialRepair,
        finalFallback: false,
      },
    });
  }

  throw new DeepSeekAdvisorError(retry.retryReason ?? initial.retryReason, {
    provider: "deepseek",
    retryUsed: true,
    retryReason: initial.retryReason,
    attempts: [initial.diagnostics, retry.diagnostics],
    final: {
      source: "rules",
      partialRepair: false,
      finalFallback: true,
    },
  });
}

export function fallbackDeepSeekAdvisorAfterError(
  input: DeviceAdvisorInput,
  error: unknown,
): DeviceAdvisorOutputWithDiagnostics {
  const fallback = runFallbackDeviceAdvisor(input);
  if (error instanceof DeepSeekAdvisorError) {
    return withDeepSeekDiagnostics(fallback, error.diagnostics);
  }

  return fallback;
}
