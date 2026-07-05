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
import {
  formatSignedZhCurrency,
  formatSignedZhNumber,
  formatZhNumber,
} from "@/lib/number-format";
import PageHeader from "@/components/layout/PageHeader";
import TickDivider from "@/components/layout/TickDivider";
import CompareSeriesSelect from "@/components/CompareSeriesSelect";

type SearchParams = {
  series?: string | string[];
  window?: string | string[];
};

type ComparisonField = {
  group: string;
  label: string;
  hint?: string;
  getValue: (device: (typeof allDevicesFlat)[number]) => string;
  isNumeric?: boolean;
};

const comparisonFields: ComparisonField[] = [
  { group: "性能", label: "芯片", hint: "处理器", getValue: (device) => device.chip || "待补充" },
  {
    group: "显示",
    label: "屏幕尺寸",
    hint: "显示屏",
    getValue: (device) => (typeof device.screenSize === "number" ? `${device.screenSize}"` : "待补充"),
    isNumeric: true,
  },
  {
    group: "显示",
    label: "刷新率",
    hint: "显示屏",
    getValue: (device) => (typeof device.refreshRate === "number" ? `${device.refreshRate}Hz` : "待补充"),
    isNumeric: true,
  },
  {
    group: "机身",
    label: "重量",
    hint: "机身重量",
    getValue: (device) => (typeof device.weight === "number" ? `${device.weight}g` : "待补充"),
    isNumeric: true,
  },
  {
    group: "价格",
    label: "起售价",
    hint: "首发价格",
    getValue: (device) => formatMaybeCurrency(device.launchPrice),
    isNumeric: true,
  },
  {
    group: "性能",
    label: "AI 能力",
    hint: "Apple 智能",
    getValue: (device) =>
      typeof device.aiFeatureLevel === "number" ? `${device.aiFeatureLevel}/10` : "待补充",
    isNumeric: true,
  },
  {
    group: "影像",
    label: "主摄像素",
    hint: "摄像头",
    getValue: (device) =>
      typeof device.mainCameraMp === "number" ? `${device.mainCameraMp}MP` : "待补充",
    isNumeric: true,
  },
  { group: "连接", label: "接口", hint: "接口", getValue: (device) => device.port || "待补充" },
  {
    group: "续航",
    label: "电池",
    hint: "续航",
    getValue: (device) => (device.specs?.batteryLife as string | undefined) || "待补充",
  },
];

function normalizeSeries(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" && raw.trim().length > 0 ? raw : "";
}

function normalizeWindow(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "all" || raw === "recent5") return raw;
  return "recent3";
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
    return `${formatSignedZhCurrency(change, 0)} / ${formatSignedZhNumber(changeRate, 0)}%`;
  }

  if (unit === "\"") {
    return `${formatSignedZhNumber(change, 1)}${unit}`;
  }

  return `${prefix}${formatZhNumber(Math.abs(change), 0)}${unit}`;
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

function CompareOverview({ devices }: { devices: (typeof allDevicesFlat)[number][] }) {
  return (
    <div className="compare-overview">
      {devices.map((device, index) => (
        <div className="compare-overview-item" key={device.id}>
          {index > 0 ? <div className="compare-overview-arrow" aria-hidden="true">→</div> : null}
          <Link
            href={`/devices/${device.id}`}
            className={`compare-overview-card${index === devices.length - 1 ? " is-current" : ""}`}
          >
            <div className="compare-overview-model">{device.model.replace(device.series, "").trim() || device.model}</div>
            <div className="compare-overview-year">{device.releaseYear}</div>
            <div className="compare-overview-price">{formatMaybeCurrency(device.launchPrice)}</div>
          </Link>
        </div>
      ))}
    </div>
  );
}

function CompareTable({
  devices,
}: {
  devices: (typeof allDevicesFlat)[number][];
}) {
  const groupedFields = Array.from(
    comparisonFields.reduce((groups, field) => {
      const fields = groups.get(field.group) ?? [];
      fields.push(field);
      groups.set(field.group, fields);
      return groups;
    }, new Map<string, ComparisonField[]>()),
  );
  const first = devices[0] ?? null;
  const last = devices.at(-1) ?? null;
  const gridTemplateColumns = `120px repeat(${devices.length}, minmax(170px, 1fr)) 120px`;

  return (
    <div className="compare-v2-table">
      {groupedFields.map(([group, fields], groupIndex) => (
        <div className="compare-v2-section" key={group}>
          <div className="compare-v2-section-title">{group}</div>
          {groupIndex === 0 ? (
            <div className="compare-v2-row is-header" style={{ gridTemplateColumns }}>
              <div className="compare-v2-cell is-label">参数</div>
              {devices.map((device, index) => (
                <div className={`compare-v2-cell${index === devices.length - 1 ? " is-highlight" : ""}`} key={device.id}>
                  <span>{device.model.replace(device.series, "").trim() || device.model}</span>
                  <small>{device.releaseYear}</small>
                </div>
              ))}
              <div className="compare-v2-cell">变化</div>
            </div>
          ) : null}
          {fields.map((field) => {
            const firstValue = first ? buildComparisonValue(first, field) : "待补充";
            const lastValue = last ? buildComparisonValue(last, field) : "待补充";

            return (
              <div className="compare-v2-row" key={`${group}-${field.label}`} style={{ gridTemplateColumns }}>
                <div className="compare-v2-cell is-label">
                  <span>{field.label}</span>
                  {field.hint ? <small>{field.hint}</small> : null}
                </div>
                {devices.map((device, index) => (
                  <div className={`compare-v2-cell${index === devices.length - 1 ? " is-highlight" : ""}`} key={device.id}>
                    {buildComparisonValue(device, field)}
                  </div>
                ))}
                <div className="compare-v2-cell">
                  <span className={`compare-change-badge${firstValue === lastValue ? " is-flat" : " is-up"}`}>
                    {compareValueLabel(field, firstValue, lastValue)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function CompareInsight({ analysis }: { analysis: AiAnalysisOutput }) {
  return (
    <div className="compare-v2-insight">
      <div className="compare-v2-insight-badge">本地规则洞察 · 基于数据分析</div>
      <p>
        <strong>代际升级总结：</strong>
        {analysis.summary}
      </p>
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
  const visibleDevices =
    selectedWindow === "all"
      ? seriesDevices
      : selectedWindow === "recent5"
        ? seriesDevices.slice(-5)
        : seriesDevices.slice(-3);
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

  return (
    <main className="site-main">
      <PageHeader
        eyebrow="代际分析"
        title="代际对比"
        description="同系列跨代参数对比，一眼看清升级幅度"
        className="compare-v2-page-header"
      />

      <section className="compare-selector">
        <div className="compare-selector-inner">
          <div className="compare-selector-group">
            <label className="compare-selector-label" htmlFor="compare-series">选择系列</label>
            <CompareSeriesSelect
              options={seriesOptions.map((item) => ({ label: item.label, series: item.series }))}
              selectedSeries={selectedSeries}
              selectedWindow={selectedWindow}
            />
          </div>

          <div className="compare-selector-group">
            <div className="compare-selector-label">对比范围</div>
            <div className="compare-range-toggle">
              {[
                { key: "recent3", label: "近 3 代" },
                { key: "recent5", label: "近 5 代" },
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
                    className={`compare-range-btn${active ? " is-active" : ""}`}
                    aria-current={active ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="compare-section">
        <div className="compare-inner">
          <CompareOverview devices={visibleDevices} />
          <CompareTable devices={visibleDevices} />
          <CompareInsight analysis={analysis} />
        </div>
      </section>

      <TickDivider className="site-container" />
    </main>
  );
}
