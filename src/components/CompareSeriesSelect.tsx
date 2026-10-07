"use client";

import DeviceCatalogFilters from "@/components/DeviceCatalogFilters";
import type { DeviceCategory } from "@/lib/device-categories";

type CompareSeriesSelectProps = {
  options: Array<{
    label: string;
    series: string;
    brand: string;
    category: string;
    catalogKey: string;
    catalogLabel: string;
  }>;
  selectedBrand: string;
  selectedCategory: string;
  selectedSeries: string;
  selectedWindow: string;
};

export default function CompareSeriesSelect({
  options,
  selectedBrand,
  selectedCategory,
  selectedSeries,
  selectedWindow,
}: CompareSeriesSelectProps) {
  return (
    <DeviceCatalogFilters path="/compare" groups={options.map((option) => ({ ...option, key: option.series, category: option.category as DeviceCategory }))}
      brand={selectedBrand} category={selectedCategory} series={selectedSeries} params={{ window: selectedWindow }} />
  );
}
