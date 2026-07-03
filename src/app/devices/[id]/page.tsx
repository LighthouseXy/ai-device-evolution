import Link from "next/link";
import { notFound } from "next/navigation";
import {
  allDevicesFlat,
  categoryLabels,
  formatMaybeCurrency,
  getDevicesBySeriesFlat,
} from "@/lib/devices-db";
import PageHeader from "@/components/layout/PageHeader";
import SectionHeader from "@/components/layout/SectionHeader";
import TickDivider from "@/components/layout/TickDivider";

type Device = (typeof allDevicesFlat)[number];

function getSpecValue(device: Device, key: string) {
  const value = device.specs?.[key];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "boolean") return value ? "支持" : "不支持";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

function buildRows(device: Device, keys: Array<[string, string]>) {
  return keys.map(([label, key]) => {
    const value = getSpecValue(device, key);
    return { label, value: value ?? "待补充" };
  });
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(value);
}

function parseChipRank(chip: string) {
  const normalized = chip.replace(/\s+/g, " ");
  const match = normalized.match(/\b(?:Apple\s+)?([AM])\s?(\d{1,2})\b/i) ?? normalized.match(/\b(\d{1,2})\b/);
  if (!match) return null;
  const raw = match.length > 2 ? match[2] : match[1];
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[rgba(221,213,199,0.75)] py-3 last:border-b-0 last:pb-0">
      <span className="text-sm text-[var(--text-muted)]">{label}</span>
      <span className="text-right text-sm font-medium text-[var(--text-strong)]">{value}</span>
    </div>
  );
}

function SpecGroup({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="card h-full p-5">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">{title}</div>
      <div className="mt-4">
        {rows.map((row) => (
          <InfoRow key={row.label} label={row.label} value={row.value} />
        ))}
      </div>
    </div>
  );
}

type TrendMetric = {
  key: string;
  label: string;
  note: string;
  format: (value: number) => string;
  getValue: (device: Device) => number | null;
};

const trendMetrics: TrendMetric[] = [
  {
    key: "launchPrice",
    label: "首发价格",
    note: "按真实首发价排位，位置越高代表价格越高。",
    format: (value) => formatMaybeCurrency(value),
    getValue: (device) => device.launchPrice ?? null,
  },
  {
    key: "screenSize",
    label: "屏幕尺寸",
    note: "按英寸值直接对比，屏幕越大位置越高。",
    format: (value) => `${formatNumber(value)} 英寸`,
    getValue: (device) => device.screenSize ?? null,
  },
  {
    key: "weight",
    label: "重量",
    note: "按克数对比，数值越小越轻。",
    format: (value) => `${formatNumber(value)} g`,
    getValue: (device) => device.weight ?? null,
  },
  {
    key: "aiFeatureLevel",
    label: "AI 能力",
    note: "来自本地 computed 字段，按 0-10 分级。",
    format: (value) => `${formatNumber(value)}/10`,
    getValue: (device) => device.aiFeatureLevel ?? null,
  },
  {
    key: "chipRank",
    label: "芯片代际",
    note: "从芯片编号提取的可比较序列，保留真实芯片文本。",
    format: (value) => `${formatNumber(value)} 代`,
    getValue: (device) => parseChipRank(device.chip),
  },
];

