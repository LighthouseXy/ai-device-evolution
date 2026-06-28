import {
  allDevices,
  categoryLabels,
  computedVal,
  formatMaybeCurrency,
  specNum,
  specStr,
  type DbDevice,
  type DeviceCategory,
} from "@/lib/devices-db";

export type DeviceAdvisorCategory = DeviceCategory | "all";

export type DeviceAdvisorBudget = {
  min?: number;
  max?: number;
  currency?: string;
};

export type DeviceAdvisorPerformancePreference =
  | "balanced"
  | "performance"
  | "battery"
  | "portable"
  | "screen"
  | "camera"
  | "storage";

export type DeviceAdvisorInput = {
  budget?: number | DeviceAdvisorBudget;
  category?: DeviceAdvisorCategory;
  performancePreference?: DeviceAdvisorPerformancePreference;
  useCases?: string[] | string;
  intent?: string;
  conditionPreference?: "new_only" | "used_ok" | "refurbished_ok";
  batteryPriority?: "balanced" | "high";
  interfaceNeed?: "any" | "usb_c" | "magsafe" | "pencil";
  replacementIntent?: "upgrade" | "replace" | "first_device";
  maxResults?: number;
};

export type DeviceAdvisorRecommendation = {
  deviceId: string;
  model: string;
  series: string;
  category: DeviceCategory;
  releaseYear: number;
  priceText: string;
  matchScore: number;
  reasons: string[];
  tradeoffs: string[];
  suitableFor: string[];
  notSuitableFor: string[];
};

export type DeviceAdvisorOutput = {
  summary: string;
  recommendations: DeviceAdvisorRecommendation[];
  tradeoffs: string[];
  suitableFor: string[];
  notSuitableFor: string[];
  alternatives: DeviceAdvisorRecommendation[];
  confidence: number;
  source: "ai" | "rules";
  disclaimer: string;
};

type Candidate = {
  device: DbDevice;
  deviceId: string;
  model: string;
  series: string;
  category: DeviceCategory;
  releaseYear: number;
  referencePrice: number | null;
  priceText: string;
  recommendationLevel: number;
  aiCapabilityLevel: number;
  screenSize: number;
  weight: number;
  batteryHours: number;
  storageGb: number;
  cameraScore: number;
  priceAvailability: "new_only" | "used_ok" | "refurbished_ok";
  conditionScore: number;
  interfaceScore: number;
  totalScore: number;
  budgetScore: number;
  scoreBreakdown: string[];
};

const DEFAULT_DISCLAIMER = "基于已收录设备数据生成，仅供参考";
const MAX_SHORTLIST = 12;
const MAX_RECOMMENDATIONS = 3;
const MAX_ALTERNATIVES = 3;
const CATEGORY_KEYWORDS: Record<Exclude<DeviceAdvisorCategory, "all">, string[]> = {
  phone: ["手机", "iphone", "拍照", "通勤", "随身", "移动"],
  tablet: ["平板", "ipad", "手写", "阅读", "追剧", "笔记", "pencil"],
  laptop: ["电脑", "macbook", "办公", "开发", "编程", "出差", "创作"],
};

