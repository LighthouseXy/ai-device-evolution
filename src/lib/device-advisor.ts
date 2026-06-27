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

export type DeviceAdvisorPreferenceLevel = "low" | "balanced" | "high";

export type DeviceAdvisorPerformancePreference =
  | "balanced"
  | "performance"
  | "battery"
  | "portable"
  | "screen"
  | "camera"
  | "storage";

export type DeviceAdvisorOwnedDevice = {
  category?: DeviceCategory;
  series?: string;
  model?: string;
  releaseYear?: number;
};

export type DeviceAdvisorInput = {
  budget?: number | DeviceAdvisorBudget;
  category?: DeviceAdvisorCategory;
  intent?: string;
  performancePreference?: DeviceAdvisorPerformancePreference;
  useCases?: string[] | string;
  preferences?: {
    battery?: DeviceAdvisorPreferenceLevel;
    portability?: DeviceAdvisorPreferenceLevel;
    screen?: DeviceAdvisorPreferenceLevel;
    storage?: DeviceAdvisorPreferenceLevel;
    camera?: DeviceAdvisorPreferenceLevel;
  };
  ownedDevice?: DeviceAdvisorOwnedDevice;
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

export type DeviceAdvisorModelCandidate = {
  deviceId: string;
  model: string;
  series: string;
  category: DeviceCategory;
  categoryLabel: string;
  releaseYear: number;
  generation: number;
  referencePrice: number | null;
  priceText: string;
  recommendationLevel: number | null;
  aiCapabilityLevel: number | null;
  screenSize: number | null;
  refreshRate: number | null;
  weight: number | null;
  storageGb: number | null;
  batteryHours: number | null;
  cameraScore: number | null;
  upgradeDelta: number | null;
  performanceScore: number;
  displayScore: number;
  portabilityScore: number;
  storageScore: number;
  batteryScore: number;
  cameraScoreNormalized: number;
  budgetScore: number;
  upgradeScore: number;
  totalScore: number;
  scoreBreakdown: string[];
  device: DbDevice;
};

type DeviceAdvisorContext = {
  input: DeviceAdvisorInput;
  category: DeviceAdvisorCategory;
  budget: DeviceAdvisorBudget | null;
  useCases: string[];
  intent: string;
  ownedDevice: DeviceAdvisorOwnedDevice | null;
  candidatePool: DeviceAdvisorModelCandidate[];
  candidateShortlist: DeviceAdvisorModelCandidate[];
  maxResults: number;
};

const DEFAULT_DISCLAIMER = "基于已收录设备数据生成，仅供参考";
const MAX_SHORTLIST = 12;
const MAX_RECOMMENDATIONS = 3;
const MAX_ALTERNATIVES = 3;

const CATEGORY_KEYWORDS: Record<Exclude<DeviceAdvisorCategory, "all">, string[]> = {
  phone: ["iphone", "手机", "拍照", "通勤", "随身", "移动"],
  tablet: ["ipad", "平板", "手写", "pencil", "绘画", "阅读", "追剧", "笔记"],
  laptop: ["macbook", "笔记本", "电脑", "办公", "开发", "创作", "出差", "编程"],
};

const PERFORMANCE_KEYWORDS = ["性能", "游戏", "剪辑", "ai", "多任务", "重度"];
const BATTERY_KEYWORDS = ["续航", "电池", "长续航", "外出", "全天", "通勤"];
const PORTABLE_KEYWORDS = ["便携", "轻薄", "轻便", "通勤", "出差", "随身"];
const SCREEN_KEYWORDS = ["屏幕", "追剧", "观影", "阅读", "大屏", "显示", "看视频"];
const STORAGE_KEYWORDS = ["存储", "容量", "素材", "照片", "视频", "文件", "离线"];
const CAMERA_KEYWORDS = ["拍照", "摄影", "视频", "vlog", "相机", "摄像头"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeText(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeOptionalText(value: unknown): string | undefined {
  const text = normalizeText(value);
  return text.length > 0 ? text : undefined;
}

function normalizeNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isDeviceCategory(value: unknown): value is DeviceCategory {
  return value === "phone" || value === "tablet" || value === "laptop";
}

function normalizeCategory(value: unknown): DeviceAdvisorCategory | undefined {
  if (value === "all") return "all";
  return isDeviceCategory(value) ? value : undefined;
}

function normalizePreferenceLevel(value: unknown): DeviceAdvisorPreferenceLevel | undefined {
  if (value === "low" || value === "balanced" || value === "high") return value;
  return undefined;
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

  return value
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .slice(0, 8);
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
    return {
      min: normalizedMax,
      max: normalizedMin,
      currency,
    };
  }

  return {
    min: normalizedMin,
    max: normalizedMax,
    currency,
  };
}

function normalizeOwnedDevice(value: unknown): DeviceAdvisorOwnedDevice | undefined {
  if (!isRecord(value)) return undefined;

  const category = normalizeCategory(value.category);
  const series = normalizeOptionalText(value.series);
  const model = normalizeOptionalText(value.model);
  const releaseYear = normalizeNumber(value.releaseYear);

  if (!category && !series && !model && releaseYear === undefined) return undefined;

  return {
    category: category && category !== "all" ? category : undefined,
    series,
    model,
    releaseYear,
  };
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
    return currency === "CNY"
      ? `¥${formatAmount(budget.max)}`
      : `${currency} ${formatAmount(budget.max)}`;
  }

  if (budget.min !== undefined) {
    return currency === "CNY"
      ? `¥${formatAmount(budget.min)}`
      : `${currency} ${formatAmount(budget.min)}`;
  }

  return "未提供预算";
}

function inferCategory(input: DeviceAdvisorInput, useCases: string[], intent: string): DeviceAdvisorCategory {
  if (input.category && input.category !== "all") return input.category;
  if (input.category === "all") return "all";

  const text = [intent, ...useCases, input.ownedDevice?.series, input.ownedDevice?.model]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  for (const category of Object.keys(CATEGORY_KEYWORDS) as Array<Exclude<DeviceAdvisorCategory, "all">>) {
    if (CATEGORY_KEYWORDS[category].some((keyword) => text.includes(keyword))) {
      return category;
    }
  }

  return "all";
}

function parseStorageGb(value?: string): number | undefined {
  if (!value) return undefined;

  const matches = Array.from(value.matchAll(/(\d+(?:\.\d+)?)\s*(TB|GB)/gi));
  let maxValue: number | undefined;

  for (const match of matches) {
    const amount = Number(match[1]);
    if (!Number.isFinite(amount)) continue;
    const unit = match[2].toUpperCase();
    const gb = unit === "TB" ? amount * 1024 : amount;
    maxValue = typeof maxValue === "number" ? Math.max(maxValue, gb) : gb;
  }

  return maxValue;
}

function parseBatteryHours(value?: string): number | undefined {
  if (!value) return undefined;

  const matches = Array.from(value.matchAll(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/gi));
  let maxValue: number | undefined;

  for (const match of matches) {
    const amount = Number(match[1]);
    if (!Number.isFinite(amount)) continue;
    maxValue = typeof maxValue === "number" ? Math.max(maxValue, amount) : amount;
  }

  return maxValue;
}

function parseCameraScore(device: DbDevice): number {
  const rear = specStr(device.specs?.mainCamera, "") || specStr(device.specs?.rearCamera, "");
  const front = specStr(device.specs?.frontCamera, "");
  const telephoto = specStr(device.specs?.telephoto, "");
  const mainMpMatch = rear.match(/(\d+(?:\.\d+)?)\s*MP/i);
  const mainMp = mainMpMatch ? Number(mainMpMatch[1]) : 0;
  const teleBonus = telephoto && telephoto !== "待补充" ? 6 : 0;
  const frontBonus = front && front !== "待补充" ? 2 : 0;

  return mainMp + teleBonus + frontBonus;
}

function parsePriceText(device: DbDevice): {
  referencePrice: number | null;
  priceText: string;
} {
  const currentPrice = specNum(device.specs?.currentPrice);
  const usedPrice = specNum(device.specs?.usedPrice);
  const launchPrice = specNum(device.specs?.launchPrice);

  if (typeof currentPrice === "number") {
    return {
      referencePrice: currentPrice,
      priceText: `当前价 ${formatMaybeCurrency(currentPrice)}`,
    };
  }

  if (typeof usedPrice === "number") {
    return {
      referencePrice: usedPrice,
      priceText: `二手价 ${formatMaybeCurrency(usedPrice)}`,
    };
  }

  if (typeof launchPrice === "number") {
    return {
      referencePrice: launchPrice,
      priceText: `首发价 ${formatMaybeCurrency(launchPrice)}`,
    };
  }

  return {
    referencePrice: null,
    priceText: "价格待补充",
  };
}

function findOwnedDevice(ownedDevice: DeviceAdvisorOwnedDevice | null): DbDevice | null {
  if (!ownedDevice) return null;

  if (ownedDevice.model) {
    const exact = allDevices.find((device) => device.modelName.toLowerCase() === ownedDevice.model?.toLowerCase());
    if (exact) return exact;
  }

  if (ownedDevice.series) {
    const exactSeries = allDevices.find((device) => device.series.toLowerCase() === ownedDevice.series?.toLowerCase());
    if (exactSeries) return exactSeries;
  }

  if (ownedDevice.category) {
    const sameCategory = allDevices.find((device) => device.category === ownedDevice.category);
    if (sameCategory) return sameCategory;
  }

  return null;
}

function normalizeRangeFromValues(value: number | null | undefined, min: number, max: number): number {
  if (value === null || value === undefined) return 0.5;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return 0.5;
  return clampNumber((value - min) / (max - min), 0, 1);
}

function normalizeInverseRangeFromValues(value: number | null | undefined, min: number, max: number): number {
  return 1 - normalizeRangeFromValues(value, min, max);
}

function buildDeviceCandidate(device: DbDevice, ownedDevice: DbDevice | null): DeviceAdvisorModelCandidate {
  const { referencePrice, priceText } = parsePriceText(device);
  const recommendationLevel = computedVal(device.computed?.recommendationLevel);
  const aiCapabilityLevel = computedVal(device.computed?.aiCapabilityLevel);
  const screenSize = specNum(device.specs?.screenSize);
  const refreshRate = specNum(device.specs?.refreshRate);
  const weight = specNum(device.specs?.weight);
  const storageGb = parseStorageGb(specStr(device.specs?.storage, ""));
  const batteryHours = parseBatteryHours(specStr(device.specs?.batteryLife, ""));
  const cameraScore = parseCameraScore(device);
  const upgradeDelta =
    ownedDevice && ownedDevice.category === device.category ? device.releaseYear - ownedDevice.releaseYear : null;

  const performanceScoreRaw =
    ((recommendationLevel ?? 0) * 2 + (aiCapabilityLevel ?? 0)) / 3;
  const displayScoreRaw =
    (screenSize ?? 0) + (refreshRate ?? 0) / 20;
  const portabilityScoreRaw =
    (weight ?? 0) + (screenSize ?? 0) * 8;

  return {
    deviceId: device.id,
    model: device.modelName,
    series: device.series,
    category: device.category,
    categoryLabel: categoryLabels[device.category],
    releaseYear: device.releaseYear,
    generation: Number.parseInt(device.generation, 10) || device.releaseYear,
    referencePrice,
    priceText,
    recommendationLevel: recommendationLevel ?? null,
    aiCapabilityLevel: aiCapabilityLevel ?? null,
    screenSize: screenSize ?? null,
    refreshRate: refreshRate ?? null,
    weight: weight ?? null,
    storageGb: storageGb ?? null,
    batteryHours: batteryHours ?? null,
    cameraScore: cameraScore ?? null,
    upgradeDelta,
    performanceScore: performanceScoreRaw,
    displayScore: displayScoreRaw,
    portabilityScore: portabilityScoreRaw,
    storageScore: storageGb ?? 0,
    batteryScore: batteryHours ?? 0,
    cameraScoreNormalized: cameraScore,
    budgetScore: 0,
    upgradeScore: 0,
    totalScore: 0,
    scoreBreakdown: [],
    device,
  };
}

function getCandidatePool(category: DeviceAdvisorCategory, ownedDevice: DbDevice | null): DeviceAdvisorModelCandidate[] {
  const devices = category === "all"
    ? [...allDevices]
    : allDevices.filter((device) => device.category === category);

  return devices.map((device) => buildDeviceCandidate(device, ownedDevice));
}

function normalizeCandidateMetrics(candidates: DeviceAdvisorModelCandidate[]): DeviceAdvisorModelCandidate[] {
  if (!candidates.length) return candidates;

  const performanceValues = candidates.map((item) => item.performanceScore);
  const displayValues = candidates.map((item) => item.displayScore);
  const portabilityValues = candidates.map((item) => item.portabilityScore);
  const storageValues = candidates.map((item) => item.storageScore);
  const batteryValues = candidates.map((item) => item.batteryScore);
  const cameraValues = candidates.map((item) => item.cameraScoreNormalized);
  const upgradeValues = candidates.map((item) => item.upgradeDelta).filter((value): value is number => typeof value === "number" && value > 0);

  const performanceMin = Math.min(...performanceValues);
  const performanceMax = Math.max(...performanceValues);
  const displayMin = Math.min(...displayValues);
  const displayMax = Math.max(...displayValues);
  const portabilityMin = Math.min(...portabilityValues);
  const portabilityMax = Math.max(...portabilityValues);
  const storageMin = Math.min(...storageValues);
  const storageMax = Math.max(...storageValues);
  const batteryMin = Math.min(...batteryValues);
  const batteryMax = Math.max(...batteryValues);
  const cameraMin = Math.min(...cameraValues);
  const cameraMax = Math.max(...cameraValues);
  const upgradeMin = upgradeValues.length ? Math.min(...upgradeValues) : 0;
  const upgradeMax = upgradeValues.length ? Math.max(...upgradeValues) : 0;

  return candidates.map((candidate) => ({
    ...candidate,
    performanceScore: normalizeRangeFromValues(candidate.performanceScore, performanceMin, performanceMax),
    displayScore: normalizeRangeFromValues(candidate.displayScore, displayMin, displayMax),
    portabilityScore: normalizeInverseRangeFromValues(candidate.portabilityScore, portabilityMin, portabilityMax),
    storageScore: normalizeRangeFromValues(candidate.storageScore, storageMin, storageMax),
    batteryScore: normalizeRangeFromValues(candidate.batteryScore, batteryMin, batteryMax),
    cameraScoreNormalized: normalizeRangeFromValues(candidate.cameraScoreNormalized, cameraMin, cameraMax),
    budgetScore: 0,
    upgradeScore: normalizeUpgradeScore(candidate.upgradeDelta, upgradeMin, upgradeMax),
    totalScore: 0,
    scoreBreakdown: [],
  }));
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
    return clampNumber(0.85 + ratio * 0.15, 0.6, 0.95);
  }

  const over = (price - max) / Math.max(max, 1);
  return clampNumber(1 - over * 1.6, 0, 0.9);
}

