import Link from "next/link";
import {
  allDevicesFlat,
  categoryLabels,
  categoryNames,
  deviceCountByCategory,
  formatMaybeCurrency,
  summaryStatsFlat,
} from "@/lib/devices-db";
import SectionHeader from "@/components/layout/SectionHeader";
import TickDivider from "@/components/layout/TickDivider";

const categoryDisplay: Record<(typeof categoryNames)[number], string> = {
  phone: "智能手机",
  tablet: "平板电脑",
  laptop: "笔记本电脑",
};

const orderedDevices = [...allDevicesFlat].sort((left, right) => {
  if (right.releaseYear !== left.releaseYear) return right.releaseYear - left.releaseYear;
  if ((right.launchPrice ?? Number.POSITIVE_INFINITY) !== (left.launchPrice ?? Number.POSITIVE_INFINITY)) {
    return (left.launchPrice ?? Number.POSITIVE_INFINITY) - (right.launchPrice ?? Number.POSITIVE_INFINITY);
  }
  return left.model.localeCompare(right.model, "zh-CN");
});

const latestDevices = orderedDevices.slice(0, 6);

const categoryHighlights = categoryNames.map((category) => {
  const devices = allDevicesFlat
    .filter((item) => item.category === category)
    .sort((left, right) => {
      if (right.releaseYear !== left.releaseYear) return right.releaseYear - left.releaseYear;
      return left.model.localeCompare(right.model, "zh-CN");
    });

  return {
    category,
    label: categoryDisplay[category],
    brandLabel: categoryLabels[category],
    count: deviceCountByCategory[category],
    latest: devices[0],
  };
});

function formatStatValue(value: number | string) {
  return typeof value === "number"
    ? new Intl.NumberFormat("zh-CN").format(value)
    : value;
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint: string;
}) {
  return (
    <div className="card p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">{label}</div>
      <div
        className="mt-2 text-2xl text-[var(--text-strong)]"
        style={{ fontFamily: "var(--font-display-stack)" }}
      >
        {formatStatValue(value)}
      </div>
      <div className="mt-1 text-xs leading-6 text-[var(--text-muted)]">{hint}</div>
    </div>
  );
}

function DevicePreview({
  device,
}: {
  device: (typeof allDevicesFlat)[number];
}) {
  return (
    <Link href={`/devices/${device.id}`} className="card group block p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="grid gap-1">
          <span className="tag tag-green w-fit">{device.brand}</span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
            {device.series}
          </span>
        </div>
        <span className="tag tag-neutral">{device.releaseYear}</span>
      </div>

      <div className="mt-5 flex items-end justify-between gap-4">
        <div className="grid gap-2">
          <h3 className="text-xl leading-tight text-[var(--text-strong)] group-hover:text-[var(--primary)]">
            {device.model}
          </h3>
          <p className="max-w-[20rem] text-sm leading-7 text-[var(--text-muted)]">
            {device.category === "phone"
              ? "面向日常使用和移动场景的真实样本。"
              : device.category === "tablet"
                ? "面向学习、创作和阅读的真实样本。"
                : "面向办公、创作和开发场景的真实样本。"}
          </p>
        </div>
        <div className="rounded-full bg-[var(--primary-soft)] px-3 py-2 text-right">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">价格</div>
          <div className="mt-1 text-sm font-semibold text-[var(--text-strong)]">
            {formatMaybeCurrency(device.launchPrice)}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <span className="tag tag-amber">{device.chip || "芯片待补充"}</span>
        <span className="tag tag-neutral">{typeof device.screenSize === "number" ? `${device.screenSize}"` : "屏幕待补充"}</span>
        <span className="tag tag-neutral">{device.weight ? `${device.weight}g` : "重量待补充"}</span>
      </div>
    </Link>
  );
}

