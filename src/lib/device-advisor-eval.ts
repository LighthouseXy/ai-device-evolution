import fs from "node:fs/promises";
import path from "node:path";

export type DeviceAdvisorEvalSummary = {
  total: number;
  source: {
    ai: number;
    rules: number;
    error: number;
  };
  partialRepair: number;
  finalFallback: number;
  noMatchEmptyAi: number;
  averageConfidence: number | null;
  averageLatencyMs: number | null;
  latencyP50Ms: number | null;
  latencyP95Ms: number | null;
  averageInitialLatencyMs: number | null;
  averageRetryLatencyMs: number | null;
  retryUsed: number;
  retryRate: number | null;
  retryReasons: Record<string, number>;
  missingFieldsTopN: Record<string, number>;
};

export type DeviceAdvisorEvalRun = {
  run: number;
  id: string;
  group: string;
  source: "ai" | "rules" | "error";
  status: number;
  confidence: number | null;
  latencyMs: number;
  partialRepair: boolean;
  finalFallback: boolean;
  noMatchEmptyAi: boolean;
  recommendationCount: number | null;
  alternativeCount: number | null;
  summary: string | null;
  stages: {
    initial: {
      phase: string | null;
      latencyMs: number | null;
      finishReason: string | null;
      retryReason: string | null;
      hasReasoningContent: boolean;
      rawTextEmpty: boolean;
      parseError: string | null;
      missingFields: string[];
      outputSource: "ai" | "rules" | null;
      partialRepair: boolean;
    } | null;
    retry: {
      phase: string | null;
      latencyMs: number | null;
      finishReason: string | null;
      retryReason: string | null;
      hasReasoningContent: boolean;
      rawTextEmpty: boolean;
      parseError: string | null;
      missingFields: string[];
      outputSource: "ai" | "rules" | null;
      partialRepair: boolean;
    } | null;
    final: {
      source: "ai" | "rules" | "error";
      confidence: number | null;
      latencyMs: number;
      partialRepair: boolean;
      finalFallback: boolean;
    };
    retryUsed: boolean;
    retryReason: string | null;
    missingFields: string[];
  };
  retryUsed: boolean;
  retryReason: string | null;
  missingFields: string[];
  initialLatencyMs: number | null;
  retryLatencyMs: number | null;
};

export type DeviceAdvisorEvalFileResult = {
  metadata: {
    provider?: string;
    runs?: number;
    sampleCount?: number;
    totalCalls?: number;
    generatedAt?: string;
  };
  summary: DeviceAdvisorEvalSummary;
  byGroup: Record<string, DeviceAdvisorEvalSummary>;
  bySample: Record<string, DeviceAdvisorEvalSummary>;
  runs: DeviceAdvisorEvalRun[];
};

export type DeviceAdvisorEvalFileInfo = {
  name: string;
  mtimeMs: number;
  sizeBytes: number;
  updatedAt: string;
  isLatest: boolean;
};

export type DeviceAdvisorEvalBundle = {
  directoryExists: boolean;
  files: DeviceAdvisorEvalFileInfo[];
  selectedFile: DeviceAdvisorEvalFileInfo | null;
  result: DeviceAdvisorEvalFileResult | null;
  requestedFile: string | null;
  warning: string | null;
};

const EVAL_RESULTS_DIR = path.join(process.cwd(), ".eval-results");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function normalizeStringRecord(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, rawValue]) => {
        const count = normalizeNumber(rawValue);
        if (!key || count === null) return null;
        return [key, count] as const;
      })
      .filter((item): item is readonly [string, number] => item !== null),
  );
}

function normalizeSummary(value: unknown): DeviceAdvisorEvalSummary | null {
  if (!isRecord(value)) return null;

  const source = isRecord(value.source)
    ? {
        ai: normalizeNumber(value.source.ai) ?? 0,
        rules: normalizeNumber(value.source.rules) ?? 0,
        error: normalizeNumber(value.source.error) ?? 0,
      }
    : { ai: 0, rules: 0, error: 0 };

  const total = normalizeNumber(value.total);
  if (total === null) return null;

  return {
    total,
    source,
    partialRepair: normalizeNumber(value.partialRepair) ?? 0,
    finalFallback: normalizeNumber(value.finalFallback) ?? 0,
    noMatchEmptyAi: normalizeNumber(value.noMatchEmptyAi) ?? 0,
    averageConfidence: normalizeNumber(value.averageConfidence),
    averageLatencyMs: normalizeNumber(value.averageLatencyMs),
    latencyP50Ms: normalizeNumber(value.latencyP50Ms),
    latencyP95Ms: normalizeNumber(value.latencyP95Ms),
    averageInitialLatencyMs: normalizeNumber(value.averageInitialLatencyMs),
    averageRetryLatencyMs: normalizeNumber(value.averageRetryLatencyMs),
    retryUsed: normalizeNumber(value.retryUsed) ?? 0,
    retryRate: normalizeNumber(value.retryRate),
    retryReasons: normalizeStringRecord(value.retryReasons),
    missingFieldsTopN: normalizeStringRecord(value.missingFieldsTopN),
  };
}

