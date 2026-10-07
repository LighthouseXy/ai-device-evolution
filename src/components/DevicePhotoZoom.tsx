"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { DeviceProductImage } from "@/lib/device-images";
import { transformPhoto, type PhotoView } from "@/lib/photo-zoom";

export default function DevicePhotoZoom({ image, model, onClose }: {
  image: DeviceProductImage; model: string; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null), canvas = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const [view, setView] = useState<PhotoView>({ scale: 1, x: 0, y: 0 });
  const [failed, setFailed] = useState(false);
  function change(factor: number, point?: { x: number; y: number }, move?: { x: number; y: number }) {
    const box = canvas.current?.getBoundingClientRect();
    if (box) setView(previous => transformPhoto(previous, factor, box.width, box.height,
      point ? { x: point.x - box.left - box.width / 2, y: point.y - box.top - box.height / 2 } : undefined, move));
  }
  useEffect(() => {
    const modal = dialog.current!, area = canvas.current!, previousOverflow = document.body.style.overflow;
    const opener = document.activeElement as HTMLElement | null;
    modal.showModal(); document.body.style.overflow = "hidden";
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const box = area.getBoundingClientRect();
      setView(previous => transformPhoto(previous, Math.exp(-Math.max(-200, Math.min(200, event.deltaY)) / 500),
        box.width, box.height, { x: event.clientX - box.left - box.width / 2, y: event.clientY - box.top - box.height / 2 }));
    };
    area.addEventListener("wheel", wheel, { passive: false });
    return () => { area.removeEventListener("wheel", wheel); modal.close(); document.body.style.overflow = previousOverflow; opener?.focus(); };
  }, []);
  function drag(event: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    const before = [...pointers.current.values()];
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const after = [...pointers.current.values()];
    if (after.length === 1) change(1, undefined, { x: after[0].x - before[0].x, y: after[0].y - before[0].y });
    else if (after.length === 2) {
      const midpoint = (points: typeof after) => ({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 });
      const distance = (points: typeof after) => Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      const a = midpoint(before), b = midpoint(after), oldDistance = distance(before);
      if (oldDistance > 0) change(distance(after) / oldDistance, a, { x: b.x - a.x, y: b.y - a.y });
    }
  }
  return <dialog ref={dialog} className="photo-zoom" aria-label={`${model}图片预览`} onCancel={onClose}>
    <div className="photo-zoom-toolbar">
      <span className="min-w-0 truncate">{model}</span>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button type="button" onClick={() => change(1 / 1.25)} disabled={failed || view.scale <= 1} aria-label="缩小图片">−</button>
        <span className="w-12 text-center text-xs" aria-live="polite">{Math.round(view.scale * 100)}%</span>
        <button type="button" onClick={() => change(1.25)} disabled={failed || view.scale >= 6} aria-label="放大图片">+</button>
        <button type="button" onClick={() => setView({ scale: 1, x: 0, y: 0 })} disabled={failed}>重置</button>
        <button type="button" onClick={onClose} aria-label="关闭图片预览">关闭</button>
      </div>
    </div>
    <div ref={canvas} className="photo-zoom-canvas" tabIndex={0} role="region" aria-label="图片缩放和拖动区域"
      onPointerDown={event => { if (event.button !== 0 || failed || pointers.current.size >= 2) return;
        event.currentTarget.setPointerCapture(event.pointerId); pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY }); }}
      onPointerMove={drag} onPointerUp={event => pointers.current.delete(event.pointerId)}
      onPointerCancel={event => pointers.current.delete(event.pointerId)} onLostPointerCapture={event => pointers.current.delete(event.pointerId)}
      onKeyDown={event => { const offsets: Record<string, { x: number; y: number }> = {
        ArrowLeft: { x: 40, y: 0 }, ArrowRight: { x: -40, y: 0 }, ArrowUp: { x: 0, y: 40 }, ArrowDown: { x: 0, y: -40 } };
        if (offsets[event.key]) { event.preventDefault(); change(1, undefined, offsets[event.key]); }
        else if (event.key === "+" || event.key === "=") { event.preventDefault(); change(1.25); }
        else if (event.key === "-") { event.preventDefault(); change(1 / 1.25); }
      }}>
      {failed ? <p role="status">图片暂无法加载，请关闭后重试。</p> : <Image src={image.url} alt={image.alt}
        width={2400} height={1800} unoptimized referrerPolicy="no-referrer" draggable={false}
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }} onError={() => setFailed(true)} />}
    </div>
    <p className="px-3 py-2 text-center text-xs text-[var(--text-muted)]">滚轮或双指缩放，拖动查看细节；方向键移动，Esc 关闭。外观图不代表配置、附件标配或现货。</p>
  </dialog>;
}
