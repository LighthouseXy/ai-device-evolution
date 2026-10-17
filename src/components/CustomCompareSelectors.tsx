"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { DeviceCategory } from "@/lib/devices-db";
import { brandLabels, getCatalogBrandFilter, matchesCatalogBrand, sortBrands } from "@/lib/catalog-order";
import { MAX_COMPARISON_DEVICES, normalizeComparisonCount, resizeComparisonSelection } from "@/lib/comparison-selection";

type Choice = { id: string; model: string; brand: string; category: DeviceCategory; series: string };
type Series = { key: string; label: string; brand: string; category: DeviceCategory };

export default function CustomCompareSelectors({ choices, series, category, ids }: {
  choices: Choice[];
  series: Series[];
  category: DeviceCategory;
  ids: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const categoryChoices = choices.filter((choice) => choice.category === category);
  const brands = sortBrands(categoryChoices.map((choice) => getCatalogBrandFilter(choice.brand)));
  function navigate(nextCategory: DeviceCategory, nextIds: string[], count = ids.length) {
    const params = new URLSearchParams({ mode: "cross", category: nextCategory, count: String(count) });
    // 空值也是明确选择，避免清空全部设备后被服务端重新填入默认型号。
    nextIds.forEach((id, index) => params.set(`device${index + 1}`, id));
    startTransition(() => router.push(`/compare?${params.toString()}`, { scroll: false }));
  }
  return (
    <>
      <label className="compare-selector-group custom-category-select"><span className="compare-selector-label">设备种类</span>
        <select className="compare-select-control" value={category} disabled={pending}
          onChange={(event) => navigate(event.target.value as DeviceCategory, [])}>
          <option value="phone">手机</option><option value="tablet">平板电脑</option><option value="laptop">笔记本电脑</option>
          <option value="watch">手表</option><option value="band">手环</option>
        </select>
      </label>
      <div className="compare-selector-group custom-count-group">
        <span className="compare-selector-label">对比数量</span>
        <div className="custom-count-controls">
          <div className="compare-range-toggle">
            <button type="button" aria-pressed={ids.length === 2} disabled={pending}
              className={`compare-range-btn${ids.length === 2 ? " is-active" : ""}`}
              onClick={() => navigate(category, resizeComparisonSelection(ids, 2), 2)}>2 台</button>
          </div>
          <form className="custom-count-form" key={ids.length} onSubmit={event => {
            event.preventDefault();
            const count = normalizeComparisonCount(String(new FormData(event.currentTarget).get("count")), ids.length);
            navigate(category, resizeComparisonSelection(ids, count), count);
          }}>
            <label className="compare-selector-label" htmlFor="comparison-count">自定义</label>
            <input id="comparison-count" className="compare-select-control" type="number" name="count" aria-label="自定义对比数量" min={2}
              max={MAX_COMPARISON_DEVICES} step={1} required defaultValue={ids.length} disabled={pending} />
            <button className="compare-range-btn" type="submit" disabled={pending}>应用</button>
          </form>
        </div>
      </div>
      <div className="custom-device-selectors" role="region" aria-label="设备选择，可横向滑动" tabIndex={0}>
        {ids.map((_, index) => {
          const selected = categoryChoices.find((choice) => choice.id === ids[index]);
          const available = (choice: Choice) => !ids.some((id, slot) => slot !== index && id === choice.id);
          const selectedBrand = selected ? getCatalogBrandFilter(selected.brand) : "";
          const brandSeries = series.filter((group) => group.category === category && matchesCatalogBrand(group.brand, selectedBrand));
          const choose = (id: string) => {
            const nextIds = [...ids]; nextIds[index] = id;
            navigate(category, nextIds);
          };
          return <fieldset className="custom-device-slot" key={index} disabled={pending}>
            <legend className="compare-selector-label">设备 {index + 1}</legend>
            <label className="compare-selector-group"><span className="compare-selector-label">品牌</span>
              <select className="compare-select-control" aria-label={`品牌 ${index + 1}`} value={selectedBrand}
                onChange={(event) => choose(categoryChoices.find((choice) => matchesCatalogBrand(choice.brand, event.target.value) && available(choice))?.id ?? "")}>
                <option value="">不选择</option>
                {brands.map((brand) => <option key={brand} value={brand}
                  disabled={!categoryChoices.some((choice) => matchesCatalogBrand(choice.brand, brand) && available(choice))}>{brandLabels[brand] ?? brand}</option>)}
              </select>
            </label>
            <label className="compare-selector-group"><span className="compare-selector-label">产品型号</span>
              <select className="compare-select-control" aria-label={`产品型号 ${index + 1}`} value={selected?.series ?? ""} disabled={!selected}
                onChange={(event) => choose(categoryChoices.find((choice) => choice.series === event.target.value && available(choice))?.id ?? "")}>
                {!selected && <option value="">请先选择品牌</option>}
                {brandSeries.map((group) => <option key={group.key} value={group.key}
                  disabled={!categoryChoices.some((choice) => choice.series === group.key && available(choice))}>{group.label}</option>)}
              </select>
            </label>
            <label className="compare-selector-group custom-model-select"><span className="compare-selector-label">具体型号</span>
              <select className="compare-select-control" aria-label={`具体型号 ${index + 1}`} value={ids[index] ?? ""} disabled={!selected}
                onChange={(event) => {
                  choose(event.target.value);
                }}>
                {!selected && <option value="">请先选择系列</option>}
                {categoryChoices.filter((choice) => choice.series === selected?.series).map((choice) =>
                  <option key={choice.id} value={choice.id} disabled={!available(choice)}>{choice.model}</option>)}
              </select>
            </label>
          </fieldset>;
        })}
      </div>
      {pending && <span role="status" className="text-sm text-[var(--primary)]">正在更新对比…</span>}
    </>
  );
}
