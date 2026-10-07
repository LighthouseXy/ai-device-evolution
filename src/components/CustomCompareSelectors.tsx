"use client";

import { useRouter } from "next/navigation";
import type { DeviceCategory } from "@/lib/devices-db";
import { brandLabels, sortBrands } from "@/lib/catalog-order";

type Choice = { id: string; model: string; brand: string; category: DeviceCategory; series: string };
type Series = { key: string; label: string; brand: string; category: DeviceCategory };

export default function CustomCompareSelectors({ choices, series, category, ids }: {
  choices: Choice[];
  series: Series[];
  category: DeviceCategory;
  ids: string[];
}) {
  const router = useRouter();
  const categoryChoices = choices.filter((choice) => choice.category === category);
  const brands = sortBrands(categoryChoices.map((choice) => choice.brand));
  function navigate(nextCategory: DeviceCategory, nextIds: string[]) {
    const params = new URLSearchParams({ mode: "cross", category: nextCategory });
    // 空值也是明确选择，避免清空全部设备后被服务端重新填入默认型号。
    nextIds.forEach((id, index) => params.set(`device${index + 1}`, id));
    router.push(`/compare?${params.toString()}`);
  }
  return (
    <>
      <label className="compare-selector-group custom-category-select"><span className="compare-selector-label">设备种类</span>
        <select className="compare-select-control" value={category}
          onChange={(event) => navigate(event.target.value as DeviceCategory, [])}>
          <option value="phone">手机</option><option value="tablet">平板电脑</option><option value="laptop">笔记本电脑</option>
          <option value="watch">手表</option><option value="band">手环</option>
        </select>
      </label>
      <div className="custom-device-selectors">
        {[0, 1, 2].map((index) => {
          const selected = categoryChoices.find((choice) => choice.id === ids[index]);
          const available = (choice: Choice) => !ids.some((id, slot) => slot !== index && id === choice.id);
          const brandSeries = series.filter((group) => group.category === category && group.brand === selected?.brand);
          const choose = (id: string) => {
            const nextIds = [...ids]; nextIds[index] = id;
            navigate(category, nextIds);
          };
          return <fieldset className="custom-device-slot" key={index}>
            <legend className="compare-selector-label">设备 {index + 1}</legend>
            <label className="compare-selector-group"><span className="compare-selector-label">品牌</span>
              <select className="compare-select-control" aria-label={`品牌 ${index + 1}`} value={selected?.brand ?? ""}
                onChange={(event) => choose(categoryChoices.find((choice) => choice.brand === event.target.value && available(choice))?.id ?? "")}>
                <option value="">不选择</option>
                {brands.map((brand) => <option key={brand} value={brand}
                  disabled={!categoryChoices.some((choice) => choice.brand === brand && available(choice))}>{brandLabels[brand] ?? brand}</option>)}
              </select>
            </label>
            <label className="compare-selector-group"><span className="compare-selector-label">产品系列</span>
              <select className="compare-select-control" aria-label={`产品系列 ${index + 1}`} value={selected?.series ?? ""} disabled={!selected}
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
    </>
  );
}
