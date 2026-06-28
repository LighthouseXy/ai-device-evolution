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
  };

  const perfPref = input.performancePreference ?? "balanced";
  if (perfPref === "performance") weights.performance += 0.8;
  if (perfPref === "battery") weights.battery += 0.8;
  if (perfPref === "portable") weights.portability += 0.8;
  if (perfPref === "screen") weights.screen += 0.8;
  if (perfPref === "camera") weights.camera += 0.8;
  if (perfPref === "storage") weights.storage += 0.8;

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
    const totalScore = (
      budgetScore * weights.budget +
      performanceScore * weights.performance +
      batteryScore * weights.battery +
      portabilityScore * weights.portability +
      screenScore * weights.screen +
      storageScore * weights.storage +
      cameraScore * weights.camera
    ) / totalWeight;

    return {
      ...candidate,
      budgetScore,
      totalScore: clamp(totalScore, 0, 1),
      scoreBreakdown: [
        candidate.referencePrice !== null && budget ? `预算 ${Math.round(budgetScore * 100)}%` : null,
        `性能 ${Math.round(performanceScore * 100)}%`,
        `屏幕 ${Math.round(screenScore * 100)}%`,
        `便携 ${Math.round(portabilityScore * 100)}%`,
        `电池 ${Math.round(batteryScore * 100)}%`,
        `存储 ${Math.round(storageScore * 100)}%`,
        `拍照 ${Math.round(cameraScore * 100)}%`,
      ].filter(Boolean) as string[],
    };
  });
}

function pickCandidates(candidates: Candidate[], maxResults: number) {
  const sorted = [...candidates].sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (b.releaseYear !== a.releaseYear) return b.releaseYear - a.releaseYear;
    return (b.referencePrice ?? 0) - (a.referencePrice ?? 0);
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

function buildRecommendationNotes(
  candidate: Candidate,
  input: DeviceAdvisorInput,
  useCases: string[],
  intent: string,
) {
  const reasons: string[] = [];
  const tradeoffs: string[] = [];
  const suitableFor: string[] = [];
  const notSuitableFor: string[] = [];
  const text = [intent, ...useCases].join(" ").toLowerCase();
  const budget = input.budget ? normalizeBudget(input.budget) ?? null : null;
  const budgetText = summarizeBudget(budget);

  if (budget && candidate.referencePrice !== null) {
    if (candidate.budgetScore >= 0.9) {
      reasons.push(`价格和 ${budgetText} 匹配度高`);
    } else if (candidate.budgetScore >= 0.7) {
      reasons.push(`价格基本落在 ${budgetText} 范围内`);
    } else {
      tradeoffs.push(`价格与 ${budgetText} 有一定偏差`);
    }
  }

  if (candidate.totalScore >= 0.7) {
    reasons.push("综合匹配度较高");
  }

  if (candidate.recommendationLevel >= 6 || candidate.aiCapabilityLevel >= 6) {
    reasons.push("性能和智能基础更稳");
    suitableFor.push("重度办公 / 多任务");
  } else if (input.performancePreference === "performance") {
    tradeoffs.push("极限性能不是最强项");
    notSuitableFor.push("重度负载优先");
  }

  if (candidate.batteryHours >= 0.65 * 20 || (input.performancePreference === "battery" && candidate.batteryHours > 0)) {
    reasons.push("续航更适合长时间使用");
    suitableFor.push("外出 / 长时间使用");
  } else if (input.performancePreference === "battery") {
    tradeoffs.push("续航不是最突出优势");
  }

  if (candidate.weight > 0 && (input.performancePreference === "portable" || PORTABLE_KEYWORDS.some((keyword) => text.includes(keyword)))) {
    const portableScore = candidate.weight <= 1 ? "更轻便" : "便携性一般";
    if (candidate.weight <= 1) {
      reasons.push(portableScore);
      suitableFor.push("通勤 / 随身携带");
    } else {
      tradeoffs.push("机身不算最轻便");
      notSuitableFor.push("高频随身携带");
    }
  }

  if (input.performancePreference === "screen" || SCREEN_KEYWORDS.some((keyword) => text.includes(keyword))) {
    if (candidate.screenSize >= 0) {
      reasons.push("屏幕条件更适合观影和阅读");
      suitableFor.push("追剧 / 阅读 / 分屏");
    }
  }

  if (candidate.storageGb >= 256 || (input.performancePreference === "storage" && candidate.storageGb > 0)) {
    reasons.push("存储余量更宽裕");
    suitableFor.push("素材 / 离线文件较多");
  } else if (input.performancePreference === "storage") {
    tradeoffs.push("存储余量需要留意");
    notSuitableFor.push("海量素材长期保存");
  }

  if (candidate.cameraScore >= 12 || (input.performancePreference === "camera" && CAMERA_KEYWORDS.some((keyword) => text.includes(keyword)))) {
    reasons.push("影像能力更贴合创作需求");
    suitableFor.push("拍照 / 视频创作");
  } else if (input.performancePreference === "camera") {
    tradeoffs.push("影像不是主打项");
    notSuitableFor.push("拍照创作优先");
  }

  if (!reasons.length) reasons.push(`综合得分 ${Math.round(candidate.totalScore * 100)}%`);
  if (!tradeoffs.length) tradeoffs.push("没有明显短板，但仍需结合价格和使用习惯判断");
  if (!suitableFor.length) suitableFor.push("日常使用");
  if (!notSuitableFor.length) notSuitableFor.push("极端偏科需求");

  return {
    reasons: reasons.slice(0, 3),
    tradeoffs: tradeoffs.slice(0, 3),
    suitableFor: [...new Set(suitableFor)].slice(0, 3),
    notSuitableFor: [...new Set(notSuitableFor)].slice(0, 3),
  };
}

function toRecommendation(candidate: Candidate, input: DeviceAdvisorInput, useCases: string[], intent: string): DeviceAdvisorRecommendation {
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
    (input.intent ? 0.06 : 0);
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
  const picked = pickCandidates(scored, maxResults);
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
  const replacementIntent =
    value.replacementIntent === "upgrade" ||
    value.replacementIntent === "replace" ||
    value.replacementIntent === "first_device"
      ? value.replacementIntent
      : undefined;
  const maxResults = normalizeNumber(value.maxResults);

  if (!budget && !category && !performancePreference && !useCases.length && !intent && !replacementIntent && maxResults === undefined) {
    return null;
  }

  return {
    budget,
    category,
    performancePreference,
    useCases,
    intent,
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
