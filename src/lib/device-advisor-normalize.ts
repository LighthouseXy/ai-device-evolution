import {
  MAX_RECOMMENDATIONS,
  type DeviceAdvisorBudget,
  type DeviceAdvisorCategory,
  type DeviceAdvisorInput,
  type DeviceAdvisorModelOutput,
  type DeviceAdvisorPerformancePreference,
} from "@/lib/device-advisor-types";
import {
  clamp,
  isRecord,
  normalizeNumber,
  normalizeText,
} from "@/lib/device-advisor-utils";

function normalizeCategory(value: unknown): DeviceAdvisorCategory | undefined {
  if (value === "all") return "all";
  return value === "phone" || value === "tablet" || value === "laptop" ? value : undefined;
}

function normalizePerformancePreference(
  value: unknown,
): DeviceAdvisorPerformancePreference | undefined {
  if (
    value === "balanced" ||
    value === "performance" ||
    value === "battery" ||
    value === "portable" ||
    value === "screen" ||
    value === "camera" ||
    value === "storage"
  ) {
    return value;
  }
  return undefined;
}

export function normalizeConditionPreference(
  value: unknown,
): DeviceAdvisorInput["conditionPreference"] | undefined {
  if (value === "new_only" || value === "used_ok" || value === "refurbished_ok") {
    return value;
  }
  return undefined;
}

export function normalizeBatteryPriority(value: unknown): DeviceAdvisorInput["batteryPriority"] | undefined {
  if (value === "balanced" || value === "high") {
    return value;
  }
  return undefined;
}

export function normalizeInterfaceNeed(value: unknown): DeviceAdvisorInput["interfaceNeed"] | undefined {
  if (value === "any" || value === "usb_c" || value === "magsafe" || value === "pencil") {
    return value;
  }
  return undefined;
}

export function normalizeUseCases(value: unknown): string[] {
  if (typeof value === "string") {
    return value
      .split(/[,\n/|，、]/g)
      .map((item) => normalizeText(item))
      .filter(Boolean)
      .slice(0, 8);
  }

  if (!Array.isArray(value)) return [];
  return value.map((item) => normalizeText(item)).filter(Boolean).slice(0, 8);
}

export function normalizeBudget(value: unknown): DeviceAdvisorBudget | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return { max: value, currency: "CNY" };
  }

  if (!isRecord(value)) return undefined;

  const min = normalizeNumber(value.min);
  const max = normalizeNumber(value.max ?? value.budget ?? value.amount);
  const currency = normalizeText(value.currency, "CNY") || "CNY";

  if (min === undefined && max === undefined) return undefined;
  const normalizedMin = min ?? max ?? undefined;
  const normalizedMax = max ?? min ?? undefined;

  if (normalizedMin !== undefined && normalizedMax !== undefined && normalizedMin > normalizedMax) {
    return { min: normalizedMax, max: normalizedMin, currency };
  }

  return { min: normalizedMin, max: normalizedMax, currency };
}

export function summarizeBudget(budget: DeviceAdvisorBudget | null): string {
  if (!budget) return "未提供预算";

  const currency = budget.currency ?? "CNY";
  const formatAmount = (value?: number) =>
    typeof value === "number"
      ? new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(value)
      : "待补充";

  if (budget.min !== undefined && budget.max !== undefined) {
    return currency === "CNY"
      ? `¥${formatAmount(budget.min)} - ¥${formatAmount(budget.max)}`
      : `${currency} ${formatAmount(budget.min)} - ${currency} ${formatAmount(budget.max)}`;
  }

  if (budget.max !== undefined) {
    return currency === "CNY" ? `¥${formatAmount(budget.max)}` : `${currency} ${formatAmount(budget.max)}`;
  }

  if (budget.min !== undefined) {
    return currency === "CNY" ? `¥${formatAmount(budget.min)}` : `${currency} ${formatAmount(budget.min)}`;
  }

  return "未提供预算";
}

export function normalizeDeviceAdvisorModelOutput(
  value: unknown,
): DeviceAdvisorModelOutput | null {
  if (!isRecord(value)) return null;

  const answer = normalizeText(value.answer);
  const recommendedDeviceIds = Array.isArray(value.recommendedDeviceIds)
    ? value.recommendedDeviceIds
        .map((item) => normalizeText(item))
        .filter(Boolean)
        .slice(0, MAX_RECOMMENDATIONS)
    : null;
  const confidence = normalizeNumber(value.confidence);
  if (!answer || !recommendedDeviceIds || confidence === undefined) return null;

  return {
    answer,
    recommendedDeviceIds,
    confidence: clamp(confidence, 0, 1),
  };
}

export function normalizeDeviceAdvisorInput(value: unknown): DeviceAdvisorInput | null {
  if (!isRecord(value)) return null;

  const budget = normalizeBudget(value.budget);
  const category = normalizeCategory(value.category);
  const performancePreference = normalizePerformancePreference(value.performancePreference);
  const useCases = normalizeUseCases(value.useCases);
  const intent = normalizeText(value.intent);
  const conditionPreference = normalizeConditionPreference(value.conditionPreference);
  const batteryPriority = normalizeBatteryPriority(value.batteryPriority);
  const interfaceNeed = normalizeInterfaceNeed(value.interfaceNeed);
  const replacementIntent =
    value.replacementIntent === "upgrade" ||
    value.replacementIntent === "replace" ||
    value.replacementIntent === "first_device"
      ? value.replacementIntent
      : undefined;
  const maxResults = normalizeNumber(value.maxResults);

  if (!budget && !category && !performancePreference && !useCases.length && !intent && !conditionPreference && !batteryPriority && !interfaceNeed && !replacementIntent && maxResults === undefined) {
    return null;
  }

  return {
    budget,
    category,
    performancePreference,
    useCases,
    intent,
    conditionPreference,
    batteryPriority,
    interfaceNeed,
    replacementIntent,
    maxResults,
  };
}

export const deviceAdvisorModelOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "recommendedDeviceIds", "confidence"],
  properties: {
    answer: { type: "string" },
    recommendedDeviceIds: {
      type: "array",
      minItems: 0,
      maxItems: MAX_RECOMMENDATIONS,
      items: { type: "string" },
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
} as const;