function normalizeUpgradeScore(delta: number | null, min: number, max: number): number {
  if (delta === null) return 0.25;
  if (delta <= 0) return 0.1;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return clampNumber(delta / 4, 0, 1);
  }
  return normalizeRangeFromValues(delta, min, max);
}

function computeWeights(input: DeviceAdvisorInput, useCases: string[], intent: string): Record<string, number> {
  const weights: Record<string, number> = {
    budget: input.budget ? 1.4 : 0,
    performance: 1,
    display: 0.9,
    portability: 0.9,
    storage: 0.8,
    battery: 0.8,
    camera: 0.7,
    upgrade: input.ownedDevice ? 0.8 : 0,
  };

  const preference = input.performancePreference ?? "balanced";
  if (preference === "performance") weights.performance += 0.8;
  if (preference === "battery") weights.battery += 0.8;
  if (preference === "portable") weights.portability += 0.8;
  if (preference === "screen") weights.display += 0.8;
  if (preference === "camera") weights.camera += 0.8;
  if (preference === "storage") weights.storage += 0.8;

  const preferenceLevels = input.preferences ?? {};
  if (preferenceLevels.battery === "high") weights.battery += 0.5;
  if (preferenceLevels.portability === "high") weights.portability += 0.5;
  if (preferenceLevels.screen === "high") weights.display += 0.5;
  if (preferenceLevels.storage === "high") weights.storage += 0.5;
  if (preferenceLevels.camera === "high") weights.camera += 0.5;

  const text = [intent, ...useCases].join(" ").toLowerCase();
  if (PERFORMANCE_KEYWORDS.some((keyword) => text.includes(keyword))) weights.performance += 0.4;
  if (BATTERY_KEYWORDS.some((keyword) => text.includes(keyword))) weights.battery += 0.4;
  if (PORTABLE_KEYWORDS.some((keyword) => text.includes(keyword))) weights.portability += 0.4;
  if (SCREEN_KEYWORDS.some((keyword) => text.includes(keyword))) weights.display += 0.4;
  if (STORAGE_KEYWORDS.some((keyword) => text.includes(keyword))) weights.storage += 0.4;
  if (CAMERA_KEYWORDS.some((keyword) => text.includes(keyword))) weights.camera += 0.4;

  return weights;
}