function MetricTrendCard({
  metric,
  devices,
  activeId,
}: {
  metric: TrendMetric;
  devices: Device[];
  activeId: string;
}) {
  const entries = devices.map((device) => {
    const value = metric.getValue(device);
    return { device, value };
  });
  const validValues = entries.flatMap((entry) => (typeof entry.value === "number" ? [entry.value] : []));
  const currentEntry = entries.find((entry) => entry.device.id === activeId) ?? null;
  const currentValue = currentEntry?.value ?? null;
  const min = validValues.length ? Math.min(...validValues) : null;
  const max = validValues.length ? Math.max(...validValues) : null;
  const span = min !== null && max !== null ? Math.max(max - min, 1) : 1;
  const width = 640;
  const height = 180;
  const paddingX = 24;
  const paddingTop = 18;
  const paddingBottom = 42;
  const usableWidth = width - paddingX * 2;
  const usableHeight = height - paddingTop - paddingBottom;

  const points = entries.map((entry, index) => {
    const hasValue = typeof entry.value === "number" && min !== null && max !== null;
    const x = devices.length <= 1 ? width / 2 : paddingX + (index / (devices.length - 1)) * usableWidth;
    const y = hasValue ? paddingTop + (1 - ((entry.value as number) - min) / span) * usableHeight : null;
    return { ...entry, x, y };
  });

  const pathSegments: string[] = [];
  let started = false;
  for (const point of points) {
    if (point.y === null) {
      started = false;
      continue;
    }
    const command = started ? "L" : "M";
    pathSegments.push(`${command} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`);
    started = true;
  }
  const path = pathSegments.join(" ");

  const currentPosition =
    currentValue !== null && min !== null && max !== null ? (currentValue - min) / span : null;
  const rangeLabel =
    min !== null && max !== null ? `${metric.format(min)} - ${metric.format(max)}` : "暂无可比数据";

  return (
    <article className="card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="grid gap-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">{metric.label}</div>
          <div className="text-2xl font-semibold text-[var(--text-strong)]">
            {currentValue !== null ? metric.format(currentValue) : "待补充"}
          </div>
          <p className="text-xs leading-6 text-[var(--text-muted)]">{metric.note}</p>
        </div>
        <span className="tag tag-green">{devices.length} 台</span>
      </div>

      <div className="mt-4 rounded-2xl border border-[rgba(221,213,199,0.72)] bg-[var(--bg-soft)] p-3">
        {path ? (
          <>
            <svg
              aria-label={`${metric.label} 同系列位置图`}
              className="h-[180px] w-full"
              preserveAspectRatio="none"
              role="img"
              viewBox={`0 0 ${width} ${height}`}
            >
              <defs>
                <linearGradient id={`${metric.key}-line`} x1="0%" x2="100%" y1="0%" y2="0%">
                  <stop offset="0%" stopColor="rgba(45,90,61,0.18)" />
                  <stop offset="100%" stopColor="rgba(45,90,61,0.42)" />
                </linearGradient>
              </defs>
              <line
                stroke="rgba(221,213,199,0.72)"
                strokeDasharray="4 6"
                x1={paddingX}
                x2={width - paddingX}
                y1={paddingTop + usableHeight / 2}
                y2={paddingTop + usableHeight / 2}
              />
              <path d={path} fill="none" stroke={`url(#${metric.key}-line)`} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
              {points.map((point) => {
                if (point.y === null) return null;
                const isActive = point.device.id === activeId;
                return (
                  <g key={`${metric.key}-${point.device.id}`}>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      fill={isActive ? "var(--primary-strong)" : "rgba(221,213,199,0.96)"}
                      r={isActive ? 6.5 : 4.4}
                      stroke={isActive ? "rgba(247,245,240,1)" : "rgba(45,90,61,0.16)"}
                      strokeWidth={isActive ? 3 : 2}
                    />
                    <text
                      fill={isActive ? "var(--primary-strong)" : "var(--text-soft)"}
                      fontSize="10"
                      fontWeight={isActive ? 700 : 500}
                      textAnchor="middle"
                      x={point.x}
                      y={height - 16}
                    >
                      {point.device.releaseYear}
                    </text>
                  </g>
                );
              })}
              {points.map((point) => {
                if (point.y === null || point.device.id !== activeId) return null;
                return (
                  <text
                    fill="var(--primary-strong)"
                    fontSize="10"
                    fontWeight="700"
                    textAnchor="middle"
                    x={point.x}
                    y={Math.max(point.y - 12, 12)}
                    key={`${metric.key}-${point.device.id}-label`}
                  >
                    {point.device.model}
                  </text>
                );
              })}
            </svg>

            <div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-[var(--text-soft)]">
              {points.map((point) => (
                <span
                  className={point.device.id === activeId ? "font-semibold text-[var(--primary-strong)]" : ""}
                  key={`${metric.key}-${point.device.id}-axis`}
                >
                  {point.device.releaseYear}
                </span>
              ))}
            </div>
          </>
        ) : (
          <div className="flex h-[180px] items-center justify-center rounded-2xl border border-dashed border-[rgba(221,213,199,0.7)] bg-white/70 text-sm text-[var(--text-muted)]">
            该指标暂无足够数据
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
        <span>系列范围 {rangeLabel}</span>
        <span>{currentPosition !== null ? `当前位置 ${Math.round(currentPosition * 100)}%` : "当前位置 —"}</span>
      </div>
    </article>
  );
}

export function generateStaticParams() {
  return allDevicesFlat.map((device) => ({ id: device.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const device = allDevicesFlat.find((item) => item.id === id);

  if (!device) {
    return {
      title: "设备不存在 — 数码观察站",
    };
  }

  return {
    title: `${device.model}｜数码观察站`,
    description: `${device.series} · ${categoryLabels[device.category]} · ${device.releaseYear}`,
  };
}

export default async function DeviceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const device = allDevicesFlat.find((item) => item.id === id);

  if (!device) {
    notFound();
  }

  const seriesDevices = getDevicesBySeriesFlat(device.series);
  const currentIndex = seriesDevices.findIndex((item) => item.id === device.id);
  const performanceRows = buildRows(device, [
    ["芯片", "chip"],
    ["CPU", "cpu"],
    ["GPU", "gpu"],
    ["神经引擎", "neuralEngine"],
    ["内存", "memory"],
    ["存储", "storage"],
  ]);
  const displayRows = buildRows(device, [
    ["屏幕尺寸", "screenSize"],
    ["显示类型", "displayType"],
    ["分辨率", "resolution"],
    ["刷新率", "refreshRate"],
    ["峰值亮度", "peakBrightness"],
    ["显示涂层", "displayCoating"],
  ]);
  const imagingRows = buildRows(device, [
    ["主摄", "mainCamera"],
    ["后置摄像头", "rearCamera"],
    ["超广角", "ultraWide"],
    ["长焦", "telephoto"],
    ["前置摄像头", "frontCamera"],
    ["视频拍摄", "videoRecording"],
  ]);
  const batteryRows = buildRows(device, [
    ["电池续航", "batteryLife"],
    ["快速充电", "fastCharge"],
    ["充电方式", "chargingMethod"],
    ["无线网络浏览", "wirelessWebBrowsing"],
  ]);
  const connectivityRows = buildRows(device, [
    ["接口", "port"],
    ["USB-C", "usbC"],
    ["雷雳", "thunderbolt"],
    ["无线网络", "wifi"],
    ["蓝牙", "bluetooth"],
    ["SIM", "sim"],
  ]);
  const protectionRows = buildRows(device, [
    ["安全验证", "security"],
    ["防水等级", "waterResistance"],
    ["MagSafe", "hasMagSafe"],
    ["NFC", "hasNFC"],
    ["SOS", "hasSOS"],
    ["车祸检测", "hasCrashDetection"],
    ["UWB", "hasUWB"],
    ["Touch ID", "hasTouchId"],
  ]);

  return (
    <main className="site-main">
      <PageHeader
        eyebrow={`${categoryLabels[device.category]} / ${device.series}`}
        title={device.model}
        description={`${device.brand} · ${device.releaseYear} · ${device.id}。页面字段直接来自本地数据库，用于展示真实设备数据口径，而不是原型假统计。`}
        actions={
          <>
            <Link href="/devices" className="btn btn-ghost">
              返回设备库
            </Link>
            <Link href={`/devices?category=${device.category}`} className="btn btn-primary">
              查看同类设备
            </Link>
          </>
        }
        meta={
          <>
            <span className="tag tag-green">{device.releaseYear}</span>
            <span className="tag tag-neutral">{device.series}</span>
            <span className="tag tag-amber">{formatMaybeCurrency(device.launchPrice)}</span>
          </>
        }
      />

      <section className="section pt-0">
        <div className="section-inner">
          <div className="card overflow-hidden p-6 lg:p-7">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] xl:items-start">
              <div className="grid gap-5">
                <div className="grid gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="tag tag-green w-fit">{device.brand}</span>
                    <span className="tag tag-neutral">{device.series}</span>
                    <span className="tag tag-amber">
                      {currentIndex >= 0 ? `第 ${currentIndex + 1} 代 / 共 ${seriesDevices.length} 代` : `${seriesDevices.length} 代样本`}
                    </span>
                  </div>
                  <div className="grid gap-2">
                    <h2 className="text-2xl leading-tight text-[var(--text-strong)]">{device.model}</h2>
                    <p className="text-sm leading-7 text-[var(--text-muted)]">
                      {device.series} · {device.category} · {device.releaseYear}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-2xl bg-[var(--bg-soft)] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">芯片</div>
                    <div className="mt-2 text-sm font-medium text-[var(--text-strong)]">{device.chip || "待补充"}</div>
                  </div>
                  <div className="rounded-2xl bg-[var(--bg-soft)] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">屏幕</div>
                    <div className="mt-2 text-sm font-medium text-[var(--text-strong)]">
                      {typeof device.screenSize === "number" ? `${device.screenSize}"` : "待补充"}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-[var(--bg-soft)] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">重量</div>
                    <div className="mt-2 text-sm font-medium text-[var(--text-strong)]">
                      {device.weight ? `${device.weight}g` : "待补充"}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-[var(--bg-soft)] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">AI 能力</div>
                    <div className="mt-2 text-sm font-medium text-[var(--text-strong)]">
                      {typeof device.aiFeatureLevel === "number" ? `${device.aiFeatureLevel}/10` : "待补充"}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-white/75 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">数据口径</div>
                  <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
                    该页面优先展示本地数据库中已收录字段，数组或布尔型字段会按实际值展开，缺失项保留“待补充”。
                    参数图仅使用真实同系列样本，不引入原型假统计数字。
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {trendMetrics.map((metric) => (
                  <MetricTrendCard activeId={device.id} devices={seriesDevices} key={metric.key} metric={metric} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <TickDivider className="site-container" />

      <section className="section pt-0">
        <div className="section-inner">
          <SectionHeader
            eyebrow="核心规格"
            title="真实字段展开"
            description="以下内容直接读取设备数据库中的原始字段，按功能分组查看。"
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <SpecGroup title="性能" rows={performanceRows} />
            <SpecGroup title="显示" rows={displayRows} />
            <SpecGroup title="影像" rows={imagingRows} />
            <SpecGroup title="续航与连接" rows={batteryRows} />
            <SpecGroup title="网络与接口" rows={connectivityRows} />
            <SpecGroup title="防护与配件" rows={protectionRows} />
          </div>
        </div>
      </section>
    </main>
  );
}
