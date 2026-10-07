import type { DeviceAdvisorOutput } from "@/lib/device-advisor";

export type DeviceAdvisorProvider = "openai" | "deepseek";

export type DeepSeekAttemptDiagnostics = {
  phase: "initial" | "retry";
  latencyMs: number;
  finishReason?: string;
  retryReason?: string;
  hasReasoningContent: boolean;
  rawTextEmpty: boolean;
  parseError?: string;
  missingFields: string[];
  outputSource?: "ai" | "rules";
  partialRepair: boolean;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
};

export type DeepSeekDiagnostics = {
  provider: "deepseek";
  retryUsed: boolean;
  retryReason?: string;
  attempts: DeepSeekAttemptDiagnostics[];
  final: {
    source: "ai" | "rules";
    partialRepair: boolean;
    finalFallback: boolean;
  };
};

export type DeviceAdvisorOutputWithDiagnostics = DeviceAdvisorOutput & {
  _diagnostics?: DeepSeekDiagnostics;
};