function scoreCandidates(
  candidates: DeviceAdvisorModelCandidate[],
  input: DeviceAdvisorInput,
  useCases: string[],
  intent: string,
  budget: DeviceAdvisorBudget | null,
): DeviceAdvisorModelCandidate[] {
  const weights = computeWeights(input, useCases, intent);
  const totalWeight = Object.values(weights).reduce((sum, value) => sum + value, 0) || 1;

  return candidates.map((candidate) => {
    const components = {
      budget: normalizeBudgetScore(candidate.referencePrice, budget),
      performance: candidate.performanceScore,
      display: candidate.displayScore,
      portability: candidate.portabilityScore,
      storage: candidate.storageScore,
      battery: candidate.batteryScore,
      camera: candidate.cameraScoreNormalized,
      upgrade: candidate.upgradeScore,
    };

    const totalScore = (
      components.budget * weights.budget +
      components.performance * weights.performance +
      components.display * weights.display +
      components.portability * weights.portability +
      components.storage * weights.storage +
      components.battery * weights.battery +
      components.camera * weights.camera +
      components.upgrade * weights.upgrade
    ) / totalWeight;

    const scoreBreakdown = [
      weights.budget > 0 ? `预算匹配 ${Math.round(components.budget * 100)}%` : null,
      `性能 ${Math.round(components.performance * 100)}%`,
      `屏幕 ${Math.round(components.display * 100)}%`,
      `便携 ${Math.round(components.portability * 100)}%`,
      `存储 ${Math.round(components.storage * 100)}%`,
      `续航 ${Math.round(components.battery * 100)}%`,
      `拍照 ${Math.round(components.camera * 100)}%`,
      weights.upgrade > 0 ? `换机 ${Math.round(components.upgrade * 100)}%` : null,
    ].filter((item): item is string => Boolean(item));

    return {
      ...candidate,
      budgetScore: components.budget,
      totalScore: clampNumber(totalScore, 0, 1),
      scoreBreakdown,
    };
  });
}

