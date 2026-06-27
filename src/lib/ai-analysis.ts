// ==================== AI 分析模块 ====================
// 类型定义、Prompt 构造、Fallback 规则分析与运行时校验

import type { DeviceCategory, FlattenedDevice } from "@/lib/devices-db";

// ---- 入参类型 ----

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
  /** 当前分析维度标签，如 "⚡ 芯片与智能" */
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

// ---- 出参类型 ----

export type AiAnalysisOutput = {
  summary: string;
  facts: string[];
  insights: string[];
  buyingAdvice: string;
  prediction: string;
  missingData: string[];
  confidence: number;
  /** "ai" = 真实 API，"rules" = 前端规则 fallback */
  source: "ai" | "rules";
  disclaimer: string;
  /** 兼容旧前端/旧消费方，后续可移除 */
  upgradeHighlights?: string[];
};

// ---- 运行时校验 / 规范化 ----

const DEVICE_CATEGORY_SET = new Set<DeviceCategory>(["phone", "tablet", "laptop"]);
const ANALYSIS_TYPE_SET = new Set<AnalysisType>([
  "generation_summary",
  "trend_prediction",
  "buying_advice",
  "comparison_explanation",
]);
const MAX_DEVICES_IN_PROMPT = 12;
const MAX_HIGHLIGHTS = 3;

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

function normalizeDeviceCategory(value: unknown): DeviceCategory | null {
  return typeof value === "string" && DEVICE_CATEGORY_SET.has(value as DeviceCategory)
    ? (value as DeviceCategory)
    : null;
}

function normalizeAnalysisType(value: unknown): AnalysisType {
  return typeof value === "string" && ANALYSIS_TYPE_SET.has(value as AnalysisType)
    ? (value as AnalysisType)
    : "generation_summary";
}

function normalizeChangedField(value: unknown): ChangedField | null {
  if (!isRecord(value)) return null;

  const label = normalizeText(value.label);
  const currentValue = normalizeText(value.currentValue);
  const previousValue = normalizeText(value.previousValue);

  if (!label || !currentValue || !previousValue) return null;

  return {
    label,
    currentValue,
    previousValue,
  };
}

export function normalizeChangedFields(value: unknown): ChangedField[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => normalizeChangedField(item))
    .filter((item): item is ChangedField => item !== null)
    .slice(0, 6);
}

function normalizeFlattenedDevice(value: unknown, fallbackCategory?: DeviceCategory): FlattenedDevice | null {
  if (!isRecord(value)) return null;

  const category = normalizeDeviceCategory(value.category) ?? fallbackCategory;
  const model = normalizeText(value.model);
  const series = normalizeText(value.series);
  const brand = normalizeText(value.brand, "Apple");
  const id = normalizeText(value.id, `${series || "device"}-${model || "model"}`);
  const generation = normalizeNumber(value.generation) ?? normalizeNumber(value.releaseYear);
  const releaseYear = normalizeNumber(value.releaseYear);

  if (!category || !model || !series || generation === undefined || releaseYear === undefined) {
    return null;
  }

  return {
    id,
    brand,
    category,
    series,
    tier: normalizeOptionalText(value.tier),
    model,
    generation,
    releaseYear,
    chip: normalizeText(value.chip, "当前数据不足"),
    screenSize: normalizeNumber(value.screenSize),
    refreshRate: normalizeNumber(value.refreshRate),
    mainCameraMp: normalizeNumber(value.mainCameraMp),
    telephoto: normalizeOptionalText(value.telephoto),
    port: normalizeOptionalText(value.port),
    weight: normalizeNumber(value.weight),
    launchPrice: normalizeNumber(value.launchPrice),
    aiFeatureLevel: normalizeNumber(value.aiFeatureLevel),
    sourceUrl: normalizeOptionalText(value.sourceUrl) ?? "",
    specs: isRecord(value.specs) ? (value.specs as Record<string, string | number | boolean | undefined>) : undefined,
  };
}

