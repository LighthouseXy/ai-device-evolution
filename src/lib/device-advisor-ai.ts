import {
  runFallbackDeviceAdvisor,
  type DeviceAdvisorInput,
} from "@/lib/device-advisor";
import {
  fallbackDeepSeekAdvisorAfterError,
  fetchDeepSeekAdvisor,
} from "@/lib/device-advisor-deepseek";
import { fetchOpenAIAdvisor } from "@/lib/device-advisor-openai";
import type {
  DeviceAdvisorOutputWithDiagnostics,
  DeviceAdvisorProvider,
} from "@/lib/device-advisor-ai-types";

export type {
  DeviceAdvisorOutputWithDiagnostics,
  DeviceAdvisorProvider,
} from "@/lib/device-advisor-ai-types";

export function resolveDeviceAdvisorProvider(): DeviceAdvisorProvider | null {
  const configured = process.env.AI_PROVIDER?.trim().toLowerCase();

  if (configured === "openai" && process.env.OPENAI_API_KEY) return "openai";
  if (configured === "deepseek" && process.env.DEEPSEEK_API_KEY) return "deepseek";
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.DEEPSEEK_API_KEY) return "deepseek";

  return null;
}

export async function fetchAiDeviceAdvisor(
  provider: DeviceAdvisorProvider,
  input: DeviceAdvisorInput,
): Promise<DeviceAdvisorOutputWithDiagnostics> {
  return provider === "deepseek" ? fetchDeepSeekAdvisor(input) : fetchOpenAIAdvisor(input);
}

export function fallbackDeviceAdvisorAfterAiError(
  provider: DeviceAdvisorProvider,
  input: DeviceAdvisorInput,
  error: unknown,
): DeviceAdvisorOutputWithDiagnostics {
  if (provider === "deepseek") {
    return fallbackDeepSeekAdvisorAfterError(input, error);
  }

  return runFallbackDeviceAdvisor(input);
}
