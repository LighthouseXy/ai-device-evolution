import type { DeviceCategory, FlattenedDevice } from "@/lib/devices-db";
import {
  AI_ANALYSIS_DISCLAIMER,
  ANALYSIS_TYPE_SET,
  MAX_HIGHLIGHTS,
  type AiAnalysisInput,
  type AiAnalysisOutput,
  type AnalysisType,
  type ChangedField,
} from "@/lib/ai-analysis-types";
import {
  clampNumber,
  isRecord,
  normalizeNumber,
  normalizeOptionalText,
  normalizeText,
} from "@/lib/ai-analysis-utils";

const DEVICE_CATEGORY_SET = new Set<DeviceCategory>(["phone", "tablet", "laptop", "watch", "band"]);

function normalizeDeviceCategory(value: unknown): DeviceCategory | null {
  return typeof value === "string" && DEVICE_CATEGORY_SET.has(value as DeviceCategory)
    ? (value as DeviceCategory)
    : null;
}

function normalizeAnalysisType(value: unknown): AnalysisType {
  return typeof value === "string" && ANALYSIS_TYPE_SET.has(value as AnalysisType)
    ? (value as AnalysisType)
    : "generation_summary";
}

function normalizeChangedField(value: unknown): ChangedField | null {
  if (!isRecord(value)) return null;

  const label = normalizeText(value.label);
  const currentValue = normalizeText(value.currentValue);
  const previousValue = normalizeText(value.previousValue);

  if (!label || !currentValue || !previousValue) return null;

  return {
    label,
    currentValue,
    previousValue,
  };
}

export function normalizeChangedFields(value: unknown): ChangedField[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => normalizeChangedField(item))
    .filter((item): item is ChangedField => item !== null)
    .slice(0, 6);
}

function normalizeFlattenedDevice(value: unknown, fallbackCategory?: DeviceCategory): FlattenedDevice | null {
  if (!isRecord(value)) return null;

  const category = normalizeDeviceCategory(value.category) ?? fallbackCategory;
  const model = normalizeText(value.model);
  const series = normalizeText(value.series);
  const brand = normalizeText(value.brand, "未知品牌");
  const id = normalizeText(value.id, `${series || "device"}-${model || "model"}`);
  const releaseYear = normalizeNumber(value.releaseYear);
  const generationNumber = normalizeNumber(value.generation);
  const generation = normalizeText(value.generation, generationNumber?.toString() ?? "");
  const generationOrder = normalizeNumber(value.generationOrder) ?? generationNumber ?? releaseYear;
  const family = normalizeText(value.family, series);
  const variant = normalizeText(value.variant, "standard");
  const market = normalizeText(value.market, "CN");
  const comparisonGroupId = normalizeText(
    value.comparisonGroupId,
    [brand, category, family, variant, normalizeOptionalText(value.tier)].filter(Boolean).join("."),
  );

  if (!category || !model || !series || !family || !variant || !generation || generationOrder === undefined || releaseYear === undefined) {
    return null;
  }

  return {
    id,
    brand,
    market,
    category,
    series,
    family,
    variant,
    tier: normalizeOptionalText(value.tier),
    model,
    generation,
    generationOrder,
    releaseYear,
    releaseDate: normalizeOptionalText(value.releaseDate),
    comparisonGroupId,
    // AI 输入边界显式标记缺失值；主数据和页面适配层仍保持空值，不把提示文字当成真实规格。
    chip: normalizeText(value.chip, "当前数据不足"),
    screenSize: normalizeNumber(value.screenSize),
    refreshRate: normalizeNumber(value.refreshRate),
    mainCameraMp: normalizeNumber(value.mainCameraMp),
    telephoto: normalizeOptionalText(value.telephoto),
    port: normalizeOptionalText(value.port),
    weight: normalizeNumber(value.weight),
    launchPrice: normalizeNumber(value.launchPrice),
    aiFeatureLevel: normalizeNumber(value.aiFeatureLevel),
    sourceUrl: normalizeOptionalText(value.sourceUrl) ?? "",
    specs: isRecord(value.specs) ? (value.specs as Record<string, string | number | boolean | undefined>) : undefined,
  };
}

export function normalizeAnalysisInput(value: unknown): AiAnalysisInput | null {
  if (!isRecord(value)) return null;

  const seriesName = normalizeText(value.seriesName);
  const category = normalizeDeviceCategory(value.category);
  const analysisType = normalizeAnalysisType(value.analysisType);
  const categoryLabel = normalizeText(value.categoryLabel);
  const devices = Array.isArray(value.devices)
    ? value.devices
        .map((item) => normalizeFlattenedDevice(item, category ?? undefined))
        .filter((item): item is FlattenedDevice => item !== null)
    : [];

  if (!seriesName || !category || !categoryLabel || devices.length === 0) {
    return null;
  }

  const latestDevice = normalizeFlattenedDevice(value.latestDevice, category);
  const previousDevice = normalizeFlattenedDevice(value.previousDevice, category);
  const changedFields = normalizeChangedFields(value.changedFields);

  return {
    seriesName,
    category,
    analysisType,
    categoryLabel,
    devices,
    latestDevice,
    previousDevice,
    changedFields,
  };
}

// 兼容性辅助：路由层可直接重用的严格输出检查。
export function normalizeAiAnalysisOutput(value: unknown): AiAnalysisOutput | null {
  if (!isRecord(value)) return null;

  const summary = normalizeText(value.summary);
  const facts = Array.isArray(value.facts)
    ? value.facts.map((item) => normalizeText(item)).filter(Boolean).slice(0, MAX_HIGHLIGHTS)
    : [];
  const insights = Array.isArray(value.insights)
    ? value.insights.map((item) => normalizeText(item)).filter(Boolean).slice(0, MAX_HIGHLIGHTS)
    : [];
  const buyingAdvice = normalizeText(value.buyingAdvice);
  const prediction = normalizeText(value.prediction);
  const missingData = Array.isArray(value.missingData)
    ? value.missingData.map((item) => normalizeText(item)).filter(Boolean).slice(0, MAX_HIGHLIGHTS)
    : [];
  const disclaimer = normalizeText(value.disclaimer, AI_ANALYSIS_DISCLAIMER);
  const source = value.source === "ai" || value.source === "rules" ? value.source : null;
  const upgradeHighlights = Array.isArray(value.upgradeHighlights)
    ? value.upgradeHighlights.map((item) => normalizeText(item)).filter(Boolean).slice(0, MAX_HIGHLIGHTS)
    : facts;
  const confidence = normalizeNumber(value.confidence);

  if (!summary || !facts.length || !insights.length || !buyingAdvice || !prediction || !source || confidence === undefined) return null;
  if (!missingData.length) {
    missingData.push("当前数据不足");
  }

  return {
    summary,
    facts,
    insights,
    upgradeHighlights,
    buyingAdvice,
    prediction,
    missingData,
    confidence: clampNumber(confidence, 0, 1),
    source,
    disclaimer,
  };
}
