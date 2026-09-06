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
    devices.push(device);
  }
  if (sourceIds.size !== datasetDevices.length || datasetSources.length !== datasetDevices.length) {
    throw new Error(`${dataset.id}: 来源登记数量与设备数量不一致`);
  }
  sources.push(...datasetSources.map((row) => ({ ...row, brand: dataset.brand, market: dataset.market })));
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
