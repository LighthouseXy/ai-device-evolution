"use client";

import { type FormEvent, type ReactNode } from "react";
import {
  categoryLabels,
  type DeviceCategory,
} from "@/lib/device-categories";
import DeviceAdvisorResult from "@/components/DeviceAdvisorResult";
import { useSessionState } from "@/lib/use-session-state";
import type {
  DeviceAdvisorCategory,
  DeviceAdvisorOutput,
} from "@/lib/device-advisor";

type DeviceAdvisorPanelProps = {
  initialCategory: DeviceCategory;
  categories: DeviceCategory[];
};

const conditionPreferenceOptions = [
  { value: "new_only", label: "只看全新" },
  { value: "used_ok", label: "接受二手" },
  { value: "refurbished_ok", label: "接受翻新" },
] as const;

const batteryPriorityOptions = [
  { value: "balanced", label: "均衡" },
  { value: "high", label: "优先续航" },
] as const;

const useCaseSuggestionOptions = [
  "学习",
  "办公",
  "剪辑",
  "游戏",
  "拍照",
  "通勤",
  "追剧",
] as const;

const formControlClassName =
  "mt-1 h-10 w-full rounded-lg border border-[#E8E4DC] bg-[#FFFDF8] px-3 text-sm text-[#1E293B] outline-none transition focus:border-[var(--primary)]";
const textAreaClassName =
  "mt-1 min-h-16 w-full resize-y rounded-lg border border-[#E8E4DC] bg-[#FFFDF8] px-3 py-2 text-sm leading-6 text-[#1E293B] outline-none transition focus:border-[var(--primary)]";
