"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import DeviceCatalogFilters from "@/components/DeviceCatalogFilters";
import DeviceImage from "@/components/DeviceImage";
import { brandLabels } from "@/lib/catalog-order";
import { categoryLabels } from "@/lib/device-categories";
import { formatMaybeCurrency } from "@/lib/number-format";
import { getCatalogListing, type CatalogEntry, type CatalogFamily } from "@/lib/catalog-list";

function DeviceCard({ device }: { device: CatalogEntry }) {
  const highlights = [device.chip, typeof device.screenSize === "number" ? `${device.screenSize}\"` : "",
    device.weight ? `${device.weight}g` : ""].filter(Boolean);
  return <Link href={`/devices/${device.id}`} prefetch={false} className="card group flex h-full flex-col p-5">
    <DeviceImage image={device.image} model={device.model} className="mb-4 h-44" />
    <div className="flex items-start justify-between gap-4">
      <div className="grid gap-1"><span className="tag tag-neutral w-fit">{categoryLabels[device.category]}</span>
        <h3 className="text-xl leading-tight text-[var(--text-strong)] group-hover:text-[var(--primary)]">{device.model}</h3>
      </div><span className="tag tag-green">{device.releaseYear}</span>
    </div>
    <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">{device.seriesLabel} · {brandLabels[device.brand] ?? device.brand}</p>
    <div className="mt-4 flex flex-wrap gap-2">{highlights.slice(0, 3).map(item => <span key={item} className="tag tag-amber">{item}</span>)}</div>
    <div className="mt-5 rounded-2xl bg-[var(--bg-soft)] p-4">
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">起售价</span>
        <span className="text-sm font-semibold text-[var(--text-strong)]">{formatMaybeCurrency(device.launchPrice)}</span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-4 text-xs text-[var(--text-muted)]"><span>系列</span><span>{device.seriesLabel}</span></div>
    </div>
    <div className="mt-5 flex items-center justify-between text-sm font-medium text-[var(--primary)]"><span>查看详情</span><span aria-hidden="true">→</span></div>
  </Link>;
}

export default function DeviceCatalog({ devices, groups, initialQuery }: { devices: CatalogEntry[]; groups: CatalogFamily[]; initialQuery: string }) {
  const query = useSearchParams() ?? new URLSearchParams(initialQuery);
  const listing = getCatalogListing(devices, groups, query);
  const navigate = (href: string) => window.history.pushState(null, "", href);
  const pageHref = (page: number) => {
    const params = new URLSearchParams(query.toString());
    if (page === 1) params.delete("page"); else params.set("page", String(page));
    return `/devices${params.size ? `?${params}` : ""}`;
  };
  const changePage = (page: number) => {
    navigate(pageHref(page));
    document.getElementById("device-catalog-results")?.scrollIntoView({ block: "start" });
  };
  return <>
    <section className="section section-filter"><div className="section-inner catalog-filter-grid">
      <DeviceCatalogFilters path="/devices" groups={groups} brand={listing.brand} category={listing.category}
        series={listing.series} allowAll params={query.get("q") ? { q: query.get("q")! } : {}} onNavigate={navigate} />
      <span className="self-end pb-2 text-sm text-[var(--text-soft)]" role="status">结果 {listing.total.toLocaleString("zh-CN")} 台</span>
    </div></section>
    <section className="section pt-0"><div id="device-catalog-results" className="section-inner scroll-mt-28">
      {listing.total ? <>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{listing.devices.map(device => <DeviceCard key={device.id} device={device} />)}</div>
        <nav aria-label="设备库分页" className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm">
          {listing.page > 1 && <a className="btn btn-secondary" href={pageHref(listing.page - 1)} onClick={event => {
            if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault(); changePage(listing.page - 1);
          }}>上一页</a>}
          <span role="status" className="text-[var(--text-muted)]">第 {listing.page} / {listing.pageCount} 页 · {listing.start + 1}–{listing.start + listing.devices.length} 台</span>
          {listing.page < listing.pageCount && <a className="btn btn-secondary" href={pageHref(listing.page + 1)} onClick={event => {
            if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault(); changePage(listing.page + 1);
          }}>下一页</a>}
        </nav>
      </> : <div className="card p-8 text-center">
        <h2 className="text-2xl text-[var(--text-strong)]">没有找到匹配设备</h2>
        <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">当前筛选条件下没有设备。你可以切回全部类别、全部品牌，或调整搜索条件。</p>
        <button className="btn btn-primary mt-6" onClick={() => navigate("/devices")}>查看全部设备</button>
      </div>}
    </div></section>
  </>;
}
