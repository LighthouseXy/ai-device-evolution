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

  return (
    <main className="site-main">
      <section className="page-header">
        <div className="page-header-inner grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)] lg:items-start">
          <div className="grid gap-6">
            <div className="grid gap-3">
              <div className="page-header-kicker">数码观察站 / 电子设备代际演进分析平台</div>
              <h1 className="page-header-title">
                用真实设备数据，读懂电子产品的代际演进
              </h1>
              <p className="page-header-desc">
                当前以 Apple 样本为第一阶段范围，所有内容都直接来自本地设备数据库。
                你可以浏览设备库、查看单机详情，或者继续扩展到更广泛的品牌与品类。
              </p>
            </div>

            <div className="page-header-actions">
              <Link href="/devices" className="btn btn-primary">
                浏览设备库
              </Link>
              <Link href={spotlight ? `/devices/${spotlight.id}` : "/devices"} className="btn btn-ghost">
                查看最新机型
              </Link>
            </div>

            <div className="page-header-meta">
              <StatCard
                label="收录机型"
                value={summaryStatsFlat.modelCount}
                hint="来自本地数据库的真实收录数量。"
              />
              <StatCard
                label="覆盖类别"
                value={summaryStatsFlat.categoryCount}
                hint="当前仅覆盖手机、平板和笔记本三类 Apple 样本。"
              />
              <StatCard
                label="覆盖系列"
                value={summaryStatsFlat.seriesCount}
                hint="同系列代际演进可直接进入详情页查看。"
              />
              <StatCard
                label="时间跨度"
                value={`${summaryStatsFlat.startYear} - ${summaryStatsFlat.endYear}`}
                hint="全部由设备数据库中的发布时间推导。"
              />
            </div>
          </div>

          <div className="card overflow-hidden p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="grid gap-1">
                <span className="tag tag-green w-fit">最新样本</span>
                <h2 className="text-2xl leading-tight text-[var(--text-strong)]">
                  {spotlight?.model ?? "暂无样本"}
                </h2>
                <p className="text-sm text-[var(--text-muted)]">
                  {spotlight ? `${spotlight.series} · ${categoryDisplay[spotlight.category]} · ${spotlight.releaseYear}` : "等待数据库加载"}
                </p>
              </div>
              <div className="rounded-full bg-[var(--accent-soft)] px-3 py-2 text-right">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-strong)]">起售价</div>
                <div className="mt-1 text-sm font-semibold text-[var(--text-strong)]">
                  {spotlight ? formatMaybeCurrency(spotlight.launchPrice) : "待补充"}
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl bg-[var(--bg-soft)] p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">核心配置</div>
                <div className="mt-2 grid gap-2 text-sm leading-7 text-[var(--text-muted)]">
                  <div className="flex items-center justify-between gap-4">
                    <span>芯片</span>
                    <span className="font-semibold text-[var(--text-strong)]">{spotlight?.chip ?? "待补充"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>屏幕</span>
                    <span className="font-semibold text-[var(--text-strong)]">
                      {spotlight?.screenSize ? `${spotlight.screenSize}"` : "待补充"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>重量</span>
                    <span className="font-semibold text-[var(--text-strong)]">
                      {spotlight?.weight ? `${spotlight.weight}g` : "待补充"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>AI 能力等级</span>
                    <span className="font-semibold text-[var(--text-strong)]">
                      {typeof spotlight?.aiFeatureLevel === "number" ? `${spotlight.aiFeatureLevel}/10` : "待补充"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid gap-2">
                {latestDevices.slice(0, 3).map((device, index) => (
                  <Link
                    key={device.id}
                    href={`/devices/${device.id}`}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-white/75 px-4 py-3 text-sm transition hover:border-[var(--primary)]/30 hover:bg-white"
                  >
                    <div className="grid gap-1">
                      <span className="font-medium text-[var(--text-strong)]">
                        {index + 1}. {device.model}
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {device.series} · {device.releaseYear}
                      </span>
                    </div>
                    <span className="font-semibold text-[var(--primary)]">
                      {formatMaybeCurrency(device.launchPrice)}
                    </span>
                  </Link>
                ))}
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
            description="每个类别都来自当前真实数据库。你可以先看类别，再进入具体设备详情。"
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
            description="以下条目全部来自真实设备数据，按发布时间从新到旧排序。"
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
