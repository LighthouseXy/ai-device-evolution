// AI 观察模块统一入口：外部继续从 "@/lib/ai-analysis" 导入，内部按职责拆分。
export type {
  AiAnalysisInput,
  AiAnalysisOutput,
  AnalysisType,
  ChangedField,
} from "@/lib/ai-analysis-types";

export {
  normalizeAiAnalysisOutput,
  normalizeAnalysisInput,
  normalizeChangedFields,
} from "@/lib/ai-analysis-normalize";

export {
  buildAnalysisPrompt,
  runFallbackAnalysis,
} from "@/lib/ai-analysis-rules";
