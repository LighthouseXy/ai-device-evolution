"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  categoryLabels,
  categoryNames,
  type DeviceCategory,
} from "@/lib/devices-db";
import DeviceAdvisorResult from "@/components/DeviceAdvisorResult";
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
  "mt-1 min-h-24 w-full rounded-lg border border-[#E8E4DC] bg-[#FFFDF8] px-3 py-2 text-sm leading-6 text-[#1E293B] outline-none transition focus:border-[var(--primary)]";
const fieldLabelClassName = "text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]";

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

function getOptionLabel<T extends string>(
  options: readonly { value: T; label: string }[],
  value: T,
) {
  return options.find((item) => item.value === value)?.label ?? value;
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
  // 预算输入在客户端先做一次宽松归一化：允许只填上限/下限，区间写反时自动交换。
  // 服务端仍会再次 normalize，避免前端状态被绕过时污染推荐逻辑。
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
  const useCasePreview = useMemo(() => normalizeUseCases(useCasesText), [useCasesText]);
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
  const handleUseCaseSuggestion = (suggestion: string) => {
    clearError();
    setUseCasesText((current) => appendUseCaseSuggestion(current, suggestion));
  };
  const summaryTags = [
    `预算：${budgetState.preview}`,
    `类别：${category === "all" ? "全品类" : categoryLabels[category]}`,
    `性能：${getOptionLabel(performancePreferenceOptions, performancePreference)}`,
    `成色：${getOptionLabel(conditionPreferenceOptions, conditionPreference)}`,
    `续航：${getOptionLabel(batteryPriorityOptions, batteryPriority)}`,
    `接口：${getOptionLabel(interfaceNeedOptions, interfaceNeed)}`,
  ];

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
      // 前端只发送用户偏好，不发送本地候选设备；候选排序、AI provider 和 fallback 都由 API 统一控制。
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
          <span className="inline-flex rounded-full bg-[var(--primary-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--primary)]">
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
              <FieldLabel>预算下限</FieldLabel>
              <input
                className={formControlClassName}
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
              <FieldLabel>预算上限</FieldLabel>
              <input
                className={formControlClassName}
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
                {categoryNames.map((item) => (
                  <option key={item} value={item}>
                    {categoryLabels[item]}
                  </option>
                ))}
              </select>
            </label>

            <SelectField
              label="性能偏好"
              value={performancePreference}
              options={performancePreferenceOptions}
              onChange={(value) => {
                  clearError();
                  setPerformancePreference(value);
              }}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
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

          <SelectField
            label="接口 / 生态需求"
            value={interfaceNeed}
            options={interfaceNeedOptions}
            onChange={(value) => {
                clearError();
                setInterfaceNeed(value);
            }}
          />

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
            <div className="mt-2">
              <p className={fieldLabelClassName}>快捷场景</p>
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
              <p className="mt-2 text-[10px] leading-relaxed text-[#94A3B8]">点击可追加场景；重复项会自动去重。</p>
            </div>
          </label>

        <div className="rounded-xl border border-[#E8E4DC] bg-white p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className={fieldLabelClassName}>提交前摘要</p>
              <p className="mt-1 text-xs text-[#64748B]">
                场景已整理为 {useCasePreview.length || 0} 项，提交前快速确认即可。
              </p>
            </div>
            <button
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--primary)] px-4 text-sm font-medium text-white transition hover:bg-[var(--primary-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? "生成中..." : "生成推荐"}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {summaryTags.map((item) => (
              <span
                className="rounded-full bg-[var(--primary-soft)] px-2.5 py-1 text-[11px] text-[var(--primary-strong)]"
                key={item}
              >
                {item}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-[#94A3B8]">
            场景：{useCasePreview.length ? useCasePreview.join(" · ") : "未填写"}
          </p>
        </div>
        </fieldset>
      </form>

      <DeviceAdvisorResult loading={loading} error={error} result={result} />
    </section>
  );
}
