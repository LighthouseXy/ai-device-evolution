import type { DeviceCategory, FlattenedDevice } from "@/lib/devices-db";

export type AnalysisType =
  | "generation_summary"
  | "trend_prediction"
  | "buying_advice"
  | "comparison_explanation";

export type ChangedField = {
  label: string;
  currentValue: string;
  previousValue: string;
};

export type AiAnalysisInput = {
  /** 系列名称，如 "iPhone"、"iPhone Pro" */
  seriesName: string;
  /** 产品类别 */
  category: DeviceCategory;
  /** 分析类型，默认 generation_summary */
  analysisType?: AnalysisType;
  /** 当前分析维度标签，如 "芯片与智能" */
  categoryLabel: string;
  /** 当前系列全部设备（按代际升序） */
  devices: FlattenedDevice[];
  /** 最新一代设备 */
  latestDevice: FlattenedDevice | null;
  /** 上一代设备 */
  previousDevice: FlattenedDevice | null;
  /** 最近两代之间的变化字段列表 */
  changedFields: ChangedField[];
};

export type AiAnalysisOutput = {
  summary: string;
  facts: string[];
  insights: string[];
  buyingAdvice: string;
  prediction: string;
  missingData: string[];
  confidence: number;
  /** "ai" = 真实 API，"rules" = 本地规则 fallback */
  source: "ai" | "rules";
  disclaimer: string;
  /** 兼容旧前端/旧消费方，后续可移除 */
  upgradeHighlights?: string[];
};

export const MAX_DEVICES_IN_PROMPT = 12;
export const MAX_HIGHLIGHTS = 3;
export const AI_ANALYSIS_DISCLAIMER = "基于已收录数据生成，仅供参考";

export const ANALYSIS_TYPE_SET = new Set<AnalysisType>([
  "generation_summary",
  "trend_prediction",
  "buying_advice",
  "comparison_explanation",
]);