export function normalizeAnalysisInput(value: unknown): AiAnalysisInput | null {
  if (!isRecord(value)) return null;

  const seriesName = normalizeText(value.seriesName);
  const category = normalizeDeviceCategory(value.category);
  const analysisType = normalizeAnalysisType(value.analysisType);
  const categoryLabel = normalizeText(value.categoryLabel);
  const devices = Array.isArray(value.devices)
    ? value.devices
        .map((item) => normalizeFlattenedDevice(item, category ?? undefined))
        .filter((item): item is FlattenedDevice => item !== null)
    : [];

  if (!seriesName || !category || !categoryLabel || devices.length === 0) {
    return null;
  }

  const latestDevice = normalizeFlattenedDevice(value.latestDevice, category);
  const previousDevice = normalizeFlattenedDevice(value.previousDevice, category);
  const changedFields = normalizeChangedFields(value.changedFields);

  return {
    seriesName,
    category,
    analysisType,
    categoryLabel,
    devices,
    latestDevice,
    previousDevice,
    changedFields,
  };
}

// ---- Prompt 构造 ----

type PromptDevice = Pick<
  FlattenedDevice,
  | "id"
  | "brand"
  | "category"
  | "series"
  | "tier"
  | "model"
  | "generation"
  | "releaseYear"
  | "chip"
  | "screenSize"
  | "refreshRate"
  | "mainCameraMp"
  | "telephoto"
  | "port"
  | "weight"
  | "launchPrice"
  | "aiFeatureLevel"
  | "sourceUrl"
>;

function compactDevice(device: FlattenedDevice | null): PromptDevice | null {
  if (!device) return null;

  return {
    id: device.id,
    brand: device.brand,
    category: device.category,
    series: device.series,
    tier: device.tier,
    model: device.model,
    generation: device.generation,
    releaseYear: device.releaseYear,
    chip: device.chip,
    screenSize: device.screenSize,
    refreshRate: device.refreshRate,
    mainCameraMp: device.mainCameraMp,
    telephoto: device.telephoto,
    port: device.port,
    weight: device.weight,
    launchPrice: device.launchPrice,
    aiFeatureLevel: device.aiFeatureLevel,
    sourceUrl: device.sourceUrl,
  };
}

function compactDevices(devices: FlattenedDevice[]): PromptDevice[] {
  return devices.slice(-MAX_DEVICES_IN_PROMPT).map((device) => compactDevice(device) as PromptDevice);
}

function predictNextChipName(chip: string): string | null {
  const normalized = chip.trim().replace(/\s+/g, " ");
  if (!normalized) return null;

  const applePrefix = /^Apple\s+/i.test(normalized);
  const stripped = normalized.replace(/^Apple\s+/i, "");
  const canonical = stripped.match(/^([AM])(\d+)(?:\s+(Pro|Max|Ultra))?(?:\s+[A-Za-z0-9-]+.*)?$/i);
  if (!canonical) return null;

  const family = canonical[1].toUpperCase();
  const generation = Number.parseInt(canonical[2], 10);
  if (!Number.isFinite(generation)) return null;

  const suffix = canonical[3]
    ? ` ${canonical[3][0].toUpperCase()}${canonical[3].slice(1).toLowerCase()}`
    : "";

  const nextFamily = `${family}${generation + 1}`;
  return `${applePrefix ? "Apple " : ""}${nextFamily}${suffix}`;
}

function addUnique(list: string[], value?: string) {
  const text = normalizeText(value);
  if (text && !list.includes(text)) list.push(text);
}