const PERFORMANCE_KEYWORDS = ["性能", "游戏", "剪辑", "ai", "多任务", "重度"];
const BATTERY_KEYWORDS = ["续航", "电池", "长续航", "外出", "通勤", "全天"];
const PORTABLE_KEYWORDS = ["便携", "轻薄", "轻便", "随身", "通勤", "出差"];
const SCREEN_KEYWORDS = ["屏幕", "追剧", "阅读", "观影", "大屏", "分屏"];
const STORAGE_KEYWORDS = ["存储", "容量", "素材", "照片", "视频", "文件"];
const CAMERA_KEYWORDS = ["拍照", "摄影", "视频", "vlog", "相机"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeText(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  const text = value.trim().replace(/\s+/g, " ");
  return text.length > 0 ? text : fallback;
}

function normalizeNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

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

function normalizeConditionPreference(
  value: unknown,
): DeviceAdvisorInput["conditionPreference"] | undefined {
  if (value === "new_only" || value === "used_ok" || value === "refurbished_ok") {
    return value;
  }
  return undefined;
}

function normalizeBatteryPriority(value: unknown): DeviceAdvisorInput["batteryPriority"] | undefined {
  if (value === "balanced" || value === "high") {
    return value;
  }
  return undefined;
}

function normalizeInterfaceNeed(value: unknown): DeviceAdvisorInput["interfaceNeed"] | undefined {
  if (value === "any" || value === "usb_c" || value === "magsafe" || value === "pencil") {
    return value;
  }
  return undefined;
}

function normalizeUseCases(value: unknown): string[] {
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

function normalizeBudget(value: unknown): DeviceAdvisorBudget | undefined {
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

function normalizePriceAvailability(candidate: DbDevice): "new_only" | "used_ok" | "refurbished_ok" {
  const hasUsed = typeof specNum(candidate.specs?.usedPrice) === "number";
  const hasCurrent = typeof specNum(candidate.specs?.currentPrice) === "number";

  if (hasUsed && !hasCurrent) return "refurbished_ok";
  if (hasUsed) return "used_ok";
  return "new_only";
}

function summarizeBudget(budget: DeviceAdvisorBudget | null): string {
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

function parseStorageGb(value?: string): number {
  if (!value) return 0;
  const matches = Array.from(value.matchAll(/(\d+(?:\.\d+)?)\s*(TB|GB)/gi));
  let maxValue = 0;

  for (const match of matches) {
    const amount = Number(match[1]);
    if (!Number.isFinite(amount)) continue;
    const unit = match[2].toUpperCase();
    const gb = unit === "TB" ? amount * 1024 : amount;
    maxValue = Math.max(maxValue, gb);
  }

  return maxValue;
}

function parseBatteryHours(value?: string): number {
  if (!value) return 0;
  const matches = Array.from(value.matchAll(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/gi));
  let maxValue = 0;

  for (const match of matches) {
    const amount = Number(match[1]);
    if (!Number.isFinite(amount)) continue;
    maxValue = Math.max(maxValue, amount);
  }

  return maxValue;
}

function parseCameraScore(device: DbDevice): number {
  const main = specStr(device.specs?.mainCamera, "") || specStr(device.specs?.rearCamera, "");
  const front = specStr(device.specs?.frontCamera, "");
  const telephoto = specStr(device.specs?.telephoto, "");
  const mpMatch = main.match(/(\d+(?:\.\d+)?)\s*MP/i);
  const mainMp = mpMatch ? Number(mpMatch[1]) : 0;
  return mainMp + (front && front !== "待补充" ? 2 : 0) + (telephoto && telephoto !== "待补充" ? 6 : 0);
}

function inferCategory(input: DeviceAdvisorInput, useCases: string[], intent: string): DeviceAdvisorCategory {
  if (input.category && input.category !== "all") return input.category;
  if (input.category === "all") return "all";

  const text = [intent, ...useCases].join(" ").toLowerCase();
  for (const category of Object.keys(CATEGORY_KEYWORDS) as Array<Exclude<DeviceAdvisorCategory, "all">>) {
    if (CATEGORY_KEYWORDS[category].some((keyword) => text.includes(keyword))) {
      return category;
    }
  }

  return "all";
}

function getPriceText(device: DbDevice): string {
  const currentPrice = specNum(device.specs?.currentPrice);
  const usedPrice = specNum(device.specs?.usedPrice);
  const launchPrice = specNum(device.specs?.launchPrice);

  if (typeof currentPrice === "number") return `当前价 ${formatMaybeCurrency(currentPrice)}`;
  if (typeof usedPrice === "number") return `二手价 ${formatMaybeCurrency(usedPrice)}`;
  if (typeof launchPrice === "number") return `首发价 ${formatMaybeCurrency(launchPrice)}`;
  return "价格待补充";
}

function normalizeCandidate(candidate: DbDevice): Candidate {
  const recommendationLevel = computedVal(candidate.computed?.recommendationLevel) ?? 0;
  const aiCapabilityLevel = computedVal(candidate.computed?.aiCapabilityLevel) ?? 0;
  const screenSize = specNum(candidate.specs?.screenSize) ?? 0;
  const weight = specNum(candidate.specs?.weight) ?? 0;
  const batteryHours = parseBatteryHours(specStr(candidate.specs?.batteryLife, ""));
  const storageGb = parseStorageGb(specStr(candidate.specs?.storage, ""));
  const cameraScore = parseCameraScore(candidate);
  const priceAvailability = normalizePriceAvailability(candidate);
  const currentPrice = specNum(candidate.specs?.currentPrice) ?? specNum(candidate.specs?.usedPrice) ?? specNum(candidate.specs?.launchPrice) ?? null;

  return {
    device: candidate,
    deviceId: candidate.id,
    model: candidate.modelName,
    series: candidate.series,
    category: candidate.category,
    releaseYear: candidate.releaseYear,
    referencePrice: currentPrice,
    priceText: getPriceText(candidate),
    recommendationLevel,
    aiCapabilityLevel,
    screenSize,
    weight,
    batteryHours,
    storageGb,
    cameraScore,
    priceAvailability,
    conditionScore: 0,
    interfaceScore: 0,
    totalScore: 0,
    budgetScore: 0,
    scoreBreakdown: [],
  };
}

function normalizeRange(value: number, min: number, max: number): number {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return 0.5;
  return clamp((value - min) / (max - min), 0, 1);
}

function normalizeBudgetScore(price: number | null, budget: DeviceAdvisorBudget | null): number {
  if (!budget) return 0;
  if (price === null) return 0.35;

  const min = budget.min ?? budget.max ?? price;
  const max = budget.max ?? budget.min ?? price;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return price <= max ? 1 : 0.55;
  }

  if (price >= min && price <= max) return 1;
  if (price < min) {
    const ratio = price / Math.max(min, 1);
    return clamp(0.85 + ratio * 0.15, 0.6, 0.95);
  }

  const over = (price - max) / Math.max(max, 1);
  return clamp(1 - over * 1.6, 0, 0.9);
}

function scoreCandidates(
  candidates: Candidate[],
  input: DeviceAdvisorInput,
  useCases: string[],
  intent: string,
  budget: DeviceAdvisorBudget | null,
): Candidate[] {
  const performanceValues = candidates.map((item) => item.recommendationLevel + item.aiCapabilityLevel / 10);
  const screenValues = candidates.map((item) => item.screenSize);
  const weightValues = candidates.map((item) => item.weight);
  const batteryValues = candidates.map((item) => item.batteryHours);
  const storageValues = candidates.map((item) => item.storageGb);
  const cameraValues = candidates.map((item) => item.cameraScore);

  const performanceMin = Math.min(...performanceValues);
  const performanceMax = Math.max(...performanceValues);
  const screenMin = Math.min(...screenValues);
  const screenMax = Math.max(...screenValues);
  const weightMin = Math.min(...weightValues);
  const weightMax = Math.max(...weightValues);
  const batteryMin = Math.min(...batteryValues);
  const batteryMax = Math.max(...batteryValues);
  const storageMin = Math.min(...storageValues);
  const storageMax = Math.max(...storageValues);
  const cameraMin = Math.min(...cameraValues);
  const cameraMax = Math.max(...cameraValues);

  const weights: Record<string, number> = {
    budget: input.budget ? 1.4 : 0,
    performance: 1,
    battery: 0.8,
    portability: 0.9,
    screen: 0.9,
    storage: 0.8,
    camera: 0.7,
    condition: input.conditionPreference && input.conditionPreference !== "new_only" ? 0.4 : 0,
    interface: input.interfaceNeed && input.interfaceNeed !== "any" ? 0.4 : 0,
  };

  const perfPref = input.performancePreference ?? "balanced";
  if (perfPref === "performance") weights.performance += 0.8;
  if (perfPref === "battery") weights.battery += 0.8;
  if (perfPref === "portable") weights.portability += 0.8;
  if (perfPref === "screen") weights.screen += 0.8;
  if (perfPref === "camera") weights.camera += 0.8;
  if (perfPref === "storage") weights.storage += 0.8;
  if (input.batteryPriority === "high") weights.battery += 0.5;

  const useCaseText = [intent, ...useCases].join(" ").toLowerCase();
  if (PERFORMANCE_KEYWORDS.some((keyword) => useCaseText.includes(keyword))) weights.performance += 0.4;
  if (BATTERY_KEYWORDS.some((keyword) => useCaseText.includes(keyword))) weights.battery += 0.4;
  if (PORTABLE_KEYWORDS.some((keyword) => useCaseText.includes(keyword))) weights.portability += 0.4;
  if (SCREEN_KEYWORDS.some((keyword) => useCaseText.includes(keyword))) weights.screen += 0.4;
  if (STORAGE_KEYWORDS.some((keyword) => useCaseText.includes(keyword))) weights.storage += 0.4;
  if (CAMERA_KEYWORDS.some((keyword) => useCaseText.includes(keyword))) weights.camera += 0.4;

  const totalWeight = Object.values(weights).reduce((sum, value) => sum + value, 0) || 1;

  return candidates.map((candidate) => {
    const budgetScore = normalizeBudgetScore(candidate.referencePrice, budget);
    const performanceScore = normalizeRange(candidate.recommendationLevel + candidate.aiCapabilityLevel / 10, performanceMin, performanceMax);
    const screenScore = normalizeRange(candidate.screenSize, screenMin, screenMax);
    const portabilityScore = 1 - normalizeRange(candidate.weight, weightMin, weightMax);
    const batteryScore = normalizeRange(candidate.batteryHours, batteryMin, batteryMax);
    const storageScore = normalizeRange(candidate.storageGb, storageMin, storageMax);
    const cameraScore = normalizeRange(candidate.cameraScore, cameraMin, cameraMax);
    const conditionScore =
      input.conditionPreference === "used_ok"
        ? candidate.priceAvailability === "used_ok" || candidate.priceAvailability === "refurbished_ok"
          ? 1
          : 0.45
        : input.conditionPreference === "refurbished_ok"
          ? candidate.priceAvailability === "refurbished_ok"
            ? 1
            : candidate.priceAvailability === "used_ok"
              ? 0.8
              : 0.55
          : candidate.priceAvailability === "new_only"
            ? 1
            : 0.7;
    const interfaceScore =
      input.interfaceNeed === "any"
        ? 0.5
        : input.interfaceNeed === "usb_c"
          ? specStr(candidate.device.specs?.port, "").toLowerCase().includes("usb-c") || specStr(candidate.device.specs?.port, "").toLowerCase().includes("type-c")
            ? 1
            : candidate.device.category === "laptop"
              ? 0.8
              : 0.4
          : input.interfaceNeed === "magsafe"
            ? specStr(candidate.device.specs?.chargingMethod, "").toLowerCase().includes("magsafe")
              ? 1
              : candidate.device.category === "laptop"
                ? 0.75
                : 0.35
            : input.interfaceNeed === "pencil"
              ? candidate.device.specs?.pencilSupport
                ? 1
                : candidate.device.category === "tablet"
                  ? 0.65
                  : 0.25
              : 0.5;
    const totalScore = (
      budgetScore * weights.budget +
      performanceScore * weights.performance +
      batteryScore * weights.battery +
      portabilityScore * weights.portability +
      screenScore * weights.screen +
      storageScore * weights.storage +
      cameraScore * weights.camera +
      conditionScore * weights.condition +
      interfaceScore * weights.interface
    ) / totalWeight;

    return {
      ...candidate,
      budgetScore,
      conditionScore,
      interfaceScore,
      totalScore: clamp(totalScore, 0, 1),
      scoreBreakdown: [
        candidate.referencePrice !== null && budget ? `预算 ${Math.round(budgetScore * 100)}%` : null,
        `性能 ${Math.round(performanceScore * 100)}%`,
        `屏幕 ${Math.round(screenScore * 100)}%`,
        `便携 ${Math.round(portabilityScore * 100)}%`,
        `电池 ${Math.round(batteryScore * 100)}%`,
        `存储 ${Math.round(storageScore * 100)}%`,
        `拍照 ${Math.round(cameraScore * 100)}%`,
        input.conditionPreference ? `成色 ${Math.round(conditionScore * 100)}%` : null,
        input.interfaceNeed && input.interfaceNeed !== "any" ? `接口 ${Math.round(interfaceScore * 100)}%` : null,
      ].filter(Boolean) as string[],
    };
  });
}

function pickCandidates(candidates: Candidate[], maxResults: number, input: DeviceAdvisorInput) {
  const sorted = [...candidates].sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (b.budgetScore !== a.budgetScore) return b.budgetScore - a.budgetScore;
    if (input.conditionPreference && input.conditionPreference !== "new_only" && b.conditionScore !== a.conditionScore) {
      return b.conditionScore - a.conditionScore;
    }
    if (input.interfaceNeed && input.interfaceNeed !== "any" && b.interfaceScore !== a.interfaceScore) {
      return b.interfaceScore - a.interfaceScore;
    }
    if (b.releaseYear !== a.releaseYear) return b.releaseYear - a.releaseYear;
    const aPrice = a.referencePrice ?? Number.POSITIVE_INFINITY;
    const bPrice = b.referencePrice ?? Number.POSITIVE_INFINITY;
    if (aPrice !== bPrice) return aPrice - bPrice;
    return a.deviceId.localeCompare(b.deviceId, "en-US");
  });

  return {
    recommendations: sorted.slice(0, maxResults),
    alternatives: sorted.slice(maxResults, maxResults + MAX_ALTERNATIVES),
  };
}

function collectUnique(target: string[], values: string[]) {
  for (const value of values) {
    const text = normalizeText(value);
    if (text && !target.includes(text)) target.push(text);
  }
}

function formatNumber(value: number, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits }).format(value);
}