function normalizeRun(value: unknown): DeviceAdvisorEvalRun | null {
  if (!isRecord(value)) return null;

  const run = normalizeNumber(value.run);
  const latencyMs = normalizeNumber(value.latencyMs);
  if (run === null || latencyMs === null) return null;

  type RunStages = NonNullable<DeviceAdvisorEvalRun["stages"]>;

  const stageData = isRecord(value.stages) ? value.stages : null;
  const initialStage: RunStages["initial"] = isRecord(stageData?.initial)
    ? {
        phase: normalizeString(stageData.initial.phase),
        latencyMs: normalizeNumber(stageData.initial.latencyMs),
        finishReason: normalizeString(stageData.initial.finishReason),
        retryReason: normalizeString(stageData.initial.retryReason),
        hasReasoningContent: stageData.initial.hasReasoningContent === true,
        rawTextEmpty: stageData.initial.rawTextEmpty === true,
        parseError: normalizeString(stageData.initial.parseError),
        missingFields: Array.isArray(stageData.initial.missingFields)
          ? stageData.initial.missingFields.filter((item): item is string => typeof item === "string")
          : [],
        outputSource:
          stageData.initial.outputSource === "ai" || stageData.initial.outputSource === "rules"
            ? stageData.initial.outputSource
            : null,
        partialRepair: stageData.initial.partialRepair === true,
      }
    : null;

  const retryStage: RunStages["retry"] = isRecord(stageData?.retry)
    ? {
        phase: normalizeString(stageData.retry.phase),
        latencyMs: normalizeNumber(stageData.retry.latencyMs),
        finishReason: normalizeString(stageData.retry.finishReason),
        retryReason: normalizeString(stageData.retry.retryReason),
        hasReasoningContent: stageData.retry.hasReasoningContent === true,
        rawTextEmpty: stageData.retry.rawTextEmpty === true,
        parseError: normalizeString(stageData.retry.parseError),
        missingFields: Array.isArray(stageData.retry.missingFields)
          ? stageData.retry.missingFields.filter((item): item is string => typeof item === "string")
          : [],
        outputSource:
          stageData.retry.outputSource === "ai" || stageData.retry.outputSource === "rules"
            ? stageData.retry.outputSource
            : null,
        partialRepair: stageData.retry.partialRepair === true,
      }
    : null;

  const finalStage: RunStages["final"] = isRecord(stageData?.final)
    ? {
        source:
          stageData.final.source === "ai" ||
          stageData.final.source === "rules" ||
          stageData.final.source === "error"
            ? stageData.final.source
            : "error",
        confidence: normalizeNumber(stageData.final.confidence),
        latencyMs: normalizeNumber(stageData.final.latencyMs) ?? 0,
        partialRepair: stageData.final.partialRepair === true,
        finalFallback: stageData.final.finalFallback === true,
      }
    : {
        source: "error",
        confidence: null,
        latencyMs: 0,
        partialRepair: false,
        finalFallback: false,
      };

  const stages: RunStages = {
    initial: initialStage,
    retry: retryStage,
    final: finalStage,
    retryUsed: stageData?.retryUsed === true,
    retryReason: normalizeString(stageData?.retryReason),
    missingFields: Array.isArray(stageData?.missingFields)
      ? stageData.missingFields.filter((item): item is string => typeof item === "string")
      : [],
  };

  return {
    run,
    id: normalizeString(value.id) ?? "unknown",
    group: normalizeString(value.group) ?? "unknown",
    source: value.source === "ai" || value.source === "rules" || value.source === "error" ? value.source : "error",
    status: normalizeNumber(value.status) ?? 0,
    confidence: normalizeNumber(value.confidence),
    latencyMs,
    partialRepair: value.partialRepair === true,
    finalFallback: value.finalFallback === true,
    noMatchEmptyAi: value.noMatchEmptyAi === true,
    recommendationCount: normalizeNumber(value.recommendationCount),
    alternativeCount: normalizeNumber(value.alternativeCount),
    summary: normalizeString(value.summary),
    stages,
    retryUsed: value.retryUsed === true,
    retryReason: normalizeString(value.retryReason),
    missingFields: Array.isArray(value.missingFields)
      ? value.missingFields.filter((item): item is string => typeof item === "string")
      : [],
    initialLatencyMs: normalizeNumber(value.initialLatencyMs),
    retryLatencyMs: normalizeNumber(value.retryLatencyMs),
  };
}

