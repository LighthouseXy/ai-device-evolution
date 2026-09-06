// ==================== 新数据库模块 ====================
// 从统一设备数据库加载多品牌数据，统一提供：
// 1. 带来源元数据的原始 DbDevice 查询；
// 2. 面向旧页面/AI 分析输入的扁平 FlattenedDevice 适配层。

import db from "@/data/devices-db.json";
import priceObservationData from "@/data/price-observations.json";

// ==================== 类型定义 ====================

export type DeviceCategory = "phone" | "tablet" | "laptop";
export type SpecSourceType = "official" | "reference";

// SpecField 带元数据的规格字段
export type SpecField<T> = {
  value: T | null;
  unit?: string | null;
  rawText?: string | null;
  sourceUrl: string;
  sourceType: SpecSourceType;
  confidence: number;
  verifiedAt: string;
};

export type PriceField = SpecField<number> & {
  priceType?: "launch" | "current" | "used";
  market?: string;
  configuration?: string;
  condition?: string;
  observedAt?: string;
  sourceName?: string;
};

type StoredPriceObservation = {
  value: number;
  sourceUrl: string;
  sourceName: string;
  rawText: string;
  configuration: string;
  condition: string;
  observedAt: string;
  sourceType?: SpecSourceType;
};

const priceObservations = priceObservationData as {
  current: Record<string, StoredPriceObservation | StoredPriceObservation[]>;
  used: Record<string, StoredPriceObservation | StoredPriceObservation[]>;
};

export function getDevicePriceFields(
  deviceId: string,
  priceType: "current" | "used",
  fallback: PriceField | undefined,
) {
  const stored = priceObservations[priceType][deviceId];
  if (!stored) return fallback ? [fallback] : [];

  return (Array.isArray(stored) ? stored : [stored]).map((observation): PriceField => ({
    ...observation,
    unit: "CNY",
    sourceType: observation.sourceType ?? "reference",
    confidence: observation.sourceType === "official" ? 1 : 0.7,
    verifiedAt: observation.observedAt,
    priceType,
    market: "中国大陆",
  }));
}

// ComputedField 计算字段
export type ComputedField = {
  value: number | null;
  scoreBreakdown: string;
  comparedTo?: string | null;
  changeSummary?: string | null;
  confidence: number;
  computedAt: string;
  sourceType: "computed";
  verifiedAt: string;
};

export type DeviceConfiguration = {
  memory: string;
  storage: string;
};

export type DeviceBenchmark = {
  provider: string;
  metric: string;
  score: number;
  protocolVersion: string;
  sourceUrl: string;
  verifiedAt: string;
};

// 设备 specs 中的字段集合（部分，按需扩展）
export type DeviceSpecs = {
  chip?: SpecField<string>;
  screenSize?: SpecField<number>;
  displayType?: SpecField<string>;
  resolution?: SpecField<string>;
  refreshRate?: SpecField<number>;
  weight?: SpecField<number>;
  dimensions?: SpecField<string>;
  colors?: SpecField<string[]>;
  material?: SpecField<string>;
  storage?: SpecField<string>;
  memory?: SpecField<string>;
  cpu?: SpecField<string>;
  gpu?: SpecField<string>;
  neuralEngine?: SpecField<string>;
  rearCamera?: SpecField<string>;
  mainCamera?: SpecField<string>;
  ultraWide?: SpecField<string>;
  telephoto?: SpecField<string>;
  opticalZoom?: SpecField<string>;
  frontCamera?: SpecField<string>;
  videoRecording?: SpecField<string>;
  videoPlayback?: SpecField<string>;
  batteryLife?: SpecField<string>;
  port?: SpecField<string>;
  chargingMethod?: SpecField<string>;
  security?: SpecField<string>;
  waterResistance?: SpecField<string>;
  wifi?: SpecField<string>;
  bluetooth?: SpecField<string>;
  sim?: SpecField<string>;
  speakers?: SpecField<string>;
  microphone?: SpecField<string>;
  pencilSupport?: SpecField<string>;
  webcam?: SpecField<string>;
  keyboard?: SpecField<string>;
  trackpad?: SpecField<string>;
  thunderbolt?: SpecField<string>;
  usbC?: SpecField<string>;
  powerAdapter?: SpecField<string>;
  externalDisplay?: SpecField<string>;
  hasMagSafe?: SpecField<boolean>;
  hasNFC?: SpecField<boolean>;
  hasSOS?: SpecField<boolean>;
  hasCrashDetection?: SpecField<boolean>;
  hasUWB?: SpecField<boolean>;
  hasTouchId?: SpecField<boolean>;
  hasHDMI?: SpecField<boolean>;
  hasSDXC?: SpecField<boolean>;
  magicKeyboard?: SpecField<boolean>;
  peakBrightness?: SpecField<number>;
  thickness?: SpecField<number>;
  wirelessWebBrowsing?: SpecField<string>;
  launchPrice?: PriceField;
  currentPrice?: PriceField;
  usedPrice?: PriceField;
};

