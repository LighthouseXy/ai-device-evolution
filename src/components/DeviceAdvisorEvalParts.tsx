import type {
  DeviceAdvisorEvalFileInfo,
  DeviceAdvisorEvalRun,
  DeviceAdvisorEvalSummary,
} from "@/lib/device-advisor-eval";

export function formatPercent(value: number | null) {
  if (value === null) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

export function formatNumber(value: number | null, fractionDigits = 0) {
  if (value === null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatMs(value: number | null) {
  return value === null ? "—" : `${formatNumber(value, value >= 100 ? 0 : 1)} ms`;
}

export function formatCounts(source: DeviceAdvisorEvalSummary["source"]) {
  return `AI ${source.ai} / 规则 ${source.rules} / 错误 ${source.error}`;
}

export function entriesByCount(record: Record<string, number>) {
  return Object.entries(record).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
}

export function SummaryStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white/80 p-4 shadow-sm">
      <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-[var(--text)]">{value}</div>
      {hint ? <div className="mt-1 text-sm text-[var(--text-secondary)]">{hint}</div> : null}
    </div>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4">
      <div className="text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">{eyebrow}</div>
      <h2 className="mt-1 text-xl font-semibold text-[var(--text)]">{title}</h2>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p>
    </div>
  );
}

export function EvalFileBadge({ file }: { file: DeviceAdvisorEvalFileInfo }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs text-[var(--text-secondary)]">
      <span>{file.name}</span>
      <span>·</span>
      <span>{new Date(file.mtimeMs).toLocaleString("zh-CN")}</span>
      {file.isLatest ? <span className="rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-[var(--primary)]">最新</span> : null}
    </span>
  );
}

export function RunCard({ run }: { run: DeviceAdvisorEvalRun }) {
  return (
    <details className="group rounded-2xl border border-[var(--border)] bg-[var(--bg-start)]/25 p-4 open:bg-white">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="font-semibold">
              {run.id} <span className="text-sm font-normal text-[var(--text-muted)]">· run {run.run}</span>
            </div>
            <div className="mt-1 text-sm text-[var(--text-secondary)]">
              {run.group} · {run.source} · confidence {formatPercent(run.confidence)}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
            <span className="rounded-full bg-white px-3 py-1">latency {formatMs(run.latencyMs)}</span>
            <span className="rounded-full bg-white px-3 py-1">retry {run.retryUsed ? "yes" : "no"}</span>
            <span className="rounded-full bg-white px-3 py-1">devices {run.recommendationCount ?? "—"}</span>
          </div>
        </div>
        {run.summary ? <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{run.summary}</p> : null}
      </summary>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <div className="text-sm font-medium">Stages</div>
          <div className="mt-3 space-y-3 text-sm">
            <StageRow label="initial" stage={run.stages.initial} />
            <StageRow label="retry" stage={run.stages.retry} />
            <div className="rounded-xl bg-[var(--bg-start)]/30 px-3 py-2">
              <div className="text-[var(--text-muted)]">final</div>
              <div className="mt-1">
                source {run.stages.final.source} · confidence {formatPercent(run.stages.final.confidence)} · latency {formatMs(run.stages.final.latencyMs)}
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <div className="text-sm font-medium">Diagnostics</div>
          <dl className="mt-3 grid gap-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">retryReason</dt>
              <dd className="text-right">{run.retryReason ?? "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">missingFields</dt>
              <dd className="text-right">{run.missingFields.length > 0 ? run.missingFields.join("，") : "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">initialLatencyMs</dt>
              <dd className="text-right">{formatMs(run.initialLatencyMs)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">retryLatencyMs</dt>
              <dd className="text-right">{formatMs(run.retryLatencyMs)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </details>
  );
}

function StageRow({
  label,
  stage,
}: {
  label: string;
  stage: DeviceAdvisorEvalRun["stages"]["initial"] | DeviceAdvisorEvalRun["stages"]["retry"];
}) {
  if (!stage) {
    return <div className="rounded-xl bg-[var(--bg-start)]/30 px-3 py-2">{label}: —</div>;
  }

  return (
    <div className="rounded-xl bg-[var(--bg-start)]/30 px-3 py-2">
      <div className="text-[var(--text-muted)]">{label}</div>
      <div className="mt-1">
        phase {stage.phase ?? "—"} · latency {formatMs(stage.latencyMs)} · finish {stage.finishReason ?? "—"}
      </div>
      <div className="mt-1 text-[var(--text-secondary)]">
        source {stage.outputSource ?? "—"} · missing {stage.missingFields.length > 0 ? stage.missingFields.join("，") : "—"}
      </div>
    </div>
  );
}
