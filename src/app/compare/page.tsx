import Link from "next/link";
import {
  runFallbackAnalysis,
  type AiAnalysisOutput,
  type ChangedField,
} from "@/lib/ai-analysis";
import {
  allDevicesFlat,
  categoryLabels,
  formatMaybeCurrency,
  getDevicesBySeriesFlat,
  seriesNames,
} from "@/lib/devices-db";
import PageHeader from "@/components/layout/PageHeader";
import SectionHeader from "@/components/layout/SectionHeader";
import TickDivider from "@/components/layout/TickDivider";

type SearchParams = {
  series?: string | string[];
  window?: string | string[];
};

type ComparisonField = {
  label: string;
  getValue: (device: (typeof allDevicesFlat)[number]) => string;
  isNumeric?: boolean;
};

const comparisonFields: ComparisonField[] = [
  { label: "芯片", getValue: (device) => device.chip || "待补充" },
  {
    label: "屏幕尺寸",
    getValue: (device) => (typeof device.screenSize === "number" ? `${device.screenSize}"` : "待补充"),
    isNumeric: true,
  },
  {
    label: "刷新率",
    getValue: (device) => (typeof device.refreshRate === "number" ? `${device.refreshRate}Hz` : "待补充"),
    isNumeric: true,
  },
  {
    label: "重量",
    getValue: (device) => (typeof device.weight === "number" ? `${device.weight}g` : "待补充"),
    isNumeric: true,
  },
  {
    label: "起售价",
    getValue: (device) => formatMaybeCurrency(device.launchPrice),
    isNumeric: true,
  },
  {
    label: "AI 能力",
    getValue: (device) =>
      typeof device.aiFeatureLevel === "number" ? `${device.aiFeatureLevel}/10` : "待补充",
    isNumeric: true,
  },
  {
    label: "主摄像素",
    getValue: (device) =>
      typeof device.mainCameraMp === "number" ? `${device.mainCameraMp}MP` : "待补充",
    isNumeric: true,
  },
  { label: "接口", getValue: (device) => device.port || "待补充" },
  { label: "电池", getValue: (device) => (device.specs?.batteryLife as string | undefined) || "待补充" },
];

function normalizeSeries(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" && raw.trim().length > 0 ? raw : "";
}

function normalizeWindow(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "all" ? "all" : "recent3";
}

