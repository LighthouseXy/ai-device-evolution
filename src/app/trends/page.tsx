import Link from "next/link";
import {
  allDevicesFlat,
  categoryLabels,
  categoryNames,
  deviceCountByCategory,
  formatMaybeCurrency,
  getComparisonGroupsByCategoryFlat,
  getDevicesByComparisonGroupKeyFlat,
} from "@/lib/devices-db";
import {
  formatSignedZhNumber,
  formatZhNumber,
} from "@/lib/number-format";
import PageHeader from "@/components/layout/PageHeader";
import TickDivider from "@/components/layout/TickDivider";

type SearchParams = {
  category?: string | string[];
  series?: string | string[];
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
    description: "按年份统计该系列设备的首发价格均值。",
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
    format: (value) => `${formatZhNumber(value, 1)}/10`,
  },
  {
    key: "screen",
    label: "屏幕尺寸",
    shortLabel: "屏幕",
    description: "按年份统计该系列设备的屏幕尺寸均值。",
    unit: '"',
    getValue: (device) => device.screenSize,
    format: (value) => `${formatZhNumber(value, 1)}"`,
  },
  {
    key: "weight",
    label: "机身重量",
    shortLabel: "重量",
    description: "按年份统计该系列设备的重量均值，适合观察便携性变化。",
    unit: "g",
    getValue: (device) => device.weight,
    format: (value) => `${formatZhNumber(value, 0)}g`,
  },
  {
    key: "camera",
    label: "主摄像素",
    shortLabel: "摄像头",
    description: "按年份统计该系列设备的主摄像素均值。",
    unit: "MP",
    getValue: (device) => device.mainCameraMp,
    format: (value) => `${formatZhNumber(value, 0)}MP`,
  },
  {
    key: "refresh",
    label: "刷新率",
    shortLabel: "刷新率",
    description: "按年份统计该系列设备的刷新率均值。",
    unit: "Hz",
    getValue: (device) => device.refreshRate,
    format: (value) => `${formatZhNumber(value, 0)}Hz`,
  },
];

function normalizeCategory(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return categoryNames.includes(raw as (typeof categoryNames)[number]) ? (raw as (typeof categoryNames)[number]) : "phone";
}

function normalizeMetric(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return metrics.some((metric) => metric.key === raw) ? (raw as MetricKey) : "price";
}

function normalizeSeries(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? raw : "";
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
    const rate = previous !== 0 ? Math.abs((delta / previous) * 100) : 0;
    return `${formatSignedZhNumber(delta, 0)}，${formatSignedZhNumber(delta > 0 ? rate : -rate, 0)}%`;
  }

  const decimals = metric.key === "weight" || metric.key === "camera" || metric.key === "refresh" ? 0 : 1;
  return `${formatSignedZhNumber(delta, decimals)}${metric.unit}`;
}

