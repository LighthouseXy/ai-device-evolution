import type { FlattenedDevice, PriceField } from "@/lib/devices-db";

export type DeviceConfiguration = {
  key: string;
  memory: string | null;
  storage: string;
};

export const SHARED_CONFIGURATION_GENERATION_COUNT = 3;
export const MAX_SHARED_STORAGE_OPTIONS = 3;

const CAPACITY_PATTERN = /(\d+(?:\.\d+)?)\s*(TB|GB)/gi;
const EXPLICIT_MEMORY_PATTERN = /(\d+(?:\.\d+)?)\s*GB\s*(?:统一|运行)?内存/i;

function capacityInGb(value: string) {
  const match = value.match(/^(\d+(?:\.\d+)?)(TB|GB)$/i);
  if (!match) return Number.POSITIVE_INFINITY;
  return Number(match[1]) * (match[2].toUpperCase() === "TB" ? 1024 : 1);
}

function extractCapacities(value: string | undefined) {
  if (!value) return [];
  return Array.from(value.matchAll(CAPACITY_PATTERN), (match) => `${match[1]}${match[2].toUpperCase()}`);
}

export function configurationKey(memory: string | null, storage: string) {
  return `${memory ?? "unknown"}|${storage}`;
}

export function formatConfiguration(configuration: DeviceConfiguration) {
  return `${configuration.memory ?? "内存待补充"} + ${configuration.storage}`;
}

export function getDeviceStorageOptions(device: FlattenedDevice) {
  return Array.from(new Set(extractCapacities(device.specs?.storage as string | undefined)))
    .sort((left, right) => capacityInGb(left) - capacityInGb(right));
}

export function getDeviceMemoryOptions(device: FlattenedDevice) {
  const storageOptions = new Set(getDeviceStorageOptions(device));
  return Array.from(new Set(extractCapacities(device.specs?.memory as string | undefined)))
    .filter((memory) => memory.endsWith("GB") && !storageOptions.has(memory))
    .sort((left, right) => capacityInGb(left) - capacityInGb(right));
}

// 只有映射可由设备事实唯一确定时才枚举组合。MacBook 的内存和存储字段
// 是两组独立选项，不能在缺少配置矩阵时假定任意两档都可组合。
export function getDeviceConfigurations(device: FlattenedDevice) {
  if (device.configurations?.length) {
    return device.configurations
      .map(({ memory, storage }) => ({ key: configurationKey(memory, storage), memory, storage }))
      .sort(
        (left, right) =>
          capacityInGb(left.storage) - capacityInGb(right.storage)
          || capacityInGb(left.memory) - capacityInGb(right.memory),
      );
  }

  const storages = getDeviceStorageOptions(device);
  const memories = getDeviceMemoryOptions(device);
  if (storages.length === 0) return [];
  if (device.category === "laptop" && memories.length > 1) return [];

  const configurations = storages.flatMap((storage) => {
    if (memories.length === 0) return [{ memory: null, storage }];
    if (device.category === "tablet" && memories.length > 1) {
      return [{ memory: capacityInGb(storage) >= 1024 ? memories.at(-1) ?? null : memories[0], storage }];
    }
    return memories.map((memory) => ({ memory, storage }));
  });

  return configurations
    .map(({ memory, storage }) => ({ key: configurationKey(memory, storage), memory, storage }))
    .sort(
      (left, right) =>
        capacityInGb(left.storage) - capacityInGb(right.storage)
        || capacityInGb(left.memory ?? "") - capacityInGb(right.memory ?? ""),
    );
}

export function getHighestDeviceConfiguration(device: FlattenedDevice) {
  if (device.configurations?.length) return getDeviceConfigurations(device).at(-1) ?? null;
  const storage = getDeviceStorageOptions(device).at(-1);
  if (!storage) return null;
  const memory = getDeviceMemoryOptions(device).at(-1) ?? null;
  return { key: configurationKey(memory, storage), memory, storage };
}

