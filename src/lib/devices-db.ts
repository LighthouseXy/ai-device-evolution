// ==================== 新数据库模块 ====================
// 从 apple-devices-db.json 加载第一阶段 Apple 样本数据，统一提供：
// 1. 带来源元数据的原始 DbDevice 查询；
// 2. 面向旧页面/AI 分析输入的扁平 FlattenedDevice 适配层。

import db from "@/data/apple-devices-db.json";

// ==================== 类型定义 ====================

export type DeviceCategory = "phone" | "tablet" | "laptop";

// SpecField 带元数据的规格字段
export type SpecField<T> = {
  value: T | null;
  unit?: string | null;
  rawText?: string | null;
  sourceUrl: string;
  sourceType: string;
  confidence: number;
  verifiedAt: string;
};

// ComputedField 计算字段
export type ComputedField = {
  value: number | null;
  scoreBreakdown: string;
  comparedTo?: string | null;
  changeSummary?: string | null;
  confidence: number;
  computedAt: string;
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
  hasSpatialAudio?: SpecField<boolean>;
  secureEnclave?: SpecField<boolean>;
  magicKeyboard?: SpecField<boolean>;
  displayCoating?: SpecField<string>;
  peakBrightness?: SpecField<number>;
  thickness?: SpecField<number>;
  fastCharge?: SpecField<string>;
  wirelessWebBrowsing?: SpecField<string>;
  launchPrice?: SpecField<number>;
  currentPrice?: SpecField<number>;
  usedPrice?: SpecField<number>;
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
  category: DeviceCategory;
  series: string;
  family: string;
  variant: string;
  modelName: string;
  generation: string;
  generationOrder: number;
  releaseYear: number;
  specs: DeviceSpecs;
  computed: DeviceComputed;
};

// ==================== 数据加载 ====================

export const allDevices: DbDevice[] = db.devices as DbDevice[];

// ==================== 分类和系列查询 ====================

export const categoryLabels: Record<DeviceCategory, string> = {
  phone: "iPhone",
  tablet: "iPad",
  laptop: "MacBook",
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
  categoryCount: categoryNames.length,
  seriesCount: seriesNames.length,
  startYear: Math.min(...allDevices.map((d) => d.releaseYear)),
  endYear: Math.max(...allDevices.map((d) => d.releaseYear)),
  fieldsTracked: 45,
};

// ==================== 向后兼容适配层 ====================
// 将 DbDevice 展平为旧版 Device 形状，供 AI 观察接口和页面组件复用。
// 注意：这里是“展示/分析适配”，不要把扁平字段反写回源数据库，否则会丢失 sourceUrl、confidence 等来源信息。

export type FlattenedDevice = {
  id: string;
  brand: string;
  category: DeviceCategory;
  series: string;
  family: string;
  variant: string;
  tier?: string;
  model: string;
  generation: string;
  generationOrder: number;
  releaseYear: number;
  chip: string;
  screenSize?: number;
  refreshRate?: number;
  mainCameraMp?: number;
  telephoto?: string;
  port?: string;
  weight?: number;
  launchPrice?: number;
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
  const mpMatch = mainCam.match(/(\d+)MP/);
  const mainCameraMp = mpMatch ? parseInt(mpMatch[1]) : undefined;

  return {
    id: db.id,
    brand: db.brand,
    category: db.category,
    series: db.series,
    family: db.family,
    variant: db.variant,
    model: db.modelName,
    generation: db.generation,
    generationOrder: db.generationOrder,
    releaseYear: db.releaseYear,
    chip: specStr(db.specs?.chip),
    screenSize: specNum(db.specs?.screenSize) ?? undefined,
    refreshRate: specNum(db.specs?.refreshRate),
    mainCameraMp,
    telephoto: specStr(db.specs?.telephoto) || undefined,
    port: specStr(db.specs?.port) || undefined,
    weight: specNum(db.specs?.weight),
    launchPrice: specNum(db.specs?.launchPrice),
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

export const getComparisonGroupKey = (family: string, variant: string) => `${family}::${variant}`;

const devicesByComparisonGroupFlat = new Map<string, FlattenedDevice[]>();
for (const device of allDevicesFlat) {
  const key = getComparisonGroupKey(device.family, device.variant);
  const group = devicesByComparisonGroupFlat.get(key) ?? [];
  group.push(device);
  devicesByComparisonGroupFlat.set(key, group);
}
for (const group of devicesByComparisonGroupFlat.values()) {
  group.sort((left, right) => left.generationOrder - right.generationOrder);
}

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

/** 严格同型号比较：产品族和款式必须同时匹配。 */
export const getDevicesByComparisonGroupFlat = (family: string, variant: string) =>
  devicesByComparisonGroupFlat.get(getComparisonGroupKey(family, variant)) ?? [];

/** 展平版 getSeriesByCategory */
export const getSeriesByCategoryFlat = (category: DeviceCategory) => seriesByCategoryFlat.get(category) ?? [];

// Device 类型别名，方便旧代码迁移
export type Device = FlattenedDevice;
