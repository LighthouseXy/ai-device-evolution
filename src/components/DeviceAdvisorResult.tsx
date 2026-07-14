import type { ReactNode } from "react";
import type { DeviceAdvisorOutput } from "@/lib/device-advisor";

type DeviceAdvisorResultProps = {
  loading: boolean;
  error: string;
  result: DeviceAdvisorOutput | null;
};

function Pill({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] ${className}`}>
      {children}
    </span>
  );
}

function LoadingState() {
  return (
    <div className="rounded-2xl border border-[rgba(45,90,61,0.16)] bg-[var(--primary-soft)] p-4" role="status">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-[var(--primary-strong)]">正在生成推荐</p>
        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--primary)]">
          API 调用
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-[#1E293B]">正在整理预算、设备类型和使用场景，请稍等。</p>
      <div className="mt-4 space-y-2 animate-pulse">
        <div className="h-4 w-2/3 rounded bg-[rgba(45,90,61,0.16)]" />
        <div className="h-4 w-full rounded bg-[rgba(45,90,61,0.16)]" />
        <div className="h-4 w-5/6 rounded bg-[rgba(232,168,56,0.18)]" />
      </div>
    </div>
  );
}

function ErrorState({ error }: { error: string }) {
  return (
    <div className="rounded-2xl border border-[#FECACA] bg-[#FFF7ED] p-4" role="alert">
      <p className="text-sm font-semibold text-[#9A3412]">请求失败</p>
      <p className="mt-2 text-sm leading-6 text-[#C2410C]">{error}</p>
      <p className="mt-2 text-xs text-[#B45309]">请先检查预算格式，或稍后再试。</p>
    </div>
  );
}

function ResultSummary({ result }: { result: DeviceAdvisorOutput }) {
  return (
    <div className="rounded-2xl border border-[rgba(45,90,61,0.18)] bg-[var(--primary-soft)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-[#1E293B]">推荐结果</p>
        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--primary)]">
          可信度 {Math.round(result.confidence * 100)}%
        </span>
        <span className="rounded-full bg-[#F0FDF4] px-2 py-0.5 text-[10px] font-medium text-[#16A34A]">
          {result.source === "ai" ? "模型生成" : "规则兜底"}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-[#1E293B]">{result.summary}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-white/80 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">整体权衡点</p>
          {result.tradeoffs.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {result.tradeoffs.map((item) => (
                <Pill key={item} className="bg-white text-[var(--primary-strong)]">
                  {item}
                </Pill>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-xs leading-relaxed text-[#64748B]">暂无明显权衡点</p>
          )}
        </div>
        <AudienceTags title="适合人群" items={result.suitableFor} tone="positive" />
        <AudienceTags title="不适合人群" items={result.notSuitableFor} tone="warning" />
      </div>
    </div>
  );
}

function AudienceTags({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "positive" | "warning";
}) {
  const className =
    tone === "positive"
      ? "bg-[var(--primary-soft)] text-[var(--primary-strong)]"
      : "bg-[#FFF7ED] text-[#7C2D12]";

  return (
    <div className="rounded-xl bg-white/80 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">{title}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Pill key={item} className={className}>
            {item}
          </Pill>
        ))}
      </div>
    </div>
  );
}

function RecommendationCard({
  item,
  index,
}: {
  item: DeviceAdvisorOutput["recommendations"][number];
  index: number;
}) {
  const isPrimary = index === 0;

  return (
    <article
      className={`rounded-2xl border p-4 shadow-sm ${
        isPrimary ? "border-[rgba(45,90,61,0.18)] bg-white" : "border-[#E8E4DC] bg-white"
      }`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                isPrimary ? "bg-[var(--primary-soft)] text-[var(--primary-strong)]" : "bg-[#F5F0E8] text-[#64748B]"
              }`}
            >
              {isPrimary ? "主推荐" : `备选 ${index}`}
            </span>
            <p className="text-sm font-semibold text-[#1E293B]">{item.model}</p>
          </div>
          <p className="mt-1 text-[11px] text-[#94A3B8]">
            {item.series} · {item.releaseYear} · {item.priceText}
          </p>
        </div>
        <span className="self-start rounded-full bg-[#F5F0E8] px-2 py-0.5 text-[10px] font-medium text-[#64748B]">
          匹配 {Math.round(item.matchScore * 100)}%
        </span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <ReasonList title="推荐理由" items={item.reasons} />
        <ReasonList title="注意事项 / 权衡点" items={item.tradeoffs} strong />
      </div>
    </article>
  );
}

function ReasonList({
  title,
  items,
  strong = false,
}: {
  title: string;
  items: string[];
  strong?: boolean;
}) {
  return (
    <div className="rounded-xl bg-[#F4F9F5] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">{title}</p>
      <ul className="mt-2 space-y-1">
        {items.map((item) => (
          <li
            className={`flex gap-2 text-sm leading-6 ${strong ? "text-[var(--primary-strong)]" : "text-[#475569]"}`}
            key={item}
          >
            <span className="shrink-0">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RecommendationResult({ result }: { result: DeviceAdvisorOutput }) {
  return (
    <div className="space-y-4">
      <ResultSummary result={result} />

      <div className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">
          推荐列表按匹配度排序，第一项为主推荐
        </p>
        {result.recommendations.map((item, index) => (
          <RecommendationCard item={item} index={index} key={item.deviceId} />
        ))}
      </div>

      {result.alternatives.length ? (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">主推荐之外的备选方案</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {result.alternatives.map((item) => (
              <span className="rounded-full bg-[#F5F0E8] px-3 py-1 text-[11px] text-[#64748B]" key={item.deviceId}>
                {item.model} · {Math.round(item.matchScore * 100)}%
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <p className="text-[10px] leading-relaxed text-[#94A3B8]">{result.disclaimer}</p>
    </div>
  );
}

export default function DeviceAdvisorResult({
  loading,
  error,
  result,
}: DeviceAdvisorResultProps) {
  if (!loading && !error && !result) return null;

  return (
    <div className="min-w-0 break-words border-t border-[#E8E4DC] bg-[#FFFDF8] p-4 sm:p-5" aria-live="polite" aria-atomic="true">
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} />
      ) : result ? (
        <RecommendationResult result={result} />
      ) : null}
    </div>
  );
}