// 设备 computed 字段集合
export type DeviceComputed = {
  aiCapabilityLevel?: ComputedField;
  generationUpgradeMagnitude?: ComputedField;
  recommendationLevel?: ComputedField;
};

// 统一设备结构
export type DbDevice = {
  id: string;
  brand: string;
  market: string;
  category: DeviceCategory;
  series: string;
  family: string;
  variant: string;
  tier?: string;
  modelName: string;
  generation: string;
  generationOrder: number;
  releaseYear: number;
  releaseDate?: string | null;
  comparisonGroupId: string;
  configurations?: DeviceConfiguration[];
  benchmarks?: DeviceBenchmark[];
  specs: DeviceSpecs;
  computed: DeviceComputed;
};

// ==================== 数据加载 ====================

export const allDevices: DbDevice[] = db.devices as DbDevice[];

// ==================== 分类和系列查询 ====================

export const categoryLabels: Record<DeviceCategory, string> = {
  phone: "手机",
  tablet: "平板电脑",
  laptop: "笔记本电脑",
};

export const categoryNames = Array.from(new Set(allDevices.map((d) => d.category))) as DeviceCategory[];

export const seriesNames = Array.from(new Set(allDevices.map((d) => d.series)));

const seriesByCategory = new Map<DeviceCategory, string[]>(
  categoryNames.map((category) => [
    category,
    Array.from(new Set(allDevices.filter((d) => d.category === category).map((d) => d.series))),
  ]),
);

const devicesBySeries = new Map<string, DbDevice[]>(
  seriesNames.map((series) => [
    series,
    allDevices
      .filter((device) => device.series === series)
      .sort((left, right) => left.releaseYear - right.releaseYear),
  ]),
);

export const getSeriesByCategory = (category: DeviceCategory) => seriesByCategory.get(category) ?? [];

export const getDevicesBySeries = (series: string) => devicesBySeries.get(series) ?? [];

// ==================== SpecField 展平工具 ====================

// 从 SpecField 中取值，不存在时返回 undefined
export function specVal<T>(field: SpecField<T> | undefined): T | undefined {
  return field?.value ?? undefined;
}

// 数据适配层只返回真实值或空串；“待补充”等提示由具体 UI/AI 边界决定，避免占位文案混入数据。
export function specStr(field: SpecField<unknown> | undefined, fallback = ""): string {
  if (!field) return fallback;
  const v = field.value;
  if (v === null || v === undefined) return fallback;
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

// 从 SpecField 中取数值，不存在时返回 undefined
export function specNum(field: SpecField<number> | undefined): number | undefined {
  return field?.value ?? undefined;
}

export function parseCameraMegapixels(value: string): number | undefined {
  const mp = value.match(/(\d+(?:\.\d+)?)\s*MP/i);
  if (mp) return Number(mp[1]);

  const chinese = value.match(/(\d+(?:\.\d+)?)\s*万像素/);
  return chinese ? Number(chinese[1]) / 100 : undefined;
}

// 从 ComputedField 中取值
export function computedVal(field: ComputedField | undefined): number | undefined {
  return field?.value ?? undefined;
}

// 格式化价格
export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0,
  }).format(value);

