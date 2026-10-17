import { catalogDevicesFlat, getCatalogFamilyOptions, summaryStatsFlat } from "@/lib/devices-db";
import PageHeader from "@/components/layout/PageHeader";
import DeviceCatalog from "@/components/DeviceCatalog";
import { getDeviceImage } from "@/lib/device-images";
import { getCatalogProductSeries } from "@/lib/catalog-order";
import { categoryLabels } from "@/lib/device-categories";
import { compareCatalogEntries, type CatalogEntry } from "@/lib/catalog-list";

// 列表只传轻量目录与缩略图地址，不把规格、证据和完整款式递归发给浏览器。
const entries: CatalogEntry[] = catalogDevicesFlat.map(device => {
  const image = getDeviceImage(device.id);
  return {
    id: device.id, model: device.model, brand: device.brand, category: device.category,
    series: device.comparisonGroupId,
    seriesLabel: getCatalogProductSeries({ ...device, key: device.comparisonGroupId, label: device.series }).label,
    chip: device.chip, releaseYear: device.releaseYear, releaseDate: device.releaseDate,
    screenSize: device.screenSize, weight: device.weight, launchPrice: device.launchPrice,
    image: image ? { url: image.url, ...(image.previewFocus ? { previewFocus: image.previewFocus } : {}) } : undefined,
    searchNames: [categoryLabels[device.category], device.series,
      ...device.editions?.flatMap(edition => [edition.label, edition.device.model]) ?? []],
  };
}).sort(compareCatalogEntries);
const groups = getCatalogFamilyOptions().map(({ key, label, brand, category, groupKeys, aliases }) => ({ key, label, brand, category, groupKeys, aliases }));

export default async function DevicesPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // 初次 URL/搜索在服务端正常渲染；页面内筛选和分页由浏览器摘要完成。
  const query = new URLSearchParams(Object.entries(await searchParams)
    .flatMap(([key, value]) => value == null ? [] : [[key, Array.isArray(value) ? value[0] : value]]));
  return <main className="site-main">
    <PageHeader eyebrow="设备数据库" title="设备库" meta={<>
      <span className="tag tag-green">{summaryStatsFlat.brandCount} 个品牌</span>
      <span className="tag tag-neutral">{summaryStatsFlat.startYear} - {summaryStatsFlat.endYear}</span>
    </>} showDivider={false} />
    <DeviceCatalog devices={entries} groups={groups} initialQuery={query.toString()} />
  </main>;
}