function candidatePriceLabel(candidate: DeviceAdvisorModelCandidate): string {
  return candidate.priceText;
}

function collectUnique(list: string[], items: string[]) {
  for (const item of items) {
    const text = normalizeText(item);
    if (text && !list.includes(text)) list.push(text);
  }
}

function buildRecommendationNotes(
  candidate: DeviceAdvisorModelCandidate,
  input: DeviceAdvisorInput,
  useCases: string[],
  intent: string,
): {
  reasons: string[];
  tradeoffs: string[];
  suitableFor: string[];
  notSuitableFor: string[];
} {
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
      reasons.push(`价格基本在 ${budgetText} 的可接受区间内`);
    } else {
      tradeoffs.push(`价格与 ${budgetText} 存在一定偏差`);
    }
  }

  if (candidate.performanceScore >= 0.7 && (input.performancePreference === "performance" || PERFORMANCE_KEYWORDS.some((keyword) => text.includes(keyword)))) {
    reasons.push("性能和 AI 基础更适合重度使用");
    suitableFor.push("重度办公 / 多任务 / 游戏");
  } else if (candidate.performanceScore <= 0.4 && input.performancePreference === "performance") {
    tradeoffs.push("极限性能不是这台的主场");
    notSuitableFor.push("极重负载场景");
  }

  if (candidate.portabilityScore >= 0.65 && (input.performancePreference === "portable" || PORTABLE_KEYWORDS.some((keyword) => text.includes(keyword)))) {
    reasons.push("便携性更适合通勤和随身携带");
    suitableFor.push("通勤携带 / 出差");
  } else if (candidate.portabilityScore <= 0.4 && (input.performancePreference === "portable" || PORTABLE_KEYWORDS.some((keyword) => text.includes(keyword)))) {
    tradeoffs.push("机身和屏幕尺寸不算最轻便");
    notSuitableFor.push("高频随身携带");
  }

  if (candidate.displayScore >= 0.65 && (input.performancePreference === "screen" || SCREEN_KEYWORDS.some((keyword) => text.includes(keyword)))) {
    reasons.push("屏幕尺寸和刷新率更适合观影、阅读或分屏");
    suitableFor.push("追剧 / 阅读 / 记笔记");
  } else if (candidate.displayScore <= 0.4 && (input.performancePreference === "screen" || SCREEN_KEYWORDS.some((keyword) => text.includes(keyword)))) {
    tradeoffs.push("屏幕不是这组条件下最突出的优势");
    notSuitableFor.push("长时间大屏体验优先");
  }

  if (candidate.batteryScore >= 0.65 && (input.performancePreference === "battery" || BATTERY_KEYWORDS.some((keyword) => text.includes(keyword)))) {
    reasons.push("续航表现更稳，适合外出和全天使用");
    suitableFor.push("全天外出 / 长时间使用");
  } else if (candidate.batteryScore <= 0.4 && (input.performancePreference === "battery" || BATTERY_KEYWORDS.some((keyword) => text.includes(keyword)))) {
    tradeoffs.push("续航不是最强项");
    notSuitableFor.push("强续航优先");
  }

  if (candidate.storageScore >= 0.65 && (input.performancePreference === "storage" || STORAGE_KEYWORDS.some((keyword) => text.includes(keyword)))) {
    reasons.push("存储余量更宽裕，适合装更多照片、视频和文件");
    suitableFor.push("素材 / 离线文件较多");
  } else if (candidate.storageScore <= 0.4 && (input.performancePreference === "storage" || STORAGE_KEYWORDS.some((keyword) => text.includes(keyword)))) {
    tradeoffs.push("存储余量需要多留意");
    notSuitableFor.push("海量素材长期离线保存");
  }

  if (candidate.cameraScoreNormalized >= 0.65 && (input.performancePreference === "camera" || CAMERA_KEYWORDS.some((keyword) => text.includes(keyword)))) {
    reasons.push("拍照和视频能力更贴合创作需求");
    suitableFor.push("拍照 / 视频创作");
  } else if (candidate.cameraScoreNormalized <= 0.4 && (input.performancePreference === "camera" || CAMERA_KEYWORDS.some((keyword) => text.includes(keyword)))) {
    tradeoffs.push("影像能力不是主打项");
    notSuitableFor.push("拍照创作优先");
  }

  if (candidate.upgradeScore >= 0.6 && input.replacementIntent === "upgrade") {
    reasons.push("相比现有设备是明确升级");
    suitableFor.push("准备升级旧设备");
  } else if (candidate.upgradeScore <= 0.2 && input.replacementIntent === "upgrade") {
    tradeoffs.push("换机幅度不算大");
    notSuitableFor.push("只想要明显跨代升级");
  }

  if (!reasons.length) {
    reasons.push(`综合得分更符合当前需求，匹配度 ${Math.round(candidate.totalScore * 100)}%`);
  }

  if (!tradeoffs.length) {
    tradeoffs.push("没有明显短板，但仍需结合预算和偏好做最后决定");
  }

  if (!suitableFor.length) {
    suitableFor.push("日常使用");
  }

  if (!notSuitableFor.length) {
    notSuitableFor.push("极端偏科需求");
  }

  return {
    reasons: reasons.slice(0, 3),
    tradeoffs: tradeoffs.slice(0, 3),
    suitableFor: [...new Set(suitableFor)].slice(0, 3),
    notSuitableFor: [...new Set(notSuitableFor)].slice(0, 3),
  };
}

