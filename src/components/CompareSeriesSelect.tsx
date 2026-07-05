"use client";

import { useRouter } from "next/navigation";

type CompareSeriesSelectProps = {
  options: Array<{
    label: string;
    series: string;
  }>;
  selectedSeries: string;
  selectedWindow: string;
};

export default function CompareSeriesSelect({
  options,
  selectedSeries,
  selectedWindow,
}: CompareSeriesSelectProps) {
  const router = useRouter();

  return (
    <select
      id="compare-series"
      name="series"
      defaultValue={selectedSeries}
      className="compare-select-control"
      onChange={(event) => {
        const params = new URLSearchParams();
        params.set("series", event.currentTarget.value);
        params.set("window", selectedWindow);
        router.push(`/compare?${params.toString()}`);
      }}
    >
      {options.map((item) => (
        <option key={item.series} value={item.series}>
          {item.label}
        </option>
      ))}
    </select>
  );
}
