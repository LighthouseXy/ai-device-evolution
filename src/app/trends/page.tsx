import Link from "next/link";
import { runFallbackAnalysis } from "@/lib/ai-analysis";
import {
  allDevicesFlat,
  categoryLabels,
  categoryNames,
  formatMaybeCurrency,
  getDevicesBySeriesFlat,
  getSeriesByCategoryFlat,
} from "@/lib/devices-db";
import PageHeader from "@/components/layout/PageHeader";
import SectionHeader from "@/components/layout/SectionHeader";
import TickDivider from "@/components/layout/TickDivider";

type SearchParams = {
  category?: string | string[];
  metric?: string | string[];
};

type MetricKey = "price" | "screen" | "weight" | "ai" | "camera" | "refresh";

type MetricDefinition = {
  key: MetricKey;
  label: string;
  shortLabel: string;
  description: string;
  unit: string;
  getValue: (device: (typeof allDevicesFlat)[number]) => number | undefined;
  format: (value: number) => string;
};

const metrics: MetricDefinition[] = [
  {
    key: "price",
    label: "起售价",
    shortLabel: "价格",
    description: "按年份统计该类别设备的首发价格均值。",
    unit: "¥",
    getValue: (device) => device.launchPrice,
    format: (value) => formatMaybeCurrency(value),
  },
  {
    key: "ai",
    label: "AI 能力",
    shortLabel: "AI",
    description: "基于数据库中的 AI 能力等级字段。",
    unit: "/10",
    getValue: (device) => device.aiFeatureLevel,
    format: (value) => `${formatNumber(value, 1)}/10`,
  },
  {
    key: "screen",
    label: "屏幕尺寸",
    shortLabel: "屏幕",
    description: "按年份统计屏幕尺寸均值。",
    unit: '"',
    getValue: (device) => device.screenSize,
    format: (value) => `${formatNumber(value, 1)}"`,
  },
  {
    key: "weight",
    label: "机身重量",
    shortLabel: "重量",
    description: "按年份统计重量均值，适合观察便携性变化。",
    unit: "g",
    getValue: (device) => device.weight,
    format: (value) => `${formatNumber(value, 0)}g`,
  },
  {
    key: "camera",
    label: "主摄像素",
    shortLabel: "摄像头",
    description: "按年份统计主摄像素均值。",
    unit: "MP",
    getValue: (device) => device.mainCameraMp,
    format: (value) => `${formatNumber(value, 0)}MP`,
  },
  {
    key: "refresh",
    label: "刷新率",
    shortLabel: "刷新率",
    description: "按年份统计刷新率均值。",
    unit: "Hz",
    getValue: (device) => device.refreshRate,
    format: (value) => `${formatNumber(value, 0)}Hz`,
  },
];

function normalizeCategory(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return categoryNames.includes(raw as (typeof categoryNames)[number]) ? (raw as (typeof categoryNames)[number]) : "phone";
}

function normalizeMetric(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return metrics.some((metric) => metric.key === raw) ? (raw as MetricKey) : "ai";
}

