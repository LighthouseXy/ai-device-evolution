"use client";

import { useMemo, useState } from "react";
import type { FlattenedDevice } from "@/lib/devices-db";
import { formatMaybeCurrency } from "@/lib/devices-db";

type MetricKey = "chipRank" | "screenSize" | "weight" | "price" | "aiFeatureLevel";

type TrendMetric = {
  key: MetricKey;
  label: string;
  formatValue: (device: FlattenedDevice, rawValue: number) => string;
  getValue: (device: FlattenedDevice) => number | null;
};

const metricOptions: TrendMetric[] = [
  {
    key: "chipRank",
    label: "芯片",
    formatValue: (device, value) => `${device.chip || "待补充"} · ${value.toFixed(0)} 代`,
    getValue: (device) => parseChipRank(device.chip),
  },
  {
    key: "screenSize",
    label: "尺寸",
    formatValue: (_device, value) => `${value.toFixed(1)} 英寸`,
    getValue: (device) => (typeof device.screenSize === "number" ? device.screenSize : null),
  },
  {
    key: "weight",
    label: "重量",
    formatValue: (_device, value) => `${value.toFixed(0)} g`,
    getValue: (device) => (typeof device.weight === "number" ? device.weight : null),
  },
  {
    key: "price",
    label: "价格",
    formatValue: (_device, value) => formatMaybeCurrency(value),
    getValue: (device) => device.launchPrice ?? getSpecNumber(device, "currentPrice") ?? getSpecNumber(device, "usedPrice"),
  },
  {
    key: "aiFeatureLevel",
    label: "AI 能力",
    formatValue: (_device, value) => `${value.toFixed(1)}/10`,
    getValue: (device) => (typeof device.aiFeatureLevel === "number" ? device.aiFeatureLevel : null),
  },
];

function parseChipRank(chip: string) {
  const normalized = chip.replace(/\s+/g, " ");
  const exact = normalized.match(/\b(?:Apple\s+)?([AM])\s?(\d{1,2})\b/i);
  if (exact) {
    return Number(exact[2]);
  }

  const fallback = normalized.match(/\b(\d{1,2})\b/);
  return fallback ? Number(fallback[1]) : null;
}

function getSpecNumber(device: FlattenedDevice, key: string) {
  const value = device.specs?.[key];
  return typeof value === "number" ? value : null;
}

function buildSmoothPath(points: Array<{ x: number; y: number }>) {
  if (points.length < 2) {
    return "";
  }

  const path: string[] = [`M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`];

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const previous = points[index - 1] ?? current;
    const afterNext = points[index + 2] ?? next;

    const controlPoint1X = current.x + (next.x - previous.x) / 6;
    const controlPoint1Y = current.y + (next.y - previous.y) / 6;
    const controlPoint2X = next.x - (afterNext.x - current.x) / 6;
    const controlPoint2Y = next.y - (afterNext.y - current.y) / 6;

    path.push(
      `C ${controlPoint1X.toFixed(1)} ${controlPoint1Y.toFixed(1)}, ${controlPoint2X.toFixed(1)} ${controlPoint2Y.toFixed(1)}, ${next.x.toFixed(1)} ${next.y.toFixed(1)}`,
    );
  }

  return path.join(" ");
}

