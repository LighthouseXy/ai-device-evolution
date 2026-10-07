import type { ReactNode } from "react";
import CustomCompareSelectors from "@/components/CustomCompareSelectors";
import ProductCompareTable, { type ComparisonField } from "@/components/ProductCompareTable";
import { catalogDevicesFlat as allDevicesFlat, getCatalogDevice, categoryLabels, formatMaybeCurrency, getCatalogFamilyOptions, type DeviceCategory, type FlattenedDevice } from "@/lib/devices-db";
import { formatConfiguration, getPricesForComparison, formatLaunchPricesForComparison } from "@/lib/device-configurations";
import { formatDeviceSpec, getDeviceSpecFields } from "@/lib/device-spec-fields";

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
  const hasSelection = [1, 2, 3].some((index) => `device${index}` in query);
  const requestedIds = [1, 2, 3].map((index) => first(query[`device${index}`]));
  const ids = (hasSelection ? requestedIds : defaults[category]).map((id) => {
    const device = getCatalogDevice(id);
    return device?.category === category ? device.id : "";
  });
  const seen = new Set<string>();
  const uniqueIds = ids.map((id) => {
    if (!id || seen.has(id)) return "";
    seen.add(id); return id;
  });
  const selected = uniqueIds.map((id) => allDevicesFlat.find((device) => device.id === id));
  const series = getCatalogFamilyOptions();
  const groupRanks = new Map(series.map((group, index) => [group.key, index]));
  const catalogKeys = new Map(series.flatMap((group) => group.groupKeys.map((key) => [key, group.key] as const)));
  const choices = allDevicesFlat.map((device) => ({ id: device.id, model: device.model, brand: device.brand,
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
        return entries.length ? entries.map((price) => `${formatConfiguration(price.configuration)} · ${formatMaybeCurrency(price.value)}${price.estimated ? "（预估）" : ""}`).join("\n") : "待补充";
      },
    })),
    ...getDeviceSpecFields(visibleDevices).map((field) => ({
      group: field.group, label: field.label,
      getValue: (device: FlattenedDevice) => formatDeviceSpec(device, field),
      getMeta: (device: FlattenedDevice) => device.specs?.[`${field.key}Note`] ? [String(device.specs[`${field.key}Note`])] : null,
    })),
  ];
  return <>
    <section className="compare-selector"><div className="compare-selector-inner custom-compare-selector">
      {modeSelector}
      <CustomCompareSelectors choices={choices} series={series} category={category} ids={uniqueIds} />
    </div></section>
    <section className="compare-section"><div className="compare-inner">
      <p className="compare-selection-note">按品牌、产品系列选择 2–3 台{categoryLabels[category]}。配置价格和已知参数差异直接列在表格中；不计算综合胜负，网址可保存当前选择。</p>
      {visibleDevices.length < 2 ? <p className="card p-6">请至少选择两台不同的{categoryLabels[category]}。</p>
        : <ProductCompareTable devices={visibleDevices} fields={fields} generation={false} />}
    </div></section>
  </>;
}
