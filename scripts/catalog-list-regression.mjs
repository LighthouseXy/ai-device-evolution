import assert from "node:assert/strict";
import { loadTsModule } from "./lib/load-ts-module.mjs";

const { catalogDevicesFlat, getCatalogFamilyOptions } = loadTsModule("@/lib/devices-db");
const { getCatalogListing, compareCatalogEntries, CATALOG_PAGE_SIZE } = loadTsModule("@/lib/catalog-list");
const { getCatalogProductSeries, getCatalogBrandFilter, matchesCatalogBrand } = loadTsModule("@/lib/catalog-order");
const groups = getCatalogFamilyOptions();
const entries = catalogDevicesFlat.map(device => ({
  id: device.id, model: device.model, brand: device.brand, category: device.category, series: device.comparisonGroupId,
  seriesLabel: getCatalogProductSeries({ ...device, key: device.comparisonGroupId, label: device.series }).label,
  chip: device.chip, releaseYear: device.releaseYear, releaseDate: device.releaseDate, launchPrice: device.launchPrice,
  searchNames: device.editions?.flatMap(edition => [edition.label, edition.device.model]) ?? [],
})).sort(compareCatalogEntries);
const list = query => getCatalogListing(entries, groups, new URLSearchParams(query));
assert.equal(list("").total, catalogDevicesFlat.length);
assert.equal(list("").devices.length, CATALOG_PAGE_SIZE);
assert.equal(list("page=2").start, CATALOG_PAGE_SIZE);
assert.ok(list("page=2").devices.every(device => !list("").devices.some(first => first.id === device.id)));
for (const page of ["0", "-1", "abc", "1.5", "Infinity", "99999999999999999999"]) assert.equal(list(`page=${page}`).page, 1);
assert.equal(list("page=9999").page, list("").pageCount);
assert.equal(list("q=there-is-no-such-device").total, 0);
assert.equal(list("q=there-is-no-such-device&page=99").page, 1);
for (const category of ["phone", "tablet", "laptop", "watch", "band"]) {
  assert.equal(list(`category=${category}`).total, entries.filter(device => device.category === category).length);
  for (const brand of new Set(entries.map(device => device.brand))) {
    assert.equal(list(`category=${category}&brand=${brand}`).total, entries.filter(device => device.category === category && matchesCatalogBrand(device.brand, getCatalogBrandFilter(brand))).length);
  }
}
const band = list("category=band&brand=Xiaomi&q=NFC");
assert.ok(band.devices.some(device => device.id === "xiaomi-band-9-2024"), "归并后仍能按旧版本名搜索到机型");
const redmi = groups.find(group => group.brand === "Redmi" && group.category === "phone");
assert.equal(list(`brand=Xiaomi&series=${redmi.groupKeys[0]}`).brand, "Redmi", "旧小米/红米链接兼容");
assert.deepEqual(list(`series=${redmi.key}`).devices, list(`series=${redmi.groupKeys[0]}`).devices);
const bandFamily = groups.find(group => group.brand === "Xiaomi" && group.category === "band" && group.aliases.includes("xiaomi.band.小米手环.nfc"));
assert.ok(bandFamily, "归并后的 NFC 旧系列保留浏览入口");
assert.deepEqual(list(`brand=Xiaomi&category=band&series=${encodeURIComponent("xiaomi.band.小米手环.nfc")}`).devices,
  list(`brand=Xiaomi&category=band&series=${encodeURIComponent(bandFamily.key)}`).devices);
console.log(`catalog list passed: ${entries.length} models, ${CATALOG_PAGE_SIZE}/page, brand/category/series/search/legacy/page edges`);
const otherEntries = ["Sony", "Meizu", "ZUK", "Smartisan", "Nut", "Google"].map((brand, index) => ({
  id: brand, model: `${brand} model`, brand, category: "phone", series: `${brand}.phone`,
  seriesLabel: brand, chip: "", releaseYear: 2024, searchNames: [], order: index,
}));
const otherGroups = otherEntries.map(device => ({ key: device.series, label: device.brand, brand: device.brand,
  category: device.category, groupKeys: [device.series] }));
assert.deepEqual(getCatalogListing(otherEntries, otherGroups, new URLSearchParams("brand=Other")).devices.map(d => d.brand),
  ["Sony", "Meizu", "ZUK", "Smartisan", "Nut"], "其他筛选不改写真实品牌，也不包括 Google");
assert.deepEqual(getCatalogListing(otherEntries, otherGroups, new URLSearchParams("brand=Google")).devices.map(d => d.brand), ["Google"]);
assert.deepEqual(getCatalogListing(otherEntries, otherGroups, new URLSearchParams("brand=Other&series=Sony.phone")).devices.map(d => d.brand), ["Sony"]);
