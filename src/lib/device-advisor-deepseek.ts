import {
  buildDeviceAdvisorPrompt,
  groundDeviceAdvisorOutput,
  normalizeDeviceAdvisorModelOutput,
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

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-chat";
const DEEPSEEK_TIMEOUT_MS = 15_000;
const DEEPSEEK_MAX_TOKENS = 900;
const DEEPSEEK_FIELDS = ["answer", "recommendedDeviceIds", "confidence"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
        content: buildDeviceAdvisorPrompt(input),
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
  const normalized = normalizeDeviceAdvisorModelOutput(parsed);
  const output = normalized ? groundDeviceAdvisorOutput(input, normalized) : null;
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