export default function Home() {
  const spotlight = latestDevices[0];
  const timelineDevices = latestDevices.slice(0, 5).reverse();

  return (
    <main className="site-main">
      <section className="section bg-[var(--bg)] pb-10 pt-12">
        <div className="section-inner grid gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)] lg:items-center">
          <div className="grid gap-7">
            <div className="grid gap-4">
              <span className="tag tag-green w-fit">电子设备代际演进分析平台</span>
              <h1 className="max-w-[10ch] text-[clamp(2.6rem,6vw,5rem)] leading-[0.98] tracking-[-0.06em] text-[var(--text-strong)]">
                看清设备的来路与去向
              </h1>
              <p className="max-w-[34rem] text-base leading-8 text-[var(--text-muted)]">
                基于真实本地数据库，串联设备库、代际对比、趋势观察和 AI 顾问。当前第一阶段聚焦 Apple 样本。
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/devices" className="btn btn-primary">
                浏览设备库
              </Link>
              <Link href="/advisor" className="btn btn-ghost">
                打开 AI 顾问
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <StatCard label="设备" value={summaryStatsFlat.modelCount} hint="真实收录" />
              <StatCard label="类别" value={summaryStatsFlat.categoryCount} hint="第一阶段" />
              <StatCard label="系列" value={summaryStatsFlat.seriesCount} hint="可对比" />
              <StatCard label="跨度" value={`${summaryStatsFlat.startYear}-${summaryStatsFlat.endYear}`} hint="发布时间" />
            </div>
          </div>

          <div className="card overflow-hidden p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="grid gap-1">
                <span className="tag tag-green w-fit">真实样本时间线</span>
                <h2 className="text-2xl leading-tight text-[var(--text-strong)]">
                  {spotlight?.series ?? "Apple"} 最新序列
                </h2>
                <p className="text-sm text-[var(--text-muted)]">
                  最近入库机型，按发布时间组织。
                </p>
              </div>
              <span className="tag tag-amber">{summaryStatsFlat.endYear}</span>
            </div>

            <div className="relative mt-8">
              <div className="absolute left-4 right-4 top-4 h-px bg-[var(--border)]" aria-hidden="true" />
              <div className="relative grid grid-cols-5 gap-3">
                {timelineDevices.map((device, index) => (
                  <Link key={device.id} href={`/devices/${device.id}`} className="group grid gap-3">
                    <span
                      className={`mx-auto h-8 w-8 rounded-full border-4 border-[var(--surface)] ${
                        index === timelineDevices.length - 1
                          ? "bg-[var(--primary)] shadow-[0_0_0_4px_var(--primary-soft)]"
                          : "bg-[var(--border)]"
                      }`}
                    />
                    <span className="text-center text-[11px] font-semibold text-[var(--text-soft)]">
                      {device.releaseYear}
                    </span>
                    <span className="text-center text-xs font-semibold leading-5 text-[var(--text-strong)] group-hover:text-[var(--primary)]">
                      {device.model.replace(device.series, "").trim() || device.model}
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[var(--radius-md)] bg-[var(--bg-soft)] p-4">
                <div className="font-mono text-lg font-semibold text-[var(--text-strong)]">{spotlight?.chip ?? "待补充"}</div>
                <div className="mt-1 text-xs text-[var(--text-soft)]">最新样本芯片</div>
              </div>
              <div className="rounded-[var(--radius-md)] bg-[var(--bg-soft)] p-4">
                <div className="font-mono text-lg font-semibold text-[var(--text-strong)]">{spotlight ? formatMaybeCurrency(spotlight.launchPrice) : "待补充"}</div>
                <div className="mt-1 text-xs text-[var(--text-soft)]">起售价</div>
              </div>
              <div className="rounded-[var(--radius-md)] bg-[var(--bg-soft)] p-4">
                <div className="font-mono text-lg font-semibold text-[var(--text-strong)]">
                  {typeof spotlight?.aiFeatureLevel === "number" ? `${spotlight.aiFeatureLevel}/10` : "待补充"}
                </div>
                <div className="mt-1 text-xs text-[var(--text-soft)]">AI 能力</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <TickDivider className="site-container" />

      <section className="section">
        <div className="section-inner">
          <SectionHeader
            eyebrow="类别概览"
            title="按设备类别浏览"
            description="从类别进入真实样本，再查看单机参数与同系列趋势。"
          />

          <div className="grid gap-4 md:grid-cols-3">
            {categoryHighlights.map((item) => (
              <Link
                key={item.category}
                href={`/devices?category=${item.category}`}
                className="card group block p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="grid gap-1">
                    <span className="tag tag-neutral w-fit">{item.brandLabel}</span>
                    <h3 className="text-xl text-[var(--text-strong)] group-hover:text-[var(--primary)]">
                      {item.label}
                    </h3>
                  </div>
                  <span className="tag tag-amber">{item.count} 台</span>
                </div>

                <div className="mt-4 rounded-2xl bg-[var(--bg-soft)] p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                    最新入库
                  </div>
                  <div className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
                    <div className="font-medium text-[var(--text-strong)]">
                      {item.latest?.model ?? "暂无"}
                    </div>
                    <div>
                      {item.latest
                        ? `${item.latest.series} · ${item.latest.releaseYear} · ${formatMaybeCurrency(item.latest.launchPrice)}`
                        : "等待数据"}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <TickDivider className="site-container" />

      <section className="section">
        <div className="section-inner">
          <SectionHeader
            eyebrow="最近更新"
            title="最新入库样本"
            description="按发布时间排序，快速定位最新设备。"
            action={
              <Link href="/devices" className="section-link">
                查看完整设备库 →
              </Link>
            }
          />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {latestDevices.map((device) => (
              <DevicePreview key={device.id} device={device} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
