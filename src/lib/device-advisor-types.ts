import type { DeviceCategory } from "@/lib/devices-db";

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

export type Candidate = {
  deviceId: string;
  model: string;
  series: string;
  category: DeviceCategory;
  releaseYear: number;
  referencePrice: number | null;
  priceText: string;
  facts: Record<string, string | number>;
};

export const DEFAULT_DEVICE_ADVISOR_DISCLAIMER = "基于已收录设备数据生成，仅供参考";
export const RULES_DEVICE_ADVISOR_DISCLAIMER = "AI 不可用，当前仅按设备类型、预算和发布时间排序，仅供参考";
export const MAX_SHORTLIST = 8;
export const MAX_RECOMMENDATIONS = 3;
export const MAX_ALTERNATIVES = 3;

export const CATEGORY_KEYWORDS: Record<Exclude<DeviceAdvisorCategory, "all">, string[]> = {
  phone: ["手机", "iphone", "拍照", "通勤", "随身", "移动"],
  tablet: ["平板", "ipad", "手写", "阅读", "追剧", "笔记", "pencil"],
  laptop: ["电脑", "macbook", "办公", "开发", "编程", "出差", "创作"],
};

export const PERFORMANCE_KEYWORDS = ["性能", "游戏", "剪辑", "ai", "多任务", "重度"];
export const BATTERY_KEYWORDS = ["续航", "电池", "长续航", "外出", "通勤", "全天"];
export const PORTABLE_KEYWORDS = ["便携", "轻薄", "轻便", "随身", "通勤", "出差"];
export const SCREEN_KEYWORDS = ["屏幕", "追剧", "阅读", "观影", "大屏", "分屏"];
export const STORAGE_KEYWORDS = ["存储", "容量", "素材", "照片", "视频", "文件"];
export const CAMERA_KEYWORDS = ["拍照", "摄影", "视频", "vlog", "相机"];
