import identity from "@/data/device-model-groups.json";
import type { FlattenedDevice } from "@/lib/devices-db";

type ModelGroup = { id: string; model: string; variant?: string; editions: Record<string, string> };
const groups = identity.groups as unknown as ModelGroup[];
const names: Record<string, string> = identity.names;
const groupsByRecord = new Map(groups.flatMap(group => Object.keys(group.editions).map(id => [id, group] as const)));

export const getDeviceModelId = (id: string) => groupsByRecord.get(id)?.id ?? id;
export const getDeviceModelGroup = (id: string) => groupsByRecord.get(id);
export const getDeviceModelName = (id: string) => groupsByRecord.get(id)?.model ?? names[id];

// 来源记录不改写；目录只按人工确认的同款映射归并，不靠名字相似度猜型号。
export function organizeDeviceModels(records: FlattenedDevice[]) {
  const byId = new Map(records.map(device => [device.id, device]));
  return records.filter(device => getDeviceModelId(device.id) === device.id).map(device => {
    const group = groupsByRecord.get(device.id);
    const model = group?.model ?? names[device.id];
    if (!model) return device;
    const editions = Object.entries(group?.editions ?? { [device.id]: device.model }).map(([id, label]) => {
      const original = byId.get(id);
      if (!original) throw new Error(`${id}: 同款整理缺少来源记录`);
      return { label, device: original };
    });
    const specs: NonNullable<FlattenedDevice["specs"]> = {};
    for (const key of new Set(editions.flatMap(edition => Object.keys(edition.device.specs ?? {})))) {
      if (["launchPrice", "currentPrice", "usedPrice"].includes(key)) continue;
      const values = editions.map(edition => edition.device.specs?.[key]);
      if (values.every(value => value === values[0])) specs[key] = values[0];
      else if (key === "colors") specs[key] = [...new Set(values.filter(value => typeof value === "string").flatMap(value => String(value).split(/[,，]/).map(name => name.trim())))].join(", ");
      else specs[key] = editions.flatMap((edition, index) => key.endsWith("Note") && values[index] == null ? []
        : [`${edition.label}：${typeof values[index] === "boolean" ? values[index] ? "支持" : "不支持" : values[index] ?? "待补充"}`]).join("\n");
    }
    const variant = group?.variant ?? device.variant;
    const shared = <K extends "chip" | "screenSize" | "refreshRate" | "weight" | "aiFeatureLevel">(key: K) =>
      editions.every(edition => edition.device[key] === device[key]) ? device[key] : undefined;
    const prices = editions.map(edition => edition.device.launchPrice).filter((price): price is number => typeof price === "number");
    return { ...device, model, variant, specs, editions,
      ...(variant !== device.variant ? { comparisonGroupId: `${device.comparisonGroupId.slice(0, -device.variant.length)}${variant}` } : {}),
      chip: shared("chip") ?? "", screenSize: shared("screenSize"), refreshRate: shared("refreshRate"), weight: shared("weight"),
      aiFeatureLevel: shared("aiFeatureLevel"), launchPrice: prices.length ? Math.min(...prices) : undefined,
      launchPrices: editions.flatMap(edition => edition.device.launchPrices ?? []),
      currentPrices: editions.flatMap(edition => edition.device.currentPrices ?? []),
      usedPrices: editions.flatMap(edition => edition.device.usedPrices ?? []),
    };
  });
}