function formatNumber(value: number, fractionDigits = 1) {
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildYearTrend(
  devices: (typeof allDevicesFlat)[number][],
  metric: MetricDefinition,
) {
  const years = Array.from(new Set(devices.map((device) => device.releaseYear))).sort((left, right) => left - right);
  return years.map((year) => {
    const yearDevices = devices.filter((device) => device.releaseYear === year);
    const values = yearDevices.map(metric.getValue).filter((value): value is number => typeof value === "number");
    return {
      year,
      count: yearDevices.length,
      value: average(values),
    };
  });
}

function formatDeltaText(
  previous: number | null,
  current: number | null,
  metric: MetricDefinition,
) {
  if (previous === null || current === null) return "待补充";
  const delta = current - previous;
  if (Math.abs(delta) < 0.0001) return "持平";

  if (metric.key === "price") {
    const sign = delta > 0 ? "+" : "−";
    const rate = previous !== 0 ? Math.abs((delta / previous) * 100) : 0;
    return `${sign}${formatNumber(Math.abs(delta), 0)}，${sign}${formatNumber(rate, 0)}%`;
  }

  const sign = delta > 0 ? "+" : "−";
  const decimals = metric.key === "weight" || metric.key === "camera" || metric.key === "refresh" ? 0 : 1;
  return `${sign}${formatNumber(Math.abs(delta), decimals)}${metric.unit}`;
}

function pickRepresentativeSeries(category: (typeof categoryNames)[number]) {
  return getSeriesByCategoryFlat(category)
    .map((series) => {
      const devices = getDevicesBySeriesFlat(series);
      return {
        series,
        devices,
        latestYear: devices.at(-1)?.releaseYear ?? 0,
      };
    })
    .filter((item) => item.devices.length >= 2)
    .sort((left, right) => {
      if (right.devices.length !== left.devices.length) return right.devices.length - left.devices.length;
      if (right.latestYear !== left.latestYear) return right.latestYear - left.latestYear;
      return left.series.localeCompare(right.series, "zh-CN");
    })[0];
}

function TrendChart({
  points,
  metric,
}: {
  points: ReturnType<typeof buildYearTrend>;
  metric: MetricDefinition;
}) {
  const maxValue = Math.max(...points.map((point) => point.value ?? 0), 1);

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <span className="tag tag-green w-fit">趋势图</span>
          <h2 className="text-2xl leading-tight text-[var(--text-strong)]">{metric.label} · 年度变化</h2>
          <p className="text-sm leading-7 text-[var(--text-muted)]">{metric.description}</p>
        </div>
        <span className="tag tag-neutral">均值口径 / 年度聚合</span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
        {points.map((point) => {
          const height = point.value === null ? 0 : Math.max(14, (point.value / maxValue) * 100);

          return (
            <div key={point.year} className="grid gap-2">
              <div className="flex h-56 items-end rounded-[28px] bg-[var(--bg-soft)] p-3">
                <div
                  className="relative w-full overflow-hidden rounded-[22px] bg-[linear-gradient(180deg,rgba(45,90,61,0.18),rgba(232,168,56,0.72))]"
                  style={{ height: `${height}%` }}
                >
                  {point.value !== null ? (
                    <div className="absolute inset-x-0 top-2 text-center text-[11px] font-semibold text-[var(--text-strong)]">
                      {metric.format(point.value)}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm font-semibold text-[var(--text-strong)]">{point.year}</div>
                <div className="mt-1 text-[11px] text-[var(--text-soft)]">{point.count} 台</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {points.map((point) => (
          <span key={point.year} className="tag tag-neutral">
            {point.year}: {point.value === null ? "待补充" : metric.format(point.value)}
          </span>
        ))}
      </div>
    </div>
  );
}

function TrendCard({
  title,
  value,
  hint,
  tone = "neutral",
}: {
  title: string;
  value: string;
  hint: string;
  tone?: "neutral" | "green" | "amber";
}) {
  return (
    <div className="card p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">{title}</div>
      <div className={`mt-2 text-xl font-semibold ${tone === "green" ? "text-[var(--primary)]" : tone === "amber" ? "text-[var(--accent-strong)]" : "text-[var(--text-strong)]"}`}>{value}</div>
      <div className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{hint}</div>
    </div>
  );
}

export default async function TrendsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const selectedCategory = normalizeCategory(resolvedSearchParams.category);
  const selectedMetricKey = normalizeMetric(resolvedSearchParams.metric);
  const metric = metrics.find((item) => item.key === selectedMetricKey) ?? metrics[0];

  const categoryDevices = allDevicesFlat.filter((device) => device.category === selectedCategory);
  const yearTrend = buildYearTrend(categoryDevices, metric);
  const firstPoint = yearTrend[0]?.value ?? null;
  const lastPoint = yearTrend.at(-1)?.value ?? null;
  let maxPoint: (typeof yearTrend)[number] | null = null;
  for (const point of yearTrend) {
    if (point.value === null) continue;
    if (maxPoint === null || (maxPoint.value !== null && point.value > maxPoint.value)) {
      maxPoint = point;
    }
  }
  const representative = pickRepresentativeSeries(selectedCategory);
  const representativeDevices = representative?.devices ?? [];
  const trendAnalysis = representative
    ? runFallbackAnalysis({
        seriesName: representative.series,
        category: selectedCategory,
        categoryLabel: categoryLabels[selectedCategory],
        devices: representativeDevices,
        latestDevice: representativeDevices.at(-1) ?? null,
        previousDevice: representativeDevices.at(-2) ?? null,
        changedFields: [],
        analysisType: "trend_prediction",
      })
    : null;

  const categoryOptions = categoryNames.map((category) => ({
    key: category,
    label: categoryLabels[category],
    count: allDevicesFlat.filter((device) => device.category === category).length,
  }));

  const trendDirection =
    firstPoint !== null && lastPoint !== null
      ? formatDeltaText(firstPoint, lastPoint, metric)
      : "待补充";

  return (
    <main className="site-main">
      <PageHeader
        eyebrow="数据洞察"
        title="趋势观察"
        description="按真实数据库里的年度样本看变化，不用原型里的假图表。这里可以切类别、切指标，再看同类设备在时间轴上的演进。"
        actions={
          <>
            <Link href="/compare" className="btn btn-ghost">
              去代际对比
            </Link>
            <Link href="/advisor" className="btn btn-primary">
              去 AI 顾问
            </Link>
          </>
        }
        meta={
          <>
            <span className="tag tag-green">{categoryLabels[selectedCategory]}</span>
            <span className="tag tag-neutral">{metric.label}</span>
            <span className="tag tag-amber">Apple 样本阶段</span>
          </>
        }
      />

      <section className="section pt-0">
        <div className="section-inner grid gap-5">
          <SectionHeader
            eyebrow="筛选"
            title="先选类别和指标"
            description="当前趋势页只使用本地真实设备数据。每个年度点都是该类别当年已收录机型的均值。"
          />

          <div className="flex flex-wrap gap-2">
            {categoryOptions.map((item) => {
              const params = new URLSearchParams();
              params.set("category", item.key);
              params.set("metric", selectedMetricKey);
              const active = item.key === selectedCategory;

              return (
                <Link
                  key={item.key}
                  href={`/trends?${params.toString()}`}
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
            {metrics.map((item) => {
              const params = new URLSearchParams();
              params.set("category", selectedCategory);
              params.set("metric", item.key);
              const active = item.key === selectedMetricKey;

              return (
                <Link
                  key={item.key}
                  href={`/trends?${params.toString()}`}
                  className={`tag ${active ? "tag-amber" : "tag-neutral"}`}
                  aria-current={active ? "page" : undefined}
                >
                  {item.shortLabel}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section pt-0">
        <div className="section-inner grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="grid gap-5">
            <TrendChart points={yearTrend} metric={metric} />

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <TrendCard
                title="起始年份"
                value={yearTrend[0]?.year?.toString() ?? "待补充"}
                hint="当前类别最早收录样本年份。"
                tone="green"
              />
              <TrendCard
                title="最新年份"
                value={yearTrend.at(-1)?.year?.toString() ?? "待补充"}
                hint="当前类别最新收录样本年份。"
              />
              <TrendCard
                title="最大值年份"
                value={maxPoint ? `${maxPoint.year} · ${metric.format(maxPoint.value ?? 0)}` : "待补充"}
                hint="年度均值最高的点。"
                tone="amber"
              />
              <TrendCard
                title="总体变化"
                value={trendDirection}
                hint="以首末年份均值计算变化。"
              />
            </div>
          </div>

          <div className="card h-full p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="tag tag-green">AI 观察</span>
              <span className="tag tag-neutral">
                {representative ? `样本：${representative.series}` : "样本不足"}
              </span>
            </div>

            {trendAnalysis ? (
              <>
                <h2 className="mt-4 text-2xl leading-tight text-[var(--text-strong)]">
                  {trendAnalysis.summary}
                </h2>
                <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
                  {trendAnalysis.prediction}
                </p>

                <div className="mt-5 grid gap-3">
                  <div className="rounded-2xl bg-[var(--bg-soft)] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">分析要点</div>
                    <ul className="mt-2 space-y-2 text-sm leading-7 text-[var(--text-muted)]">
                      {trendAnalysis.insights.map((item) => (
                        <li key={item} className="flex gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-2xl bg-[var(--bg-soft)] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">缺失信息</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {trendAnalysis.missingData.map((item) => (
                        <span key={item} className="tag tag-neutral">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <TrendCard
                    title="样本设备"
                    value={`${representativeDevices.length} 台`}
                    hint="AI 观察使用的系列样本量。"
                    tone="green"
                  />
                  <TrendCard
                    title="可信度"
                    value={`${Math.round(trendAnalysis.confidence * 100)}%`}
                    hint={`来源：${trendAnalysis.source === "ai" ? "模型" : "规则"}。`}
                    tone="amber"
                  />
                </div>

                <p className="mt-4 text-xs leading-6 text-[var(--text-soft)]">{trendAnalysis.disclaimer}</p>
              </>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-[var(--border)] bg-white/70 p-4">
                <p className="text-sm font-semibold text-[var(--text-strong)]">暂无可用样本</p>
                <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">当前类别数据不足，无法生成趋势观察。</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <TickDivider className="site-container" />
    </main>
  );
}
