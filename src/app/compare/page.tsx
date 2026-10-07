import Link from "next/link";
import {
  runFallbackAnalysis,
  type AiAnalysisOutput,
  type ChangedField,
} from "@/lib/ai-analysis";
import {
  catalogDevicesFlat as allDevicesFlat,
  categoryLabels,
  getCatalogSeriesOptions,
  formatMaybeCurrency,
  getDevicesByComparisonGroupKeyFlat,
} from "@/lib/devices-db";
import {
  formatConfiguration,
  getPricesForComparison,
  formatLaunchPricesForComparison,
} from "@/lib/device-configurations";
import PageHeader from "@/components/layout/PageHeader";
import TickDivider from "@/components/layout/TickDivider";
import CompareSeriesSelect from "@/components/CompareSeriesSelect";
import { CustomCompareContent } from "@/components/CustomCompareContent";
import ProductCompareTable, { type ComparisonField } from "@/components/ProductCompareTable";
import { formatDeviceSpec, getDeviceSpecFields } from "@/lib/device-spec-fields";

type SearchParams = Record<string, string | string[] | undefined>;

function CompareModeSelector({ mode }: { mode: "same" | "cross" }) {
  return <div className="compare-selector-group compare-mode-group">
    <div className="compare-selector-label">对比方式</div>
    <div className="compare-range-toggle w-fit" role="group" aria-label="对比方式">
      <Link className={`compare-range-btn${mode === "same" ? " is-active" : ""}`} aria-current={mode === "same" ? "page" : undefined} href="/compare">同品牌</Link>
      <Link className={`compare-range-btn${mode === "cross" ? " is-active" : ""}`} aria-current={mode === "cross" ? "page" : undefined} href="/compare?mode=cross">跨品牌</Link>
    </div>
  </div>;
}

function getComparisonSpecFields(devices: (typeof allDevicesFlat)[number][]): ComparisonField[] {
  return [
    ...getDeviceSpecFields(devices).map((field) => ({
      group: field.group, label: field.label,
      getValue: (device: (typeof allDevicesFlat)[number]) => formatDeviceSpec(device, field),
      getMeta: (device: (typeof allDevicesFlat)[number]) => device.specs?.[`${field.key}Note`] ? [String(device.specs[`${field.key}Note`])] : null,
      isNumeric: ["screenSize", "refreshRate", "weight"].includes(field.key),
      showChange: field.key !== "batteryCapacity",
    })),
    {
      group: "影像", label: "DXOMARK 相机", hint: "不同测试协议的分数不可直接横比",
      getValue: (device) => {
        const benchmark = device.benchmarks?.find((item) => item.provider === "DXOMARK" && item.metric === "camera");
        return benchmark ? `${benchmark.score} 分 · ${benchmark.protocolVersion}` : "待补充";
      },
      showChange: false, optional: true,
    },
  ];
}

function buildComparisonFields(devices: (typeof allDevicesFlat)[number][]): ComparisonField[] {
  const priceValue = (device: (typeof allDevicesFlat)[number], priceType: "current" | "used") => {
    const prices = getPricesForComparison(device, priceType);
    return prices.length > 0
      ? prices.map((price) => `${formatConfiguration(price.configuration)} · ${formatMaybeCurrency(price.value)}${price.estimated ? "（预估）" : ""}`).join("\n")
      : "待补充";
  };
  return [
    {
      group: "价格", label: "首发价", hint: "按已收录款式列示", showChange: false,
      getValue: formatLaunchPricesForComparison,
    },
    {
      group: "价格",
      label: "当前价",
      hint: "按已核验配置列示",
      getValue: (device) => priceValue(device, "current"),
      isNumeric: true,
      isCurrency: true,
      showChange: false,
    },
    {
      group: "价格",
      label: "二手价",
      hint: "按已核验配置列示",
      getValue: (device) => priceValue(device, "used"),
      isNumeric: true,
      isCurrency: true,
      showChange: false,
    },
    ...getComparisonSpecFields(devices),
  ];
}

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

