import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve("src/data");
const manifest = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "device-data-manifest.json"), "utf8"));

function readJson(filename) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, filename), "utf8"));
}

function sourceRows(sourceRegistry) {
  return Object.values(sourceRegistry).flat();
}

function writeJsonIfChanged(filename, value) {
  const output = `${JSON.stringify(value, null, 2)}\n`;
  const target = path.join(DATA_DIR, filename);
  if (fs.existsSync(target) && fs.readFileSync(target, "utf8") === output) return;
  fs.writeFileSync(target, output);
}

const devices = [];
const sources = [];
const ids = new Set();
const comparisonGroups = new Map();
const expandedGroups = new Set();
for (const dataset of manifest.datasets) {
  const database = readJson(dataset.devices);
  const registry = readJson(dataset.sources);
  const datasetDevices = database.devices ?? [];
  const datasetSources = sourceRows(registry);
  const sourceIds = new Set(datasetSources.map((row) => row.id));
  const sourcesById = new Map(datasetSources.map((row) => [row.id, row]));

  for (const device of datasetDevices) {
    if (device.brand !== dataset.brand) throw new Error(`${device.id}: brand 与清单不一致`);
    if (device.market !== dataset.market) throw new Error(`${device.id}: market 与清单不一致`);
    if (!device.comparisonGroupId) throw new Error(`${device.id}: 缺少 comparisonGroupId`);
    if (ids.has(device.id)) throw new Error(`${device.id}: 跨数据集设备 id 重复`);
    if (!sourceIds.has(device.id)) throw new Error(`${device.id}: 缺少来源登记`);
    const source = sourcesById.get(device.id);
    const registeredUrls = new Set([
      source.officialSpecUrl,
      source.supportUrl,
      source.newsroomUrl,
      ...(source.referenceUrls ?? []),
    ].filter(Boolean));
    for (const [fieldName, field] of Object.entries(device.specs ?? {})) {
      if (!registeredUrls.has(field.sourceUrl)) throw new Error(`${device.id}.${fieldName}: sourceUrl 未登记`);
    }
    for (const benchmark of device.benchmarks ?? []) {
      if (!registeredUrls.has(benchmark.sourceUrl)) throw new Error(`${device.id}: benchmark sourceUrl 未登记`);
    }
    for (const configuration of device.configurations ?? []) {
      if (configuration.evidence && !registeredUrls.has(configuration.evidence.sourceUrl)) {
        throw new Error(`${device.id}: configuration evidence sourceUrl 未登记`);
      }
    }
    ids.add(device.id);
    const groupIdentity = JSON.stringify([
      device.brand,
      device.market,
      device.category,
      device.family,
      device.variant,
      device.tier ?? null,
    ]);
    const existingIdentity = comparisonGroups.get(device.comparisonGroupId);
    if (existingIdentity && existingIdentity !== groupIdentity) {
      throw new Error(`${device.id}: comparisonGroupId 被不同产品组复用`);
    }
    comparisonGroups.set(device.comparisonGroupId, groupIdentity);
    if (dataset.normalizeGenerationOrder) expandedGroups.add(device.comparisonGroupId);
    devices.push(device);
  }
  if (sourceIds.size !== datasetDevices.length || datasetSources.length !== datasetDevices.length) {
    throw new Error(`${dataset.id}: 来源登记数量与设备数量不一致`);
  }
  sources.push(...datasetSources.map((row) => ({ ...row, brand: dataset.brand, market: dataset.market })));
}

// 少量旧型号的官方外观补证；采集器仍保留自己的参数来源，构建时仅补图片页面登记。
const imageRecovery = JSON.parse(fs.readFileSync("scripts/fixtures/xiaomi-image-recovery.json", "utf8"));
for (const candidate of imageRecovery.candidates) {
  const source = sources.find((row) => row.id === candidate.deviceId);
  const device = devices.find((row) => row.id === candidate.deviceId);
  if (!source || device.modelName !== candidate.model) throw new Error(`${candidate.deviceId}: 图片补证型号不匹配`);
  source.referenceUrls = [...new Set([...source.referenceUrls ?? [], candidate.sourceUrl])];
}

// 旧型号补入已有系列时只重排扩容涉及的组，保留其他组与派生结果。
const orderDates = new Map(sources.map((source) => {
  const release = String(source.releaseEvidence?.value ?? "");
  const published = source.marketEvidence?.rawText?.match(/国内发布时间\s*(20\d{2})年(\d{2})月(\d{2})日/);
  // 仅用于同年排序，不把发布日期伪装成首售日或补写未知的 releaseDate。
  const date = /^20\d{2}-\d{2}/.test(release) ? release
    : published && Number(published[1]) === source.releaseYear ? published.slice(1).join("-") : String(source.releaseYear);
  return [source.id, date];
}));
for (const groupId of expandedGroups) {
  const group = devices.filter((device) => device.comparisonGroupId === groupId)
    .sort((a, b) => a.releaseYear - b.releaseYear
      || (a.releaseDate ?? orderDates.get(a.id)).localeCompare(b.releaseDate ?? orderDates.get(b.id))
      || a.generationOrder - b.generationOrder || a.id.localeCompare(b.id));
  group.forEach((device, index) => {
    device.generationOrder = index + 1;
    const magnitude = device.computed?.generationUpgradeMagnitude;
    // 历史补录改变了前代，原派生评分不能继续引用旧关系，也不能凭空补分。
    if (magnitude && (magnitude.comparedTo ?? null) !== (group[index - 1]?.id ?? null)) {
      delete device.computed.generationUpgradeMagnitude;
    }
  });
}

const generatedAt = manifest.datasets
  .map((dataset) => readJson(dataset.devices).metadata?.generatedAt)
  .filter(Boolean)
  .sort()
  .at(-1) ?? null;

writeJsonIfChanged("devices-db.json", {
  metadata: {
    version: "2.0",
    generatedAt,
    totalDevices: devices.length,
    brands: [...new Set(devices.map((device) => device.brand))],
    markets: [...new Set(devices.map((device) => device.market))],
    datasets: manifest.datasets.map(({ id, brand, market }) => ({ id, brand, market })),
  },
  devices,
});
writeJsonIfChanged("device-sources.json", {
  metadata: { version: "1.0", generatedAt, totalDevices: sources.length },
  devices: sources,
});

console.log(`built ${devices.length} devices from ${manifest.datasets.length} dataset(s)`);
