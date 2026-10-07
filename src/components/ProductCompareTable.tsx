import Link from "next/link";
import DeviceImage from "@/components/DeviceImage";
import { getDeviceImage } from "@/lib/device-images";
import type { FlattenedDevice } from "@/lib/devices-db";
import { formatMaybeCurrency, formatSignedZhCurrency, formatSignedZhNumber, formatZhNumber, parseDisplayNumber } from "@/lib/number-format";

export type ComparisonField = {
  group: string; label: string; hint?: string;
  getValue: (device: FlattenedDevice) => string;
  getMeta?: (device: FlattenedDevice) => string[] | null;
  isNumeric?: boolean; isCurrency?: boolean; showChange?: boolean; optional?: boolean;
};
function changeLabel(field: ComparisonField, previous: string, current: string) {
  if (!field.isNumeric) return "已更新";
  const before = parseDisplayNumber(previous), after = parseDisplayNumber(current);
  if (!Number.isFinite(before) || !Number.isFinite(after) || before === 0 || after === 0) return "已更新";
  const delta = after - before;
  if (field.isCurrency) return `${formatSignedZhCurrency(delta, 0)} / ${formatSignedZhNumber(delta / before * 100, 0)}%`;
  const unit = field.label.includes("重量") ? "g" : field.label.includes("屏幕") ? '"' : field.label.includes("刷新率") ? "Hz" : "";
  return `${delta > 0 ? "+" : "−"}${formatZhNumber(Math.abs(delta), unit === '"' ? 1 : 0)}${unit}`;
}
export default function ProductCompareTable({ devices, fields, generation = true }: {
  devices: FlattenedDevice[]; fields: ComparisonField[]; generation?: boolean;
}) {
  const visibleFields = fields.filter((field) => !field.optional || devices.some((device) => field.getValue(device) !== "待补充"));
  const groups = new Map<string, ComparisonField[]>();
  for (const field of visibleFields) groups.set(field.group, [...(groups.get(field.group) ?? []), field]);
  const columns = `120px repeat(${devices.length}, minmax(210px, 1fr))`;
  const width = 120 + devices.length * 210;
  return <div className="compare-v2-scroll" aria-label="设备参数对比表">
    <div className="compare-v2-scroll-inner" style={{ minWidth: width }}>
      <div className="compare-overview" style={{ gridTemplateColumns: columns }}>
        <div className="compare-overview-spacer" aria-hidden="true" />
        {devices.map((device, index) => <div className="compare-overview-item" key={device.id}>
          {generation && index > 0 && <div className="compare-overview-arrow" aria-hidden="true">←</div>}
          <Link href={`/devices/${device.id}`} className={`compare-overview-card${generation && index === 0 ? " is-current" : ""}`}>
            <DeviceImage image={getDeviceImage(device.id)} model={device.model} className="h-24 w-full" />
            <div className="compare-overview-model">{device.model}</div>
            <div className="compare-overview-year">{device.releaseYear}</div>
            <div className="compare-overview-price">{formatMaybeCurrency(device.launchPrice)}</div>
          </Link>
        </div>)}
      </div>
      <div className="compare-v2-table"><div className="compare-v2-table-inner" style={{ minWidth: width }}>
        <div className="compare-v2-row is-header" style={{ gridTemplateColumns: columns }}>
          <div className="compare-v2-cell is-label">功能 / 参数</div>
          {devices.map((device, index) => <div className={`compare-v2-cell${generation && index === 0 ? " is-highlight" : ""}`} key={device.id}>
            <span>{device.model}</span><small>{device.releaseYear}</small>
          </div>)}
        </div>
        {[...groups].map(([group, groupFields]) => <div className="compare-v2-section" key={group}>
          <div className="compare-v2-row is-group" style={{ gridTemplateColumns: columns }}>
            <div className="compare-v2-cell is-label">{group}</div><div className="compare-v2-group-fill" />
          </div>
          {groupFields.map((field) => {
            const current = devices[0] ? field.getValue(devices[0]) : "待补充";
            const previous = devices[1] ? field.getValue(devices[1]) : "待补充";
            const changed = generation && field.showChange !== false && current !== previous && current !== "待补充" && previous !== "待补充";
            return <div className="compare-v2-row" key={field.label} style={{ gridTemplateColumns: columns }}>
              <div className="compare-v2-cell is-label"><span>{field.label}</span>{field.hint && <small>{field.hint}</small>}</div>
              {devices.map((device, index) => <div className={`compare-v2-cell${generation && index === 0 ? " is-highlight" : ""}${index === 0 && changed ? " has-change" : ""}`} key={device.id}>
                <span className="compare-v2-value"><span>{field.getValue(device)}</span>{field.getMeta?.(device)?.map((line) => <small key={line}>{line}</small>)}</span>
                {index === 0 && changed && <span className="compare-change-badge is-up">{changeLabel(field, previous, current)}</span>}
              </div>)}
            </div>;
          })}
        </div>)}
      </div></div>
    </div>
  </div>;
}
