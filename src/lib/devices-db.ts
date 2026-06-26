// ==================== 新数据库模块 ====================
// 从 apple-devices-db.json 加载数据，提供查询和展平函数

import db from "@/data/apple-devices-db.json";

// ==================== 类型定义 ====================

export type DeviceCategory = "phone" | "tablet" | "laptop";

// SpecField 带元数据的规格字段
export type SpecField<T> = {
  value: T;
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
  [key: string]: SpecField<unknown> | undefined;
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
  modelName: string;
  generation: string;
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

export const categoryNames = Array.from(
  new Set(allDevices.map((d) => d.category)),
) as DeviceCategory[];

export const seriesNames = Array.from(new Set(allDevices.map((d) => d.series)));

export const getSeriesByCategory = (category: DeviceCategory) =>
  Array.from(
    new Set(
      allDevices.filter((d) => d.category === category).map((d) => d.series),
    ),
  );

export const getDevicesBySeries = (series: string) =>
  allDevices
    .filter((d) => d.series === series)
    .sort((a, b) => a.releaseYear - b.releaseYear);

// ==================== SpecField 展平工具 ====================

// 从 SpecField 中取值，不存在时返回 undefined
export function specVal<T>(field: SpecField<T> | undefined): T | undefined {
  return field?.value;
}

// 从 SpecField 中取值，转为字符串显示
export function specStr(field: SpecField<unknown> | undefined, fallback = "待补充"): string {
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
