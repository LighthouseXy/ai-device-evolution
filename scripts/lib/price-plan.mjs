import { loadTsModule } from "./load-ts-module.mjs";

const { getDeviceConfigurations, getPriceConfiguration, isNewDevicePrice } = loadTsModule("./src/lib/device-configurations.ts");

export function buildPricePlan(devices, observations, { category, priceType, limit = Infinity }) {
  const groups = Map.groupBy(devices, (device) => device.comparisonGroupId);
  const recent = new Set([...groups.values()].flatMap((group) => [...group]
    .sort((a, b) => b.generationOrder - a.generationOrder).slice(0, 5).map((device) => device.id)));
  const rows = [];
  // 采集工作队列的优先级，不改变顾问推荐排序；荣耀暂后置。
  const brandPriority = (brand) => ["Xiaomi", "Samsung", "OPPO", "vivo"].includes(brand) ? 0 : brand === "HONOR" ? 2 : 1;
  for (const device of [...devices].sort((a, b) => brandPriority(a.brand) - brandPriority(b.brand)
    || b.releaseYear - a.releaseYear || a.modelName.localeCompare(b.modelName, "zh-CN"))) {
    if (device.market !== "CN" || (category && device.category !== category)) continue;
    const flat = { ...device, specs: Object.fromEntries(Object.entries(device.specs).map(([key, field]) => [key, field.value])) };
    const quotes = (type) => {
      const value = observations[type]?.[device.id] ?? device.specs[`${type}Price`];
      return (Array.isArray(value) ? value : value ? [value] : []).filter((price) =>
        !price.excludedReason && Number.isFinite(price.value) && price.value > 0
        && (!price.market || ["CN", "中国大陆"].includes(price.market))
        && !/美版|港版|日版|海外版/.test(price.configuration ?? "")
        && (type === "used" ? /二手|成新/.test(price.condition ?? "") : isNewDevicePrice(price.condition)));
    };
    let targets = getDeviceConfigurations(flat).filter((configuration) => configuration.memory);
    const incompleteMatrix = targets.length === 0;
    if (!recent.has(device.id)) targets = targets.slice(-1);
    // 缺矩阵时只沿用报价已经证明的组合；不从两组容量选项拼出新 SKU。
    if (incompleteMatrix) targets = [...new Map(["current", "used"].flatMap(quotes)
      .map((price) => getPriceConfiguration(flat, price)).filter(Boolean)
      .map((configuration) => [configuration.key, configuration])).values()];
    const covered = new Set(quotes(priceType).map((price) => getPriceConfiguration(flat, price)?.key).filter(Boolean));
    const base = { deviceId: device.id, modelName: device.modelName, category: device.category,
      releaseYear: device.releaseYear, market: "CN", priceType,
      condition: priceType === "used" ? "二手，记录实际成色" : "全新",
      coverageScope: "memory_storage" };
    for (const target of targets) {
      if (covered.has(target.key)) continue;
      const configuration = `${target.memory} 运行内存 + ${target.storage} 存储`;
      rows.push({ ...base, priority: priceType === "used" ? "P3" : "P2", status: "missing_price", configurationKey: target.key, configuration,
        searchQuery: `${device.modelName} ${configuration} 国行 ${base.condition}` });
    }
    if (incompleteMatrix) rows.push({ ...base, priority: "P1", status: "verify_configuration", configurationKey: null,
      configuration: null, searchQuery: `${device.modelName} 国行 原始配置表 CPU GPU 运行内存 存储`,
      reason: "缺少完整配置矩阵；已知报价不代表所有配置齐全，旧设备最高配置也需证据确认" });
  }
  return rows.sort((a, b) => a.priority.localeCompare(b.priority)).slice(0, limit);
}