function buildChangedFields(
  previous: (typeof allDevicesFlat)[number] | null,
  latest: (typeof allDevicesFlat)[number] | null,
): ChangedField[] {
  if (!previous || !latest) return [];

  return getComparisonSpecFields([previous, latest])
    .filter((field) => field.showChange !== false)
    .map((field) => {
      const previousValue = buildComparisonValue(previous, field);
      const currentValue = buildComparisonValue(latest, field);
      if (previousValue === currentValue || previousValue === "待补充" || currentValue === "待补充") return null;

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
  return getCatalogSeriesOptions(2).map((group) => ({ ...group, series: group.key }));
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
  if (normalizeSeries(resolvedSearchParams.mode) === "cross") {
    return <main className="site-main">
      <PageHeader eyebrow="参数与选购" title="产品对比" showDivider={false} />
      <CustomCompareContent query={resolvedSearchParams} modeSelector={<CompareModeSelector mode="cross" />} />
      <TickDivider className="site-container" />
    </main>;
  }
  const seriesOptions = buildSeriesOptions();
  const defaultSeries = getDevicesByComparisonGroupKeyFlat("iPhone::Pro")[0]?.comparisonGroupId
    ?? seriesOptions[0]?.series
    ?? "";
  const requestedSeries = normalizeSeries(resolvedSearchParams.series);
  const requestedGroupId = getDevicesByComparisonGroupKeyFlat(requestedSeries)[0]?.comparisonGroupId;
  const requestedBrand = normalizeSeries(resolvedSearchParams.brand) === "Xiaomi"
    && seriesOptions.some((item) => item.series === requestedGroupId && item.brand === "Redmi")
    ? "Redmi" : normalizeSeries(resolvedSearchParams.brand);
  const selectedBrand = seriesOptions.some((item) => item.brand === requestedBrand)
    ? requestedBrand
    : seriesOptions.find((item) => item.series === requestedGroupId)?.brand ?? "Apple";
  const requestedCategory = normalizeSeries(resolvedSearchParams.category);
  const categorySeries = seriesOptions.filter((item) => item.brand === selectedBrand && (!requestedCategory || item.category === requestedCategory));
  const selectedSeries = seriesOptions.some((item) => item.series === requestedGroupId && item.brand === selectedBrand && (!requestedCategory || item.category === requestedCategory))
    ? requestedGroupId
    : categorySeries.find((item) => item.series === defaultSeries)?.series ?? categorySeries[0]?.series
      ?? seriesOptions.find((item) => item.brand === selectedBrand)?.series ?? defaultSeries;
  const selectedSeriesOption = seriesOptions.find((item) => item.series === selectedSeries) ?? null;
  const selectedCategory = selectedSeriesOption?.category ?? "phone";
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
    seriesName: selectedSeriesOption?.label ?? "设备系列",
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
        eyebrow="参数与选购"
        title="产品对比"
        showDivider={false}
      />

      <section className="compare-selector">
        <div className="compare-selector-inner">
          <CompareModeSelector mode="same" />
          <CompareSeriesSelect
            options={seriesOptions.map((item) => ({
              label: item.label,
              series: item.series,
              brand: item.brand,
              category: item.category,
              catalogKey: item.catalogKey,
              catalogLabel: item.catalogLabel,
            }))}
            selectedBrand={selectedBrand}
            selectedCategory={selectedCategory}
            selectedSeries={selectedSeries}
            selectedWindow={selectedWindow}
          />

          <div className="compare-selector-group compare-range-group">
            <div className="compare-selector-label">对比范围</div>
            <div className="compare-range-toggle">
              {[
                { key: "recent3", label: "近 3 代" },
                { key: "recent5", label: "近 5 代" },
                { key: "all", label: "全部" },
              ].map((item) => {
                const params = new URLSearchParams();
                params.set("brand", selectedBrand);
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
          <ProductCompareTable
            devices={visibleDevices}
            fields={buildComparisonFields(visibleDevices)}
          />
          <CompareInsight analysis={analysis} />
        </div>
      </section>

      <TickDivider className="site-container" />
    </main>
  );
}
