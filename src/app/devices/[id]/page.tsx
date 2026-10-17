import { notFound } from "next/navigation";
import {
  allDevices,
  allDevicesFlat,
  getCatalogDevice,
  categoryLabels,
  formatMaybeCurrency,
  getDevicesByComparisonGroupFlat,
  getComparisonGroupLabelFlat,
} from "@/lib/devices-db";
import DeviceSeriesTrendExplorer from "@/components/DeviceSeriesTrendExplorer";
import PageHeader from "@/components/layout/PageHeader";
import SectionHeader from "@/components/layout/SectionHeader";
import TickDivider from "@/components/layout/TickDivider";
import DeviceImage from "@/components/DeviceImage";
import DeviceSpecGrid from "@/components/DeviceSpecGrid";
import { getDeviceImage, getDeviceImageGallery } from "@/lib/device-images";
import { formatConfiguration, getPricesForComparison, getLaunchPriceRows } from "@/lib/device-configurations";
import { formatDeviceSpec, getDeviceSpecFields, getDeviceSpecNote, splitDeviceSpecDescription } from "@/lib/device-spec-fields";
import { brandLabels } from "@/lib/catalog-order";

function buildSourceRows(devices: (typeof allDevices)) {
  const sources = new Map<string, {
    sourceType: "official" | "reference";
    verifiedAt: string;
    fields: Set<string>;
    protocols: Set<string>;
    hasSummary: boolean;
  }>();
  const addSource = (
    sourceUrl: string,
    sourceType: "official" | "reference",
    verifiedAt: string,
    field: string,
    protocol?: string,
    isSummary = false,
  ) => {
    const source = sources.get(sourceUrl) ?? {
      sourceType,
      verifiedAt,
      fields: new Set<string>(),
      protocols: new Set<string>(),
      hasSummary: false,
    };
    source.fields.add(field);
    source.hasSummary ||= isSummary;
    if (protocol) source.protocols.add(protocol);
    sources.set(sourceUrl, source);
  };

  for (const device of devices) {
    for (const [fieldName, field] of Object.entries(device.specs ?? {})) {
      if (field?.value !== null && field?.value !== undefined) {
        addSource(field.sourceUrl, field.sourceType, field.verifiedAt, `${device.id}:${fieldName}`, undefined, field.evidenceKind === "summary");
      }
    }
    for (const benchmark of device.benchmarks ?? []) {
      addSource(
        benchmark.sourceUrl,
        "reference",
        benchmark.verifiedAt,
        `${device.id}:${benchmark.provider} ${benchmark.metric}`,
        benchmark.protocolVersion,
      );
    }
  }

  return [...sources].map(([sourceUrl, source]) => ({
    sourceUrl,
    hostname: new URL(sourceUrl).hostname,
    sourceType: source.sourceType,
    verifiedAt: source.verifiedAt,
    fieldCount: source.fields.size,
    hasSummary: source.hasSummary,
    protocols: [...source.protocols],
  }));
}

type DetailRow = {
  label: string;
  value: string;
  note?: string;
  preserveLines?: boolean;
  quotes?: Array<{ configuration: string; amount: string }>;
};

function InfoRow({ label, value, note, preserveLines, quotes }: DetailRow) {
  const lines = value.split("\n");
  // 仅按原文分项，不生成摘要；配置条件保留原有行，避免拆散对应关系。
  const parts = splitDeviceSpecDescription(value);
  const hasIntroduction = !preserveLines && parts.length > 1 && /[:：]$/.test(parts[0]);
  const detailed = hasIntroduction || value.length > 80 || parts.length > 2 || lines.length > 1 || Boolean(quotes?.length);
  return (
    <div className={`device-spec-row${detailed ? " is-detailed" : ""}`}>
      <dt className="device-spec-label">{label}</dt>
      <dd className="device-spec-value">
        {quotes?.length ? (
          <ul className="device-spec-quotes">
            {quotes.map((quote, index) => (
              <li key={index}><span>{quote.configuration}</span><strong>{quote.amount}</strong></li>
            ))}
          </ul>
        ) : detailed ? (
          <div className="device-spec-description">
            {!preserveLines && parts.length > 1
              ? <>
                {hasIntroduction && <p>{parts[0]}</p>}
                <ul>{(hasIntroduction ? parts.slice(1) : parts).map((part, index) => <li key={index}>{part}</li>)}</ul>
              </>
              : lines.map((line, index) => <p key={index}>{line}</p>)}
          </div>
        ) : lines.map((line, index) => <p key={index}>{line}</p>)}
      </dd>
      {note && <dd className="device-spec-note"><span>说明</span>{note}</dd>}
    </div>
  );
}

