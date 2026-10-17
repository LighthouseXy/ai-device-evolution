import "server-only";
import images from "@/data/device-images.json";
import galleries from "@/data/device-image-galleries.json";
import { getDeviceModelGroup, getDeviceModelName } from "@/lib/device-models";
import { allDevices } from "@/lib/devices-db";

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
  colorScope?: "all_colors";
  viewScope?: "front_back";
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
  colorAliases?: Record<string, string>;
  colors: Array<{ name: string; image?: DeviceProductImage }>;
};
const colorFields = new Map(allDevices.map(device => [device.id, { modelName: device.modelName, field: device.specs.colors }]));
function completeKnownColors(id: string): DeviceImageGallery | undefined {
  const existing = (galleries as Record<string, DeviceImageGallery>)[id];
  const known = colorFields.get(id);
  const field = known?.field;
  if (!known || !Array.isArray(field?.value) || !field.fetchedAt || !field.sourceSnapshotHash) return existing;
  const aliases = existing?.colorAliases ?? {};
  const colors = new Map<string, { name: string; image?: DeviceProductImage }>();
  for (const color of existing?.colors ?? []) {
    const name = aliases[color.name] ?? color.name;
    const prior = colors.get(name);
    colors.set(name, { name, image: prior?.image ?? color.image });
  }
  for (const rawName of field.value) {
    const name = aliases[rawName] ?? rawName;
    if (name.trim() && !colors.has(name)) colors.set(name, { name });
  }
  return { ...(existing ?? { modelName: known.modelName, sourceUrl: field.sourceUrl,
    sourceName: field.sourceType === "official" ? "设备官方配色规格" : "设备配色规格来源",
    fetchedAt: field.fetchedAt, sourceSnapshotHash: field.sourceSnapshotHash }), colors: [...colors.values()] };
}

export function getDeviceImage(id: string): DeviceProductImage | undefined {
  const photos = images as Record<string, DeviceProductImage>;
  const stored = galleries as Record<string, DeviceImageGallery>;
  const candidates = [photos[id], ...stored[id]?.colors.map(color => color.image) ?? []]
    .filter((image): image is DeviceProductImage => Boolean(image));
  const preferred = chooseDefaultDeviceImage(candidates);
  if (preferred) return preferred;
  const group = getDeviceModelGroup(id);
  const reference = group && Object.keys(group.editions).map(recordId => photos[recordId]
    ?? stored[recordId]?.colors.find(color => color.image)?.image).find(Boolean);
  return reference ? { ...reference, colorScope: undefined, imageScope: "model_shared", note: "同型号其他版本的参考图；不代表当前版本外观或全部配色。" } : undefined;
}

export function chooseDefaultDeviceImage(candidates: DeviceProductImage[]) {
  const priority = (image: DeviceProductImage) => {
    try {
      const host = new URL(image.sourceUrl).hostname;
      if (/(^|\.)(apple\.com(?:\.cn)?|mi\.com|samsung\.com\.cn|huawei\.com|oppo\.com|opposhop\.cn|vivo\.com\.cn|honor\.com)$/.test(host)) return 0;
      if (/(^|\.)(jd\.com|tmall\.com|taobao\.com|pinduoduo\.com|yangkeduo\.com)$/.test(host)) return 1;
    } catch { /* 没有来源身份时不提升优先级。 */ }
    return 2;
  };
  const ordered = [...candidates].sort((left, right) => priority(left) - priority(right));
  return ordered.find(image => image.colorScope === "all_colors")
    ?? ordered.find(image => image.viewScope === "front_back")
    ?? ordered[0];
}

export function getDeviceImageGallery(id: string): DeviceImageGallery | undefined {
  const group = getDeviceModelGroup(id);
  if (!group) return completeKnownColors(id);
  const photos = images as Record<string, DeviceProductImage>;
  const first = completeKnownColors(group.id) ?? photos[group.id]
    ?? Object.keys(group.editions).map(recordId => completeKnownColors(recordId) ?? photos[recordId]).find(Boolean);
  if (!first) return undefined;
  return { ...first, modelName: getDeviceModelName(id)!, colors: Object.entries(group.editions).flatMap(([recordId, label]) => {
    const colors = completeKnownColors(recordId)?.colors;
    // 无准确颜色图时保留该款式主图，但不能给它猜一个颜色名称。
    if (!colors?.length) return [{ name: label, image: photos[recordId] }];
    const entries = colors.map(color => ({ ...color, name: label.includes(color.name) ? label : `${label} · ${color.name}` }));
    const primary = photos[recordId];
    const identity = (url: string) => url.replace(/_\d+x\d+(?=\/)/, "");
    // 型号默认合集已经单独展示，不再重复成为一项“配色参考图”。
    if (primary && !(recordId === group.id && primary.colorScope === "all_colors")
      && !colors.some(color => color.image && identity(color.image.url) === identity(primary.url))) {
      entries.push({ name: `${label} · 参考图`, image: primary });
    }
    return entries;
  }) };
}