function toRecommendation(candidate: DeviceAdvisorModelCandidate, input: DeviceAdvisorInput, useCases: string[], intent: string): DeviceAdvisorRecommendation {
  const notes = buildRecommendationNotes(candidate, input, useCases, intent);
  return {
    deviceId: candidate.deviceId,
    model: candidate.model,
    series: candidate.series,
    category: candidate.category,
    releaseYear: candidate.releaseYear,
    priceText: candidatePriceLabel(candidate),
    matchScore: clampNumber(Math.round(candidate.totalScore * 100) / 100, 0, 1),
    reasons: notes.reasons,
    tradeoffs: notes.tradeoffs,
    suitableFor: notes.suitableFor,
    notSuitableFor: notes.notSuitableFor,
  };
}

function summarizeRecommendations(
  recommendations: DeviceAdvisorRecommendation[],
  input: DeviceAdvisorInput,
  category: DeviceAdvisorCategory,
  budget: DeviceAdvisorBudget | null,
  intent: string,
): string {
  const top = recommendations[0];
  const categoryLabel = category === "all" ? "全品类" : categoryLabels[category];
  const budgetText = summarizeBudget(budget);
  const intentText = intent ? `，围绕“${intent}”` : "";

  if (!top) {
    return `当前条件下没有足够明确的推荐结果，建议先补充${category === "all" ? "类别" : categoryLabel}、预算或使用场景。`;
  }

  const reasonText = top.reasons.slice(0, 2).join("、");
  return `${categoryLabel}${budget ? ` · ${budgetText}` : ""}${intentText}下，${top.model} 是最稳妥的优先推荐项，主要因为 ${reasonText}。`;
}

