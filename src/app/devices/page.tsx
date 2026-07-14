import Link from "next/link";
import {
  allDevicesFlat,
  categoryNames,
  deviceCountByCategory,
  formatMaybeCurrency,
  summaryStatsFlat,
} from "@/lib/devices-db";
import PageHeader from "@/components/layout/PageHeader";

type SearchParams = {
  category?: string | string[];
  q?: string | string[];
};

const categoryDisplay: Record<(typeof categoryNames)[number], string> = {
  phone: "智能手机",
  tablet: "平板电脑",
  laptop: "笔记本电脑",
};

function normalizeCategory(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "phone" || raw === "tablet" || raw === "laptop" ? raw : "all";
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
    device.launchPrice ? formatMaybeCurrency(device.launchPrice) : null,
  ].filter((item): item is string => Boolean(item));
}

function DeviceCard({
  device,
}: {
  device: (typeof allDevicesFlat)[number];
}) {
  return (
    <Link href={`/devices/${device.id}`} className="card group flex h-full flex-col p-5">
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
        {device.series} · {device.brand}
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
          <span>{device.series}</span>
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
  const selectedCategory = normalizeCategory(resolvedSearchParams.category);
  const searchQuery = normalizeSearchQuery(resolvedSearchParams.q);
  const normalizedSearch = searchQuery.toLocaleLowerCase("zh-CN");
  const categoryDevices =
    selectedCategory === "all"
      ? allDevicesFlat
      : allDevicesFlat.filter((device) => device.category === selectedCategory);
  const visibleDevices = normalizedSearch
    ? categoryDevices.filter((device) =>
        [device.model, device.series, device.brand, device.chip, categoryDisplay[device.category]]
          .filter(Boolean)
          .some((value) => String(value).toLocaleLowerCase("zh-CN").includes(normalizedSearch)),
      )
    : categoryDevices;

  const sortedDevices = [...visibleDevices].sort((left, right) => {
    if (right.releaseYear !== left.releaseYear) return right.releaseYear - left.releaseYear;
    if ((right.launchPrice ?? Number.POSITIVE_INFINITY) !== (left.launchPrice ?? Number.POSITIVE_INFINITY)) {
      return (left.launchPrice ?? Number.POSITIVE_INFINITY) - (right.launchPrice ?? Number.POSITIVE_INFINITY);
    }
    return left.model.localeCompare(right.model, "zh-CN");
  });

  const categoryPills = [
    { key: "all", label: "全部", count: allDevicesFlat.length },
    ...categoryNames.map((category) => ({
      key: category,
      label: categoryDisplay[category],
      count: deviceCountByCategory[category],
    })),
  ] as const;

  return (
    <main className="site-main">
      <PageHeader
        eyebrow="设备数据库"
        title="设备库"
        meta={
          <>
            <span className="tag tag-green">Apple 样本阶段</span>
            <span className="tag tag-neutral">
              {summaryStatsFlat.startYear} - {summaryStatsFlat.endYear}
            </span>
          </>
        }
        showDivider={false}
      />

      <section className="section section-filter">
        <div className="section-inner filter-strip">
          <div className="filter-row">
            <div className="filter-heading">设备类别</div>
            <div className="filter-pills">
              {categoryPills.map((item) => {
                const active = item.key === selectedCategory;
                const params = new URLSearchParams();
                if (item.key !== "all") params.set("category", item.key);
                if (searchQuery) params.set("q", searchQuery);
                const href = params.size > 0 ? `/devices?${params.toString()}` : "/devices";

                return (
                  <Link
                    key={item.key}
                    href={href}
                    className={`tag ${active ? "tag-green" : "tag-neutral"}`}
                    aria-current={active ? "page" : undefined}
                  >
                    {item.label}
                    <span className="opacity-70">({formatCount(item.count)})</span>
                  </Link>
                );
              })}
              <span className="tag tag-neutral">结果 {formatCount(sortedDevices.length)} 台</span>
            </div>
          </div>
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
                当前筛选条件下没有设备。你可以切回全部类别，或重新选择其它类别。
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