export function getSharedStorageOptions(devices: FlattenedDevice[]) {
  const recentDevices = devices.slice(-SHARED_CONFIGURATION_GENERATION_COUNT);
  const firstDevice = recentDevices[0];
  if (!firstDevice) return [];

  return getDeviceStorageOptions(firstDevice)
    .filter((storage) => recentDevices.every((device) => getDeviceStorageOptions(device).includes(storage)))
    .slice(0, MAX_SHARED_STORAGE_OPTIONS);
}

export function getPriceConfiguration(device: FlattenedDevice, price: PriceField | undefined) {
  const rawConfiguration = price?.configuration;
  if (!rawConfiguration) return null;

  const normalized = rawConfiguration.toUpperCase().replaceAll(" ", "");
  const storage = getDeviceStorageOptions(device).find((option) => normalized.includes(option));
  if (!storage) return null;

  const explicitMemory = rawConfiguration.match(EXPLICIT_MEMORY_PATTERN);
  const memories = getDeviceMemoryOptions(device);
  const memory = explicitMemory
    ? `${explicitMemory[1]}GB`
    : device.configurations?.length
      ? device.configurations.find((configuration) => configuration.storage === storage)?.memory ?? null
    : device.category === "tablet" && memories.length > 1
      ? capacityInGb(storage) >= 1024
        ? memories.at(-1) ?? null
        : memories[0]
      : memories.length === 1
        ? memories[0]
        : null;

  return { key: configurationKey(memory, storage), memory, storage };
}

export function formatConfigurationForComparison(
  device: FlattenedDevice,
  usesSharedConfiguration: boolean,
  selectedStorage: string,
) {
  if (!usesSharedConfiguration) {
    const highest = getHighestDeviceConfiguration(device);
    return highest ? formatConfiguration(highest) : "";
  }

  if (!getDeviceStorageOptions(device).includes(selectedStorage)) return "";
  const memories = getDeviceMemoryOptions(device);
  if (device.category === "laptop" && memories.length > 1) {
    return `${selectedStorage} 存储；运行内存 ${memories.join(" / ")}`;
  }

  const configuration = getDeviceConfigurations(device).find((item) => item.storage === selectedStorage);
  return configuration ? formatConfiguration(configuration) : "";
}

export function formatMemoryForComparison(
  device: FlattenedDevice,
  usesSharedConfiguration: boolean,
  selectedStorage: string,
) {
  const memories = getDeviceMemoryOptions(device);
  if (memories.length === 0) return "";
  if (!usesSharedConfiguration) return memories.at(-1) ?? "";
  if (!getDeviceStorageOptions(device).includes(selectedStorage)) return "";

  const configuration = getDeviceConfigurations(device).find((item) => item.storage === selectedStorage);
  return configuration?.memory ?? memories.join(" / ");
}

export function formatLatestConfigurationOption(devices: FlattenedDevice[], storage: string) {
  const latestDevice = devices.at(-1);
  if (!latestDevice || !getDeviceStorageOptions(latestDevice).includes(storage)) return storage;

  const configuration = getDeviceConfigurations(latestDevice).find((item) => item.storage === storage);
  const memory = configuration?.memory ?? getDeviceMemoryOptions(latestDevice)[0] ?? null;
  return formatConfiguration({ key: configurationKey(memory, storage), memory, storage });
}

export function getPricesForComparison(
  device: FlattenedDevice,
  priceType: "current" | "used",
) {
  const prices = priceType === "current"
    ? device.currentPrices ?? (device.currentPrice ? [device.currentPrice] : [])
    : device.usedPrices ?? (device.usedPrice ? [device.usedPrice] : []);
  const byConfiguration = new Map<string, { value: number; configuration: DeviceConfiguration }>();

  for (const price of prices) {
    if (typeof price.value !== "number") continue;
    const configuration = getPriceConfiguration(device, price);
    if (!configuration) continue;
    const existing = byConfiguration.get(configuration.key);
    if (!existing || price.value < existing.value) byConfiguration.set(configuration.key, { value: price.value, configuration });
  }

  return [...byConfiguration.values()].sort(
    (left, right) =>
      capacityInGb(left.configuration.storage) - capacityInGb(right.configuration.storage)
      || capacityInGb(left.configuration.memory ?? "") - capacityInGb(right.configuration.memory ?? ""),
  );
}
