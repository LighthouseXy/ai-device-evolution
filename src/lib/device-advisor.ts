// 设备顾问公共门面：
// 外部 API、组件和脚本仍统一从 "@/lib/device-advisor" 引入；
// 内部实现按职责拆到 types / normalize / rules，避免一个文件同时承载类型、评分、schema 和 prompt。
export type {
  DeviceAdvisorBudget,
  DeviceAdvisorCategory,
  DeviceAdvisorInput,
  DeviceAdvisorOutput,
  DeviceAdvisorPerformancePreference,
  DeviceAdvisorRecommendation,
} from "@/lib/device-advisor-types";

export {
  deviceAdvisorOutputSchema,
  normalizeDeviceAdvisorInput,
  normalizeDeviceAdvisorOutput,
} from "@/lib/device-advisor-normalize";

export {
  buildDeviceAdvisorPrompt,
  runFallbackDeviceAdvisor,
} from "@/lib/device-advisor-rules";