export const formatCompactCurrency = (value: number) =>
  new Intl.NumberFormat("zh-CN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

export const formatMaybeCurrency = (value?: number) =>
  typeof value === "number" ? formatCurrency(value) : "待补充";

// ==================== 统计数据 ====================

export const summaryStats = {
  modelCount: allDevices.length,
  brandCount: new Set(allDevices.map((d) => d.brand)).size,
  categoryCount: categoryNames.length,
  seriesCount: seriesNames.length,
  startYear: Math.min(...allDevices.map((d) => d.releaseYear)),
  endYear: Math.max(...allDevices.map((d) => d.releaseYear)),
};

// ==================== 向后兼容适配层 ====================
// 将 DbDevice 展平为旧版 Device 形状，供 AI 观察接口和页面组件复用。
// 注意：这里是“展示/分析适配”，不要把扁平字段反写回源数据库，否则会丢失 sourceUrl、confidence 等来源信息。

export type FlattenedDevice = {
  id: string;
  brand: string;
  market: string;
  category: DeviceCategory;
  series: string;
  family: string;
  variant: string;
  tier?: string;
  model: string;
  generation: string;
  generationOrder: number;
  releaseYear: number;
  releaseDate?: string | null;
  comparisonGroupId: string;
  configurations?: DeviceConfiguration[];
  benchmarks?: DeviceBenchmark[];
  chip: string;
  screenSize?: number;
  refreshRate?: number;
  mainCameraMp?: number;
  telephoto?: string;
  port?: string;
  weight?: number;
  launchPrice?: number;
  currentPrice?: PriceField;
  usedPrice?: PriceField;
  currentPrices?: PriceField[];
  usedPrices?: PriceField[];
  aiFeatureLevel?: number;
  sourceUrl: string;
  specs?: Record<string, string | number | boolean | undefined>;
};

/** 将 DbDevice 转为旧版扁平 Device 形状 */
export function flattenDevice(db: DbDevice): FlattenedDevice {
  // specs 展平只保留可直接展示的基础类型；数组转字符串，复杂对象保留在原始 DbDevice 中。
  const flatSpecs: Record<string, string | number | boolean | undefined> = {};
  const s = db.specs;
  for (const key of Object.keys(s)) {
    const field = (s as Record<string, { value: unknown } | undefined>)[key];
    if (field && typeof field === "object" && "value" in field) {
      const v = field.value;
      if (Array.isArray(v)) flatSpecs[key] = v.join(", ");
      else if (typeof v === "string" || typeof v === "number" || typeof v === "boolean")
        flatSpecs[key] = v;
    }
  }

  // 解析 mainCameraMp
  const mainCam = specStr(db.specs?.mainCamera, "") || specStr(db.specs?.rearCamera, "");
  const mainCameraMp = parseCameraMegapixels(mainCam);

  return {
    id: db.id,
    brand: db.brand,
    market: db.market,
    category: db.category,
    series: db.series,
    family: db.family,
    variant: db.variant,
    tier: db.tier,
    model: db.modelName,
    generation: db.generation,
    generationOrder: db.generationOrder,
    releaseYear: db.releaseYear,
    releaseDate: db.releaseDate,
    comparisonGroupId: db.comparisonGroupId,
    configurations: db.configurations,
    benchmarks: db.benchmarks,
    chip: specStr(db.specs?.chip),
    screenSize: specNum(db.specs?.screenSize) ?? undefined,
    refreshRate: specNum(db.specs?.refreshRate),
    mainCameraMp,
    telephoto: specStr(db.specs?.telephoto) || undefined,
    port: specStr(db.specs?.port) || undefined,
    weight: specNum(db.specs?.weight),
    launchPrice: specNum(db.specs?.launchPrice),
    currentPrice: db.specs?.currentPrice,
    usedPrice: db.specs?.usedPrice,
    currentPrices: getDevicePriceFields(db.id, "current", db.specs?.currentPrice),
    usedPrices: getDevicePriceFields(db.id, "used", db.specs?.usedPrice),
    aiFeatureLevel: computedVal(db.computed?.aiCapabilityLevel),
    sourceUrl: db.specs?.chip?.sourceUrl ?? "",
    specs: flatSpecs,
  };
}

/** 预展平的全部设备列表 */
export const allDevicesFlat: FlattenedDevice[] = allDevices.map(flattenDevice);

const devicesBySeriesFlat = new Map<string, FlattenedDevice[]>(
  seriesNames.map((series) => [
    series,
    allDevicesFlat
      .filter((device) => device.series === series)
      .sort(
        (left, right) =>
          left.releaseYear - right.releaseYear || left.generationOrder - right.generationOrder,
      ),
  ]),
);

export const getComparisonGroupKey = (family: string, variant: string, tier?: string) =>
  [family, variant, tier].filter(Boolean).join("::");

const devicesByComparisonGroupFlat = new Map<string, FlattenedDevice[]>();
const legacyComparisonGroupAliases = new Map<string, string>();
for (const device of allDevicesFlat) {
  const key = device.comparisonGroupId;
  const group = devicesByComparisonGroupFlat.get(key) ?? [];
  group.push(device);
  devicesByComparisonGroupFlat.set(key, group);
  const legacyKey = getComparisonGroupKey(device.family, device.variant, device.tier);
  if (!legacyComparisonGroupAliases.has(legacyKey)) {
    legacyComparisonGroupAliases.set(legacyKey, device.comparisonGroupId);
  }
}
for (const group of devicesByComparisonGroupFlat.values()) {
  group.sort((left, right) => left.generationOrder - right.generationOrder);
}

const tieredComparisonGroups = new Set(
  allDevicesFlat
    .filter((device) =>
      allDevicesFlat.some(
        (other) =>
          other.family === device.family &&
          other.variant === device.variant &&
          other.tier !== device.tier,
      ),
    )
    .map((device) => `${device.family}::${device.variant}`),
);

/** 生成面向用户的比较组名称；芯片档位只作为必要的附加维度，不混入产品族。 */
export function getComparisonGroupLabelFlat(family: string, variant: string, tier?: string) {
  const displayVariant = variant.replace(/^(\d+(?:\.\d+)?)-inch$/, "$1 英寸");
  const baseLabel = variant === "standard" ? family : `${family} ${displayVariant}`;
  if (!tieredComparisonGroups.has(`${family}::${variant}`)) return baseLabel;
  const tierLabel = tier === "pro" ? "Pro 芯片" : tier === "max" ? "Max 芯片" : "标准芯片";
  return `${baseLabel} · ${tierLabel}`;
}

export const comparisonGroupsFlat = Array.from(devicesByComparisonGroupFlat, ([key, devices]) => {
  const first = devices[0];
  return {
    key,
    category: first.category,
    family: first.family,
    variant: first.variant,
    tier: first.tier,
    label: getComparisonGroupLabelFlat(first.family, first.variant, first.tier),
    devices,
  };
});

const seriesByCategoryFlat = new Map<DeviceCategory, string[]>(
  categoryNames.map((category) => [
    category,
    Array.from(new Set(allDevicesFlat.filter((device) => device.category === category).map((device) => device.series))),
  ]),
);

export const deviceCountByCategory = Object.fromEntries(
  categoryNames.map((category) => [
    category,
    allDevicesFlat.filter((device) => device.category === category).length,
  ]),
) as Record<DeviceCategory, number>;

/** 展平版 summaryStats */
export const summaryStatsFlat = {
  ...summaryStats,
  modelCount: allDevicesFlat.length,
};

/** 展平版 getDevicesBySeries */
export const getDevicesBySeriesFlat = (series: string) => devicesBySeriesFlat.get(series) ?? [];

/** 严格同型号比较：产品族、款式和必要的芯片档位必须同时匹配。 */
export const getDevicesByComparisonGroupFlat = (family: string, variant: string, tier?: string) =>
  getDevicesByComparisonGroupKeyFlat(getComparisonGroupKey(family, variant, tier));

export const getDevicesByComparisonGroupKeyFlat = (key: string) =>
  devicesByComparisonGroupFlat.get(key) ??
  devicesByComparisonGroupFlat.get(legacyComparisonGroupAliases.get(key) ?? "") ??
  [];

export const getComparisonGroupsByCategoryFlat = (category: DeviceCategory) =>
  comparisonGroupsFlat.filter((group) => group.category === category);

/** 展平版 getSeriesByCategory */
export const getSeriesByCategoryFlat = (category: DeviceCategory) => seriesByCategoryFlat.get(category) ?? [];

// Device 类型别名，方便旧代码迁移
export type Device = FlattenedDevice;