const fieldLabelClassName = "text-xs font-semibold tracking-[0.08em] text-[#64748B]";

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className={fieldLabelClassName}>{children}</span>;
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <select
        className={formControlClassName}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function normalizeUseCases(text: string): string[] {
  return text
    .split(/[,\n/|，、]/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function appendUseCaseSuggestion(currentText: string, suggestion: string) {
  const items = normalizeUseCases(currentText);
  if (items.includes(suggestion)) {
    return items.join(" / ");
  }

  return [...items, suggestion].join(" / ");
}

function formatBudgetAmount(value: number) {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(value);
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

export default function DeviceAdvisorPanel({ initialCategory, categories }: DeviceAdvisorPanelProps) {
  const [budgetMin, setBudgetMin] = useSessionState("advisor:v1:budgetMin", 3000);
  const [budgetMax, setBudgetMax] = useSessionState("advisor:v1:budgetMax", 10000);
  const [category, setCategory] = useSessionState<DeviceAdvisorCategory>("advisor:v1:category", initialCategory);
  const [conditionPreference, setConditionPreference] = useSessionState<(typeof conditionPreferenceOptions)[number]["value"]>("advisor:v1:condition", "new_only");
  const [batteryPriority, setBatteryPriority] = useSessionState<(typeof batteryPriorityOptions)[number]["value"]>("advisor:v1:battery", "balanced");
  const [useCasesText, setUseCasesText] = useSessionState("advisor:v1:useCases", "办公 / 追剧");
  const [intent, setIntent] = useSessionState("advisor:v1:intent", "");
  // 导航切换保留进行中的请求状态，但刷新后不能恢复一个已失效的请求。
  const [loading, setLoading] = useSessionState("advisor:v1:loading", false, { persist: false });
  const [error, setError] = useSessionState("advisor:v1:error", "");
  const [result, setResult] = useSessionState<DeviceAdvisorOutput | null>("advisor:v1:result", null);

  const budgetPreview = `¥${formatBudgetAmount(budgetMin)} - ¥${formatBudgetAmount(budgetMax)}`;
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
        ? `设备顾问已生成推荐${result.devices[0] ? `，首选为 ${result.devices[0].model}` : ""}`
        : "设备顾问尚未生成推荐";
  const handleUseCaseSuggestion = (suggestion: string) => {
    clearError();
    setUseCasesText((current) => appendUseCaseSuggestion(current, suggestion));
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedUseCases = normalizeUseCases(useCasesText);

    setLoading(true);
    setError("");

    try {
      // 前端只发送用户偏好，不发送本地候选设备；候选排序、AI provider 和 fallback 都由 API 统一控制。
      const response = await fetch("/api/device-advisor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          budget: { min: budgetMin, max: budgetMax, currency: "CNY" },
          category,
          useCases: normalizedUseCases,
          intent: intent.trim() || undefined,
          conditionPreference,
          batteryPriority,
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
    <section className="card min-w-0 max-w-full overflow-hidden">
      <div className="border-b border-[#E8E4DC] p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-base font-semibold text-[#1E293B]">设备顾问</p>
            <p className="mt-1 text-[13px] text-[#94A3B8]">预算、设备类型与使用场景</p>
          </div>
          <span className="inline-flex shrink-0 self-start rounded-full bg-[var(--primary-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--primary)]">
            API 调用
          </span>
        </div>
      </div>

      <form className="min-w-0 space-y-4 p-4 sm:p-5" onSubmit={submit}>
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {statusText}
        </p>

        <fieldset className="min-w-0 space-y-4" disabled={loading} aria-busy={loading}>
          <div className="min-w-0 rounded-xl border border-[#E8E4DC] bg-[#FFFDF8] p-3 sm:p-4">
            <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <FieldLabel>预算区间</FieldLabel>
              <output className="min-w-0 max-w-full break-words text-right text-sm font-semibold text-[var(--primary-strong)]" aria-live="polite">
                {budgetPreview}
              </output>
            </div>
            <div className="mt-3">
              <div className="relative h-8" role="group" aria-label="预算上下限">
                <div
                  className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full"
                  style={{
                    background: `linear-gradient(to right, #E8E4DC 0%, #E8E4DC ${(budgetMin / 30000) * 100}%, var(--primary) ${(budgetMin / 30000) * 100}%, var(--accent) ${(budgetMax / 30000) * 100}%, #E8E4DC ${(budgetMax / 30000) * 100}%, #E8E4DC 100%)`,
                  }}
                  aria-hidden="true"
                />
                <input
                  className={`advisor-budget-range ${budgetMin > 28500 ? "z-30" : "z-20"}`}
                  type="range"
                  min="0"
                  max="30000"
                  step="500"
                  value={budgetMin}
                  onChange={(event) => {
                    clearError();
                    setBudgetMin(Math.min(Number(event.target.value), budgetMax));
                  }}
                  aria-label="预算下限"
                  aria-valuetext={`${budgetMin} 元`}
                />
                <input
                  className="advisor-budget-range z-20"
                  type="range"
                  min="0"
                  max="30000"
                  step="500"
                  value={budgetMax}
                  onChange={(event) => {
                    clearError();
                    setBudgetMax(Math.max(Number(event.target.value), budgetMin));
                  }}
                  aria-label="预算上限"
                  aria-valuetext={`${budgetMax} 元`}
                />
              </div>
              <div className="mt-1 flex items-center justify-between gap-3 text-sm text-[#64748B]">
                <span>下限 ¥{formatBudgetAmount(budgetMin)}</span>
                <span className="text-right">上限 ¥{formatBudgetAmount(budgetMax)}</span>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block sm:col-span-1">
              <FieldLabel>设备类型</FieldLabel>
              <select
                className={formControlClassName}
                value={category}
                onChange={(event) => {
                  clearError();
                  setCategory(event.target.value as DeviceAdvisorCategory);
                }}
              >
                <option value="all">全品类</option>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {categoryLabels[item]}
                  </option>
                ))}
              </select>
            </label>

            <SelectField
              label="成色偏好"
              value={conditionPreference}
              options={conditionPreferenceOptions}
              onChange={(value) => {
                clearError();
                setConditionPreference(value);
              }}
            />

            <SelectField
              label="续航优先级"
              value={batteryPriority}
              options={batteryPriorityOptions}
              onChange={(value) => {
                clearError();
                setBatteryPriority(value);
              }}
            />
          </div>

          <label className="block">
            <FieldLabel>使用场景</FieldLabel>
            <textarea
              className={textAreaClassName}
              placeholder="例如：学习 / 办公 / 剪辑 / 游戏 / 拍照"
              value={useCasesText}
              onChange={(event) => {
                clearError();
                setUseCasesText(event.target.value);
              }}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {useCaseSuggestionOptions.map((item) => (
                <button
                  key={item}
                  className="inline-flex h-8 items-center rounded-full border border-[#E8E4DC] bg-white px-3 text-xs text-[#475569] transition hover:border-[rgba(45,90,61,0.24)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary-strong)]"
                  type="button"
                  onClick={() => handleUseCaseSuggestion(item)}
                >
                  + {item}
                </button>
              ))}
            </div>
          </label>

          <label className="block">
            <FieldLabel>文本描述与补充</FieldLabel>
            <textarea
              className={textAreaClassName}
              placeholder="例如：开发编程，至少24GB内存，至少1TB存储；经常出差，希望轻便"
              value={intent}
              onChange={(event) => {
                clearError();
                setIntent(event.target.value);
              }}
            />
          </label>

          <div className="flex justify-end">
            <button
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--primary)] px-4 text-sm font-medium text-white transition hover:bg-[var(--primary-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? "生成中..." : "生成推荐"}
            </button>
          </div>
        </fieldset>
      </form>

      <DeviceAdvisorResult loading={loading} error={error} result={result} />
    </section>
  );
}
