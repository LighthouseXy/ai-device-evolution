import type { DeviceCategory } from "@/lib/device-categories";
import { brandLabels, getCatalogBrandFilter, matchesCatalogBrand } from "@/lib/catalog-order";

export type CatalogEntry = {
  id: string; model: string; brand: string; category: DeviceCategory; series: string;
  seriesLabel: string; chip: string; releaseYear: number; releaseDate?: string | null;
  screenSize?: number; weight?: number; launchPrice?: number;
  image?: { url: string; previewFocus?: "top" }; searchNames: string[];
};
export type CatalogFamily = {
  key: string; label: string; brand: string; category: DeviceCategory; groupKeys: string[]; aliases?: string[];
};
export const CATALOG_PAGE_SIZE = 36;

export function compareCatalogEntries(left: CatalogEntry, right: CatalogEntry) {
  return right.releaseYear - left.releaseYear
    || (right.releaseDate ?? "").localeCompare(left.releaseDate ?? "")
    || (left.launchPrice ?? Infinity) - (right.launchPrice ?? Infinity)
    || left.model.localeCompare(right.model, "zh-CN");
}

// 浏览器只处理目录摘要；完整参数、报价证据仍留在服务端详情与顾问链路。
export function getCatalogListing(devices: CatalogEntry[], groups: CatalogFamily[], query: Pick<URLSearchParams, "get">) {
  let brand = groups.some(group => matchesCatalogBrand(group.brand, query.get("brand") ?? ""))
    ? getCatalogBrandFilter(query.get("brand")!) : "all";
  const category = groups.some(group => group.category === query.get("category")) ? query.get("category")! : "all";
  const requestedSeries = query.get("series") ?? "";
  if (brand === "Xiaomi" && groups.some(group => group.brand === "Redmi"
    && (group.key === requestedSeries || group.groupKeys.includes(requestedSeries) || group.aliases?.includes(requestedSeries)))) brand = "Redmi";
  const group = groups.find(group => (group.key === requestedSeries || group.groupKeys.includes(requestedSeries) || group.aliases?.includes(requestedSeries))
    && matchesCatalogBrand(group.brand, brand) && (category === "all" || group.category === category));
  const search = (query.get("q") ?? "").trim().toLocaleLowerCase("zh-CN");
  const matches = devices.filter(device => matchesCatalogBrand(device.brand, brand)
    && (category === "all" || device.category === category) && (!group || group.groupKeys.includes(device.series))
    && (!search || [device.model, device.seriesLabel, device.brand, brandLabels[device.brand], device.chip,
      ...device.searchNames].some(value => value?.toLocaleLowerCase("zh-CN").includes(search))));
  const pageCount = Math.max(1, Math.ceil(matches.length / CATALOG_PAGE_SIZE));
  const requestedPage = /^\d+$/.test(query.get("page") ?? "") ? Number(query.get("page")) : 1;
  const page = Math.min(pageCount, Math.max(1, Number.isSafeInteger(requestedPage) ? requestedPage : 1));
  const start = (page - 1) * CATALOG_PAGE_SIZE;
  return { brand, category, series: group?.key ?? "all", page, pageCount, total: matches.length,
    start, devices: matches.slice(start, start + CATALOG_PAGE_SIZE) };
}