export default function DeviceSeriesTrendExplorer({
  devices,
  activeDeviceId,
}: {
  devices: FlattenedDevice[];
  activeDeviceId: string;
}) {
  const [activeMetric, setActiveMetric] = useState<MetricKey>("chipRank");

  const metric = useMemo(
    () => metricOptions.find((item) => item.key === activeMetric) ?? metricOptions[0],
    [activeMetric],
  );

  const normalizedDevices = useMemo(() => {
    return devices.map((device, index) => ({
      device,
      index,
      value: metric.getValue(device),
    }));
  }, [devices, metric]);

  const validValues = normalizedDevices.flatMap((entry) => (typeof entry.value === "number" ? [entry.value] : []));
  const min = validValues.length ? Math.min(...validValues) : null;
  const max = validValues.length ? Math.max(...validValues) : null;
  const span = min !== null && max !== null ? Math.max(max - min, 1) : 1;
  const hasEnoughData = min !== null && max !== null;
  const activeEntry = normalizedDevices.find((entry) => entry.device.id === activeDeviceId) ?? null;
  const activeValue = activeEntry?.value ?? null;

  const width = 720;
  const height = 250;
  const paddingX = 54;
  const paddingTop = 44;
  const paddingBottom = 54;
  const usableWidth = width - paddingX * 2;
  const usableHeight = height - paddingTop - paddingBottom;

  const points = normalizedDevices.map((entry) => {
    const x = normalizedDevices.length <= 1 ? width / 2 : paddingX + (entry.index / (normalizedDevices.length - 1)) * usableWidth;
    const y = typeof entry.value === "number" && hasEnoughData ? paddingTop + (1 - (entry.value - min) / span) * usableHeight : null;
    return { ...entry, x, y };
  });

  const pathSegments: string[] = [];
  let segment: Array<{ x: number; y: number }> = [];
  const flushSegment = () => {
    if (!segment.length) return;
    if (segment.length === 1) {
      const only = segment[0];
      pathSegments.push(`M ${only.x.toFixed(1)} ${only.y.toFixed(1)}`);
    } else {
      pathSegments.push(buildSmoothPath(segment));
    }
    segment = [];
  };

  for (const point of points) {
    if (point.y === null) {
      flushSegment();
      continue;
    }
    segment.push({ x: point.x, y: point.y });
  }
  flushSegment();

  const path = pathSegments.join(" ");
  const yearRange =
    devices.length > 0 ? `${devices[0].releaseYear} → ${devices[devices.length - 1].releaseYear}` : "—";
  const activeDevice = activeEntry?.device ?? devices[0];
  const currentLabel = activeValue !== null && activeDevice ? metric.formatValue(activeDevice, activeValue) : "待补充";

  return (
    <div className="grid min-w-0 max-w-full gap-4">
      <div className="min-w-0 max-w-full rounded-[1.75rem] border border-[rgba(221,213,199,0.78)] bg-white p-4 sm:p-5">
        <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-4">
          <div className="grid min-w-0 gap-1">
            <span className="tag tag-green w-fit">同系列趋势</span>
            <h3 className="text-2xl font-semibold text-[var(--text-strong)]">{metric.label} · 代际变化</h3>
            <span className="tag tag-neutral w-fit">{yearRange}</span>
          </div>
          <div className="grid w-full min-w-0 max-w-full justify-items-start gap-2 lg:ml-auto lg:w-[19rem] lg:justify-items-end">
            <div className="flex max-w-full lg:justify-end">
              <span className="tag tag-green">
                <span className="flex flex-col items-start">
                  <span>当前设备：{activeEntry?.device.model ?? "—"}</span>
                  <span>当前值：{currentLabel}</span>
                </span>
              </span>
            </div>
            <div className="flex max-w-full flex-wrap gap-2 lg:justify-end">
              {metricOptions.map((option) => {
                const active = option.key === activeMetric;
                return (
                  <button
                    className={`tag shrink-0 ${active ? "tag-amber" : "tag-neutral"}`}
                    key={option.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setActiveMetric(option.key)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {hasEnoughData ? (
          <div className="max-w-full overflow-x-auto overscroll-x-contain pb-1 [touch-action:pan-x] [-webkit-overflow-scrolling:touch]">
            <svg
              aria-label={`${metric.label} 同系列折线图`}
              className="block h-[250px] w-full min-w-[680px] lg:min-w-0"
              role="img"
              viewBox={`0 0 ${width} ${height}`}
            >

            {Array.from({ length: 5 }).map((_, index) => {
              const y = paddingTop + (usableHeight / 4) * index;
              const tickValue = max !== null && min !== null ? max - ((max - min) / 4) * index : 0;
              return (
                <g key={`grid-${index}`}>
                  <line
                    stroke="var(--border)"
                    x1={paddingX}
                    x2={width - paddingX}
                    y1={y}
                    y2={y}
                  />
                  <text
                    fill="var(--text-soft)"
                    fontSize="11"
                    textAnchor="end"
                    x={paddingX - 10}
                    y={y + 4}
                  >
                    {metric.key === "price"
                      ? formatMaybeCurrency(tickValue)
                      : metric.key === "screenSize"
                        ? `${tickValue.toFixed(1)}"`
                        : metric.key === "weight"
                          ? `${Math.round(tickValue)}`
                          : metric.key === "aiFeatureLevel"
                            ? `${tickValue.toFixed(1)}`
                            : `${Math.round(tickValue)} 代`}
                  </text>
                </g>
              );
            })}

              {path ? (
                <path
                  d={path}
                  fill="none"
                  stroke="var(--primary)"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="4"
                />
              ) : null}

            {points.map((point, index) => {
              if (point.y === null) return null;
              const isActive = point.device.id === activeDeviceId;
              const label =
                metric.key === "chipRank"
                  ? point.device.chip || "待补充"
                  : metric.formatValue(point.device, point.value ?? 0);
              const labelOffset = index % 2 === 0 ? -12 : 20;

              return (
                <g key={`${metric.key}-${point.device.id}`}>
                  <circle
                    cx={point.x}
                    cy={point.y}
                    fill={isActive ? "var(--primary-strong)" : "rgba(154,148,136,0.34)"}
                    r={isActive ? 7 : 5.2}
                    stroke="white"
                    strokeWidth={isActive ? 3 : 2}
                  />
                  <text
                    fill={isActive ? "var(--primary-strong)" : "var(--text-soft)"}
                    fontSize="10"
                    fontWeight={isActive ? 700 : 500}
                    textAnchor="middle"
                    x={point.x}
                    y={Math.max(point.y + labelOffset, 14)}
                  >
                    {label}
                  </text>
                  <text
                    fill={isActive ? "var(--primary-strong)" : "var(--text-soft)"}
                    fontSize="10"
                    fontWeight={isActive ? 700 : 500}
                    textAnchor="middle"
                    x={point.x}
                    y={height - 18}
                  >
                    {point.device.releaseYear}
                  </text>
                </g>
              );
            })}

            {points.map((point) => {
              if (point.y === null || point.device.id !== activeDeviceId) return null;
              return (
                <text
                  fill="var(--primary-strong)"
                  fontSize="11"
                  fontWeight="700"
                  textAnchor="middle"
                  x={point.x}
                  y={Math.max(point.y - 16, 16)}
                  key={`${metric.key}-${point.device.id}-active-label`}
                >
                  {point.device.model}
                </text>
              );
            })}
            </svg>
          </div>
        ) : (
          <div className="flex h-[250px] items-center justify-center rounded-[1.5rem] border border-dashed border-[rgba(221,213,199,0.72)] bg-white/70 text-sm text-[var(--text-muted)]">
            当前指标暂无足够数据
          </div>
        )}

        <p className="mt-3 text-xs leading-6 text-[var(--text-soft)]">
          * 芯片趋势仅使用文本解析出的内部代际序列，便于表达变化方向，不等同于真实硬件基准分。
        </p>
      </div>
    </div>
  );
}