function normalizeEvalResult(value: unknown): DeviceAdvisorEvalFileResult | null {
  if (!isRecord(value)) return null;

  const metadata = isRecord(value.metadata) ? value.metadata : {};
  const summary = normalizeSummary(value.summary);
  if (!summary) return null;

  const byGroup = isRecord(value.byGroup)
    ? Object.fromEntries(
        Object.entries(value.byGroup)
          .map(([groupName, item]) => {
            const normalized = normalizeSummary(item);
            return normalized ? ([groupName, normalized] as const) : null;
          })
          .filter((item): item is readonly [string, DeviceAdvisorEvalSummary] => item !== null),
      )
    : {};

  const bySample = isRecord(value.bySample)
    ? Object.fromEntries(
        Object.entries(value.bySample)
          .map(([sampleId, item]) => {
            const normalized = normalizeSummary(item);
            return normalized ? ([sampleId, normalized] as const) : null;
          })
          .filter((item): item is readonly [string, DeviceAdvisorEvalSummary] => item !== null),
      )
    : {};

  const runs = Array.isArray(value.runs)
    ? value.runs.map((item) => normalizeRun(item)).filter((item): item is DeviceAdvisorEvalRun => item !== null)
    : [];

  return {
    metadata: {
      provider: normalizeString(metadata.provider) ?? undefined,
      runs: normalizeNumber(metadata.runs) ?? undefined,
      sampleCount: normalizeNumber(metadata.sampleCount) ?? undefined,
      totalCalls: normalizeNumber(metadata.totalCalls) ?? undefined,
      generatedAt: normalizeString(metadata.generatedAt) ?? undefined,
    },
    summary,
    byGroup,
    bySample,
    runs,
  };
}

function normalizeEvalFileName(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed || trimmed === "latest") return null;

  const baseName = path.basename(trimmed);
  if (baseName !== trimmed || !baseName.endsWith(".json")) {
    return null;
  }

  return baseName;
}

async function listEvalFilesOnDisk(): Promise<DeviceAdvisorEvalFileInfo[]> {
  try {
    const entries = await fs.readdir(EVAL_RESULTS_DIR, { withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".json"));

    const infos = await Promise.all(
      files.map(async (entry) => {
        const fullPath = path.join(EVAL_RESULTS_DIR, entry.name);
        const stat = await fs.stat(fullPath);
        return {
          name: entry.name,
          mtimeMs: stat.mtimeMs,
          sizeBytes: stat.size,
          updatedAt: new Date(stat.mtimeMs).toISOString(),
          isLatest: false,
        } satisfies DeviceAdvisorEvalFileInfo;
      }),
    );

    return infos.sort((left, right) => right.mtimeMs - left.mtimeMs || left.name.localeCompare(right.name));
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error;
}

async function readEvalFileResult(fileName: string): Promise<DeviceAdvisorEvalFileResult | null> {
  const fullPath = path.join(EVAL_RESULTS_DIR, fileName);
  try {
    const contents = await fs.readFile(fullPath, "utf8");
    const parsed = JSON.parse(contents) as unknown;
    return normalizeEvalResult(parsed);
  } catch {
    return null;
  }
}

function selectEvalFile(
  files: DeviceAdvisorEvalFileInfo[],
  requestedFile: string | null,
): { selectedFile: DeviceAdvisorEvalFileInfo | null; warning: string | null } {
  if (files.length === 0) {
    return { selectedFile: null, warning: null };
  }

  const latest = files[0];
  const normalizedRequested = normalizeEvalFileName(requestedFile);
  if (!normalizedRequested) {
    return { selectedFile: latest, warning: null };
  }

  const matched = files.find((file) => file.name === normalizedRequested);
  if (matched) {
    return { selectedFile: matched, warning: null };
  }

  return {
    selectedFile: latest,
    warning: `找不到结果文件 ${normalizedRequested}，已回退到最新结果 ${latest.name}`,
  };
}

export async function readDeviceAdvisorEvalBundle(requestedFile: string | null): Promise<DeviceAdvisorEvalBundle> {
  const files = await listEvalFilesOnDisk();
  if (files.length === 0) {
    return {
      directoryExists: false,
      files,
      selectedFile: null,
      result: null,
      requestedFile: normalizeEvalFileName(requestedFile),
      warning: null,
    };
  }

  files[0] = { ...files[0], isLatest: true };
  const { selectedFile, warning } = selectEvalFile(files, requestedFile);
  const result = selectedFile ? await readEvalFileResult(selectedFile.name) : null;

  return {
    directoryExists: true,
    files,
    selectedFile,
    result,
    requestedFile: normalizeEvalFileName(requestedFile),
    warning: result ? warning : warning ?? "最新结果文件无法解析，当前仅展示文件列表",
  };
}