function buildFacts(input: AiAnalysisInput): string[] {
  const facts: string[] = [];
  const analysisType = input.analysisType ?? "generation_summary";

  if (analysisType === "generation_summary" || analysisType === "comparison_explanation") {
    for (const field of input.changedFields.slice(0, MAX_HIGHLIGHTS)) {
      addUnique(facts, `${field.label}: ${field.previousValue} -> ${field.currentValue}`);
    }
  }

  if (analysisType === "trend_prediction") {
    const latest = input.latestDevice;
    const previous = input.previousDevice;
    addUnique(facts, latest ? `最新设备为 ${latest.model} (${latest.releaseYear})` : undefined);
    addUnique(facts, previous ? `上一代设备为 ${previous.model} (${previous.releaseYear})` : undefined);
    addUnique(
      facts,
      input.devices.length > 0
        ? `当前系列共有 ${input.devices.length} 个已收录机型`
        : undefined,
    );
    addUnique(facts, latest?.chip ? `最新芯片为 ${latest.chip}` : undefined);
    addUnique(
      facts,
      typeof latest?.aiFeatureLevel === "number" ? `最新 AI 能力等级为 ${latest.aiFeatureLevel}` : undefined,
    );
    addUnique(
      facts,
      typeof latest?.screenSize === "number" ? `最新屏幕尺寸为 ${latest.screenSize} 英寸` : undefined,
    );
    addUnique(
      facts,
      typeof latest?.launchPrice === "number" ? `最新首发价格为 ${latest.launchPrice}` : undefined,
    );
  }

  if (analysisType === "buying_advice") {
    addUnique(facts, input.latestDevice ? `最新设备为 ${input.latestDevice.model}` : undefined);
    addUnique(facts, input.previousDevice ? `上一代设备为 ${input.previousDevice.model}` : undefined);
    addUnique(facts, `已识别变化字段 ${input.changedFields.length} 项`);
    addUnique(
      facts,
      typeof input.latestDevice?.launchPrice === "number"
        ? `最新首发价格为 ${input.latestDevice.launchPrice}`
        : undefined,
    );
  }

  if (facts.length === 0) {
    addUnique(facts, `分析系列为 ${input.seriesName}`);
    addUnique(facts, `分析维度为 ${input.categoryLabel}`);
  }

  return facts.slice(0, MAX_HIGHLIGHTS);
}

function buildMissingData(input: AiAnalysisInput): string[] {
  const missing: string[] = [];
  const latest = input.latestDevice;
  const previous = input.previousDevice;

  if (!previous) addUnique(missing, "上一代设备数据不足");
  if (!latest) addUnique(missing, "最新设备数据不足");
  if (!input.changedFields.length) addUnique(missing, "当前缺少可对比的变化字段");

  if (input.analysisType === "trend_prediction" || input.analysisType === "buying_advice") {
    if (!input.devices.length) addUnique(missing, "历史设备序列不足");
    if (typeof latest?.launchPrice !== "number") addUnique(missing, "最新价格数据不足");
    if (typeof previous?.launchPrice !== "number") addUnique(missing, "上一代价格数据不足");
    if (typeof latest?.aiFeatureLevel !== "number") addUnique(missing, "最新 AI 能力数据不足");
  }

  if (input.analysisType === "comparison_explanation") {
    if (!latest?.chip) addUnique(missing, "最新芯片数据不足");
    if (typeof latest?.screenSize !== "number") addUnique(missing, "最新屏幕尺寸数据不足");
  }

  if (input.analysisType === "generation_summary" && input.changedFields.length === 0) {
    addUnique(missing, "代际变化字段不足");
  }

  return missing.slice(0, MAX_HIGHLIGHTS);
}

function buildInsights(input: AiAnalysisInput): string[] {
  const insights: string[] = [];
  const latest = input.latestDevice;
  const previous = input.previousDevice;
  const analysisType = input.analysisType ?? "generation_summary";

  if (analysisType === "generation_summary") {
    if (input.changedFields.length > 0) {
      addUnique(insights, `本次更新集中在 ${input.categoryLabel}，属于以已知变化为主的代际观察。`);
      if (input.changedFields.length >= 3) {
        addUnique(insights, "变化点达到中等强度，不只是单一规格微调。");
      } else {
        addUnique(insights, "变化幅度偏克制，更像渐进式升级。");
      }
    } else {
      addUnique(insights, "当前数据不足以确认明显代际变化，更适合保持保守判断。");
    }
  } else if (analysisType === "trend_prediction") {
    if (latest?.chip || previous?.chip) {
      addUnique(insights, "芯片代际仍是未来升级方向的主线，通常会先反映在性能和能效上。");
    }
    if (typeof latest?.aiFeatureLevel === "number") {
      addUnique(insights, "AI 能力等级可以作为下一代功能推进的早期信号。");
    }
    if (typeof latest?.launchPrice === "number" && typeof previous?.launchPrice === "number") {
      const delta = latest.launchPrice - previous.launchPrice;
      addUnique(
        insights,
        delta > 0
          ? "价格上行会影响购买门槛，后续预测应优先考虑价值感而不是只看参数。"
          : "价格未明显上升时，升级体验更可能被性能和功能变化放大。",
      );
    }
  } else if (analysisType === "buying_advice") {
    if (input.changedFields.length >= 4) {
      addUnique(insights, "变化面较广，说明新旧代际差异更值得认真对比。");
    } else if (input.changedFields.length > 0) {
      addUnique(insights, "存在可感知升级，但是否值得买单仍取决于预算与现有设备状态。");
    } else {
      addUnique(insights, "变化有限时，购买决策更应回到价格、库存和真实需求。");
    }
  } else if (analysisType === "comparison_explanation") {
    addUnique(insights, `${input.categoryLabel} 是决定用户体感差异的重要维度，不应只看单一规格。`);
    if (latest?.chip && previous?.chip) {
      addUnique(insights, `从 ${previous.chip} 到 ${latest.chip} 的变化通常意味着性能基线变化。`);
    }
  }

  if (!insights.length && previous) {
    addUnique(insights, "当前信息更适合做保守观察，而不是下结论。");
  }

  return insights.slice(0, MAX_HIGHLIGHTS);
}

