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

const conditionPreferenceOptions = [
  { value: "new_only", label: "只看全新" },
  { value: "used_ok", label: "接受二手" },
  { value: "refurbished_ok", label: "接受翻新" },
] as const;

const batteryPriorityOptions = [
  { value: "balanced", label: "均衡" },
  { value: "high", label: "优先续航" },
] as const;

const interfaceNeedOptions = [
  { value: "any", label: "无特殊要求" },
  { value: "usb_c", label: "USB-C" },
  { value: "magsafe", label: "MagSafe" },
  { value: "pencil", label: "Apple Pencil" },
] as const;

function normalizeUseCases(text: string): string[] {
  return text
    .split(/[,\n/|，、]/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

type BudgetState = {
  budget?: {
    min?: number;
    max?: number;
    currency: "CNY";
  };
  preview: string;
  message: string;
  isError: boolean;
};

function formatBudgetAmount(value: number) {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(value);
}

function parseBudgetValue(raw: string, label: string) {
  const text = raw.trim();
  if (!text) return { value: undefined as number | undefined, error: "" };

  const value = Number(text);
  if (!Number.isFinite(value)) {
    return { value: undefined, error: `${label}必须是数字` };
  }

  if (value < 0) {
    return { value: undefined, error: `${label}不能是负数` };
  }

  return { value, error: "" };
}

function resolveBudgetState(minText: string, maxText: string): BudgetState {
  const min = parseBudgetValue(minText, "预算下限");
  const max = parseBudgetValue(maxText, "预算上限");

  if (min.error) {
    return {
      preview: "预算待完善",
      message: min.error,
      isError: true,
    };
  }

  if (max.error) {
    return {
      preview: "预算待完善",
      message: max.error,
      isError: true,
    };
  }

  if (min.value === undefined && max.value === undefined) {
    return {
      preview: "未设置",
      message: "支持输入非负数字；最小值大于最大值时会自动交换。",
      isError: false,
    };
  }

  if (min.value !== undefined && max.value !== undefined) {
    const lower = Math.min(min.value, max.value);
    const upper = Math.max(min.value, max.value);

    return {
      budget: { min: lower, max: upper, currency: "CNY" },
      preview: `¥${formatBudgetAmount(lower)} - ¥${formatBudgetAmount(upper)}`,
      message:
        min.value > max.value
          ? `已自动交换预算上下限：¥${formatBudgetAmount(lower)} - ¥${formatBudgetAmount(upper)}`
          : "预算区间已就绪。",
      isError: false,
    };
  }

  if (min.value !== undefined) {
    return {
      budget: { min: min.value, currency: "CNY" },
      preview: `≥ ¥${formatBudgetAmount(min.value)}`,
      message: "已填写预算下限。",
      isError: false,
    };
  }

  return {
    budget: { max: max.value, currency: "CNY" },
    preview: `≤ ¥${formatBudgetAmount(max.value ?? 0)}`,
    message: "已填写预算上限。",
    isError: false,
  };
}

function getReadableAdvisorError(status: number, payload: { error?: string } | null) {
  const text = payload?.error ?? "";

  if (status === 400) {
    if (/合法 JSON/.test(text)) return "请求内容格式不正确，请检查后重试。";
    if (/缺少必要字段|字段格式不正确/.test(text)) return "输入有误，请检查预算和偏好后重试。";
    return "输入有误，请检查后重试。";
  }

  return "设备顾问请求失败，请稍后重试。";
}

export default function DeviceAdvisorPanel({ initialCategory }: DeviceAdvisorPanelProps) {
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [category, setCategory] = useState<DeviceAdvisorCategory>(initialCategory);
  const [performancePreference, setPerformancePreference] =
    useState<DeviceAdvisorPerformancePreference>("balanced");
  const [conditionPreference, setConditionPreference] = useState<(typeof conditionPreferenceOptions)[number]["value"]>("new_only");
  const [batteryPriority, setBatteryPriority] = useState<(typeof batteryPriorityOptions)[number]["value"]>("balanced");
  const [interfaceNeed, setInterfaceNeed] = useState<(typeof interfaceNeedOptions)[number]["value"]>("any");
  const [useCasesText, setUseCasesText] = useState("办公 / 追剧");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<DeviceAdvisorOutput | null>(null);

  const budgetState = useMemo(() => resolveBudgetState(budgetMin, budgetMax), [budgetMax, budgetMin]);
  const clearError = () => {
    if (error) {
      setError("");
    }
  };
  const statusText = loading
    ? "设备顾问正在生成推荐"
    : error
      ? `设备顾问请求失败：${error}`
      : result
        ? `设备顾问已生成推荐，主推荐为 ${result.recommendations[0]?.model ?? "未知"}`
        : "设备顾问尚未生成推荐";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedUseCases = normalizeUseCases(useCasesText);

    if (budgetState.isError) {
      setResult(null);
      setError(budgetState.message);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/device-advisor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          budget: budgetState.budget,
          category,
          performancePreference,
          useCases: normalizedUseCases,
          intent: useCasesText.trim() || undefined,
          conditionPreference,
          batteryPriority,
          interfaceNeed,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(getReadableAdvisorError(response.status, payload));
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
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {statusText}
        </p>

        <fieldset className="space-y-4" disabled={loading} aria-busy={loading}>
          <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">预算下限</span>
            <input
              className="mt-1 h-10 w-full rounded-lg border border-[#E8E4DC] bg-[#FFFDF8] px-3 text-sm text-[#1E293B] outline-none transition focus:border-[#3B82F6]"
              inputMode="numeric"
              placeholder="例如 6000"
              value={budgetMin}
              onChange={(event) => {
                clearError();
                setBudgetMin(event.target.value);
              }}
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">预算上限</span>
            <input
              className="mt-1 h-10 w-full rounded-lg border border-[#E8E4DC] bg-[#FFFDF8] px-3 text-sm text-[#1E293B] outline-none transition focus:border-[#3B82F6]"
              inputMode="numeric"
              placeholder="例如 9000"
              value={budgetMax}
              onChange={(event) => {
                clearError();
                setBudgetMax(event.target.value);
              }}
            />
          </label>
          <p className={`col-span-full text-[10px] ${budgetState.isError ? "text-[#DC2626]" : "text-[#94A3B8]"}`}>
            {budgetState.message}
          </p>
        </div>

          <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">设备类型</span>
            <select
              className="mt-1 h-10 w-full rounded-lg border border-[#E8E4DC] bg-[#FFFDF8] px-3 text-sm text-[#1E293B] outline-none transition focus:border-[#3B82F6]"
              value={category}
              onChange={(event) => {
                clearError();
                setCategory(event.target.value as DeviceAdvisorCategory);
              }}
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
                {
                  clearError();
                  setPerformancePreference(event.target.value as DeviceAdvisorPerformancePreference);
                }
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

          <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">成色偏好</span>
            <select
              className="mt-1 h-10 w-full rounded-lg border border-[#E8E4DC] bg-[#FFFDF8] px-3 text-sm text-[#1E293B] outline-none transition focus:border-[#3B82F6]"
              value={conditionPreference}
              onChange={(event) =>
                {
                  clearError();
                  setConditionPreference(event.target.value as (typeof conditionPreferenceOptions)[number]["value"]);
                }
              }
            >
              {conditionPreferenceOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">续航优先级</span>
            <select
              className="mt-1 h-10 w-full rounded-lg border border-[#E8E4DC] bg-[#FFFDF8] px-3 text-sm text-[#1E293B] outline-none transition focus:border-[#3B82F6]"
              value={batteryPriority}
              onChange={(event) =>
                {
                  clearError();
                  setBatteryPriority(event.target.value as (typeof batteryPriorityOptions)[number]["value"]);
                }
              }
            >
              {batteryPriorityOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          </div>

        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">接口 / 生态需求</span>
          <select
            className="mt-1 h-10 w-full rounded-lg border border-[#E8E4DC] bg-[#FFFDF8] px-3 text-sm text-[#1E293B] outline-none transition focus:border-[#3B82F6]"
            value={interfaceNeed}
            onChange={(event) =>
              {
                clearError();
                setInterfaceNeed(event.target.value as (typeof interfaceNeedOptions)[number]["value"]);
              }
            }
          >
            {interfaceNeedOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">使用场景</span>
          <textarea
            className="mt-1 min-h-24 w-full rounded-lg border border-[#E8E4DC] bg-[#FFFDF8] px-3 py-2 text-sm leading-6 text-[#1E293B] outline-none transition focus:border-[#3B82F6]"
            placeholder="例如：通勤办公、视频剪辑、追剧、轻度游戏"
            value={useCasesText}
            onChange={(event) => {
              clearError();
              setUseCasesText(event.target.value);
            }}
          />
        </label>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[10px] text-[#94A3B8]">当前预算：{budgetState.preview}</p>
          <button
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#3B82F6] px-4 text-sm font-medium text-white transition hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? "生成中..." : "生成推荐"}
          </button>
        </div>
        </fieldset>
      </form>

      <div className="border-t border-[#E8E4DC] bg-[#FFFDF8] p-5" aria-live="polite" aria-atomic="true">
        {loading ? (
          <div className="rounded-2xl border border-[#DBEAFE] bg-[#EFF6FF] p-4" role="status">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-[#1D4ED8]">正在生成推荐</p>
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-[#3B82F6]">
                API 调用
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#1E293B]">正在整理预算、成色、续航和接口偏好，请稍等。</p>
            <div className="mt-4 space-y-2 animate-pulse">
              <div className="h-4 w-2/3 rounded bg-[#DBEAFE]" />
              <div className="h-4 w-full rounded bg-[#DBEAFE]" />
              <div className="h-4 w-5/6 rounded bg-[#DBEAFE]" />
            </div>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-[#FECACA] bg-[#FFF7ED] p-4" role="alert">
            <p className="text-sm font-semibold text-[#9A3412]">请求失败</p>
            <p className="mt-2 text-sm leading-6 text-[#C2410C]">{error}</p>
            <p className="mt-2 text-xs text-[#B45309]">请先检查预算格式，或稍后再试。</p>
          </div>
        ) : result ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-[#1E293B]">推荐结果</p>
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-[#3B82F6]">
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
                        <span key={item} className="rounded-full bg-white px-2 py-0.5 text-[11px] text-[#64748B]">
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-xs leading-relaxed text-[#64748B]">暂无明显权衡点</p>
                  )}
                </div>
                <div className="rounded-xl bg-white/80 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">适合人群</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {result.suitableFor.map((item) => (
                      <span key={item} className="rounded-full bg-[#F8FAFE] px-2 py-0.5 text-[11px] text-[#64748B]">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl bg-white/80 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">不适合人群</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {result.notSuitableFor.map((item) => (
                      <span key={item} className="rounded-full bg-[#FFF7ED] px-2 py-0.5 text-[11px] text-[#7C2D12]">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">
                推荐列表按匹配度排序，第一项为主推荐
              </p>
              {result.recommendations.map((item, index) => {
                const isPrimary = index === 0;
                return (
                  <article
                    className={`rounded-2xl border p-4 shadow-sm ${
                      isPrimary ? "border-[#BFDBFE] bg-white" : "border-[#E8E4DC] bg-white"
                    }`}
                    key={item.deviceId}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              isPrimary ? "bg-[#DBEAFE] text-[#1D4ED8]" : "bg-[#F5F0E8] text-[#64748B]"
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
                      <div className="rounded-xl bg-[#F8FAFE] p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">推荐理由</p>
                        <ul className="mt-2 space-y-1">
                          {item.reasons.map((reason) => (
                            <li className="flex gap-2 text-sm leading-6 text-[#475569]" key={reason}>
                              <span className="shrink-0">•</span>
                              <span>{reason}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-xl bg-[#FFF7ED] p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">注意事项 / 权衡点</p>
                        <ul className="mt-2 space-y-1">
                          {item.tradeoffs.map((tradeoff) => (
                            <li className="flex gap-2 text-sm leading-6 text-[#7C2D12]" key={tradeoff}>
                              <span className="shrink-0">•</span>
                              <span>{tradeoff}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {result.alternatives.length ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">主推荐之外的备选方案</p>
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
          <div className="rounded-2xl border border-dashed border-[#E8E4DC] bg-white/70 p-4">
            <p className="text-sm font-semibold text-[#1E293B]">还没有推荐结果</p>
            <p className="mt-2 text-sm leading-6 text-[#64748B]">先输入预算和偏好，再生成推荐。</p>
            <ul className="mt-3 space-y-2 text-xs leading-6 text-[#94A3B8]">
              <li>• 预算支持单边界或区间，输入非数字会直接提示。</li>
              <li>• 结果会先展示主推荐，再展开理由和权衡点。</li>
              <li>• 请求失败时只显示可读提示，不暴露技术细节。</li>
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