function buildTopLevelLists(recommendations: DeviceAdvisorRecommendation[]): {
  tradeoffs: string[];
  suitableFor: string[];
  notSuitableFor: string[];
} {
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

function buildConfidence(
  recommendations: DeviceAdvisorRecommendation[],
  input: DeviceAdvisorInput,
  shortlist: DeviceAdvisorModelCandidate[],
): number {
  const topScore = recommendations[0]?.matchScore ?? 0;
  const secondScore = recommendations[1]?.matchScore ?? 0;
  const infoBonus =
    (input.budget ? 0.12 : 0) +
    (input.intent ? 0.08 : 0) +
    (input.useCases && normalizeUseCases(input.useCases).length ? 0.08 : 0) +
    (input.ownedDevice ? 0.1 : 0) +
    (input.category && input.category !== "all" ? 0.08 : 0);
  const spread = Math.max(topScore - secondScore, 0);
  const shortlistBonus = shortlist.length >= 3 ? 0.05 : 0;

  return clampNumber(0.3 + topScore * 0.4 + spread * 0.18 + infoBonus + shortlistBonus, 0.2, 0.96);
}

function normalizeRecommendation(value: unknown): DeviceAdvisorRecommendation | null {
  if (!isRecord(value)) return null;

  const deviceId = normalizeText(value.deviceId);
  const model = normalizeText(value.model);
  const series = normalizeText(value.series);
  const category = isDeviceCategory(value.category) ? value.category : null;
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
    matchScore: clampNumber(matchScore, 0, 1),
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

  if (!summary || !recommendations.length || !alternatives.length || confidence === undefined || !source) {
    return null;
  }

  return {
    summary,
    recommendations: recommendations.slice(0, MAX_RECOMMENDATIONS),
    tradeoffs: tradeoffs.length ? tradeoffs : ["当前条件下仍需结合预算和使用场景判断"],
    suitableFor: suitableFor.length ? suitableFor : ["日常使用"],
    notSuitableFor: notSuitableFor.length ? notSuitableFor : ["极端偏科需求"],
    alternatives: alternatives.slice(0, MAX_ALTERNATIVES),
    confidence: clampNumber(confidence, 0, 1),
    source,
    disclaimer,
  };
}

function buildPromptCandidateSnapshot(candidate: DeviceAdvisorModelCandidate) {
  return {
    deviceId: candidate.deviceId,
    model: candidate.model,
    series: candidate.series,
    category: candidate.category,
    categoryLabel: candidate.categoryLabel,
    releaseYear: candidate.releaseYear,
    referencePrice: candidate.referencePrice,
    priceText: candidate.priceText,
    recommendationLevel: candidate.recommendationLevel,
    aiCapabilityLevel: candidate.aiCapabilityLevel,
    screenSize: candidate.screenSize,
    refreshRate: candidate.refreshRate,
    weight: candidate.weight,
    storageGb: candidate.storageGb,
    batteryHours: candidate.batteryHours,
    cameraScore: candidate.cameraScore,
    upgradeDelta: candidate.upgradeDelta,
    matchScore: candidate.totalScore,
    scoreBreakdown: candidate.scoreBreakdown,
  };
}

function summarizeInput(input: DeviceAdvisorInput, category: DeviceAdvisorCategory, budget: DeviceAdvisorBudget | null, useCases: string[], intent: string, ownedDevice: DeviceAdvisorOwnedDevice | null) {
  return {
    budget: budget ? {
      min: budget.min ?? null,
      max: budget.max ?? null,
      currency: budget.currency ?? "CNY",
      summary: summarizeBudget(budget),
    } : null,
    category,
    intent: intent || null,
    useCases,
    performancePreference: input.performancePreference ?? "balanced",
    preferences: input.preferences ?? null,
    ownedDevice,
    replacementIntent: input.replacementIntent ?? "replace",
    maxResults: input.maxResults ?? MAX_RECOMMENDATIONS,
  };
}

function buildContext(input: DeviceAdvisorInput): DeviceAdvisorContext {
  const budget = normalizeBudget(input.budget) ?? null;
  const useCases = normalizeUseCases(input.useCases);
  const intent = normalizeText(input.intent);
  const category = inferCategory(input, useCases, intent);
  const ownedDevice = normalizeOwnedDevice(input.ownedDevice) ?? null;
  const ownedDeviceMatch = findOwnedDevice(ownedDevice);
  const maxResults = clampNumber(input.maxResults ?? MAX_RECOMMENDATIONS, 1, MAX_RECOMMENDATIONS);

  const candidatePool = normalizeCandidateMetrics(getCandidatePool(category, ownedDeviceMatch));
  const scoredCandidates = scoreCandidates(candidatePool, input, useCases, intent, budget);
  const candidateShortlist = [...scoredCandidates]
    .sort((left, right) => right.totalScore - left.totalScore)
    .slice(0, MAX_SHORTLIST);

  return {
    input,
    category,
    budget,
    useCases,
    intent,
    ownedDevice,
    candidatePool: scoredCandidates,
    candidateShortlist,
    maxResults,
  };
}

export function buildDeviceAdvisorPrompt(input: DeviceAdvisorInput): string {
  const context = buildContext(input);
  const payload = {
    userProfile: summarizeInput(input, context.category, context.budget, context.useCases, context.intent, context.ownedDevice),
    candidateShortlist: context.candidateShortlist.slice(0, MAX_SHORTLIST).map(buildPromptCandidateSnapshot),
  };

  return [
    "你是数码观察站 DeviceScope 的 Apple 设备顾问。",
    "你只能基于我提供的候选设备和用户偏好做推荐，不允许编造未提供的机型、价格、规格或结论。",
    "请优先考虑预算、设备类别、性能偏好、使用场景、续航/便携/屏幕/存储偏好，以及已有设备或替换意图。",
    "如果信息不足，请在理由中明确指出，不要假装很确定。",
    "只从候选设备列表中选择推荐项和替代项，不要输出候选列表之外的机型。",
    "输出必须是纯 JSON 对象，不要使用 markdown 代码块，不要输出额外说明。",
    "输出字段必须且只能包含：summary、recommendations、tradeoffs、suitableFor、notSuitableFor、alternatives、confidence、source、disclaimer。",
    '其中 source 必须固定为 "ai"，disclaimer 必须为 "基于已收录设备数据生成，仅供参考"。',
    "recommendations 和 alternatives 都必须是数组，每个项目必须包含 deviceId、model、series、category、releaseYear、priceText、matchScore、reasons、tradeoffs、suitableFor、notSuitableFor。",
    "matchScore 必须是 0 到 1 之间的小数，越高表示越匹配。",
    "reasons、tradeoffs、suitableFor、notSuitableFor 都必须是字符串数组，且尽量精炼。",
    "",
    "输入数据：",
    JSON.stringify(payload, null, 2),
    "",
    "请直接返回 JSON。",
  ].join("\n");
}

export function runFallbackDeviceAdvisor(input: DeviceAdvisorInput): DeviceAdvisorOutput {
  const context = buildContext(input);
  const recommendations = context.candidateShortlist.slice(0, context.maxResults).map((candidate) =>
    toRecommendation(candidate, input, context.useCases, context.intent),
  );
  const alternatives = context.candidateShortlist.slice(context.maxResults, context.maxResults + MAX_ALTERNATIVES).map((candidate) =>
    toRecommendation(candidate, input, context.useCases, context.intent),
  );
  const topLists = buildTopLevelLists(recommendations);

  return {
    summary: summarizeRecommendations(recommendations, input, context.category, context.budget, context.intent),
    recommendations,
    tradeoffs: topLists.tradeoffs,
    suitableFor: topLists.suitableFor,
    notSuitableFor: topLists.notSuitableFor,
    alternatives,
    confidence: buildConfidence(recommendations, input, context.candidateShortlist),
    source: "rules",
    disclaimer: DEFAULT_DISCLAIMER,
  };
}

export function normalizeDeviceAdvisorInput(value: unknown): DeviceAdvisorInput | null {
  if (!isRecord(value)) return null;

  const category = normalizeCategory(value.category);
  const budget = normalizeBudget(value.budget);
  const intent = normalizeOptionalText(value.intent);
  const performancePreference = normalizePerformancePreference(value.performancePreference);
  const useCases = normalizeUseCases(value.useCases);
  const preferences = isRecord(value.preferences)
    ? {
        battery: normalizePreferenceLevel(value.preferences.battery),
        portability: normalizePreferenceLevel(value.preferences.portability),
        screen: normalizePreferenceLevel(value.preferences.screen),
        storage: normalizePreferenceLevel(value.preferences.storage),
        camera: normalizePreferenceLevel(value.preferences.camera),
      }
    : undefined;
  const ownedDevice = normalizeOwnedDevice(value.ownedDevice);
  const replacementIntent = value.replacementIntent === "upgrade" || value.replacementIntent === "replace" || value.replacementIntent === "first_device"
    ? value.replacementIntent
    : undefined;
  const maxResults = normalizeNumber(value.maxResults);

  if (!category && !budget && !intent && !useCases.length && !preferences && !ownedDevice && !replacementIntent && maxResults === undefined) {
    return null;
  }

  return {
    category,
    budget,
    intent,
    performancePreference,
    useCases,
    preferences,
    ownedDevice,
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