function formatWeight(candidate: Candidate): string | null {
  if (!candidate.weight) return null;
  return candidate.category === "laptop"
    ? `${formatNumber(candidate.weight, 2)} kg`
    : `${formatNumber(candidate.weight, 0)} g`;
}

function formatScreenSize(candidate: Candidate): string | null {
  return candidate.screenSize > 0 ? `${formatNumber(candidate.screenSize, 1)} 英寸` : null;
}

function formatBatteryHours(candidate: Candidate): string | null {
  return candidate.batteryHours > 0 ? `${formatNumber(candidate.batteryHours, 0)} 小时` : null;
}

function formatStorage(candidate: Candidate): string | null {
  if (!candidate.storageGb) return null;
  return candidate.storageGb >= 1024
    ? `${formatNumber(candidate.storageGb / 1024, 1)} TB`
    : `${formatNumber(candidate.storageGb, 0)} GB`;
}

function addSignal(target: Array<{ score: number; text: string }>, score: number, text: string) {
  if (text) target.push({ score: clamp(score, 0, 1), text });
}

function pickSignals(signals: Array<{ score: number; text: string }>, limit: number): string[] {
  const sorted = [...signals].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.text.localeCompare(b.text, "zh-Hans-CN");
  });

  const picked: string[] = [];
  const seen = new Set<string>();
  for (const signal of sorted) {
    const text = normalizeText(signal.text);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    picked.push(text);
    if (picked.length >= limit) break;
  }

  return picked;
}

