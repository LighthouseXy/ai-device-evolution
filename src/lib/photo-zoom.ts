export type PhotoView = { scale: number; x: number; y: number };

export function transformPhoto(view: PhotoView, factor: number, width: number, height: number,
  anchor = { x: 0, y: 0 }, move = { x: 0, y: 0 }): PhotoView {
  if (!Number.isFinite(factor) || factor <= 0 || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return view;
  const scale = Math.max(1, Math.min(6, view.scale * factor));
  const ratio = scale / view.scale;
  const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));
  return { scale, x: clamp(anchor.x - (anchor.x - view.x) * ratio + move.x, width * (scale - 1) / 2),
    y: clamp(anchor.y - (anchor.y - view.y) * ratio + move.y, height * (scale - 1) / 2) };
}
