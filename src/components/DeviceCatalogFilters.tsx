"use client";

import { useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { categoryLabels, type DeviceCategory } from "@/lib/device-categories";
import { brandLabels, getCatalogBrandFilter, matchesCatalogBrand, sortBrands } from "@/lib/catalog-order";

type Group = { key: string; label: string; brand: string; category: DeviceCategory; catalogKey?: string; catalogLabel?: string };
export default function DeviceCatalogFilters({ groups, brand, category, series, path, params = {}, allowAll = false, children, onNavigate }: {
  groups: Group[]; brand: string; category: string; series: string;
  path: "/compare" | "/trends" | "/devices"; params?: Record<string, string>;
  allowAll?: boolean; children?: ReactNode; onNavigate?: (href: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const brands = sortBrands(groups.map((group) => getCatalogBrandFilter(group.brand)));
  const brandGroups = groups.filter((group) => matchesCatalogBrand(group.brand, brand));
  const categories = (["phone", "tablet", "laptop", "watch", "band"] as const).filter((value) => brandGroups.some((group) => group.category === value));
  const seriesGroups = brandGroups.filter((group) => category === "all" || group.category === category);
  const productSeries = [...new Map(seriesGroups.map((group) => [group.catalogKey ?? group.key,
    { key: group.catalogKey ?? group.key, label: group.catalogLabel ?? group.label }])).values()];
  const selectedGroup = seriesGroups.find((group) => group.key === series);
  const selectedFamily = selectedGroup?.catalogKey ?? selectedGroup?.key ?? series;
  const modelOptions = allowAll ? productSeries : seriesGroups;
  function navigate(nextBrand: string, nextCategory: string, nextSeries: string) {
    const available = groups.filter((group) => matchesCatalogBrand(group.brand, nextBrand));
    if (nextCategory !== "all" && !available.some((group) => group.category === nextCategory)) nextCategory = allowAll ? "all" : available[0]?.category ?? "phone";
    const matching = available.filter((group) => nextCategory === "all" || group.category === nextCategory);
    if (!allowAll && !matching.some((group) => group.key === nextSeries)) nextSeries = matching[0]?.key ?? "";
    const query = new URLSearchParams(params);
    if (nextBrand !== "all") query.set("brand", nextBrand);
    if (nextCategory !== "all") query.set("category", nextCategory);
    if (nextSeries && nextSeries !== "all") query.set("series", nextSeries);
    const href = `${path}${query.size ? `?${query.toString()}` : ""}`;
    if (onNavigate) onNavigate(href);
    else startTransition(() => router.push(href, { scroll: false }));
  }
  return <>
    <label className="compare-selector-group"><span className="compare-selector-label">品牌</span>
      <select className="compare-select-control" value={brand} onChange={(event) => navigate(event.target.value, category, allowAll ? "all" : "")}>
        {allowAll && <option value="all">全部品牌</option>}
        {brands.map((value) => <option key={value} value={value}>{brandLabels[value] ?? value}</option>)}
      </select>
    </label>
    <label className="compare-selector-group"><span className="compare-selector-label">设备种类</span>
      <select className="compare-select-control" value={category} onChange={(event) => navigate(brand, event.target.value, allowAll ? "all" : "")}>
        {allowAll && <option value="all">全部种类</option>}
        {categories.map((value) => <option key={value} value={value}>{categoryLabels[value]}</option>)}
      </select>
    </label>
    <label className="compare-selector-group catalog-model-group"><span className="compare-selector-label">{allowAll ? "产品系列" : "产品型号"}</span>
      <select className="compare-select-control" value={allowAll ? selectedFamily : series} onChange={(event) => {
        const group = seriesGroups.find((group) => (allowAll ? group.catalogKey ?? group.key : group.key) === event.target.value);
        navigate(group ? getCatalogBrandFilter(group.brand) : brand, group?.category ?? category, group?.key ?? event.target.value);
      }}>
        {allowAll && <option value="all">全部系列</option>}
        {modelOptions.map((group) => <option key={group.key} value={group.key}>{group.label}</option>)}
      </select>
    </label>
    {children}
    {pending && <span role="status" className="self-end text-sm text-[var(--primary)]">正在更新…</span>}
  </>;
}
