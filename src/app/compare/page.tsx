import Link from "next/link";
import {
  runFallbackAnalysis,
  type AiAnalysisOutput,
  type ChangedField,
} from "@/lib/ai-analysis";
import {
  allDevicesFlat,
  categoryLabels,
  categoryNames,
  comparisonGroupsFlat,
  formatMaybeCurrency,
  getDevicesByComparisonGroupKeyFlat,
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
  const familyOrder = {
    phone: ["iPhone"],
    tablet: ["iPad", "iPad mini", "iPad Air", "iPad Pro"],
    laptop: ["MacBook Air", "MacBook Pro"],
  };
  const variantOrder = [
    "standard",
    "Pro",
    "Pro Max",
    "Plus",
    "mini",
    "SE",
    "e",
    "Air",
    "11-inch",
    "13-inch",
    "14-inch",
    "15-inch",
    "16-inch",
  ];
  const rank = (values: string[], value: string) => {
    const index = values.indexOf(value);
    return index < 0 ? values.length : index;
  };

  return comparisonGroupsFlat
    .map((group) => {
      const devices = group.devices;
      const family = group.family.replace(categoryLabels[group.category], "").trim();
      const kind = family || (group.variant === "standard" ? "数字" : group.variant);
      const size =
        family && group.variant !== "standard"
          ? ` · ${group.variant.replace("-inch", " 英寸")}`
          : "";
      const tier = group.tier === "pro-max" ? " · Pro/Max 芯片" : "";
      return {
        series: group.key,
        label: `${kind}系列${size}${tier}`,
        category: group.category,
        count: devices.length,
        order:
          rank(familyOrder[group.category], group.family) * 100 +
          rank(variantOrder, group.variant) * 10 +
          (group.tier === "pro-max" ? 1 : 0),
      };
    })
    .filter((item) => item.count >= 2)
    .sort((left, right) => {
      const categoryOrder = categoryNames.indexOf(left.category) - categoryNames.indexOf(right.category);
      if (categoryOrder !== 0) return categoryOrder;
      return left.order - right.order || left.label.localeCompare(right.label, "zh-CN");
    });
}

function CompareOverview({ devices }: { devices: (typeof allDevicesFlat)[number][] }) {
  return (
    <div className="compare-overview">
      {devices.map((device, index) => (
        <div className="compare-overview-item" key={device.id}>
          {index > 0 ? <div className="compare-overview-arrow" aria-hidden="true">←</div> : null}
          <Link
            href={`/devices/${device.id}`}
            className={`compare-overview-card${index === 0 ? " is-current" : ""}`}
          >
            <div className="compare-overview-model">{device.model}</div>
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
  const latest = devices[0] ?? null;
  const previous = devices[1] ?? null;
  const gridTemplateColumns = `120px repeat(${devices.length}, 210px)`;
  const tableWidth = 120 + devices.length * 210;

  return (
    <div className="compare-v2-table">
      <div className="compare-v2-scroll" aria-label="设备参数对比表">
        <div className="compare-v2-table-inner" style={{ minWidth: `${tableWidth}px` }}>
          <div className="compare-v2-row is-header" style={{ gridTemplateColumns }}>
            <div className="compare-v2-cell is-label">功能 / 参数</div>
            {devices.map((device, index) => (
              <div className={`compare-v2-cell${index === 0 ? " is-highlight" : ""}`} key={device.id}>
                <span>{device.model}</span>
                <small>{device.releaseYear}</small>
              </div>
            ))}
          </div>

          {groupedFields.map(([group, fields]) => (
            <div className="compare-v2-section" key={group}>
              <div className="compare-v2-row is-group" style={{ gridTemplateColumns }}>
                <div className="compare-v2-cell is-label">{group}</div>
                <div className="compare-v2-group-fill" />
              </div>
              {fields.map((field) => {
                const latestValue = latest ? buildComparisonValue(latest, field) : "待补充";
                const previousValue = previous ? buildComparisonValue(previous, field) : "待补充";
                const hasChanged = latestValue !== previousValue;

                return (
                  <div className="compare-v2-row" key={`${group}-${field.label}`} style={{ gridTemplateColumns }}>
                    <div className="compare-v2-cell is-label">
                      <span>{field.label}</span>
                      {field.hint ? <small>{field.hint}</small> : null}
                    </div>
                    {devices.map((device, index) => (
                      <div
                        className={`compare-v2-cell${index === 0 ? " is-highlight" : ""}${index === 0 && hasChanged ? " has-change" : ""}`}
                        key={device.id}
                      >
                        {buildComparisonValue(device, field)}
                        {index === 0 && hasChanged ? (
                          <span className="compare-change-badge is-up">
                            {compareValueLabel(field, previousValue, latestValue)}
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
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
  const defaultSeries = seriesOptions.find((item) => item.series === "iPhone::Pro")?.series ?? seriesOptions[0]?.series ?? "";
  const requestedSeries = normalizeSeries(resolvedSearchParams.series);
  const selectedSeries = seriesOptions.some((item) => item.series === requestedSeries) ? requestedSeries : defaultSeries;
  const selectedSeriesOption = seriesOptions.find((item) => item.series === selectedSeries) ?? null;
  const selectedCategory = selectedSeriesOption?.category ?? "phone";
  const categoryOptions = categoryNames
    .filter((category) => seriesOptions.some((item) => item.category === category))
    .map((category) => ({ value: category, label: categoryLabels[category] }));
  const selectedWindow = normalizeWindow(resolvedSearchParams.window);
  const seriesDevices = getDevicesByComparisonGroupKeyFlat(selectedSeries);
  const visibleDevices = (
    selectedWindow === "all"
      ? seriesDevices.slice()
      : selectedWindow === "recent5"
        ? seriesDevices.slice(-5)
        : seriesDevices.slice(-3)
  ).reverse();
  const latest = seriesDevices.at(-1) ?? null;
  const previous = seriesDevices.at(-2) ?? null;
  const category = latest?.category ?? "phone";
  const analysis = runFallbackAnalysis({
    seriesName: selectedSeriesOption?.label ?? "Apple",
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
      />

      <section className="compare-selector">
        <div className="compare-selector-inner">
          <CompareSeriesSelect
            options={seriesOptions.map((item) => ({
              label: item.label,
              series: item.series,
              category: item.category,
            }))}
            categories={categoryOptions}
            selectedCategory={selectedCategory}
            selectedSeries={selectedSeries}
            selectedWindow={selectedWindow}
          />

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