function TrendChart({
  points,
  metric,
  category,
  series,
}: {
  points: ReturnType<typeof buildYearTrend>;
  metric: MetricDefinition;
  category: (typeof categoryNames)[number];
  series: string;
}) {
  const chartPoints = points.filter((point): point is typeof point & { value: number } => point.value !== null);
  const values = chartPoints.map((point) => point.value);
  const minValue = Math.min(...values, 0);
  const maxValue = Math.max(...values, 1);
  const range = maxValue - minValue || 1;
  const x = (index: number) => 48 + (index * 624) / Math.max(chartPoints.length - 1, 1);
  const y = (value: number) => 196 - ((value - minValue) / range) * 152;
  const linePoints = chartPoints.map((point, index) => `${x(index)},${y(point.value)}`).join(" ");

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1">
          <span className="tag tag-green w-fit">趋势图</span>
          <h2 className="text-2xl leading-tight text-[var(--text-strong)]">{series} · {metric.label}</h2>
          <p className="text-sm leading-7 text-[var(--text-muted)]">{metric.description}</p>
        </div>
        <div className="grid max-w-full justify-items-start gap-2 sm:justify-items-end">
          <span className="tag tag-neutral">同系列 / 年度聚合</span>
          <div className="flex max-w-full gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:justify-end">
            {metrics.map((item) => {
              const params = new URLSearchParams({ category, series, metric: item.key });
              return (
                <Link
                  key={item.key}
                  href={`/trends?${params.toString()}`}
                  className={`tag shrink-0 ${item.key === metric.key ? "tag-amber" : "tag-neutral"}`}
                  aria-current={item.key === metric.key ? "page" : undefined}
                >
                  {item.shortLabel}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mx-auto mt-5 max-w-4xl overflow-x-auto pb-2">
        <svg className="w-full min-w-[680px]" viewBox="0 0 720 250" role="img" aria-label={`${series}${metric.label}年度折线图`}>
          <defs>
            <linearGradient id="trend-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.2" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.03" />
            </linearGradient>
          </defs>
          {[44, 82, 120, 158, 196].map((gridY) => (
            <line key={gridY} x1="48" x2="672" y1={gridY} y2={gridY} stroke="var(--border)" strokeWidth="1" />
          ))}
          {chartPoints.length > 1 ? (
            <polygon points={`48,196 ${linePoints} 672,196`} fill="url(#trend-area)" />
          ) : null}
          <polyline points={linePoints} fill="none" stroke="var(--primary)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          {chartPoints.map((point, index) => (
            <g key={point.year}>
              <circle cx={x(index)} cy={y(point.value)} r="6" fill="var(--accent)" stroke="white" strokeWidth="3" />
              <text x={x(index)} y={Math.max(24, y(point.value) - 13)} textAnchor="middle" className="fill-[var(--text-strong)] text-[10px] font-semibold">
                {metric.format(point.value)}
              </text>
              <text x={x(index)} y="222" textAnchor="middle" className="fill-[var(--text-strong)] text-[11px] font-semibold">
                {point.year}
              </text>
              <text x={x(index)} y="239" textAnchor="middle" className="fill-[var(--text-soft)] text-[9px]">
                {point.count} 台
              </text>
            </g>
          ))}
        </svg>
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

  const seriesOptions = getComparisonGroupsByCategoryFlat(selectedCategory).filter(
    (group) => group.devices.length >= 2,
  );
  const requestedSeries = normalizeSeries(resolvedSearchParams.series);
  const requestedGroupId = getDevicesByComparisonGroupKeyFlat(requestedSeries)[0]?.comparisonGroupId;
  const selectedSeries = seriesOptions.some((group) => group.key === requestedGroupId)
    ? requestedGroupId
    : seriesOptions[0]?.key ?? "";
  const selectedSeriesOption = seriesOptions.find((group) => group.key === selectedSeries) ?? null;
  const seriesDevices = getDevicesByComparisonGroupKeyFlat(selectedSeries);
  const yearTrend = buildYearTrend(seriesDevices, metric);
  const firstPoint = yearTrend[0]?.value ?? null;
  const lastPoint = yearTrend.at(-1)?.value ?? null;
  let maxPoint: (typeof yearTrend)[number] | null = null;
  for (const point of yearTrend) {
    if (point.value === null) continue;
    if (maxPoint === null || (maxPoint.value !== null && point.value > maxPoint.value)) {
      maxPoint = point;
    }
  }
  const categoryOptions = categoryNames.map((category) => ({
    key: category,
    label: categoryLabels[category],
    count: deviceCountByCategory[category],
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
        meta={
          <>
            <span className="tag tag-green">{categoryLabels[selectedCategory]}</span>
            <span className="tag tag-neutral">{selectedSeriesOption?.label ?? "待补充"}</span>
            <span className="tag tag-neutral">{metric.label}</span>
            <span className="tag tag-amber">多品牌样本</span>
          </>
        }
        showDivider={false}
      />

      <section className="section section-filter">
        <div className="section-inner filter-strip">
          <div className="filter-row">
            <div className="filter-heading">设备类别</div>
            <div className="filter-pills">
              {categoryOptions.map((item) => {
                const params = new URLSearchParams();
                params.set("category", item.key);
                params.set("series", getComparisonGroupsByCategoryFlat(item.key).find((group) => group.devices.length >= 2)?.key ?? "");
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
          </div>

          <div className="filter-row">
            <div className="filter-heading">同系列</div>
            <div className="filter-pills">
              {seriesOptions.map((group) => {
                const params = new URLSearchParams({
                  category: selectedCategory,
                  series: group.key,
                  metric: selectedMetricKey,
                });
                const active = group.key === selectedSeries;

                return (
                  <Link
                    key={group.key}
                    href={`/trends?${params.toString()}`}
                    className={`tag ${active ? "tag-green" : "tag-neutral"}`}
                    aria-current={active ? "page" : undefined}
                  >
                    {group.label}
                    <span className="opacity-70">({group.devices.length})</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="section pt-0">
        <div className="section-inner mx-auto grid max-w-6xl gap-5">
          <TrendChart
            points={yearTrend}
            metric={metric}
            category={selectedCategory}
            series={selectedSeriesOption?.label ?? "设备系列"}
          />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <TrendCard
                title="起始年份"
                value={yearTrend[0]?.year?.toString() ?? "待补充"}
                hint="当前系列最早收录样本年份。"
                tone="green"
              />
              <TrendCard
                title="最新年份"
                value={yearTrend.at(-1)?.year?.toString() ?? "待补充"}
                hint="当前系列最新收录样本年份。"
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
      </section>

      <TickDivider className="site-container" />
    </main>
  );
}
