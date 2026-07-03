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

function getSpecValue(device: (typeof allDevicesFlat)[number], key: string) {
  const value = device.specs?.[key];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "boolean") return value ? "支持" : "不支持";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

function buildRows(device: (typeof allDevicesFlat)[number], keys: Array<[string, string]>) {
  return keys
    .map(([label, key]) => {
      const value = getSpecValue(device, key);
      return { label, value: value ?? "待补充" };
    });
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

function DeviceTimelineCard({
  device,
  active,
}: {
  device: (typeof allDevicesFlat)[number];
  active?: boolean;
}) {
  return (
    <Link
      href={`/devices/${device.id}`}
      className={`card group flex h-full flex-col p-4 transition ${active ? "border-[rgba(45,90,61,0.35)] shadow-[0_10px_30px_rgba(45,90,61,0.12)]" : ""}`}
      aria-current={active ? "page" : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-1">
          <span className="tag tag-neutral w-fit">{device.releaseYear}</span>
          <h3 className="text-lg leading-tight text-[var(--text-strong)] group-hover:text-[var(--primary)]">
            {device.model}
          </h3>
        </div>
        {active ? <span className="tag tag-green">当前</span> : null}
      </div>

      <div className="mt-4 grid gap-2 text-sm text-[var(--text-muted)]">
        <div className="flex items-center justify-between gap-4">
          <span>芯片</span>
          <span className="font-medium text-[var(--text-strong)]">{device.chip || "待补充"}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span>屏幕</span>
          <span className="font-medium text-[var(--text-strong)]">
            {typeof device.screenSize === "number" ? `${device.screenSize}"` : "待补充"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span>起售价</span>
          <span className="font-medium text-[var(--text-strong)]">{formatMaybeCurrency(device.launchPrice)}</span>
        </div>
      </div>
    </Link>
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
  const previousDevice = currentIndex > 0 ? seriesDevices[currentIndex - 1] : null;
  const nextDevice = currentIndex >= 0 && currentIndex < seriesDevices.length - 1 ? seriesDevices[currentIndex + 1] : null;

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
        <div className="section-inner grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="card p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="grid gap-2">
                <span className="tag tag-green w-fit">{device.brand}</span>
                <h2 className="text-2xl leading-tight text-[var(--text-strong)]">{device.model}</h2>
                <p className="text-sm leading-7 text-[var(--text-muted)]">
                  {device.series} · {device.category} · {device.releaseYear}
                </p>
              </div>
              <div className="rounded-full bg-[var(--accent-soft)] px-4 py-3 text-right">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-strong)]">
                  起售价
                </div>
                <div className="mt-1 text-lg font-semibold text-[var(--text-strong)]">
                  {formatMaybeCurrency(device.launchPrice)}
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
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

            <div className="mt-6 rounded-2xl border border-[var(--border)] bg-white/75 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">数据口径</div>
              <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
                该页面优先展示本地数据库中已收录字段，数组或布尔型字段会按实际值展开，缺失项保留“待补充”。
                数据不会引用原型中的假统计数字。
              </p>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="grid gap-1">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">同系列演进</div>
                <h3 className="text-xl text-[var(--text-strong)]">{device.series}</h3>
              </div>
              <span className="tag tag-neutral">{seriesDevices.length} 代</span>
            </div>

            <div className="mt-5 grid gap-3">
              {seriesDevices.map((item) => (
                <DeviceTimelineCard key={item.id} device={item} active={item.id === device.id} />
              ))}
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

      <TickDivider className="site-container" />

      <section className="section pt-0">
        <div className="section-inner">
          <SectionHeader
            eyebrow="前后代际"
            title="查看前后机型"
            description="同系列的前后机型可以快速比较代际演进脉络。"
          />

          <div className="grid gap-4 md:grid-cols-2">
            {previousDevice ? <DeviceTimelineCard device={previousDevice} /> : null}
            {nextDevice ? <DeviceTimelineCard device={nextDevice} /> : null}
            {!previousDevice && !nextDevice ? (
              <div className="card p-6 text-sm text-[var(--text-muted)]">当前系列暂无更多前后机型。</div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