function buildFallbackOutput(input: AiAnalysisInput): AiAnalysisOutput {
  const analysisType = input.analysisType ?? "generation_summary";
  const facts = buildFacts(input);
  const insights = buildInsights(input);
  const missingData = buildMissingData(input);
  const nextChip = input.latestDevice?.chip ? predictNextChipName(input.latestDevice.chip) : predictNextChipName(input.previousDevice?.chip ?? "");

  const summaryByType: Record<AnalysisType, string> = {
    generation_summary:
      input.changedFields.length > 0
        ? `${input.latestDevice?.model ?? input.seriesName} 在 ${input.categoryLabel} 上有 ${input.changedFields.length} 项可见变化。`
        : `${input.latestDevice?.model ?? input.seriesName} 的 ${input.categoryLabel} 目前数据不足，代际差异不够明确。`,
    trend_prediction:
      input.latestDevice?.chip
        ? `基于现有结构化数据，${input.latestDevice.model} 之后的趋势仍以渐进式升级为主。`
        : "当前数据不足，趋势判断只能保持保守。",
    buying_advice:
      input.changedFields.length > 0
        ? "当前代际有明确变化，但是否购买仍应结合价格、旧机状态和个人需求判断。"
        : "当前变化有限，建议优先观察价格和是否真的需要升级。",
    comparison_explanation:
      `从 ${input.categoryLabel} 维度看，当前对比主要用于解释代际差异如何影响用户决策。`,
  };

  return {
    summary: summaryByType[analysisType],
    facts,
    insights,
    buyingAdvice:
      analysisType === "buying_advice"
        ? input.changedFields.length >= 4
          ? "升级幅度较明显，适合有明确需求且预算充足时入手。"
          : input.changedFields.length > 0
            ? "有升级点，但更适合结合价格和自身使用场景再决定。"
            : "变化有限时，建议先看价格和旧机状态，不必急着换代。"
        : analysisType === "trend_prediction"
          ? "趋势判断适合当作方向性参考，不建议直接替代购买决策。"
          : analysisType === "comparison_explanation"
            ? `此维度适合帮助理解 ${input.categoryLabel} 的差异如何影响判断。`
            : input.changedFields.length > 0
              ? "变化已经足以构成代际观察，但是否购买仍要结合预算。"
              : "当前数据不足时，先观察价格和补充信息更稳妥。",
    prediction:
      analysisType === "trend_prediction"
        ? nextChip
          ? `按现有节奏，下一代可能继续围绕 ${nextChip} 做渐进式优化。`
          : "当前数据不足，无法可靠预测下一代方向。"
        : analysisType === "comparison_explanation"
          ? "比较本维度的意义在于帮助识别哪些变化会真正影响使用体验。"
          : nextChip
            ? `下一代大概率仍会沿着 ${nextChip} 的方向做稳健升级。`
            : "当前数据不足，无法可靠预测下一代芯片代际。",
    missingData,
    confidence: buildConfidence(input),
    source: "rules",
    disclaimer: "基于已收录数据生成，仅供参考",
    upgradeHighlights: facts,
  };
}

function buildConfidence(input: AiAnalysisInput): number {
  const base = 0.45;
  const changeBoost = Math.min(input.changedFields.length, 4) * 0.08;
  const latestBoost = input.latestDevice ? 0.05 : 0;
  const previousBoost = input.previousDevice ? 0.03 : 0;
  return clampNumber(base + changeBoost + latestBoost + previousBoost, 0.2, 0.92);
}