function buildRecommendationNotes(
  candidate: Candidate,
  input: DeviceAdvisorInput,
  useCases: string[],
  intent: string,
) {
  const reasons: Array<{ score: number; text: string }> = [];
  const tradeoffs: Array<{ score: number; text: string }> = [];
  const suitableFor: string[] = [];
  const notSuitableFor: string[] = [];
  const text = [intent, ...useCases].join(" ").toLowerCase();
  const budget = input.budget ? normalizeBudget(input.budget) ?? null : null;
  const budgetText = summarizeBudget(budget);
  const interfaceLabel =
    input.interfaceNeed === "usb_c"
      ? "USB-C"
      : input.interfaceNeed === "magsafe"
        ? "MagSafe"
        : input.interfaceNeed === "pencil"
          ? "Apple Pencil"
          : "通用接口";
  const priceAvailabilityLabel =
    candidate.priceAvailability === "used_ok"
      ? "二手"
      : candidate.priceAvailability === "refurbished_ok"
        ? "翻新"
        : "全新";
  const screenSize = formatScreenSize(candidate);
  const weight = formatWeight(candidate);
  const batteryHours = formatBatteryHours(candidate);
  const storage = formatStorage(candidate);
  const performanceValue = candidate.recommendationLevel + candidate.aiCapabilityLevel / 10;

  if (budget && candidate.referencePrice !== null) {
    if (candidate.budgetScore >= 0.95) {
      addSignal(reasons, candidate.budgetScore, `价格 ${candidate.priceText} 基本落在 ${budgetText} 内`);
    } else if (candidate.budgetScore >= 0.75) {
      addSignal(reasons, candidate.budgetScore, `价格 ${candidate.priceText} 和 ${budgetText} 匹配度较高`);
    } else {
      addSignal(tradeoffs, 1 - candidate.budgetScore, `价格 ${candidate.priceText} 和 ${budgetText} 偏差较大`);
    }
  } else if (budget) {
    addSignal(tradeoffs, 0.35, "价格信息不完整，预算只能粗略参考");
  }

  if (performanceValue >= 7.2) {
    addSignal(reasons, performanceValue / 10, "性能和 AI 基础更稳，适合多任务");
    suitableFor.push("重度办公 / 多任务");
  } else if (input.performancePreference === "performance") {
    addSignal(tradeoffs, 0.8, "性能不是这一组里最强的一台，重负载要保守");
    notSuitableFor.push("重度负载优先");
  }

  if (candidate.batteryHours > 0) {
    if (candidate.batteryHours >= 16 || (input.batteryPriority === "high" && candidate.batteryHours >= 12)) {
      addSignal(reasons, candidate.batteryHours / 20, `续航约 ${batteryHours ?? formatNumber(candidate.batteryHours, 0)}，外出使用更踏实`);
      suitableFor.push("外出 / 长时间使用");
    } else if (input.batteryPriority === "high" || input.performancePreference === "battery") {
      addSignal(tradeoffs, 0.8, `续航约 ${batteryHours ?? formatNumber(candidate.batteryHours, 0)}，和优先续航相比不算最强`);
      notSuitableFor.push("长时间外出");
    }
  }

  if (candidate.weight > 0 && (input.performancePreference === "portable" || PORTABLE_KEYWORDS.some((keyword) => text.includes(keyword)))) {
    const isLightweight =
      (candidate.category === "laptop" && candidate.weight <= 1.4) ||
      (candidate.category === "tablet" && candidate.weight <= 500) ||
      (candidate.category === "phone" && candidate.weight <= 190);
    if (isLightweight) {
      addSignal(reasons, 0.8, `重量约 ${weight ?? formatNumber(candidate.weight, 0)}，通勤携带更轻松`);
      suitableFor.push("通勤 / 随身携带");
    } else {
      addSignal(tradeoffs, 0.7, `重量约 ${weight ?? formatNumber(candidate.weight, 0)}，随身携带不算最轻便`);
      notSuitableFor.push("高频随身携带");
    }
  }

  if (candidate.screenSize > 0 && (input.performancePreference === "screen" || SCREEN_KEYWORDS.some((keyword) => text.includes(keyword)))) {
    if (candidate.screenSize >= 6.5 || candidate.category !== "phone") {
      addSignal(reasons, candidate.screenSize / 14, `屏幕约 ${screenSize ?? formatNumber(candidate.screenSize, 1)}，阅读和分屏更顺手`);
      suitableFor.push("追剧 / 阅读 / 分屏");
    } else {
      addSignal(tradeoffs, 0.6, `屏幕约 ${screenSize ?? formatNumber(candidate.screenSize, 1)}，长时间阅读和分屏不占优`);
      notSuitableFor.push("大屏分屏优先");
    }
  }

  if (storage && (candidate.storageGb >= 256 || input.performancePreference === "storage" || STORAGE_KEYWORDS.some((keyword) => text.includes(keyword)))) {
    if (candidate.storageGb >= 256) {
      addSignal(reasons, Math.min(candidate.storageGb / 512, 1), `存储约 ${storage}，离线文件和素材更从容`);
      suitableFor.push("素材 / 离线文件较多");
    } else {
      addSignal(tradeoffs, 0.6, `存储约 ${storage}，长期放大量素材要留意空间`);
      notSuitableFor.push("海量素材长期保存");
    }
  }

  if (candidate.cameraScore >= 12 || (input.performancePreference === "camera" && CAMERA_KEYWORDS.some((keyword) => text.includes(keyword)))) {
    addSignal(reasons, Math.min(candidate.cameraScore / 20, 1), "影像能力更贴合拍照和视频创作");
    suitableFor.push("拍照 / 视频创作");
  } else if (input.performancePreference === "camera") {
    addSignal(tradeoffs, 0.7, "影像不是主打项");
    notSuitableFor.push("拍照创作优先");
  }

  if (input.interfaceNeed && input.interfaceNeed !== "any") {
    const hasUsbC = specStr(candidate.device.specs?.port, "").toLowerCase().includes("usb-c") || specStr(candidate.device.specs?.port, "").toLowerCase().includes("type-c");
    const hasMagSafe = specStr(candidate.device.specs?.chargingMethod, "").toLowerCase().includes("magsafe");
    const hasPencil = Boolean(candidate.device.specs?.pencilSupport);

    if (
      (input.interfaceNeed === "usb_c" && hasUsbC) ||
      (input.interfaceNeed === "magsafe" && hasMagSafe) ||
      (input.interfaceNeed === "pencil" && hasPencil)
    ) {
      if (input.interfaceNeed === "usb_c") {
        addSignal(reasons, candidate.interfaceScore, "USB-C 生态统一，充电和外设更省心");
      } else if (input.interfaceNeed === "magsafe") {
        addSignal(reasons, candidate.interfaceScore, "MagSafe 充电更方便，桌面使用更顺手");
      } else {
        addSignal(reasons, candidate.interfaceScore, "支持 Apple Pencil，记笔记和绘画更顺手");
        suitableFor.push("手写 / 笔记 / 绘画");
      }
    } else {
      addSignal(tradeoffs, 1 - candidate.interfaceScore, `接口/生态与 ${interfaceLabel} 不完全一致`);
      notSuitableFor.push(`强依赖 ${interfaceLabel} 生态`);
    }
  }

  if (input.conditionPreference && input.conditionPreference !== "new_only") {
    if (candidate.priceAvailability !== "new_only") {
      addSignal(
        reasons,
        candidate.conditionScore,
        input.conditionPreference === "used_ok"
          ? `可走 ${priceAvailabilityLabel} 路线，预算弹性更大`
          : `可走 ${priceAvailabilityLabel} 路线，性价比更灵活`,
      );
      suitableFor.push("预算敏感 / 性价比优先");
    } else {
      addSignal(tradeoffs, 0.8, `当前更偏全新渠道，和你想接受的 ${priceAvailabilityLabel} 偏好不完全一致`);
    }
  } else if (input.conditionPreference === "new_only" && candidate.priceAvailability !== "new_only") {
    addSignal(tradeoffs, 0.6, "虽然有二手或翻新价格，但你当前偏好只买全新");
  }

  if (!reasons.length) {
    if (performanceValue >= 7.2) {
      addSignal(reasons, performanceValue / 10, "性能基础更稳");
    } else if (candidate.batteryHours >= 16) {
      addSignal(reasons, candidate.batteryHours / 20, `续航约 ${batteryHours ?? formatNumber(candidate.batteryHours, 0)}，更适合长时间使用`);
    } else if (candidate.screenSize >= 6.5 || candidate.category !== "phone") {
      addSignal(reasons, candidate.screenSize / 14, `屏幕约 ${screenSize ?? formatNumber(candidate.screenSize, 1)}，阅读和分屏更顺手`);
    } else if (candidate.storageGb >= 256) {
      addSignal(reasons, Math.min(candidate.storageGb / 512, 1), `存储约 ${storage}，离线文件更从容`);
    } else if (candidate.cameraScore >= 12) {
      addSignal(reasons, Math.min(candidate.cameraScore / 20, 1), "影像能力更适合创作");
    } else {
      addSignal(reasons, candidate.totalScore, `综合匹配度 ${Math.round(candidate.totalScore * 100)}%`);
    }
  }

  if (!tradeoffs.length) {
    addSignal(tradeoffs, 0.2, "没有明显短板，但仍需结合价格和使用习惯判断");
  }
  if (!suitableFor.length) suitableFor.push("日常使用");
  if (!notSuitableFor.length) notSuitableFor.push("极端偏科需求");

  return {
    reasons: pickSignals(reasons, 3),
    tradeoffs: pickSignals(tradeoffs, 3),
    suitableFor: [...new Set(suitableFor)].slice(0, 3),
    notSuitableFor: [...new Set(notSuitableFor)].slice(0, 3),
  };
}

