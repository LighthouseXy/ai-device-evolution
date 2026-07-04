import {
  DEFAULT_DEVICE_ADVISOR_DISCLAIMER,
  MAX_ALTERNATIVES,
  MAX_RECOMMENDATIONS,
  type DeviceAdvisorBudget,
  type DeviceAdvisorCategory,
  type DeviceAdvisorInput,
  type DeviceAdvisorOutput,
  type DeviceAdvisorPerformancePreference,
  type DeviceAdvisorRecommendation,
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

function normalizeRecommendation(value: unknown): DeviceAdvisorRecommendation | null {
  // 模型输出与脚本 fixtures 都走同一套运行时校验，避免 TypeScript 类型断言掩盖脏数据。
  if (!isRecord(value)) return null;

  const deviceId = normalizeText(value.deviceId);
  const model = normalizeText(value.model);
  const series = normalizeText(value.series);
  const category = value.category === "phone" || value.category === "tablet" || value.category === "laptop"
    ? value.category
    : null;
  const releaseYear = normalizeNumber(value.releaseYear);
  const priceText = normalizeText(value.priceText, "价格待补充");
  const matchScore = normalizeNumber(value.matchScore);
  const reasons = Array.isArray(value.reasons)
    ? value.reasons.map((item) => normalizeText(item)).filter(Boolean).slice(0, 3)
    : [];
  const tradeoffs = Array.isArray(value.tradeoffs)
    ? value.tradeoffs.map((item) => normalizeText(item)).filter(Boolean).slice(0, 3)
    : [];
  const suitableFor = Array.isArray(value.suitableFor)
    ? value.suitableFor.map((item) => normalizeText(item)).filter(Boolean).slice(0, 3)
    : [];
  const notSuitableFor = Array.isArray(value.notSuitableFor)
    ? value.notSuitableFor.map((item) => normalizeText(item)).filter(Boolean).slice(0, 3)
    : [];

  if (!deviceId || !model || !series || !category || releaseYear === undefined || matchScore === undefined) {
    return null;
  }

  return {
    deviceId,
    model,
    series,
    category,
    releaseYear,
    priceText,
    matchScore: clamp(matchScore, 0, 1),
    reasons: reasons.length ? reasons : ["当前条件下的优先推荐项"],
    tradeoffs: tradeoffs.length ? tradeoffs : ["当前推荐暂无额外补充"],
    suitableFor: suitableFor.length ? suitableFor : ["日常使用"],
    notSuitableFor: notSuitableFor.length ? notSuitableFor : ["极端偏科需求"],
  };
}

export function normalizeDeviceAdvisorOutput(value: unknown): DeviceAdvisorOutput | null {
  if (!isRecord(value)) return null;

  const summary = normalizeText(value.summary);
  const recommendations = Array.isArray(value.recommendations)
    ? value.recommendations.map((item) => normalizeRecommendation(item)).filter((item): item is DeviceAdvisorRecommendation => item !== null)
    : [];
  const tradeoffs = Array.isArray(value.tradeoffs)
    ? value.tradeoffs.map((item) => normalizeText(item)).filter(Boolean).slice(0, 4)
    : [];
  const suitableFor = Array.isArray(value.suitableFor)
    ? value.suitableFor.map((item) => normalizeText(item)).filter(Boolean).slice(0, 4)
    : [];
  const notSuitableFor = Array.isArray(value.notSuitableFor)
    ? value.notSuitableFor.map((item) => normalizeText(item)).filter(Boolean).slice(0, 4)
    : [];
  const alternatives = Array.isArray(value.alternatives)
    ? value.alternatives.map((item) => normalizeRecommendation(item)).filter((item): item is DeviceAdvisorRecommendation => item !== null)
    : [];
  const confidence = normalizeNumber(value.confidence);
  const source = value.source === "ai" || value.source === "rules" ? value.source : null;
  const disclaimer = normalizeText(value.disclaimer, DEFAULT_DEVICE_ADVISOR_DISCLAIMER);

  // 常规合法输出必须有主推荐和备选；预算无解空数组属于 DeepSeek route 的特殊分支，不在通用 schema 放开。
  if (!summary || !recommendations.length || !alternatives.length || confidence === undefined || !source) return null;

  return {
    summary,
    recommendations: recommendations.slice(0, MAX_RECOMMENDATIONS),
    tradeoffs: tradeoffs.length ? tradeoffs : ["当前条件下仍需结合预算和使用场景判断"],
    suitableFor: suitableFor.length ? suitableFor : ["日常使用"],
    notSuitableFor: notSuitableFor.length ? notSuitableFor : ["极端偏科需求"],
    alternatives: alternatives.slice(0, MAX_ALTERNATIVES),
    confidence: clamp(confidence, 0, 1),
    source,
    disclaimer,
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

export const deviceAdvisorOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "recommendations",
    "tradeoffs",
    "suitableFor",
    "notSuitableFor",
    "alternatives",
    "confidence",
    "source",
    "disclaimer",
  ],
  properties: {
    summary: { type: "string" },
    recommendations: {
      type: "array",
      minItems: 1,
      maxItems: MAX_RECOMMENDATIONS,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "deviceId",
          "model",
          "series",
          "category",
          "releaseYear",
          "priceText",
          "matchScore",
          "reasons",
          "tradeoffs",
          "suitableFor",
          "notSuitableFor",
        ],
        properties: {
          deviceId: { type: "string" },
          model: { type: "string" },
          series: { type: "string" },
          category: { type: "string", enum: ["phone", "tablet", "laptop"] },
          releaseYear: { type: "number" },
          priceText: { type: "string" },
          matchScore: { type: "number", minimum: 0, maximum: 1 },
          reasons: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 },
          tradeoffs: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 },
          suitableFor: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 },
          notSuitableFor: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 },
        },
      },
    },
    tradeoffs: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 4 },
    suitableFor: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 4 },
    notSuitableFor: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 4 },
    alternatives: {
      type: "array",
      minItems: 1,
      maxItems: MAX_ALTERNATIVES,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "deviceId",
          "model",
          "series",
          "category",
          "releaseYear",
          "priceText",
          "matchScore",
          "reasons",
          "tradeoffs",
          "suitableFor",
          "notSuitableFor",
        ],
        properties: {
          deviceId: { type: "string" },
          model: { type: "string" },
          series: { type: "string" },
          category: { type: "string", enum: ["phone", "tablet", "laptop"] },
          releaseYear: { type: "number" },
          priceText: { type: "string" },
          matchScore: { type: "number", minimum: 0, maximum: 1 },
          reasons: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 },
          tradeoffs: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 },
          suitableFor: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 },
          notSuitableFor: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 },
        },
      },
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    source: { type: "string", enum: ["ai"] },
    disclaimer: { type: "string" },
  },
} as const;
