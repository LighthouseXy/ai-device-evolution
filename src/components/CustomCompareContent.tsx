import type { ReactNode } from "react";
import CustomCompareSelectors from "@/components/CustomCompareSelectors";
import ProductCompareTable, { type ComparisonField } from "@/components/ProductCompareTable";
import { catalogDevicesFlat as allDevicesFlat, getCatalogDevice, categoryLabels, formatMaybeCurrency, getCatalogFamilyOptions, type DeviceCategory, type FlattenedDevice } from "@/lib/devices-db";
import { formatConfiguration, getPricesForComparison, formatLaunchPricesForComparison } from "@/lib/device-configurations";
import { formatDeviceSpec, getDeviceSpecFields, getDeviceSpecNote } from "@/lib/device-spec-fields";
import { getComparisonCount, MAX_COMPARISON_DEVICES, resizeComparisonSelection } from "@/lib/comparison-selection";

type Query = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => typeof value === "string" ? value : "";
const defaults: Record<DeviceCategory, string[]> = {
  phone: ["iphone-17", "xiaomi-17-2025", ""],
  tablet: ["ipad-a16-2025", "xiaomi-pad-8-2025", ""],
  laptop: ["macbook-air-13-m5-2026", "huawei-matebook-14-2024", ""],
  watch: ["apple-watch-series-10-2024", "xiaomi-watch-s4-2024", ""],
  band: ["xiaomi-band-9-2024", "honor-band-9-2024", ""],
};

export function CustomCompareContent({ query, modeSelector }: { query: Query; modeSelector?: ReactNode }) {
  const category: DeviceCategory = ["phone", "tablet", "laptop", "watch", "band"].includes(first(query.category))
    ? first(query.category) as DeviceCategory : "phone";
  const count = getComparisonCount(query);
  const hasSelection = Array.from({ length: MAX_COMPARISON_DEVICES }, (_, index) => index + 1).some((index) => `device${index}` in query);
  const requestedIds = Array.from({ length: count }, (_, index) => first(query[`device${index + 1}`]));
  const ids = resizeComparisonSelection(hasSelection ? requestedIds : defaults[category], count).map((id) => {
    const device = getCatalogDevice(id);
    return device?.category === category ? device.id : "";
  });
  const seen = new Set<string>();
  const uniqueIds = ids.map((id) => {
    if (!id || seen.has(id)) return "";
    seen.add(id); return id;
  });
  const selected = uniqueIds.map(getCatalogDevice);
  const series = getCatalogFamilyOptions().filter(group => group.category === category);
  const groupRanks = new Map(series.map((group, index) => [group.key, index]));
  const catalogKeys = new Map(series.flatMap((group) => group.groupKeys.map((key) => [key, group.key] as const)));
  const choices = allDevicesFlat.filter(device => device.category === category).map((device) => ({ id: device.id, model: device.model, brand: device.brand,
    category: device.category, series: catalogKeys.get(device.comparisonGroupId)!, releaseYear: device.releaseYear,
    releaseDate: device.releaseDate ?? "" })).sort((a, b) => (groupRanks.get(a.series) ?? Infinity)
    - (groupRanks.get(b.series) ?? Infinity) || b.releaseYear - a.releaseYear || b.releaseDate.localeCompare(a.releaseDate)
    || a.model.localeCompare(b.model, "zh-CN"));
  const visibleDevices = selected.filter((device): device is FlattenedDevice => Boolean(device));
  const fields: ComparisonField[] = [
    ...(["launch", "current", "used"] as const).map((type) => ({
      group: "价格", label: type === "launch" ? "首发价" : type === "current" ? "当前价" : "二手价",
      hint: type === "launch" ? "已记录的首发配置" : "按已记录配置列示", showChange: false,
      getValue(device: FlattenedDevice) {
        if (type === "launch") {
          return formatLaunchPricesForComparison(device);
        }
        const entries = getPricesForComparison(device, type);
        return entries.length ? entries.map((price) => `${formatConfiguration(price.configuration)} · ${formatMaybeCurrency(price.value)}${price.estimated ? "（预估）" : ""}${price.availabilityNote ? `（${price.availabilityNote}）` : ""}`).join("\n") : "待补充";
      },
    })),
    ...getDeviceSpecFields(visibleDevices).map((field) => ({
      group: field.group, label: field.label,
      getValue: (device: FlattenedDevice) => formatDeviceSpec(device, field),
      getMeta: (device: FlattenedDevice) => {
        const note = getDeviceSpecNote(device, field.key);
        return note ? [String(note)] : null;
      },
    })),
  ];
  return <>
    <section className="compare-selector"><div className="compare-selector-inner custom-compare-selector">
      {modeSelector}
      <CustomCompareSelectors choices={choices.map(({ id, model, brand, category, series }) => ({ id, model, brand, category, series }))}
        series={series.map(({ key, label, brand, category }) => ({ key, label, brand, category }))} category={category} ids={uniqueIds} />
    </div></section>
    <section className="compare-section"><div className="compare-inner">
      <p className="compare-selection-note">已选择 {visibleDevices.length} / {count} 台{categoryLabels[category]}。设备较多时可横向滑动选择栏和对比表；配置价格与参数差异直接列示。</p>
      {visibleDevices.length < 2 ? <p className="card p-6">请至少选择两台不同的{categoryLabels[category]}。</p>
        : <ProductCompareTable devices={visibleDevices} fields={fields} generation={false} />}
    </div></section>
  </>;
}