function toRecommendation(
  candidate: Candidate,
  input: DeviceAdvisorInput,
  useCases: string[],
  intent: string,
): DeviceAdvisorRecommendation {
  const notes = buildRecommendationNotes(candidate, input, useCases, intent);
  return {
    deviceId: candidate.deviceId,
    model: candidate.model,
    series: candidate.series,
    category: candidate.category,
    releaseYear: candidate.releaseYear,
    priceText: candidate.priceText,
    matchScore: Math.round(candidate.totalScore * 100) / 100,
    reasons: notes.reasons,
    tradeoffs: notes.tradeoffs,
    suitableFor: notes.suitableFor,
    notSuitableFor: notes.notSuitableFor,
  };
}

function buildTopLists(recommendations: DeviceAdvisorRecommendation[]) {
  const tradeoffs: string[] = [];
  const suitableFor: string[] = [];
  const notSuitableFor: string[] = [];

  for (const recommendation of recommendations) {
    collectUnique(tradeoffs, recommendation.tradeoffs);
    collectUnique(suitableFor, recommendation.suitableFor);
    collectUnique(notSuitableFor, recommendation.notSuitableFor);
  }

  return {
    tradeoffs: tradeoffs.slice(0, 4),
    suitableFor: suitableFor.slice(0, 4),
    notSuitableFor: notSuitableFor.slice(0, 4),
  };
}

