"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  categoryLabels,
  categoryNames,
  type DeviceCategory,
} from "@/lib/devices-db";
import type {
  DeviceAdvisorCategory,
  DeviceAdvisorOutput,
  DeviceAdvisorPerformancePreference,
} from "@/lib/device-advisor";

type DeviceAdvisorPanelProps = {
  initialCategory: DeviceCategory;
};

const performancePreferenceOptions: Array<{
  value: DeviceAdvisorPerformancePreference;
  label: string;
}> = [
  { value: "balanced", label: "均衡" },
  { value: "performance", label: "性能优先" },
  { value: "battery", label: "续航优先" },
  { value: "portable", label: "便携优先" },
  { value: "screen", label: "屏幕优先" },
  { value: "camera", label: "拍照优先" },
  { value: "storage", label: "存储优先" },
];

function normalizeUseCases(text: string): string[] {
  return text
    .split(/[,\n/|，、]/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

export default function DeviceAdvisorPanel({ initialCategory }: DeviceAdvisorPanelProps) {
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [category, setCategory] = useState<DeviceAdvisorCategory>(initialCategory);
  const [performancePreference, setPerformancePreference] =
    useState<DeviceAdvisorPerformancePreference>("balanced");
  const [useCasesText, setUseCasesText] = useState("办公 / 追剧");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<DeviceAdvisorOutput | null>(null);

  const budgetLabel = useMemo(() => {
    if (budgetMin && budgetMax) return `¥${budgetMin} - ¥${budgetMax}`;
    if (budgetMax) return `≤ ¥${budgetMax}`;
    if (budgetMin) return `≥ ¥${budgetMin}`;
    return "未设置";
  }, [budgetMax, budgetMin]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    const min = budgetMin.trim() ? Number(budgetMin) : undefined;
    const max = budgetMax.trim() ? Number(budgetMax) : undefined;
    const normalizedUseCases = normalizeUseCases(useCasesText);

    try {
      const response = await fetch("/api/device-advisor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          budget:
            min !== undefined || max !== undefined
              ? {
                  min: Number.isFinite(min) ? min : undefined,
                  max: Number.isFinite(max) ? max : undefined,
                  currency: "CNY",
                }
              : undefined,
          category,
          performancePreference,
          useCases: normalizedUseCases,
          intent: useCasesText.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "设备顾问请求失败");
      }

      const data = (await response.json()) as DeviceAdvisorOutput;
      setResult(data);
    } catch (cause) {
      setResult(null);
      setError(cause instanceof Error ? cause.message : "设备顾问请求失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-[#E8E4DC] p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#1E293B]">设备顾问</p>
            <p className="mt-1 text-xs text-[#94A3B8]">预算、机型类型、性能偏好、使用场景</p>
          </div>
          <span className="inline-flex rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[10px] font-medium text-[#3B82F6]">
            API 调用
          </span>
        </div>
      </div>

      <form className="space-y-4 p-5" onSubmit={submit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">预算下限</span>
            <input
              className="mt-1 h-10 w-full rounded-lg border border-[#E8E4DC] bg-[#FFFDF8] px-3 text-sm text-[#1E293B] outline-none transition focus:border-[#3B82F6]"
              inputMode="numeric"
              placeholder="例如 6000"
              value={budgetMin}
              onChange={(event) => setBudgetMin(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">预算上限</span>
            <input
              className="mt-1 h-10 w-full rounded-lg border border-[#E8E4DC] bg-[#FFFDF8] px-3 text-sm text-[#1E293B] outline-none transition focus:border-[#3B82F6]"
              inputMode="numeric"
              placeholder="例如 9000"
              value={budgetMax}
              onChange={(event) => setBudgetMax(event.target.value)}
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">设备类型</span>
            <select
              className="mt-1 h-10 w-full rounded-lg border border-[#E8E4DC] bg-[#FFFDF8] px-3 text-sm text-[#1E293B] outline-none transition focus:border-[#3B82F6]"
              value={category}
              onChange={(event) => setCategory(event.target.value as DeviceAdvisorCategory)}
            >
              <option value="all">全品类</option>
              {categoryNames.map((item) => (
                <option key={item} value={item}>
                  {categoryLabels[item]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">性能偏好</span>
            <select
              className="mt-1 h-10 w-full rounded-lg border border-[#E8E4DC] bg-[#FFFDF8] px-3 text-sm text-[#1E293B] outline-none transition focus:border-[#3B82F6]"
              value={performancePreference}
              onChange={(event) =>
                setPerformancePreference(event.target.value as DeviceAdvisorPerformancePreference)
              }
            >
              {performancePreferenceOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">使用场景</span>
          <textarea
            className="mt-1 min-h-24 w-full rounded-lg border border-[#E8E4DC] bg-[#FFFDF8] px-3 py-2 text-sm leading-6 text-[#1E293B] outline-none transition focus:border-[#3B82F6]"
            placeholder="例如：通勤办公、视频剪辑、追剧、轻度游戏"
            value={useCasesText}
            onChange={(event) => setUseCasesText(event.target.value)}
          />
        </label>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[10px] text-[#94A3B8]">当前预算：{budgetLabel}</p>
          <button
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#3B82F6] px-4 text-sm font-medium text-white transition hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={loading}
          >
            {loading ? "生成中..." : "生成推荐"}
          </button>
        </div>
      </form>

      <div className="border-t border-[#E8E4DC] bg-[#FFFDF8] p-5">
        {error ? (
          <p className="rounded-lg bg-[#FFF7ED] px-3 py-2 text-sm text-[#C2410C]">已切换到规则结果：{error}</p>
        ) : null}

        {result ? (
          <div className="space-y-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-[#1E293B]">推荐结果</p>
                <span className="rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[10px] font-medium text-[#3B82F6]">
                  可信度 {Math.round(result.confidence * 100)}%
                </span>
                <span className="rounded-full bg-[#F0FDF4] px-2 py-0.5 text-[10px] font-medium text-[#16A34A]">
                  {result.source === "ai" ? "模型生成" : "规则兜底"}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-[#1E293B]">{result.summary}</p>
            </div>

            <div className="space-y-3">
              {result.recommendations.map((item, index) => (
                <article
                  className="rounded-xl border border-[#E8E4DC] bg-white p-3 shadow-sm"
                  key={item.deviceId}
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[#1E293B]">
                        {index + 1}. {item.model}
                      </p>
                      <p className="text-[11px] text-[#94A3B8]">
                        {item.series} · {item.releaseYear} · {item.priceText}
                      </p>
                    </div>
                    <span className="rounded-full bg-[#F5F0E8] px-2 py-0.5 text-[10px] font-medium text-[#64748B]">
                      匹配 {Math.round(item.matchScore * 100)}%
                    </span>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">推荐理由</p>
                      <ul className="mt-2 space-y-1">
                        {item.reasons.map((reason) => (
                          <li className="text-xs leading-relaxed text-[#64748B]" key={reason}>
                            • {reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">注意事项</p>
                      <ul className="mt-2 space-y-1">
                        {item.tradeoffs.map((tradeoff) => (
                          <li className="text-xs leading-relaxed text-[#64748B]" key={tradeoff}>
                            • {tradeoff}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg bg-[#F8FAFE] p-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">适合</p>
                      <p className="mt-1 text-xs leading-relaxed text-[#64748B]">{item.suitableFor.join(" · ")}</p>
                    </div>
                    <div className="rounded-lg bg-[#FFF7ED] p-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">不适合</p>
                      <p className="mt-1 text-xs leading-relaxed text-[#64748B]">{item.notSuitableFor.join(" · ")}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {result.alternatives.length ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">备选方案</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {result.alternatives.map((item) => (
                    <span
                      className="rounded-full bg-[#F5F0E8] px-3 py-1 text-[11px] text-[#64748B]"
                      key={item.deviceId}
                    >
                      {item.model} · {Math.round(item.matchScore * 100)}%
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <p className="text-[10px] leading-relaxed text-[#94A3B8]">{result.disclaimer}</p>
          </div>
        ) : (
          <p className="text-sm text-[#94A3B8]">
            先填预算和偏好，再生成推荐。默认会走规则结果，配置模型 key 后可切换到模型生成。
          </p>
        )}
      </div>
    </section>
  );
}
