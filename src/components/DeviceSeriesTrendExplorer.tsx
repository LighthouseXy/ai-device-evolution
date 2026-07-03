"use client";

import { useMemo, useState } from "react";
import type { FlattenedDevice } from "@/lib/devices-db";
import { formatMaybeCurrency } from "@/lib/devices-db";

type MetricKey = "chipRank" | "screenSize" | "weight" | "price" | "aiFeatureLevel";

type TrendMetric = {
  key: MetricKey;
  label: string;
  note: string;
  formatValue: (device: FlattenedDevice, rawValue: number) => string;
  getValue: (device: FlattenedDevice) => number | null;
};

const metricOptions: TrendMetric[] = [
  {
    key: "chipRank",
    label: "芯片",
    note: "仅使用芯片文本解析出的内部代际序列，不把它包装成真实硬件基准分。",
    formatValue: (device, value) => `${device.chip || "待补充"} · ${value.toFixed(0)} 代`,
    getValue: (device) => parseChipRank(device.chip),
  },
  {
    key: "screenSize",
    label: "尺寸",
    note: "按真实屏幕尺寸直接对比，屏幕越大数值越高。",
    formatValue: (_device, value) => `${value.toFixed(1)} 英寸`,
    getValue: (device) => (typeof device.screenSize === "number" ? device.screenSize : null),
  },
  {
    key: "weight",
    label: "重量",
    note: "按克数对比，数值越小越轻。",
    formatValue: (_device, value) => `${value.toFixed(0)} g`,
    getValue: (device) => (typeof device.weight === "number" ? device.weight : null),
  },
  {
    key: "price",
    label: "价格",
    note: "优先使用首发价；缺失时回退当前价或二手价。",
    formatValue: (_device, value) => formatMaybeCurrency(value),
    getValue: (device) => device.launchPrice ?? getSpecNumber(device, "currentPrice") ?? getSpecNumber(device, "usedPrice"),
  },
  {
    key: "aiFeatureLevel",
    label: "AI 能力",
    note: "来自本地 computed 字段，保留 0-10 的相对位置。",
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
  const height = 320;
  const paddingX = 54;
  const paddingTop = 38;
  const paddingBottom = 58;
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
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="grid gap-2">
          <div className="flex items-center gap-3">
            <span className="tag tag-green">趋势对比</span>
            <span className="tag tag-neutral">实时</span>
          </div>
          <h3 className="text-2xl font-semibold text-[var(--text-strong)]">{metric.label}趋势</h3>
          <p className="max-w-[42rem] text-sm leading-7 text-[var(--text-muted)]">{metric.note}</p>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-[var(--text-muted)]">{yearRange}</div>
          <div className="mt-2 text-2xl font-semibold text-[var(--primary-strong)]">{currentLabel}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {metricOptions.map((option) => {
          const active = option.key === activeMetric;
          return (
            <button
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                active
                  ? "bg-[var(--primary)] text-white shadow-[0_8px_20px_rgba(45,90,61,0.16)]"
                  : "bg-[rgba(154,148,136,0.12)] text-[var(--text-muted)] hover:bg-[rgba(45,90,61,0.08)] hover:text-[var(--primary-strong)]"
              }`}
              key={option.key}
              type="button"
              onClick={() => setActiveMetric(option.key)}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-[1.75rem] border border-[rgba(221,213,199,0.78)] bg-[var(--bg-soft)] p-4 sm:p-5">
        {hasEnoughData ? (
          <svg
            aria-label={`${metric.label} 同系列折线图`}
            className="h-[340px] w-full"
            preserveAspectRatio="none"
            role="img"
            viewBox={`0 0 ${width} ${height}`}
          >
            <defs>
              <linearGradient id={`${metric.key}-line`} x1="0%" x2="100%" y1="0%" y2="0%">
                <stop offset="0%" stopColor="rgba(154,148,136,0.34)" />
                <stop offset="100%" stopColor="rgba(45,90,61,0.5)" />
              </linearGradient>
            </defs>

            {Array.from({ length: 5 }).map((_, index) => {
              const y = paddingTop + (usableHeight / 4) * index;
              const tickValue = max !== null && min !== null ? max - ((max - min) / 4) * index : 0;
              return (
                <g key={`grid-${index}`}>
                  <line
                    stroke="rgba(198,190,176,0.78)"
                    strokeDasharray="3 6"
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
                stroke={`url(#${metric.key}-line)`}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3.5"
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
                    fill={isActive ? "var(--primary-strong)" : "rgba(247,245,240,0.98)"}
                    r={isActive ? 7 : 5.2}
                    stroke={isActive ? "rgba(247,245,240,1)" : "rgba(45,90,61,0.24)"}
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
        ) : (
          <div className="flex h-[340px] items-center justify-center rounded-[1.5rem] border border-dashed border-[rgba(221,213,199,0.72)] bg-white/70 text-sm text-[var(--text-muted)]">
            当前指标暂无足够数据
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
          <span>系列范围：{yearRange}</span>
          <span>当前设备：{activeEntry?.device.model ?? "—"}</span>
        </div>
      </div>

      <p className="text-xs leading-6 text-[var(--text-soft)]">
        * 芯片趋势仅使用文本解析出的内部代际序列，便于表达变化方向，不等同于真实硬件基准分。
      </p>
    </div>
  );
}