function buildConfidence(recommendations: DeviceAdvisorRecommendation[], input: DeviceAdvisorInput, shortlistCount: number) {
  const topScore = recommendations[0]?.matchScore ?? 0;
  const secondScore = recommendations[1]?.matchScore ?? 0;
  const completeness =
    (input.budget ? 0.12 : 0) +
    (input.category && input.category !== "all" ? 0.08 : 0) +
    (input.performancePreference ? 0.08 : 0) +
    (input.useCases && normalizeUseCases(input.useCases).length ? 0.08 : 0) +
    (input.intent ? 0.06 : 0) +
    (input.conditionPreference && input.conditionPreference !== "new_only" ? 0.04 : 0) +
    (input.batteryPriority === "high" ? 0.04 : 0) +
    (input.interfaceNeed && input.interfaceNeed !== "any" ? 0.04 : 0);
  const spread = Math.max(topScore - secondScore, 0);
  const shortlistBonus = shortlistCount >= 3 ? 0.05 : 0;

  return clamp(0.3 + topScore * 0.4 + spread * 0.18 + completeness + shortlistBonus, 0.2, 0.96);
}

function buildFallbackOutput(input: DeviceAdvisorInput): DeviceAdvisorOutput {
  const useCases = normalizeUseCases(input.useCases);
  const intent = normalizeText(input.intent);
  const category = inferCategory(input, useCases, intent);
  const budget = normalizeBudget(input.budget) ?? null;
  const maxResults = clamp(normalizeNumber(input.maxResults) ?? MAX_RECOMMENDATIONS, 1, MAX_RECOMMENDATIONS);
  const candidates = allDevices
    .filter((device) => category === "all" || device.category === category)
    .map((device) => normalizeCandidate(device));
  const scored = scoreCandidates(candidates, input, useCases, intent, budget).sort((a, b) => b.totalScore - a.totalScore).slice(0, MAX_SHORTLIST);
  const picked = pickCandidates(scored, maxResults, input);
  const recommendations = picked.recommendations.map((candidate) => toRecommendation(candidate, input, useCases, intent));
  const alternatives = picked.alternatives.map((candidate) => toRecommendation(candidate, input, useCases, intent));
  const topLists = buildTopLists(recommendations);
  const top = recommendations[0];
  const categoryLabel = category === "all" ? "全品类" : categoryLabels[category];
  const budgetText = summarizeBudget(budget);

  return {
    summary: top
      ? `${categoryLabel}${budget ? ` · ${budgetText}` : ""} 下，${top.model} 是当前条件最稳妥的优先推荐。`
      : `当前条件下没有足够明确的推荐结果，建议补充 ${category === "all" ? "类别" : categoryLabel}、预算或使用场景。`,
    recommendations,
    tradeoffs: topLists.tradeoffs,
    suitableFor: topLists.suitableFor,
    notSuitableFor: topLists.notSuitableFor,
    alternatives,
    confidence: buildConfidence(recommendations, input, scored.length),
    source: "rules",
    disclaimer: DEFAULT_DISCLAIMER,
  };
}