export function runFallbackAnalysis(input: AiAnalysisInput): AiAnalysisOutput {
  return buildFallbackOutput(input);
}

function formatDeviceForPrompt(device: FlattenedDevice | null): Record<string, unknown> | null {
  return compactDevice(device);
}

export function buildAnalysisPrompt(input: AiAnalysisInput): string {
  const payload = {
    seriesName: input.seriesName,
    category: input.category,
    analysisType: input.analysisType ?? "generation_summary",
    categoryLabel: input.categoryLabel,
    devices: compactDevices(input.devices),
    latestDevice: formatDeviceForPrompt(input.latestDevice),
    previousDevice: formatDeviceForPrompt(input.previousDevice),
    changedFields: input.changedFields.slice(0, MAX_HIGHLIGHTS),
  };

  return [
    "你是数码观察站 DeviceScope 的 Apple 设备代际观察助手。",
    "你只能基于我提供的结构化数据进行分析，不允许编造未提供的参数、命名、规格、价格、发布日期或结论。",
    "analysisType 决定分析侧重点：generation_summary 侧重代际变化，trend_prediction 侧重趋势观察，buying_advice 侧重购买建议，comparison_explanation 侧重解释对比维度。",
    "请严格区分 facts、insights、prediction、buyingAdvice 和 missingData：",
    "- facts 只能来自输入数据，不能添加未提供参数。",
    "- insights 是对 facts 的解释，不得引入新的具体规格或数字。",
    "- prediction 只能做方向性、谨慎预测，不得给出未提供的精确规格、价格、发布日期。",
    "- buyingAdvice 必须基于已提供数据和变化幅度生成，不要无脑推荐。",
    "- missingData 必须列出影响判断的缺失数据，例如价格、二手价、上一代数据、关键规格等。",
    "如果数据不足，请在相关字段中明确写出“当前数据不足”。",
    "输出必须是纯 JSON 对象，不要使用 markdown 代码块，不要输出额外说明。",
    "输出字段必须且只能包含：summary、facts、insights、prediction、buyingAdvice、missingData、confidence、source、disclaimer。",
    '其中 source 必须固定为 "ai"，disclaimer 必须为 "基于已收录数据生成，仅供参考"。',
    "facts、insights、missingData 都必须是字符串数组，且尽量精炼。",
    "confidence 必须是 0 到 1 之间的小数。",
    "",
    "输入数据：",
    JSON.stringify(payload, null, 2),
    "",
    "请直接返回 JSON。",
  ].join("\n");
}

// 兼容性辅助：路由层可直接重用的严格输出检查
export function normalizeAiAnalysisOutput(value: unknown): AiAnalysisOutput | null {
  if (!isRecord(value)) return null;

  const summary = normalizeText(value.summary);
  const facts = Array.isArray(value.facts)
    ? value.facts.map((item) => normalizeText(item)).filter(Boolean).slice(0, MAX_HIGHLIGHTS)
    : [];
  const insights = Array.isArray(value.insights)
    ? value.insights.map((item) => normalizeText(item)).filter(Boolean).slice(0, MAX_HIGHLIGHTS)
    : [];
  const buyingAdvice = normalizeText(value.buyingAdvice);
  const prediction = normalizeText(value.prediction);
  const missingData = Array.isArray(value.missingData)
    ? value.missingData.map((item) => normalizeText(item)).filter(Boolean).slice(0, MAX_HIGHLIGHTS)
    : [];
  const disclaimer = normalizeText(value.disclaimer, "基于已收录数据生成，仅供参考");
  const source = value.source === "ai" || value.source === "rules" ? value.source : null;
  const upgradeHighlights = Array.isArray(value.upgradeHighlights)
    ? value.upgradeHighlights.map((item) => normalizeText(item)).filter(Boolean).slice(0, MAX_HIGHLIGHTS)
    : facts;
  const confidence = normalizeNumber(value.confidence);

  if (!summary || !facts.length || !insights.length || !buyingAdvice || !prediction || !source || confidence === undefined) return null;
  if (!missingData.length) {
    missingData.push("当前数据不足");
  }

  return {
    summary,
    facts,
    insights,
    upgradeHighlights,
    buyingAdvice,
    prediction,
    missingData,
    confidence: clampNumber(confidence, 0, 1),
    source,
    disclaimer,
  };
}
