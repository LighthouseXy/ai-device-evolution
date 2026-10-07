import Link from "next/link";
import {
  catalogDevicesFlat as allDevicesFlat,
  categoryNames,
  getCatalogFamilyOptions,
  formatMaybeCurrency,
  summaryStatsFlat,
} from "@/lib/devices-db";
import PageHeader from "@/components/layout/PageHeader";
import DeviceImage from "@/components/DeviceImage";
import { getDeviceImage } from "@/lib/device-images";
import DeviceCatalogFilters from "@/components/DeviceCatalogFilters";
import { brandLabels, getCatalogProductSeries, sortBrands } from "@/lib/catalog-order";

type SearchParams = {
  brand?: string | string[];
  category?: string | string[];
  series?: string | string[];
  q?: string | string[];
};

const brandNames = sortBrands(allDevicesFlat.map((device) => device.brand));

const categoryDisplay: Record<(typeof categoryNames)[number], string> = {
  phone: "智能手机",
  tablet: "平板电脑",
  laptop: "笔记本电脑",
  watch: "手表",
  band: "手环",
};

function normalizeCategory(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "phone" || raw === "tablet" || raw === "laptop" || raw === "watch" || raw === "band" ? raw : "all";
}

function normalizeBrand(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && brandNames.includes(raw) ? raw : "all";
}

function normalizeSearchQuery(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() ?? "";
}

function formatCount(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function buildHighlights(device: (typeof allDevicesFlat)[number]) {
  return [
    device.chip,
    typeof device.screenSize === "number" ? `${device.screenSize}"` : null,
    device.weight ? `${device.weight}g` : null,
  ].filter((item): item is string => Boolean(item));
}

function DeviceCard({
  device,
}: {
  device: (typeof allDevicesFlat)[number];
}) {
  const seriesLabel = getCatalogProductSeries({ ...device, key: device.comparisonGroupId, label: device.series }).label;
  return (
    <Link href={`/devices/${device.id}`} className="card group flex h-full flex-col p-5">
      <DeviceImage image={getDeviceImage(device.id)} model={device.model} className="mb-4 h-44" />
      <div className="flex items-start justify-between gap-4">
        <div className="grid gap-1">
          <span className="tag tag-neutral w-fit">{categoryDisplay[device.category]}</span>
          <h3 className="text-xl leading-tight text-[var(--text-strong)] group-hover:text-[var(--primary)]">
            {device.model}
          </h3>
        </div>
        <span className="tag tag-green">{device.releaseYear}</span>
      </div>

      <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
        {seriesLabel} · {brandLabels[device.brand] ?? device.brand}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {buildHighlights(device).slice(0, 3).map((item) => (
          <span key={item} className="tag tag-amber">
            {item}
          </span>
        ))}
      </div>

      <div className="mt-5 rounded-2xl bg-[var(--bg-soft)] p-4">
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
            起售价
          </span>
          <span className="text-sm font-semibold text-[var(--text-strong)]">
            {formatMaybeCurrency(device.launchPrice)}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-4 text-xs text-[var(--text-muted)]">
          <span>系列</span>
          <span>{seriesLabel}</span>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between text-sm font-medium text-[var(--primary)]">
        <span>查看详情</span>
        <span aria-hidden="true">→</span>
      </div>
    </Link>
  );
}

export default async function DevicesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  let selectedBrand = normalizeBrand(resolvedSearchParams.brand);
  const selectedCategory = normalizeCategory(resolvedSearchParams.category);
  const catalogGroups = getCatalogFamilyOptions();
  const requestedSeries = normalizeSearchQuery(resolvedSearchParams.series);
  // 兼容拆分前保存的红米链接，不把明确的红米系列切换成小米全部设备。
  if (selectedBrand === "Xiaomi" && catalogGroups.some((group) => group.brand === "Redmi"
    && (group.key === requestedSeries || group.groupKeys.includes(requestedSeries)))) selectedBrand = "Redmi";
  const requestedGroup = catalogGroups.find((group) => (group.key === requestedSeries || group.groupKeys.includes(requestedSeries))
    && (selectedBrand === "all" || group.brand === selectedBrand)
    && (selectedCategory === "all" || group.category === selectedCategory));
  const selectedSeries = requestedGroup?.key ?? "all";
  const searchQuery = normalizeSearchQuery(resolvedSearchParams.q);
  const normalizedSearch = searchQuery.toLocaleLowerCase("zh-CN");
  const categoryDevices =
    selectedCategory === "all"
      ? allDevicesFlat
      : allDevicesFlat.filter((device) => device.category === selectedCategory);
  const brandDevices =
    selectedBrand === "all"
      ? categoryDevices
      : categoryDevices.filter((device) => device.brand === selectedBrand);
  const seriesDevices = !requestedGroup ? brandDevices : brandDevices.filter((device) => requestedGroup.groupKeys.includes(device.comparisonGroupId));
  const visibleDevices = normalizedSearch
    ? seriesDevices.filter((device) =>
        [device.model, device.series, device.brand, brandLabels[device.brand], device.chip, categoryDisplay[device.category],
          ...device.editions?.flatMap(edition => [edition.label, edition.device.model]) ?? []]
          .filter(Boolean)
          .some((value) => String(value).toLocaleLowerCase("zh-CN").includes(normalizedSearch)),
      )
    : seriesDevices;

  const sortedDevices = [...visibleDevices].sort((left, right) => {
    if (right.releaseYear !== left.releaseYear) return right.releaseYear - left.releaseYear;
    const releaseDateOrder = (right.releaseDate ?? "").localeCompare(left.releaseDate ?? "");
    if (releaseDateOrder !== 0) return releaseDateOrder;
    if ((right.launchPrice ?? Number.POSITIVE_INFINITY) !== (left.launchPrice ?? Number.POSITIVE_INFINITY)) {
      return (left.launchPrice ?? Number.POSITIVE_INFINITY) - (right.launchPrice ?? Number.POSITIVE_INFINITY);
    }
    return left.model.localeCompare(right.model, "zh-CN");
  });

  return (
    <main className="site-main">
      <PageHeader
        eyebrow="设备数据库"
        title="设备库"
        meta={
          <>
            <span className="tag tag-green">{summaryStatsFlat.brandCount} 个品牌</span>
            <span className="tag tag-neutral">
              {summaryStatsFlat.startYear} - {summaryStatsFlat.endYear}
            </span>
          </>
        }
        showDivider={false}
      />

      <section className="section section-filter">
        <div className="section-inner catalog-filter-grid">
          <DeviceCatalogFilters path="/devices" groups={catalogGroups} brand={selectedBrand} category={selectedCategory}
            series={selectedSeries} allowAll params={searchQuery ? { q: searchQuery } : {}} />
          <span className="self-end pb-2 text-sm text-[var(--text-soft)]">结果 {formatCount(sortedDevices.length)} 台</span>
        </div>
      </section>

      <section className="section pt-0">
        <div className="section-inner">
          {sortedDevices.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {sortedDevices.map((device) => (
                <DeviceCard key={device.id} device={device} />
              ))}
            </div>
          ) : (
            <div className="card p-8 text-center">
              <h2 className="text-2xl text-[var(--text-strong)]">没有找到匹配设备</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
                当前筛选条件下没有设备。你可以切回全部类别、全部品牌，或调整搜索条件。
              </p>
              <div className="mt-6">
                <Link href="/devices" className="btn btn-primary">
                  查看全部设备
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
