"use client";

import { useEffect, useRef, type ReactNode } from "react";

type SpecGridPosition = { column: number; row: number; span: number };

export function getSpecGridPositions(rows: number[], columnCount: number, previous?: SpecGridPosition[]) {
  const heights = Array<number>(columnCount).fill(0);
  const measured = rows.map((span, index) => ({ span, index }));
  // ponytail: 固定前两张卡片在顶部，其余按高到低放入较短列；不求全局最优组合。
  const ordered = previous
    ? [...measured].sort((a, b) => previous[a.index].row - previous[b.index].row)
    : columnCount > 1
    ? [...measured.slice(0, 2), ...measured.slice(2).sort((a, b) => b.span - a.span)]
    : measured;
  const positions = Array<SpecGridPosition>(rows.length);
  for (const { span, index } of ordered) {
    const column = previous ? previous[index].column - 1 : heights.indexOf(Math.min(...heights));
    positions[index] = { column: column + 1, row: heights[column] + 1, span };
    heights[column] += span;
  }
  return positions;
}

export default function DeviceSpecGrid({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const panel = ref.current;
    if (!panel || typeof ResizeObserver === "undefined") return;
    const cards = Array.from(panel.children) as HTMLElement[];
    let positions: SpecGridPosition[] | undefined;
    let previousColumnCount = 0;
    const layout = () => {
      const columnCount = Number(getComputedStyle(panel).getPropertyValue("--spec-columns")) || 1;
      // 高度变化只推动同列后续卡片；仅首次渲染或列数变化时重新分配。
      const nextPositions = getSpecGridPositions(cards.map(card => Math.ceil(card.getBoundingClientRect().height) + 16), columnCount,
        columnCount === previousColumnCount ? positions : undefined);
      positions = nextPositions;
      previousColumnCount = columnCount;
      cards.forEach((card, index) => {
        const { column, row, span } = nextPositions[index];
        card.style.gridColumn = String(column);
        card.style.gridRow = `${row} / span ${span}`;
      });
      panel.classList.add("is-balanced");
    };
    const observer = new ResizeObserver(layout);
    cards.forEach(card => observer.observe(card));
    layout();
    return () => observer.disconnect();
  }, [children]);

  return <div className="device-spec-panel" ref={ref}>{children}</div>;
}
