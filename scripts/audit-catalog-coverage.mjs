import fs from "node:fs/promises";
import { loadTsModule } from "./lib/load-ts-module.mjs";

// 清单差集不是全量证明：只统计已登记目标，未建立完整目录的品牌必须保持 partial。
const read = async (file) => JSON.parse(await fs.readFile(file, "utf8"));
const manifest = await read("src/data/device-data-manifest.json");
const { getCatalogBrand } = loadTsModule("./src/lib/catalog-order.ts");
const database = await read("src/data/devices-db.json");
const devices = database.devices.map(device => ({ ...device, brand: getCatalogBrand(device) }));
const images = await read("src/data/device-images.json");
const galleries = await read("src/data/device-image-galleries.json");
const asOf = "2026-10-07";
const scope = { Apple: 2016, Xiaomi: 2017, Redmi: 2017, Samsung: 2017, Huawei: 2022, OPPO: 2022, vivo: 2022, HONOR: 2022 };
const identity = (name = "") => name.replace(/HUAWEI|华为|OPPO|vivo|HONOR|荣耀|Samsung|三星|Xiaomi|小米/gi, "")
  .replace(/红米/gi, "redmi").replace(/平板/g, "pad").replace(/20\d{2}(?:款)?|英寸/g, "")
  .replace(/[\s()（）·]/g, "").toLowerCase();
const registered = new Map(devices.map((device) => [device.id, device]));
const inventoryBrand = (entry, fallback) => registered.get(entry.id ?? entry.deviceId)?.brand
  ?? getCatalogBrand({ brand: fallback, family: String(entry.family ?? entry.modelName ?? entry.name ?? entry.slug ?? entry.id ?? "").replace(/^红米/, "REDMI ") });
const auditEntries = [];
const inventoryEvidence = {};
const knownInventory = new Map();
for (const dataset of manifest.datasets) {
  const { metadata } = await read(`src/data/${dataset.devices}`);
  const evidence = inventoryEvidence[dataset.brand] ??= { sources: [], scopeGaps: [], hasModelInventory: false };
  evidence.scopeGaps.push(...metadata?.remainingGaps ?? [], ...(metadata?.catalogGaps ?? []).map((entry) => `${entry.sourceUrl}: ${entry.reason}`));
  for (const entry of metadata?.skipped ?? []) if (!registered.has(entry.id)) auditEntries.push({ status: "blocked", ...entry, brand: inventoryBrand(entry, dataset.brand) });
  const audit = metadata?.catalogAudit ?? metadata?.audit ?? (metadata?.coverageInventory ? {
    inventory: metadata.coverageInventory, pending: metadata.pending, blocked: metadata.blocked,
    catalogSources: metadata.catalogEvidence?.map((entry) => entry.sourceUrl),
  } : null);
  if (!audit) continue;
  evidence.hasModelInventory = true;
  evidence.sources.push(...audit.catalogSources ?? []);
  for (const entry of audit.inventory ?? audit.annualInventory ?? []) {
    const brand = inventoryBrand(entry, dataset.brand);
    const key = `${brand}|${identity(entry.modelName ?? entry.name) || entry.id || entry.deviceId}|${entry.year ?? entry.releaseYear ?? ""}`;
    knownInventory.set(key, { ...entry, brand });
    evidence.sources.push(...entry.sourceUrls ?? [], ...entry.catalogSources?.map((source) => typeof source === "string" ? source : source.sourceUrl) ?? []);
  }
  for (const status of ["pending", "blocked"]) for (const entry of audit[status] ?? []) {
    const brand = inventoryBrand(entry, dataset.brand);
    const year = entry.year ?? entry.releaseYear;
    const id = entry.id ?? entry.deviceId ?? (entry.slug && year ? `${entry.slug}-${year}` : undefined);
    const name = entry.modelName ?? entry.name;
    const match = registered.get(id) ?? devices.find((device) => device.brand === brand
      && (!year || device.releaseYear === year) && identity(device.modelName) === identity(name));
    if (match) continue;
    auditEntries.push({ status, ...entry, brand,
      reason: entry.reason ?? (status === "pending" ? "尚未开展核验，不是已证实不存在" : "证据未通过当前校验"),
      catalogSources: audit.catalogSources ?? [] });
  }
}
// 不同批次重复登记同一缺口时只计一次；blocked 优先于旧的 pending 描述。
const uniqueGaps = new Map();
for (const entry of auditEntries) {
  const model = identity(entry.modelName ?? entry.name) || entry.id || entry.slug;
  const year = entry.year ?? entry.releaseYear;
  const prior = [...uniqueGaps.entries()].find(([, value]) => value.brand === entry.brand
    && (identity(value.modelName ?? value.name) || value.id || value.slug) === model
    && (!year || !(value.year ?? value.releaseYear) || (value.year ?? value.releaseYear) === year));
  const key = prior?.[0] ?? `${entry.brand}|${model}|${year ?? ""}`;
  if (!uniqueGaps.has(key) || entry.status === "blocked") uniqueGaps.set(key, entry);
}
const duplicatedUrls = new Map();
for (const [id, image] of Object.entries(images)) {
  const ids = duplicatedUrls.get(image.url) ?? [];
  ids.push(id); duplicatedUrls.set(image.url, ids);
}
const sharedImageGroups = [...duplicatedUrls.entries()].filter(([, ids]) => ids.length > 1)
  .map(([url, ids]) => ({ url, ids, models: ids.map((id) => registered.get(id)?.modelName) }));
