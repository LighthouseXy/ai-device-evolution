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
    <div className="home-hero-stat">
      <span className="home-hero-stat-value">{formatStatValue(value)}</span>
      <span className="home-hero-stat-label">{label}</span>
      <span className="home-hero-stat-hint">{hint}</span>
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
      <section className="home-hero">
        <div className="home-hero-inner">
          <div className="home-hero-content">
            <div className="home-hero-text">
              <div className="home-hero-badge">AI 设备演进分析平台</div>
              <h1 className="home-hero-title">
                整理<span className="accent">过去</span>
                <br />
                预测<span className="amber">未来</span>
              </h1>
              <p className="home-hero-desc">
                基于真实本地数据库，串联设备库、代际对比、趋势观察和 AI 顾问；现已接入 Apple、Xiaomi、OPPO 与 vivo 中国大陆设备数据。
              </p>

              <div className="home-hero-actions">
                <Link href="/devices" className="btn btn-primary btn-lg">
                  浏览设备库
                </Link>
                <Link href="/advisor" className="btn btn-ghost btn-lg">
                  问问 AI 顾问
                </Link>
              </div>

              <div className="home-hero-stats">
                <StatCard label="收录设备" value={summaryStatsFlat.modelCount} hint="真实样本" />
                <StatCard label="品牌范围" value={summaryStatsFlat.brandCount} hint="持续扩充" />
                <StatCard label="可比系列" value={summaryStatsFlat.seriesCount} hint={`${summaryStatsFlat.startYear}—${summaryStatsFlat.endYear}`} />
              </div>
            </div>

            <div className="home-hero-visual">
              <div className="home-timeline-card">
                <div className="home-timeline-header">
                  <span className="home-timeline-series">{spotlight?.series ?? "设备"} 最新序列</span>
                  <span className="home-timeline-range">{summaryStatsFlat.startYear} — {summaryStatsFlat.endYear}</span>
                </div>

                <div className="home-timeline-track">
                  <div className="home-timeline-line" />
                  <div className="home-timeline-nodes">
                    {timelineDevices.map((device, index) => (
                      <Link key={device.id} href={`/devices/${device.id}`} className="home-timeline-node">
                        <span className={`home-node-dot${index === timelineDevices.length - 1 ? " active" : ""}`} />
                        <span className="home-node-year">{device.releaseYear}</span>
                        <span className="home-node-name">
                          {device.model.replace(device.series, "").trim() || device.model}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="home-timeline-metrics">
                  <div className="home-metric">
                    <span className="home-metric-value">{spotlight?.chip ?? "待补充"}</span>
                    <span className="home-metric-label">最新样本芯片</span>
                  </div>
                  <div className="home-metric">
                    <span className="home-metric-value">{spotlight ? formatMaybeCurrency(spotlight.launchPrice) : "待补充"}</span>
                    <span className="home-metric-label">起售价</span>
                  </div>
                  <div className="home-metric">
                    <span className="home-metric-value">
                      {typeof spotlight?.aiFeatureLevel === "number" ? `${spotlight.aiFeatureLevel}/10` : "待补充"}
                    </span>
                    <span className="home-metric-label">AI 能力</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="section-inner">
        <TickDivider className="home-section-divider" />
      </div>

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

      <div className="section-inner">
        <TickDivider className="home-section-divider" />
      </div>

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