function normalizeRecommendation(value: unknown): DeviceAdvisorRecommendation | null {
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
  const disclaimer = normalizeText(value.disclaimer, DEFAULT_DISCLAIMER);

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

function compactCandidate(candidate: Candidate) {
  return {
    deviceId: candidate.deviceId,
    model: candidate.model,
    series: candidate.series,
    category: candidate.category,
    releaseYear: candidate.releaseYear,
    referencePrice: candidate.referencePrice,
    priceText: candidate.priceText,
    recommendationLevel: candidate.recommendationLevel,
    aiCapabilityLevel: candidate.aiCapabilityLevel,
    screenSize: candidate.screenSize,
    weight: candidate.weight,
    batteryHours: candidate.batteryHours,
    storageGb: candidate.storageGb,
    cameraScore: candidate.cameraScore,
    scoreBreakdown: candidate.scoreBreakdown,
    totalScore: candidate.totalScore,
  };
}

export function buildDeviceAdvisorPrompt(input: DeviceAdvisorInput): string {
  const useCases = normalizeUseCases(input.useCases);
  const intent = normalizeText(input.intent);
  const category = inferCategory(input, useCases, intent);
  const budget = normalizeBudget(input.budget) ?? null;
  const conditionPreference = normalizeConditionPreference(input.conditionPreference);
  const batteryPriority = normalizeBatteryPriority(input.batteryPriority);
  const interfaceNeed = normalizeInterfaceNeed(input.interfaceNeed);
  const candidates = allDevices
    .filter((device) => category === "all" || device.category === category)
    .map((device) => normalizeCandidate(device));
  const shortlist = scoreCandidates(candidates, input, useCases, intent, budget)
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, MAX_SHORTLIST);

  const payload = {
    userProfile: {
      budget: budget
        ? {
            min: budget.min ?? null,
            max: budget.max ?? null,
            currency: budget.currency ?? "CNY",
            summary: summarizeBudget(budget),
          }
        : null,
      category,
      intent: intent || null,
      useCases,
      performancePreference: input.performancePreference ?? "balanced",
      conditionPreference: conditionPreference ?? "new_only",
      batteryPriority: batteryPriority ?? "balanced",
      interfaceNeed: interfaceNeed ?? "any",
      replacementIntent: input.replacementIntent ?? "replace",
      maxResults: clamp(normalizeNumber(input.maxResults) ?? MAX_RECOMMENDATIONS, 1, MAX_RECOMMENDATIONS),
    },
    candidateShortlist: shortlist.map((candidate) => compactCandidate(candidate)),
  };

  return [
    "你是 DeviceScope 的 Apple 设备顾问。",
    "只能基于提供的候选设备和用户偏好生成推荐，不允许编造未提供的机型、价格或规格。",
    "如果信息不足，要在理由里明确说明，不要假装确定。",
    "只返回纯 JSON，对象字段必须且只能包含：summary、recommendations、tradeoffs、suitableFor、notSuitableFor、alternatives、confidence、source、disclaimer。",
    'source 必须固定为 "ai"，disclaimer 必须为 "基于已收录设备数据生成，仅供参考"。',
    "recommendations 和 alternatives 都必须来自候选列表，且每项包含 deviceId、model、series、category、releaseYear、priceText、matchScore、reasons、tradeoffs、suitableFor、notSuitableFor。",
    "",
    "输入数据：",
    JSON.stringify(payload, null, 2),
    "",
    "请直接返回 JSON。",
  ].join("\n");
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

export function runFallbackDeviceAdvisor(input: DeviceAdvisorInput): DeviceAdvisorOutput {
  return buildFallbackOutput(input);
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
