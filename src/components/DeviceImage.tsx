"use client";

import Image from "next/image";
import { useState } from "react";
import type { DeviceImageGallery, DeviceProductImage } from "@/lib/device-images";

type PreviewImage = Pick<DeviceProductImage, "url" | "previewFocus">;
function hasImageEvidence(photo: DeviceProductImage | PreviewImage): photo is DeviceProductImage {
  return "sourceUrl" in photo;
}
import DevicePhotoZoom from "@/components/DevicePhotoZoom";

export default function DeviceImage({ image, gallery, showColors = false, model, className = "" }: {
  image?: DeviceProductImage | PreviewImage;
  gallery?: DeviceImageGallery;
  showColors?: boolean;
  model: string;
  className?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const [colorName, setColorName] = useState<string>();
  const [zoomUrl, setZoomUrl] = useState<string>();
  const selected = showColors ? gallery?.colors.find((color) => color.name === colorName) : undefined;
  const photo = selected ? selected.image : image;
  const source = photo ?? gallery;
  const available = gallery?.colors.filter((color) => color.image).length ?? 0;
  return (
    <div>
      <div className={`relative flex items-center justify-center overflow-hidden rounded-2xl bg-white ${className}`}>
        {photo && failedUrl !== photo.url ? (
          <Image key={photo.url} src={photo.url} alt={`${model}${selected ? ` ${selected.name}` : ""} 产品外观参考`} width={320} height={240}
            unoptimized loading="lazy" referrerPolicy="no-referrer"
            className={`h-full w-full p-3 ${photo.previewFocus === "top" ? "object-cover object-top" : "object-contain"}`}
            onError={() => setFailedUrl(photo.url)} />
        ) : (
          <span className="text-xs text-[var(--text-soft)]" role="status">
            {photo ? "图片暂无法加载" : selected ? `${selected.name}图片待补充` : "暂无图片"}
          </span>
        )}
        {showColors && photo && failedUrl !== photo.url && <button type="button" aria-label={`放大查看${model}图片`}
          className="absolute inset-0 cursor-zoom-in rounded-2xl focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
          onClick={() => setZoomUrl(photo.url)}><span className="absolute bottom-2 right-3 rounded-full bg-white/90 px-3 py-1 text-xs text-[var(--primary)]">放大查看</span></button>}
      </div>
      {photo && hasImageEvidence(photo) && zoomUrl === photo.url && <DevicePhotoZoom image={photo} model={model} onClose={() => setZoomUrl(undefined)} />}
      {showColors && gallery && (
        <div className="mt-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
            <span>配色与款式</span><span>已补图片 {available}/{gallery.colors.length} 种</span>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label={`${model}颜色图片`}>
            {image && <button type="button" className={`tag ${!selected ? "tag-green" : "tag-neutral"}`}
              aria-pressed={!selected} onClick={() => setColorName(undefined)}>{hasImageEvidence(image) && image.colorScope === "all_colors" ? "多色宣传图" : "外观参考"}</button>}
            {gallery.colors.map((color) => <button key={color.name} type="button"
              className={`tag ${selected?.name === color.name ? "tag-green" : "tag-neutral"}`}
              aria-pressed={selected?.name === color.name} onClick={() => setColorName(color.name)}>
              {color.name}{!color.image ? " · 待补图" : ""}
            </button>)}
          </div>
          <p className="mt-2 text-xs leading-5 text-[var(--text-soft)]">仅切换外观图片；各款式价格和参数差异见下方，不代表当前有货。</p>
        </div>
      )}
      {showColors && source && "sourceUrl" in source && <p className="mt-2 text-center text-xs leading-5 text-[var(--text-soft)]">
        外观参考{selected ? ` · ${selected.name}` : photo && hasImageEvidence(photo) && photo.colorScope === "all_colors" ? " · 全配色宣传图" : ""} · <a href={source.sourceUrl}
          target="_blank" rel="noopener noreferrer" className="text-[var(--primary)]">{source.sourceName}</a>
      </p>}
      {showColors && photo && hasImageEvidence(photo) && photo.note && <p className="mt-2 text-center text-xs leading-5 text-[var(--text-soft)]">
        {photo.note}{photo.imageScope === "model_shared" ? "；画面中的键盘、手写笔等配件不代表标配。" : ""}
      </p>}
    </div>
  );
}
