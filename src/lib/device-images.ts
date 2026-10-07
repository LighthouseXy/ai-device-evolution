import "server-only";
import images from "@/data/device-images.json";
import galleries from "@/data/device-image-galleries.json";
import { getDeviceModelGroup, getDeviceModelId, getDeviceModelName } from "@/lib/device-models";

export type DeviceProductImage = {
  url: string;
  alt: string;
  modelName: string;
  sourceUrl: string;
  sourceName: string;
  fetchedAt: string;
  sourceSnapshotHash: string;
  linkedFromUrl?: string;
  previewFocus?: "top";
  imageScope?: "model_shared";
  note?: string;
  usageBoundary?: string;
};

export type DeviceImageGallery = {
  modelName: string;
  sourceUrl: string;
  sourceName: string;
  fetchedAt: string;
  sourceSnapshotHash: string;
  linkedFromUrl?: string;
  colors: Array<{ name: string; image?: DeviceProductImage }>;
};

export const getDeviceImage = (id: string): DeviceProductImage | undefined =>
  (images as Record<string, DeviceProductImage>)[getDeviceModelId(id)];

export function getDeviceImageGallery(id: string): DeviceImageGallery | undefined {
  const stored = galleries as Record<string, DeviceImageGallery>;
  const group = getDeviceModelGroup(id);
  if (!group) return stored[id];
  const photos = images as Record<string, DeviceProductImage>;
  const first = stored[group.id] ?? photos[group.id];
  if (!first) return undefined;
  return { ...first, modelName: getDeviceModelName(id)!, colors: Object.entries(group.editions).flatMap(([recordId, label]) => {
    const colors = stored[recordId]?.colors;
    // 无准确颜色图时保留该款式主图，但不能给它猜一个颜色名称。
    if (!colors?.length) return [{ name: label, image: photos[recordId] }];
    return colors.map(color => ({ ...color, name: label.includes(color.name) ? label : `${label} · ${color.name}` }));
  }) };
}