function formatNumber(value: number, fractionDigits = 1) {
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

function formatSignedNumber(value: number, fractionDigits = 1) {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatNumber(Math.abs(value), fractionDigits)}`;
}

function buildComparisonValue(device: (typeof allDevicesFlat)[number], field: ComparisonField) {
  return field.getValue(device);
}

function compareValueLabel(field: ComparisonField, first: string, last: string) {
  if (first === last) {
    return "持平";
  }

  if (!field.isNumeric) {
    return "已更新";
  }

  const firstNumber = Number(first.replace(/[^\d.-]/g, ""));
  const lastNumber = Number(last.replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(firstNumber) || !Number.isFinite(lastNumber) || firstNumber === 0) {
    return "已更新";
  }

  const change = lastNumber - firstNumber;
  const changeRate = (change / firstNumber) * 100;
  const prefix = change > 0 ? "+" : "−";
  const unit = field.label.includes("重量")
    ? "g"
    : field.label.includes("起售价")
      ? "¥"
      : field.label.includes("屏幕")
        ? "\""
        : field.label.includes("刷新率")
          ? "Hz"
          : "";

  if (field.label.includes("起售价")) {
    return `${prefix}¥${formatNumber(Math.abs(change), 0)} / ${prefix}${formatNumber(Math.abs(changeRate), 0)}%`;
  }

  if (unit === "\"") {
    return `${prefix}${formatNumber(Math.abs(change), 1)}${unit}`;
  }

  return `${prefix}${formatNumber(Math.abs(change), 0)}${unit}`;
}

function buildChangedFields(
  previous: (typeof allDevicesFlat)[number] | null,
  latest: (typeof allDevicesFlat)[number] | null,
): ChangedField[] {
  if (!previous || !latest) return [];

  return comparisonFields
    .map((field) => {
      const previousValue = buildComparisonValue(previous, field);
      const currentValue = buildComparisonValue(latest, field);
      if (previousValue === currentValue) return null;

      return {
        label: field.label,
        previousValue,
        currentValue,
      };
    })
    .filter((item): item is ChangedField => item !== null)
    .slice(0, 6);
}

function buildSeriesOptions() {
  return seriesNames
    .map((series) => {
      const devices = getDevicesBySeriesFlat(series);
      const latest = devices.at(-1) ?? null;
      return {
        series,
        label: series,
        category: latest ? categoryLabels[latest.category] : "Apple",
        count: devices.length,
        latestYear: latest?.releaseYear ?? 0,
      };
    })
    .filter((item) => item.count >= 2)
    .sort((left, right) => {
      if (right.latestYear !== left.latestYear) return right.latestYear - left.latestYear;
      if (right.count !== left.count) return right.count - left.count;
      return left.series.localeCompare(right.series, "zh-CN");
    });
}

function FieldBadge({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "green" | "amber";
}) {
  return (
    <div className="card p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">{label}</div>
      <div className={`mt-2 text-sm font-medium ${tone === "green" ? "text-[var(--primary)]" : tone === "amber" ? "text-[var(--accent-strong)]" : "text-[var(--text-strong)]"}`}>
        {value}
      </div>
    </div>
  );
}

function CompareMetricRow({
  field,
  devices,
}: {
  field: ComparisonField;
  devices: (typeof allDevicesFlat)[number][];
}) {
  const first = devices[0];
  const last = devices[devices.length - 1];
  const firstValue = first ? buildComparisonValue(first, field) : "待补充";
  const lastValue = last ? buildComparisonValue(last, field) : "待补充";

  return (
    <div className="grid gap-3 border-t border-[rgba(221,213,199,0.72)] py-4 lg:grid-cols-[160px_minmax(0,1fr)_140px]">
      <div>
        <div className="text-sm font-semibold text-[var(--text-strong)]">{field.label}</div>
        <div className="mt-1 text-xs leading-6 text-[var(--text-soft)]">真实数据库字段</div>
      </div>

      <div className="grid gap-2 sm:grid-cols-[repeat(auto-fit,minmax(160px,1fr))]">
        {devices.map((device) => (
          <div key={device.id} className="rounded-2xl bg-[var(--bg-soft)] p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
              {device.releaseYear}
            </div>
            <div className="mt-1 text-sm font-medium text-[var(--text-strong)]">{buildComparisonValue(device, field)}</div>
            <div className="mt-1 text-[11px] text-[var(--text-muted)]">{device.model}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-[var(--primary-soft)] p-3 text-right">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">变化</div>
        <div className="mt-1 text-sm font-semibold text-[var(--text-strong)]">{compareValueLabel(field, firstValue, lastValue)}</div>
      </div>
    </div>
  );
}

function AnalysisPanel({ analysis }: { analysis: AiAnalysisOutput }) {
  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="tag tag-green">本地规则洞察</span>
        <span className="tag tag-neutral">来源：本地规则</span>
        <span className="tag tag-amber">可信度 {Math.round(analysis.confidence * 100)}%</span>
      </div>

      <p className="mt-4 text-base leading-8 text-[var(--text-muted)]">{analysis.summary}</p>

      <div className="mt-5 grid gap-3">
        <div className="rounded-2xl bg-[var(--bg-soft)] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">事实</div>
          <ul className="mt-2 space-y-2 text-sm leading-7 text-[var(--text-muted)]">
            {analysis.facts.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl bg-[var(--bg-soft)] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">解读</div>
          <ul className="mt-2 space-y-2 text-sm leading-7 text-[var(--text-muted)]">
            {analysis.insights.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <FieldBadge label="购买建议" value={analysis.buyingAdvice} tone="green" />
        <FieldBadge label="趋势判断" value={analysis.prediction} tone="amber" />
      </div>

      <div className="mt-4 rounded-2xl border border-[var(--border)] bg-white/75 p-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">缺失信息</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {analysis.missingData.length > 0 ? (
            analysis.missingData.map((item) => (
              <span key={item} className="tag tag-neutral">
                {item}
              </span>
            ))
          ) : (
            <span className="text-sm leading-7 text-[var(--text-muted)]">当前对比字段已覆盖主要展示信息。</span>
          )}
        </div>
      </div>

      <p className="mt-4 text-xs leading-6 text-[var(--text-soft)]">{analysis.disclaimer}</p>
    </div>
  );
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const seriesOptions = buildSeriesOptions();
  const defaultSeries = seriesOptions.find((item) => item.series === "iPhone Pro")?.series ?? seriesOptions[0]?.series ?? "";
  const requestedSeries = normalizeSeries(resolvedSearchParams.series);
  const selectedSeries = seriesOptions.some((item) => item.series === requestedSeries) ? requestedSeries : defaultSeries;
  const selectedWindow = normalizeWindow(resolvedSearchParams.window);
  const seriesDevices = getDevicesBySeriesFlat(selectedSeries);
  const visibleDevices = selectedWindow === "all" ? seriesDevices : seriesDevices.slice(-3);
  const latest = seriesDevices.at(-1) ?? null;
  const previous = seriesDevices.at(-2) ?? null;
  const category = latest?.category ?? "phone";
  const analysis = runFallbackAnalysis({
    seriesName: selectedSeries || "Apple",
    category,
    categoryLabel: categoryLabels[category],
    devices: seriesDevices,
    latestDevice: latest,
    previousDevice: previous,
    changedFields: buildChangedFields(previous, latest),
    analysisType: "comparison_explanation",
  });

  const firstVisible = visibleDevices[0] ?? null;
  const lastVisible = visibleDevices.at(-1) ?? null;
  const summaryCards = visibleDevices.length >= 2 && firstVisible && lastVisible ? [
    {
      label: "对比跨度",
      value: `${visibleDevices.length} 代`,
      hint: selectedWindow === "all" ? "全部已收录代际" : "近 3 代",
    },
    {
      label: "首末价格变化",
      value:
        typeof firstVisible.launchPrice === "number" && typeof lastVisible.launchPrice === "number" && firstVisible.launchPrice > 0
          ? `${formatSignedNumber(lastVisible.launchPrice - firstVisible.launchPrice, 0)} / ${formatSignedNumber(((lastVisible.launchPrice - firstVisible.launchPrice) / firstVisible.launchPrice) * 100, 0)}%`
          : "待补充",
      hint: "首发价格对比",
    },
    {
      label: "屏幕变化",
      value:
        typeof firstVisible.screenSize === "number" && typeof lastVisible.screenSize === "number"
          ? `${formatSignedNumber(lastVisible.screenSize - firstVisible.screenSize, 1)}"`
          : "待补充",
      hint: "以英寸为单位",
    },
    {
      label: "AI 能力变化",
      value:
        typeof firstVisible.aiFeatureLevel === "number" && typeof lastVisible.aiFeatureLevel === "number"
          ? `${formatSignedNumber(lastVisible.aiFeatureLevel - firstVisible.aiFeatureLevel, 0)}/10`
          : "待补充",
      hint: "基于数据库字段",
    },
  ] : [];

  return (
    <main className="site-main">
      <PageHeader
        eyebrow="代际分析"
        title="代际对比"
        description="在同一系列里横向看见真实代际变化。所有参数和价格都来自本地设备数据库，不使用原型里的假统计。"
        actions={
          <>
            <Link href="/devices" className="btn btn-ghost">
              返回设备库
            </Link>
            <Link href="/advisor" className="btn btn-primary">
              去 AI 顾问
            </Link>
          </>
        }
        meta={
          <>
            <span className="tag tag-green">{categoryLabels[category]}</span>
            <span className="tag tag-neutral">{selectedSeries}</span>
            <span className="tag tag-amber">{selectedWindow === "all" ? "全部代际" : "近 3 代"}</span>
          </>
        }
      />

      <section className="section pt-0">
        <div className="section-inner grid gap-5">
          <SectionHeader
            eyebrow="系列选择"
            title="先选系列，再看代际"
            description="当前只展示 Apple 第一阶段样本。你可以在真实系列里切换，比较同一条产品线的代际变化。"
          />

          <div className="flex flex-wrap gap-2">
            {seriesOptions.map((item) => {
              const active = item.series === selectedSeries;
              const params = new URLSearchParams();
              params.set("series", item.series);
              params.set("window", selectedWindow);

              return (
                <Link
                  key={item.series}
                  href={`/compare?${params.toString()}`}
                  className={`tag ${active ? "tag-green" : "tag-neutral"}`}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                  <span className="opacity-70">({item.count})</span>
                </Link>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { key: "recent3", label: "近 3 代" },
              { key: "all", label: "全部" },
            ].map((item) => {
              const params = new URLSearchParams();
              params.set("series", selectedSeries);
              params.set("window", item.key);
              const active = item.key === selectedWindow;

              return (
                <Link
                  key={item.key}
                  href={`/compare?${params.toString()}`}
                  className={`tag ${active ? "tag-amber" : "tag-neutral"}`}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section pt-0">
        <div className="section-inner grid gap-5 xl:grid-cols-[1.15fr_0.85fr] xl:items-start">
          <div className="grid gap-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map((item) => (
                <FieldBadge key={item.label} label={item.label} value={item.value} tone="green" />
              ))}
            </div>

            <div className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="grid gap-1">
                  <span className="tag tag-green w-fit">系列时间线</span>
                  <h2 className="text-2xl leading-tight text-[var(--text-strong)]">
                    {selectedSeries} · {seriesDevices.length} 台样本
                  </h2>
                  <p className="text-sm leading-7 text-[var(--text-muted)]">
                    时间线按发布时间排序，横向比较可直接看出同系列代际变化。
                  </p>
                </div>
                <Link href={`/devices?category=${category}`} className="btn btn-ghost">
                  查看同类设备
                </Link>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {visibleDevices.map((device, index) => {
                  const active = index === visibleDevices.length - 1;
                  return (
                    <Link
                      key={device.id}
                      href={`/devices/${device.id}`}
                      className={`rounded-[24px] border p-4 transition ${
                        active
                          ? "border-[rgba(45,90,61,0.35)] bg-[var(--primary-soft)] shadow-[0_12px_30px_rgba(45,90,61,0.1)]"
                          : "border-[var(--border)] bg-[var(--bg-soft)]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="grid gap-1">
                          <span className="tag tag-neutral w-fit">{device.releaseYear}</span>
                          <h3 className="text-lg leading-tight text-[var(--text-strong)]">{device.model}</h3>
                        </div>
                        {active ? <span className="tag tag-green">当前代</span> : null}
                      </div>
                      <div className="mt-4 grid gap-2 text-sm leading-7 text-[var(--text-muted)]">
                        <div className="flex items-center justify-between gap-4">
                          <span>芯片</span>
                          <span className="font-medium text-[var(--text-strong)]">{device.chip || "待补充"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span>屏幕</span>
                          <span className="font-medium text-[var(--text-strong)]">
                            {typeof device.screenSize === "number" ? `${device.screenSize}"` : "待补充"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span>价格</span>
                          <span className="font-medium text-[var(--text-strong)]">{formatMaybeCurrency(device.launchPrice)}</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="card overflow-hidden p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">对比表</div>
                  <h2 className="mt-2 text-2xl leading-tight text-[var(--text-strong)]">核心规格逐项对照</h2>
                </div>
                <span className="tag tag-neutral">真实字段</span>
              </div>

              <div className="mt-5 overflow-x-auto">
                <div className="min-w-[720px]">
                  {comparisonFields.map((field) => (
                    <CompareMetricRow key={field.label} field={field} devices={visibleDevices} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <AnalysisPanel analysis={analysis} />
        </div>
      </section>

      <TickDivider className="site-container" />
    </main>
  );
}