function SpecGroup({
  title,
  rows,
}: {
  title: string;
  rows: DetailRow[];
}) {
  return (
    <section className="card device-spec-group" aria-label={`${title}参数`}>
      <h3>{title}</h3>
      <dl>
        {rows.map((row) => (
          <InfoRow key={row.label} {...row} />
        ))}
      </dl>
    </section>
  );
}

export function generateStaticParams() {
  return allDevicesFlat.map((device) => ({ id: device.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const device = getCatalogDevice(id);

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
  const device = getCatalogDevice(id);
  const rawDevice = allDevices.find((item) => item.id === id);

  if (!device || !rawDevice) {
    notFound();
  }

  const seriesDevices = getDevicesByComparisonGroupFlat(device.family, device.variant, device.tier);
  const comparisonGroupLabel = getComparisonGroupLabelFlat(device.family, device.variant, device.tier);
  const specGroups = new Map<string, DetailRow[]>();
  const specFields = getDeviceSpecFields([device]);
  for (const field of specFields) {
    const note = getDeviceSpecNote(device, field.key);
    const row = {
      label: field.label,
      value: formatDeviceSpec(device, field),
      note: note ? String(note) : undefined,
      preserveLines: ["chip", "memory", "storage", "cpu", "gpu"].includes(field.key),
    };
    specGroups.set(field.group, [...(specGroups.get(field.group) ?? []), row]);
  }
  const priceRows: DetailRow[] = (["current", "used"] as const).map((priceType) => {
    const prices = getPricesForComparison(device, priceType);
    return {
      label: priceType === "current" ? "当前价" : "二手价",
      value: "待补充",
      quotes: prices.map(price => ({
        configuration: formatConfiguration(price.configuration),
        amount: `${formatMaybeCurrency(price.value)}${price.estimated ? "（预估）" : ""}${price.availabilityNote ? `（${price.availabilityNote}）` : ""}`,
      })),
    };
  });
  if ((device.editions?.length ?? 0) > 1) priceRows.unshift({ label: "首发价", value: "待补充", quotes: getLaunchPriceRows(device) });
  const cameraBenchmark = device.benchmarks?.find(
    (benchmark) => benchmark.provider === "DXOMARK" && benchmark.metric === "camera",
  );
  if (cameraBenchmark) specGroups.set("影像", [...(specGroups.get("影像") ?? []), {
      label: "DXOMARK 相机",
      value: `${cameraBenchmark.score} 分 · ${cameraBenchmark.protocolVersion}（不同协议不可直接横比）`,
    }]);
  const recordIds = new Set(device.editions?.map(edition => edition.device.id) ?? [device.id]);
  const sourceRows = buildSourceRows(allDevices.filter(record => recordIds.has(record.id)));
  const image = getDeviceImage(device.id);
  const gallery = getDeviceImageGallery(device.id);
  const wearable = device.category === "watch" || device.category === "band";
  const highlights = wearable ? [
    { label: "屏幕", value: typeof device.screenSize === "number" ? `${device.screenSize}\"` : String(device.specs?.caseSize ?? "按版本列示") },
    { label: "手机兼容性", value: String(device.specs?.compatibility ?? "待补充") },
    { label: "续航模式", value: String(device.specs?.batteryLife ?? "待补充") },
    { label: "防护", value: String(device.specs?.waterResistance ?? "待补充") },
  ] : [
    { label: "芯片", value: device.chip || "待补充" },
    { label: "屏幕", value: typeof device.screenSize === "number" ? `${device.screenSize}\"` : "待补充" },
    { label: "重量", value: device.weight ? `${device.weight}g` : "待补充", note: device.specs?.weightNote },
    { label: "AI 能力", value: typeof device.aiFeatureLevel === "number" ? `${device.aiFeatureLevel}/10` : "待补充" },
  ];

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
                <DeviceImage key={device.id} image={image} gallery={gallery} showColors
                  model={device.model} className="h-56 sm:h-64" />
                <div className="grid gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="tag tag-green w-fit">{brandLabels[device.brand] ?? device.brand}</span>
                    <span className="tag tag-neutral">{comparisonGroupLabel}</span>
                    <span className="tag tag-amber">
                      {`已收录 ${seriesDevices.length} 款同组型号`}
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
                  {highlights.map(item => <div key={item.label} className="rounded-2xl bg-[var(--bg-soft)] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">{item.label}</div>
                    <div className="mt-2 line-clamp-3 text-sm font-medium text-[var(--text-strong)]">{item.value}</div>
                    {"note" in item && item.note && <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{String(item.note)}</p>}
                  </div>)}
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-white/75 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">数据口径</div>
                  <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
                    该页面优先展示本地数据库中已收录字段，数组或布尔型字段会按实际值展开，缺失项保留“待补充”。
                    参数图仅使用同一产品族、款式与芯片档位的真实样本，不引入原型假统计数字。
                  </p>
                </div>
              </div>

              <DeviceSeriesTrendExplorer activeDeviceId={device.id} devices={seriesDevices.map(({
                id, model, releaseYear, chip, screenSize, weight, launchPrice, aiFeatureLevel,
              }) => ({ id, model, releaseYear, chip, screenSize, weight, launchPrice, aiFeatureLevel }))} />
            </div>
          </div>
        </div>
      </section>

      <TickDivider className="site-container" />

      <section className="section pt-0">
        <div className="section-inner">
          <SectionHeader
            eyebrow="核心规格"
            title="详细参数"
            description="完整参数按类别分区显示，不同配置的价格与差异逐项列出。"
          />

          <DeviceSpecGrid>
            <SpecGroup title="价格参考" rows={priceRows} />
            {[...specGroups].map(([title, rows]) => <SpecGroup key={title} title={title} rows={rows} />)}
          </DeviceSpecGrid>
        </div>
      </section>

      <TickDivider className="site-container" />

      <section className="section pt-0">
        <div className="section-inner">
          <SectionHeader
            eyebrow="数据来源"
            title="已收录字段的证据入口"
            description="相同页面只列一次；第三方资料是可追溯参考，不冒充品牌官方数据。"
          />
          <div className="grid gap-3 md:grid-cols-2">
            {sourceRows.map((source) => (
              <a
                className="card group p-5 transition hover:-translate-y-0.5 hover:border-[rgba(45,90,61,0.28)] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                href={source.sourceUrl}
                key={source.sourceUrl}
                rel="noreferrer"
                target="_blank"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={source.sourceType === "official" ? "tag tag-green" : "tag tag-amber"}>
                    {source.sourceType === "official" ? "官方来源" : "第三方参考"}
                  </span>
                  <span className="text-xs text-[var(--text-soft)]">{source.hasSummary ? "历史记录日期" : "核验于"} {source.verifiedAt}</span>
                </div>
                <p className="mt-3 break-all text-sm font-semibold text-[var(--text-strong)]">{source.hostname}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                  覆盖 {source.fieldCount} 项已收录数据
                  {source.hasSummary ? " · 含整理描述，原文证据待补" : ""}
                  {source.protocols.length ? ` · 测试协议 ${source.protocols.join(" / ")}` : ""}
                </p>
                <span className="mt-4 inline-flex text-xs font-semibold text-[var(--primary)]">
                  查看来源 <span aria-hidden="true" className="ml-1 transition group-hover:translate-x-0.5">→</span>
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