const perBrand = Object.fromEntries(Object.entries(scope).map(([brand, minYear]) => {
  const rows = devices.filter((device) => device.brand === brand && device.releaseYear >= minYear);
  const counts = Object.fromEntries(["phone", "tablet", "laptop", "watch", "band"].map((category) =>
    [category, rows.filter((device) => device.category === category).length]));
  const gaps = [...uniqueGaps.values()].filter((entry) => entry.brand === brand);
  const hasInventory = inventoryEvidence[brand]?.hasModelInventory ?? false;
  return [brand, { fromYear: minYear, through: asOf, inventoryComplete: false, coverageStatus: "partial",
    devices: rows.length, categories: counts, knownPending: hasInventory ? gaps.filter((entry) => entry.status === "pending").length : null,
    knownBlocked: gaps.filter((entry) => entry.status === "blocked").length,
    modelInventoryRegistered: hasInventory,
    explicitInventoryEntries: hasInventory ? [...knownInventory.values()].filter((entry) => entry.brand === brand).length : null,
    knownScopeDeviceEntries: rows.length + gaps.length,
    inventoryNote: "显式目标条目只统计已登记的局部清单，不是品牌全部产品数；年度/品类为0仅表示未收录，不能解释为不适用。",
    catalogSources: [...new Set(inventoryEvidence[brand]?.sources ?? [])],
    unenumeratedScopeGaps: [...new Set(inventoryEvidence[brand]?.scopeGaps ?? [])],
    missingDefaultImage: rows.filter((device) => !images[device.id]).map((device) => device.id),
    missingPalette: rows.filter((device) => !galleries[device.id]).map((device) => device.id),
    years: Object.fromEntries(Array.from({ length: 2026 - minYear + 1 }, (_, offset) => minYear + offset).map((year) =>
      [year, rows.filter((device) => device.releaseYear === year).map((device) => {
        const palette = galleries[device.id]?.colors ?? [];
        const required = ["watch", "band"].includes(device.category)
          ? ["displayType", "resolution", "batteryLife", "compatibility", "waterResistance"]
          : ["launchPrice", "chip", "screenSize", "displayType", "memory", "storage", "weight"];
        return { id: device.id, modelName: device.modelName, category: device.category, family: device.family,
          configurations: device.configurations?.length ?? 0,
          fieldGaps: required.filter((key) => device.specs[key]?.value == null),
          defaultImage: images[device.id]?.url ?? null,
          defaultImageScope: images[device.id] ? duplicatedUrls.get(images[device.id].url).length > 1 ? "shared-url" : "model-url" : "missing",
          colors: palette.length, colorImages: palette.filter((color) => color.image).length,
          missingColors: palette.filter((color) => !color.image).map((color) => color.name) };
      })])), gaps }];
}));
const sourceTypes = {};
for (const device of devices) for (const field of Object.values(device.specs)) {
  const type = field.sourceType ?? "unknown";
  sourceTypes[type] = (sourceTypes[type] ?? 0) + 1;
}
const report = { asOf, allRequestedProductsComplete: false,
  scopeAssumptions: ["近10年按2017–2026、近5年按2022–2026解释；Apple延续2016起的范围", "截至日已发售的中国大陆手机、平板、笔记本、手表、手环", "穿戴设备首批为已核验样本，不等于全量历史型号或配色已覆盖"],
  caveat: "已知目标清单仍不完整；pending/blocked数量不能当作全部剩余产品数。没有收录不等于该品牌未发布。",
  totals: { devices: devices.length, defaultImages: Object.keys(images).length,
    missingDefaultImages: devices.filter((device) => !images[device.id]).map((device) => device.id),
    palettes: Object.keys(galleries).length,
    colors: Object.values(galleries).reduce((sum, gallery) => sum + gallery.colors.length, 0),
    colorImages: Object.values(galleries).reduce((sum, gallery) => sum + gallery.colors.filter((color) => color.image).length, 0),
    licenseUnknownDefaultImages: Object.values(images).filter((image) => !image.licenseStatus || image.licenseStatus === "unknown").length,
    sourceTypes }, sharedImageGroups, perBrand };
const outputIndex = process.argv.indexOf("--output");
if (outputIndex >= 0) {
  const file = process.argv[outputIndex + 1];
  if (!file?.startsWith("/tmp/")) throw new Error("验收报告仅可输出到 /tmp，避免主动修改项目文档");
  await fs.writeFile(file, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ report: file, totals: report.totals,
    brands: Object.fromEntries(Object.entries(perBrand).map(([brand, value]) => [brand, { devices: value.devices, categories: value.categories,
      pending: value.knownPending, blocked: value.knownBlocked }])) }));
} else console.log(JSON.stringify(report, null, 2));
