import type { FlattenedDevice, PriceField } from "@/lib/devices-db";
import { formatMaybeCurrency } from "@/lib/number-format";

export type DeviceConfiguration = {
  key: string;
  memory: string | null;
  storage: string;
  description?: string;
};

export const SHARED_CONFIGURATION_GENERATION_COUNT = 3;
export const MAX_SHARED_STORAGE_OPTIONS = 3;

const CAPACITY_PATTERN = /(\d+(?:\.\d+)?)\s*(TB|GB)/gi;
const EXPLICIT_MEMORY_PATTERN = /(\d+(?:\.\d+)?)\s*GB\s*(?:统一|运行)?内存/i;

function capacityInGb(value: string): number {
  if (/^\d+(?:\.\d+)?(?:GB|TB) \+ \d+(?:\.\d+)?(?:GB|TB)$/i.test(value)) {
    return value.split(" + ").reduce((total, part) => total + capacityInGb(part), 0);
  }
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
  return configuration.description ?? `${configuration.memory ?? "内存待补充"} + ${configuration.storage}`;
}

// 保留芯片核心数、网络、面板等价格条件；不能仅按 RAM/存储覆盖另一种 SKU。
export function priceConfigurationIdentity(configuration: string) {
  return configuration.normalize("NFKC").toUpperCase().replace(/\s+/g, "");
}

export function getDeviceStorageOptions(device: FlattenedDevice) {
  const storage = device.specs?.storage as string | undefined;
  if (device.category === "laptop" && storage?.includes("+")) {
    // 双盘是一个 SKU，不把 SSD、HDD 两个容量拆成可选配置。
    return [...new Set(storage.split("/").flatMap((part) => {
      const normalized = part.trim().replace(/\s*\+\s*/g, " + ").toUpperCase();
      return /^\d+(?:\.\d+)?(?:GB|TB)(?: \+ \d+(?:\.\d+)?(?:GB|TB))?$/.test(normalized) ? [normalized] : [];
    }))].sort((left, right) => capacityInGb(left) - capacityInGb(right));
  }
  return Array.from(new Set(extractCapacities(storage)))
    .sort((left, right) => capacityInGb(left) - capacityInGb(right));
}

export function getDeviceMemoryOptions(device: FlattenedDevice) {
  const storageOptions = new Set(extractCapacities(device.specs?.storage as string | undefined));
  return Array.from(new Set(extractCapacities(device.specs?.memory as string | undefined)))
    .filter((memory) => memory.endsWith("GB") && !storageOptions.has(memory))
    .sort((left, right) => capacityInGb(left) - capacityInGb(right));
}

// 只有映射可由设备事实唯一确定时才枚举组合。MacBook 的内存和存储字段
// 是两组独立选项，不能在缺少配置矩阵时假定任意两档都可组合。
export function getDeviceConfigurations(device: FlattenedDevice) {
  if (device.configurations?.length) {
    const configurations = device.configurations
      .filter(({ memory, storage }) => getDeviceMemoryOptions(device).includes(memory) && getDeviceStorageOptions(device).includes(storage))
      .map(({ memory, storage }) => ({ key: configurationKey(memory, storage), memory, storage }));
    return [...new Map(configurations.map((configuration) => [configuration.key, configuration])).values()]
      .sort(
        (left, right) =>
          capacityInGb(left.storage) - capacityInGb(right.storage)
          || capacityInGb(left.memory) - capacityInGb(right.memory),
      );
  }

  const storages = getDeviceStorageOptions(device);
  const memories = getDeviceMemoryOptions(device);
  if (storages.length === 0) return [];
  if (device.category !== "tablet" && memories.length > 1) return [];

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
  return getDeviceConfigurations(device).at(-1) ?? null;
}

export function getSharedStorageOptions(devices: FlattenedDevice[]) {
  const recentDevices = devices.slice(-SHARED_CONFIGURATION_GENERATION_COUNT);
  const firstDevice = recentDevices[0];
  if (!firstDevice) return [];

  return getDeviceStorageOptions(firstDevice)
    .filter((storage) => recentDevices.every((device) => getDeviceStorageOptions(device).includes(storage)))
    .slice(0, MAX_SHARED_STORAGE_OPTIONS);
}

