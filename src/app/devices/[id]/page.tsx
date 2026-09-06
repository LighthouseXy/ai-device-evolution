import { notFound } from "next/navigation";
import {
  allDevicesFlat,
  categoryLabels,
  formatMaybeCurrency,
  getDevicesByComparisonGroupFlat,
  getComparisonGroupLabelFlat,
} from "@/lib/devices-db";
import DeviceSeriesTrendExplorer from "@/components/DeviceSeriesTrendExplorer";
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

  const seriesDevices = getDevicesByComparisonGroupFlat(device.family, device.variant, device.tier);
  const comparisonGroupLabel = getComparisonGroupLabelFlat(device.family, device.variant, device.tier);
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
  ]);
  const cameraBenchmark = device.benchmarks?.find(
    (benchmark) => benchmark.provider === "DXOMARK" && benchmark.metric === "camera",
  );
  const imagingRows = [
    ...buildRows(device, [
    ["主摄", "mainCamera"],
    ["后置摄像头", "rearCamera"],
    ["超广角", "ultraWide"],
    ["长焦", "telephoto"],
    ["前置摄像头", "frontCamera"],
    ["视频拍摄", "videoRecording"],
    ]),
    ...(cameraBenchmark ? [{
      label: "DXOMARK 相机",
      value: `${cameraBenchmark.score} 分 · ${cameraBenchmark.protocolVersion}（不同协议不可直接横比）`,
    }] : []),
  ];
  const batteryRows = buildRows(device, [
    ["电池续航", "batteryLife"],
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
        meta={
          <>
            <span className="tag tag-green">{device.releaseYear}</span>
            <span className="tag tag-neutral">{comparisonGroupLabel}</span>
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
                    <span className="tag tag-neutral">{comparisonGroupLabel}</span>
                    <span className="tag tag-amber">
                      {currentIndex >= 0 ? `第 ${currentIndex + 1} 代 / 共 ${seriesDevices.length} 代` : `${seriesDevices.length} 代样本`}
                    </span>
                  </div>
                  <div className="grid gap-2">
                    <h2 className="text-2xl leading-tight text-[var(--text-strong)]">{device.model}</h2>
                    <p className="text-sm leading-7 text-[var(--text-muted)]">
                      {comparisonGroupLabel} · {categoryLabels[device.category]} · {device.releaseYear}
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
                    参数图仅使用同一产品族、款式与芯片档位的真实样本，不引入原型假统计数字。
                  </p>
                </div>
              </div>

              <DeviceSeriesTrendExplorer activeDeviceId={device.id} devices={seriesDevices} />
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
            description="按功能分组查看原始字段。"
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
