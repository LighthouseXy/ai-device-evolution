import Link from "next/link";
import type { DeviceAdvisorOutput } from "@/lib/device-advisor";

type DeviceAdvisorResultProps = {
  loading: boolean;
  error: string;
  result: DeviceAdvisorOutput | null;
};

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

function RecommendationResult({ result }: { result: DeviceAdvisorOutput }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[rgba(45,90,61,0.18)] bg-[var(--primary-soft)] p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-[#1E293B]">顾问建议</p>
          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--primary)]">
            {result.source === "ai" ? "模型生成" : "规则兜底"}
          </span>
        </div>
        <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[#1E293B]">
          {result.answer}
        </p>
      </div>

      {result.devices.length ? (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">
            推荐中提到的设备
          </p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {result.devices.map((device, index) => (
              <Link
                className="group rounded-2xl border border-[#E8E4DC] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[rgba(45,90,61,0.28)] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                href={`/devices/${device.deviceId}`}
                key={device.deviceId}
              >
                <span className="rounded-full bg-[var(--primary-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--primary-strong)]">
                  {index === 0 ? "首选" : `推荐 ${index + 1}`}
                </span>
                <p className="mt-3 text-sm font-semibold text-[#1E293B]">{device.model}</p>
                <p className="mt-1 text-xs leading-5 text-[#64748B]">
                  {device.series} · {device.releaseYear}
                </p>
                <p className="mt-1 text-xs leading-5 text-[#64748B]">{device.priceText}</p>
                <span className="mt-4 inline-flex text-xs font-semibold text-[var(--primary)]">
                  查看详细参数 <span aria-hidden="true" className="ml-1 transition group-hover:translate-x-0.5">→</span>
                </span>
              </Link>
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