export function getPriceConfiguration(device: FlattenedDevice, price: PriceField | undefined):
  (DeviceConfiguration & { chip?: string; cpuCores?: number; gpuCores?: number }) | null {
  const rawConfiguration = price?.configuration;
  if (!rawConfiguration) return null;
  if (price.market && !["CN", "中国大陆"].includes(price.market)) return null;
  if (price.unit && price.unit !== "CNY") return null;
  if (/美版|港版|日版|韩版|台版|海外版|国际版|欧版|外版|非国行/.test(rawConfiguration)) return null;
  if (device.editions) {
    // 非穿戴版本可能有相同容量但不同芯片/内存制式，先按原报价记录找所属版本。
    for (const edition of device.editions) {
      if (device.category !== "watch" && device.category !== "band"
        && ![...(edition.device.launchPrices ?? []), ...(edition.device.currentPrices ?? []), ...(edition.device.usedPrices ?? [])]
          .some(original => original.sourceUrl === price.sourceUrl && original.configuration === rawConfiguration
            && original.value === price.value && original.condition === price.condition
            && original.observedAt === price.observedAt)) continue;
      const configuration = getPriceConfiguration(edition.device, price);
      if (configuration) return { ...configuration, key: device.editions.length > 1 ? `${edition.device.id}|${configuration.key}` : configuration.key,
        description: device.editions.length > 1 ? `${edition.label}${configuration.storage ? ` · ${formatConfiguration(configuration)}` : ""}` : configuration.description };
    }
    return null;
  }
  if (device.category === "watch" || device.category === "band") {
    // 穿戴报价只绑定已登记的具体版型；不借 RAM/存储容量生成伪配置。
    const sizes = new Set(String(device.specs?.caseSize ?? "").match(/\d+\s*(?:mm|毫米)/gi));
    if (sizes.size > 1) return null; // 多尺寸汇总记录尚不能准确对应一笔报价。
    if (priceConfigurationIdentity(rawConfiguration) !== priceConfigurationIdentity(`国行 ${device.model}`)) return null;
    return { key: `wearable:${device.id}`, memory: null, storage: "", description: device.model };
  }
  const appleChipPattern = /\bM\d+(?:\s*(?:Pro|Max|Ultra))?\b/gi;
  const namedChips = [...rawConfiguration.matchAll(appleChipPattern)].map((match) => match[0].replace(/\s/g, "").toLowerCase());
  const deviceChip = String(device.specs?.chip ?? device.chip ?? "").match(appleChipPattern)?.[0]?.replace(/\s/g, "").toLowerCase();
  if (device.brand === "Apple" && namedChips.some((chip) => chip !== deviceChip)) return null;
  if (device.brand !== "Apple" && namedChips.length) return null;

  const explicitMemory = rawConfiguration.match(EXPLICIT_MEMORY_PATTERN);
  const memories = getDeviceMemoryOptions(device);
  const explicitStorage = rawConfiguration.match(/(\d+(?:\.\d+)?)\s*(TB|GB)\s*(?:固态硬盘|存储)/i);
  const capacities = extractCapacities(rawConfiguration.replace(EXPLICIT_MEMORY_PATTERN, ""));
  const compound = device.category === "laptop" && capacities.length === 2
    ? rawConfiguration.replace(EXPLICIT_MEMORY_PATTERN, "").match(/\d+(?:\.\d+)?\s*(?:GB|TB)\s*(?:SSD|固态硬盘)?\s*\+\s*\d+(?:\.\d+)?\s*(?:GB|TB)\s*(?:HDD|机械硬盘)?/i) : null;
  const storage = compound ? capacities.join(" + ") : explicitStorage ? `${explicitStorage[1]}${explicitStorage[2].toUpperCase()}`
    : capacities.length === 1 ? capacities[0] : null;
  if (!storage || (!compound && (capacities.length !== 1 || capacities[0] !== storage)) || !getDeviceStorageOptions(device).includes(storage)) return null;
  const supported = getDeviceConfigurations(device).filter((item) => item.storage === storage);
  const memory = explicitMemory ? `${explicitMemory[1]}GB`
    : supported.length === 1 ? supported[0].memory
      : memories.length === 1 ? memories[0] : null;
  if (explicitMemory && !memories.includes(memory!)) return null;
  if (memories.length && !memory) return null;
  if (device.configurations?.length || device.category !== "laptop") {
    if (!supported.some((item) => item.memory === memory)) return null;
  }
  const cpuValues = [...rawConfiguration.matchAll(/(\d+)\s*核\s*(?:CPU|中央处理器)/gi)].map((match) => Number(match[1]));
  const gpuValues = [...rawConfiguration.matchAll(/(\d+)\s*核\s*(?:GPU|图形处理器)/gi)].map((match) => Number(match[1]));
  if (new Set(cpuValues).size > 1 || new Set(gpuValues).size > 1) return null;
  let matches = device.configurations?.filter((item) => item.memory === memory && item.storage === storage
    && (!cpuValues.length || item.cpuCores === undefined || item.cpuCores === cpuValues[0])
    && (!gpuValues.length || item.gpuCores === undefined || item.gpuCores === gpuValues[0]));
  if (device.configurations?.length && !matches?.length) return null;
  if (device.brand !== "Apple") {
    const normalizeChip = (value: string) => value.normalize("NFKC").toLowerCase()
      .replace(/snapdragon/g, "骁龙").replace(/kirin/g, "麒麟").replace(/dimensity/g, "天玑")
      .replace(/intel|英特尔|amd|高通|qualcomm|core|酷睿|芯片|处理器/g, "").replace(/[\s-]+/g, "");
    const namedCpus = [...rawConfiguration.matchAll(/\bi[3579](?:[\s-]*\d{4,5}[A-Z]{0,3})?\b|(?:Ultra\s*X?[3579]|(?:酷睿|Core)\s*[3579]|Ryzen\s*[3579])(?:[\s-]*\d{3,4}[A-Z]{0,3})?|(?:骁龙|Snapdragon|麒麟|Kirin|天玑|Dimensity)\s*\d+[A-Z]*(?:\s*\+)?/gi)]
      .map((match) => normalizeChip(match[0]));
    if (namedCpus.length) {
      matches = matches?.filter((item) => item.chip && namedCpus.every((name) => normalizeChip(item.chip!).includes(name)));
      if (!matches?.length) return null;
    }
  }
  const chip = matches?.every((item) => item.chip === matches[0].chip) ? matches[0]?.chip : undefined;
  const cpuCores = matches?.[0]?.cpuCores;
  const gpuCores = matches?.[0]?.gpuCores;
  return { key: configurationKey(memory, storage), memory, storage, ...(chip ? { chip } : {}),
    ...(cpuCores !== undefined && matches?.every((item) => item.cpuCores === cpuCores) ? { cpuCores } : {}),
    ...(gpuCores !== undefined && matches?.every((item) => item.gpuCores === gpuCores) ? { gpuCores } : {}) };
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

export function isNewDevicePrice(condition: string | undefined) {
  return /全新/.test(condition ?? "")
    && !/二手|成新|准新|拆封|开封|退货|资源机|官换|翻新|展示机|样机/.test((condition ?? "").replace(/未拆封|未开封/g, ""));
}

export function getValidPriceFields(
  device: FlattenedDevice,
  priceType: "current" | "used",
) {
  const prices = priceType === "current"
    ? device.currentPrices ?? (device.currentPrice ? [device.currentPrice] : [])
    : device.usedPrices ?? (device.usedPrice ? [device.usedPrice] : []);
  const byConfiguration = new Map<string, PriceField & { value: number }>();

  for (const price of prices) {
    if (price.excludedReason) continue;
    if (priceType === "current" && !isNewDevicePrice(price.condition)) continue;
    if (typeof price.value !== "number" || !Number.isFinite(price.value) || price.value <= 0) continue;
    if (!getPriceConfiguration(device, price)) continue;
    const identity = `${priceConfigurationIdentity(price.configuration!)}|${price.condition ?? ""}`;
    const existing = byConfiguration.get(identity);
    const observedAt = price.observedAt ?? "";
    if (!existing || observedAt > (existing.observedAt ?? "") || (observedAt === (existing.observedAt ?? "") && price.value < existing.value)) {
      byConfiguration.set(identity, { ...price, value: price.value });
    }
  }
  return [...byConfiguration.values()];
}

export function getPricesForComparison(device: FlattenedDevice, priceType: "current" | "used") {
  const hasVariants = (["chip", "cpuCores", "gpuCores"] as const).some((key) =>
    new Set(device.configurations?.map((configuration) => configuration[key]).filter(Boolean)).size > 1);
  const entries = getValidPriceFields(device, priceType).map((price) => ({
    value: price.value,
    estimated: /预估到手价/.test(price.condition ?? ""),
    availabilityNote: /暂时缺货|无货|售罄/.test(price.condition ?? "") ? "缺货标价" : undefined,
    configuration: getPriceConfiguration(device, price)!,
    description: `${price.configuration}${price.condition ? `；${price.condition}` : ""}`,
  }));
  return entries.map((entry) => {
    const siblings = entries.filter((other) => other.configuration.key === entry.configuration.key);
    const coresDistinguish = siblings.every((other) => other.configuration.cpuCores && other.configuration.gpuCores)
      && new Set(siblings.map((other) => `${other.configuration.cpuCores}|${other.configuration.gpuCores}`)).size === siblings.length;
    const description = coresDistinguish
      ? `${formatConfiguration(entry.configuration)}（${entry.configuration.cpuCores} 核 CPU / ${entry.configuration.gpuCores} 核 GPU）`
      : entry.description;
    return {
      value: entry.value,
      estimated: entry.estimated,
      availabilityNote: entry.availabilityNote,
      configuration: siblings.length > 1 || hasVariants ? { ...entry.configuration, description } : entry.configuration,
    };
  }).sort(
    (left, right) =>
      capacityInGb(left.configuration.storage) - capacityInGb(right.configuration.storage)
      || capacityInGb(left.configuration.memory ?? "") - capacityInGb(right.configuration.memory ?? ""),
  );
}

export function getLaunchPriceRows(device: FlattenedDevice) {
  const editions = device.editions ?? [{ label: "", device }];
  return editions.flatMap(edition => {
    const prices = edition.device.launchPrices ?? [];
    if (!prices.length) return [{ configuration: edition.label, amount: "待补充" }];
    return prices.map(price => ({
      configuration: device.editions && device.editions.length > 1
        ? `${edition.label}${edition.device.category === "watch" || edition.device.category === "band" ? "" : ` · ${price.configuration ?? "配置待补充"}`}`
        : price.configuration ?? "",
      amount: `${formatMaybeCurrency(price.value ?? undefined)}${price.condition && price.condition !== "首发全新" ? `（${price.condition}）` : ""}`,
    }));
  });
}

export function formatLaunchPricesForComparison(device: FlattenedDevice) {
  return getLaunchPriceRows(device).map(row => `${row.configuration ? `${row.configuration} · ` : ""}${row.amount}`).join("\n");
}
