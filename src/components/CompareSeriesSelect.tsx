"use client";

import { useRouter } from "next/navigation";

type CompareSeriesSelectProps = {
  options: Array<{
    label: string;
    series: string;
    category: string;
  }>;
  categories: Array<{ label: string; value: string }>;
  selectedCategory: string;
  selectedSeries: string;
  selectedWindow: string;
};

export default function CompareSeriesSelect({
  options,
  categories,
  selectedCategory,
  selectedSeries,
  selectedWindow,
}: CompareSeriesSelectProps) {
  const router = useRouter();
  const seriesOptions = options.filter((item) => item.category === selectedCategory);

  const navigateToSeries = (series: string) => {
    const params = new URLSearchParams({ series, window: selectedWindow });
    router.push(`/compare?${params.toString()}`);
  };

  return (
    <>
      <div className="compare-selector-group">
        <label className="compare-selector-label" htmlFor="compare-category">
          设备大类
        </label>
        <select
          id="compare-category"
          className="compare-select-control"
          value={selectedCategory}
          onChange={(event) => {
            const firstSeries = options.find((item) => item.category === event.currentTarget.value)?.series;
            if (firstSeries) navigateToSeries(firstSeries);
          }}
        >
          {categories.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div className="compare-selector-group">
        <label className="compare-selector-label" htmlFor="compare-series">
          产品系列
        </label>
        <select
          id="compare-series"
          name="series"
          className="compare-select-control"
          value={selectedSeries}
          onChange={(event) => navigateToSeries(event.currentTarget.value)}
        >
          {seriesOptions.map((item) => (
            <option key={item.series} value={item.series}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

    </>
  );
}
