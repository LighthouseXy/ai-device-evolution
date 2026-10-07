import assert from "node:assert/strict";
import { loadTsModule } from "./lib/load-ts-module.mjs";

const { transformPhoto } = loadTsModule("./src/lib/photo-zoom.ts");
const photoStart = { scale: 1, x: 0, y: 0 };
assert.deepEqual(transformPhoto(photoStart, 2, 200, 100, { x: 50, y: 0 }), { scale: 2, x: -50, y: 0 }, "缩放保持鼠标/双指中心对应的内容");
assert.deepEqual(transformPhoto({ scale: 2, x: 0, y: 0 }, 1, 200, 100, undefined, { x: 999, y: -999 }),
  { scale: 2, x: 100, y: -50 }, "拖动范围受图片视窗约束");
assert.deepEqual(transformPhoto({ scale: 2, x: 40, y: 20 }, .5, 200, 100), photoStart, "缩回100%清除平移");
assert.equal(transformPhoto(photoStart, 100, 200, 100).scale, 6);
assert.deepEqual(transformPhoto(photoStart, NaN, 200, 100), photoStart);
assert.deepEqual(transformPhoto(photoStart, 2, 0, 100), photoStart);

const { parseDisplayNumber, formatCurrency, formatCompactCurrency, formatMaybeCurrency } = loadTsModule("./src/lib/number-format.ts");
for (const price of [0, 1299, 9999.5]) {
  assert.equal(formatCurrency(price), new Intl.NumberFormat("zh-CN", {
    style: "currency", currency: "CNY", maximumFractionDigits: 0,
  }).format(price));
  assert.equal(formatCompactCurrency(price), new Intl.NumberFormat("zh-CN", {
    notation: "compact", maximumFractionDigits: 1,
  }).format(price));
}
assert.equal(formatMaybeCurrency(), "待补充");
assert.equal(formatMaybeCurrency(0), formatCurrency(0));
assert.deepEqual(loadTsModule("./src/lib/device-categories.ts").categoryLabels,
  { phone: "手机", tablet: "平板电脑", laptop: "笔记本电脑", watch: "手表", band: "手环" });
assert.equal(parseDisplayNumber("5/10") - parseDisplayNumber("4/10"), 1, "score denominators must not be merged into the value");
assert.equal(parseDisplayNumber("¥12,999"), 12999);
assert.ok(Number.isNaN(parseDisplayNumber("待补充")));

const {
  formatConfigurationForComparison,
  formatLatestConfigurationOption,
  formatMemoryForComparison,
  getDeviceConfigurations,
  getPricesForComparison,
  getPriceConfiguration,
  getValidPriceFields,
  formatConfiguration,
  getSharedStorageOptions,
  getDeviceStorageOptions,
} = loadTsModule("./src/lib/device-configurations.ts");
const { allDevices, allDevicesFlat, catalogDevicesFlat, getDevicesByComparisonGroupKeyFlat, getCatalogSeriesOptions, getCatalogFamilyOptions } = loadTsModule("./src/lib/devices-db.ts");
const devices = new Map(allDevicesFlat.map((device) => [device.id, device]));
const dualDisk = { brand: "Xiaomi", category: "laptop", specs: { chip: "i7-7700HQ", memory: "16GB", storage: "256GB + 1TB" },
  configurations: [{ memory: "16GB", storage: "256GB + 1TB", chip: "i7-7700HQ" }] };
assert.deepEqual(getDeviceStorageOptions(dualDisk), ["256GB + 1TB"]);
assert.deepEqual(getDeviceConfigurations(dualDisk).map(({ key }) => key), ["16GB|256GB + 1TB"]);
assert.equal(getPriceConfiguration(dualDisk, { configuration: "16GB 运行内存 + 256GB SSD + 1TB HDD 存储，国行" })?.storage, "256GB + 1TB");
for (const configuration of ["16GB 运行内存 + 256GB 存储，国行", "16GB 运行内存 + 1TB 存储，国行", "16GB 运行内存 + 256GB/1TB 存储，国行", "16GB 运行内存 + 256GB 存储，赠送1TB移动硬盘，国行"]) {
  assert.equal(getPriceConfiguration(dualDisk, { configuration }), null, "双盘价格不能绑定到单盘、可选或赠品容量");
}
assert.deepEqual(getDeviceConfigurations({ ...dualDisk, category: "phone" }), [], "手机不能套用双盘笔记本配置");
for (const [group, earlier, later] of [
  ["xiaomi.phone.redmi-k.standard", "redmi-k20-2019", "redmi-k30-5g-2019"],
  ["xiaomi.phone.redmi-note-pro.standard", "redmi-note-10-pro-2021", "redmi-note-11-pro-2021"],
]) {
  const ids = getDevicesByComparisonGroupKeyFlat(group).map((device) => device.id);
  assert.ok(ids.indexOf(earlier) < ids.indexOf(later), "同年设备应使用已核验月份顺序，不能把只有年份的记录一律放在年初");
}
const { brandOrder, sortBrands, getCatalogProductSeries } = loadTsModule("./src/lib/catalog-order.ts");
assert.deepEqual(sortBrands(["HONOR", "Apple", "Huawei", "vivo", "Samsung", "Xiaomi", "Redmi", "OPPO", "Apple"]), brandOrder);
const catalog = getCatalogSeriesOptions();
assert.deepEqual([...new Set(catalog.map((group) => group.brand))], brandOrder);
assert.equal(devices.get("redmi-book-pro-16-2024").brand, "Redmi");
assert.equal(devices.get("redmi-k20-2019").brand, "Redmi");
assert.equal(devices.get("xiaomi-17-2025").brand, "Xiaomi");
assert.ok(allDevicesFlat.filter(device => device.brand === "Xiaomi").every(device => !/^REDMI\b/i.test(device.family)), "小米品牌不再包含红米");
const catalogFamilies = getCatalogFamilyOptions();
assert.equal(catalogFamilies.reduce((count, family) => count + family.count, 0), catalogDevicesFlat.length, "合并系列不能遗漏机型，也不重复计数配色/表带款");
assert.equal(new Set(catalogFamilies.flatMap(family => family.groupKeys)).size, catalog.length, "每个严格比较组只属于一个浏览系列");
for (const brand of ["Xiaomi", "Redmi"]) {
  const families = catalogFamilies.filter(group => group.brand === brand && group.category === "phone");
  assert.ok(families.length <= 7, "小米/红米不再把特殊版本作为独立浏览系列");
  for (const family of families) assert.ok(family.groupKeys.every(key => getDevicesByComparisonGroupKeyFlat(key).every(device => device.brand === brand && device.category === "phone")),
    "合并后的系列不能串品牌或品类");
}
const redmiK = catalogFamilies.find(group => group.label === "红米 K 系列");
assert.ok(redmiK.groupKeys.includes("xiaomi.phone.redmi-k.standard") && redmiK.groupKeys.includes("xiaomi.phone.redmi-k-pro.standard"));
assert.ok(!getDevicesByComparisonGroupKeyFlat("xiaomi.phone.redmi-k.standard").some(device => device.family === "REDMI K Pro"), "代际比较仍保留独立分支，不混入 Pro");
for (const [brand, category, label, strictKeys] of [
  ["Apple", "phone", "iPhone 系列", ["apple.phone.iphone.pro", "apple.phone.iphone.se"]],
  ["Apple", "tablet", "iPad Pro 系列", ["apple.tablet.ipad-pro.11-inch", "apple.tablet.ipad-pro.13-inch"]],
  ["Apple", "laptop", "MacBook Pro 系列", ["apple.laptop.macbook-pro.14-inch.pro", "apple.laptop.macbook-pro.16-inch.max"]],
  ["Samsung", "phone", "Galaxy S 系列", ["samsung.phone.galaxy-s-ultra.standard", "samsung.phone.galaxy-s-fe.standard"]],
  ["Samsung", "phone", "Galaxy Z 系列", ["samsung.phone.galaxy-z-fold.standard", "samsung.phone.galaxy-z-flip.standard", "samsung.phone.galaxy-z-trifold.standard"]],
  ["Samsung", "tablet", "Galaxy Tab S 系列", ["samsung.tablet.galaxy-tab-s-ultra.wifi", "samsung.tablet.galaxy-tab-s-fe.5g"]],
  ["Huawei", "phone", "Mate X 系列", ["huawei.phone.mate-x.standard", "huawei.phone.mate-xs.standard", "huawei.phone.mate-xt.standard"]],
  ["Huawei", "phone", "P / Pura 系列", ["huawei.phone.pura-ultra.standard", "huawei.phone.pura-pro.standard"]],
  ["Huawei", "tablet", "MatePad Pro 系列", ["huawei.tablet.matepad-pro-11.standard", "huawei.tablet.matepad-pro-12-yuexiang.standard", "huawei.tablet.matepad-pro-13-2.standard"]],
  ["Huawei", "laptop", "MateBook D 系列", ["huawei.laptop.matebook-d14.standard", "huawei.laptop.matebook-d16-high.standard"]],
  ["OPPO", "phone", "Reno 系列", ["oppo.phone.reno-pro.standard", "oppo.phone.reno-pro-starlight.starlight"]],
  ["OPPO", "tablet", "OPPO Pad 系列", ["oppo.tablet.pad-pro.standard", "oppo.tablet.pad-air.wifi-soft-light"]],
  ["vivo", "phone", "iQOO Neo 系列", ["vivo.phone.iqoo-neo.standard", "vivo.phone.iqoo-neo-racing.standard"]],
  ["vivo", "tablet", "vivo Pad 系列", ["vivo.tablet.pad-pro.standard", "vivo.tablet.pad-e.soft-light"]],
  ["HONOR", "phone", "Magic V 系列", ["honor.phone.magic-v.standard", "honor.phone.magic-vs.standard"]],
  ["HONOR", "tablet", "荣耀平板 V 系列", ["honor.tablet.pad-v.standard", "honor.tablet.pad-v-pro.standard"]],
]) {
  const family = catalogFamilies.find(group => group.brand === brand && group.category === category && group.label === label);
  assert.ok(family && strictKeys.every(key => family.groupKeys.includes(key)), `${brand} ${label} 应合并尺寸、版本或档位分支`);
}
for (const family of catalogFamilies) {
  assert.ok(family.groupKeys.every(key => getDevicesByComparisonGroupKeyFlat(key).every(device =>
    device.brand === family.brand && device.category === family.category)), "全部品牌系列归类不能串品牌或品类");
}
for (const brand of ["Apple", "Samsung", "Huawei", "OPPO", "vivo", "HONOR"]) {
  assert.ok(catalogFamilies.filter(group => group.brand === brand).length < catalog.filter(group => group.brand === brand).length,
    `${brand} 的浏览系列应收敛，原始严格分组保留`);
}
assert.ok(!catalogFamilies.find(group => group.label === "Mate 系列").groupKeys.some(key => key.includes("mate-x")), "Mate 折叠产品线不并入 Mate 直板系列");
assert.ok(!catalogFamilies.find(group => group.label === "P / Pura 系列").groupKeys.some(key => key.includes("pura-x")), "Pura X 保留独立产品线");
assert.ok(!catalogFamilies.find(group => group.label === "vivo Pad 系列").groupKeys.some(key => key.includes("iqoo")), "vivo Pad 与 iQOO Pad 不混成一个系列");
for (const [brand, family] of [["Samsung", "Samsung Galaxy Sonic"], ["Huawei", "HUAWEI MateBooklet"], ["Unknown", "New Product"]]) {
  const group = { key: "original-key", label: "原系列", category: "phone", brand, family };
  assert.deepEqual(getCatalogProductSeries(group), { key: group.key, label: group.label }, "未知产品线保留原分组，不进行宽泛猜测");
}
const iphoneGroups = catalog.filter((group) => group.brand === "Apple" && group.category === "phone");
assert.ok(iphoneGroups.findIndex((group) => group.label.includes("Pro")) < iphoneGroups.findIndex((group) => group.label.includes("SE")));
assert.ok(iphoneGroups.findIndex(group => group.label === "iPhone Pro") < iphoneGroups.findIndex(group => group.label === "iPhone Plus"), "Pro旗舰应排在Plus之前");
const samsungGroups = catalog.filter(group => group.brand === "Samsung" && group.category === "phone");
assert.ok(samsungGroups.findIndex(group => group.family === "Samsung Galaxy Z Fold")
  < samsungGroups.findIndex(group => group.family === "Samsung Galaxy S FE"), "折叠旗舰不应排在 FE 之后");
const { getDeviceSpecFields, formatDeviceSpec, splitDeviceSpecDescription } = loadTsModule("./src/lib/device-spec-fields.ts");
assert.deepEqual(splitDeviceSpecDescription("30W（8 核；10 核 [选配;随附]）；35W (512GB; 1TB)\nUSB-C"),
  ["30W（8 核；10 核 [选配;随附]）", "35W (512GB; 1TB)", "USB-C"], "只拆分括号外的分项，配置条件不拆散");
assert.deepEqual(splitDeviceSpecDescription("； ;\n"), []);
assert.deepEqual(splitDeviceSpecDescription("未闭合（条件；备注"), ["未闭合（条件；备注"], "不完整原文保留，不推断条件边界");
const androidPhone = devices.get("oppo-find-x9-2025");
for (const id of ["samsung-galaxy-z-fold5-2023", "samsung-galaxy-z-fold6-2024", "samsung-galaxy-z-flip5-2023"]) {
  assert.equal(devices.get(id).specs.operatingSystem, "Android", "仅恢复官方明示的泛称Android，不恢复未经核实的One UI版本");
  assert.ok(devices.get(id).specs.displayType.includes("AMOLED"));
  assert.equal(devices.get(id).specs.storageType, undefined, "未经独立补证的存储制式保持缺失");
}
const androidFields = getDeviceSpecFields([androidPhone]);
assert.ok(androidFields.some((field) => field.key === "batteryCapacity"));
assert.ok(!androidFields.some((field) => ["neuralEngine", "hasMagSafe", "hasTouchId", "hasCrashDetection"].includes(field.key)),
  "Android must not inherit empty Apple-only capability rows");
assert.ok(!getDeviceSpecFields([devices.get("macbook-air-13-m1-2020")]).some((field) => field.key === "rearCamera"),
  "laptop specifications must not include phone rear cameras");
assert.equal(formatDeviceSpec({ ...androidPhone, specs: { ...androidPhone.specs, hasNFC: false } },
  { key: "hasNFC", label: "NFC", group: "功能" }), "不支持", "false is a real fact, not missing");
assert.equal(formatDeviceSpec({ ...androidPhone, specs: { ...androidPhone.specs, screenSize: 7.6,
  screenSizeDetails: "主屏7.6英寸，外屏6.3英寸" } },
  { key: "screenSize", label: "屏幕尺寸", group: "屏幕", unit: "英寸" }), "主屏7.6英寸，外屏6.3英寸",
  "foldable screen detail must not be reduced to only its first dimension");
assert.equal(formatDeviceSpec({ ...devices.get("macbook-air-13-m1-2020"), specs: {
  ...devices.get("macbook-air-13-m1-2020").specs, chip: "i5-8250U / i7-8550U",
}, configurations: [
  { memory: "8GB", storage: "512GB", chip: "i5-8250U" },
  { memory: "16GB", storage: "512GB", chip: "i7-8550U" },
] }, { key: "chip", label: "芯片", group: "性能" }), "i5-8250U / i7-8550U\ni5-8250U（8GB + 512GB）\ni7-8550U（16GB + 512GB）",
"笔记本型号的已核验处理器选项不应仅显示第一条 SKU");
assert.match(formatDeviceSpec({ ...androidPhone, specs: { ...androidPhone.specs, memory: "8GB / 12GB / 16GB" },
  configurations: [{ memory: "8GB", storage: "256GB" }, { memory: "12GB", storage: "512GB" }],
}, { key: "memory", label: "运行内存", group: "性能" }), /^8GB \/ 12GB \/ 16GB\n/,
  "部分配置矩阵不能把尚未建立对应关系的原有规格选项隐去");
const m3GpuDisplay = formatDeviceSpec(devices.get("macbook-air-13-m3-2024"), { key: "gpu", label: "GPU", group: "性能" });
assert.match(m3GpuDisplay, /8 核 GPU（8GB \+ 256GB \/ 16GB \+ 256GB）/);
assert.match(m3GpuDisplay, /10 核 GPU.*24GB \+ 256GB/);
assert.equal(formatDeviceSpec(devices.get("iphone-17"), { key: "memory", label: "运行内存", group: "性能" }), "8GB");
assert.match(formatDeviceSpec(devices.get("huawei-matepad-pro-11-2022"), { key: "chip", label: "芯片", group: "性能" }),
  /骁龙888.*12GB \+ 512GB/, "平板不同芯片的配置也须内联标注，不能只处理笔记本");
const singleQuote = getPricesForComparison({ ...devices.get("macbook-air-13-m3-2024"), currentPrices: [
  { value: 7000, configuration: "8GB 运行内存 + 256GB 存储，10 核 GPU，国行", condition: "全新", observedAt: "2026-09-01" },
] }, "current");
assert.match(formatConfiguration(singleQuote[0].configuration), /10 核 GPU/, "只收录一个报价时也不能隐去有差异的 GPU 档位");
const { renderToStaticMarkup } = await import("react-dom/server");
const { createElement } = await import("react");
const ProductCompareTable = loadTsModule("./src/components/ProductCompareTable.tsx").default;
const markup = renderToStaticMarkup(createElement(ProductCompareTable, {
  devices: [devices.get("iphone-17"), androidPhone], generation: false,
  fields: [{ group: "性能", label: "芯片", getValue: (device) => device.chip ?? "待补充" }],
}));
assert.equal((markup.match(/class="compare-overview-card/g) ?? []).length, 2);
assert.ok(!markup.includes("compare-change-badge") && !markup.includes("is-highlight"), "cross-brand differences are not generation upgrades");
const { AppRouterContext } = await import("next/dist/shared/lib/app-router-context.shared-runtime.js");
const renderPage = (element) => renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: { push() {} } }, element));
const DeviceCatalogFilters = loadTsModule("./src/components/DeviceCatalogFilters.tsx").default;
const redmiCatalogFilters = renderPage(createElement(DeviceCatalogFilters, { path: "/devices", groups: catalogFamilies,
  brand: "Redmi", category: "phone", series: redmiK.key, allowAll: true }));
const seriesSelect = redmiCatalogFilters.match(/产品系列<\/span><select[^>]*>(.*?)<\/select>/)?.[1];
assert.equal((seriesSelect?.match(/<option/g) ?? []).length, 6, "红米手机只显示五个浏览系列及全部系列选项");
assert.ok(!seriesSelect.includes("Pro Premium") && !seriesSelect.includes("High Snapdragon"));
assert.ok(!redmiCatalogFilters.includes("型号分支"), "设备库没有额外版本选择器");
const redmiCompareFilters = renderPage(createElement(DeviceCatalogFilters, { path: "/compare", groups: getCatalogSeriesOptions(2),
  brand: "Redmi", category: "phone", series: "xiaomi.phone.redmi-k-pro.standard" }));
assert.ok(redmiCompareFilters.includes("型号分支") && /catalog-k[^>]*selected/.test(redmiCompareFilters), "比较页定位合并系列，具体分支仍独立");
for (const brand of ["Apple", "Samsung", "Huawei", "OPPO", "vivo", "HONOR"]) {
  const family = catalogFamilies.find(group => group.brand === brand && group.category === "phone");
  const libraryFilters = renderPage(createElement(DeviceCatalogFilters, { path: "/devices", groups: catalogFamilies,
    brand, category: "phone", series: family.key, allowAll: true }));
  const options = libraryFilters.match(/产品系列<\/span><select[^>]*>(.*?)<\/select>/)?.[1];
  assert.equal((options.match(/<option/g) ?? []).length, catalogFamilies.filter(group => group.brand === brand && group.category === "phone").length + 1);
  for (const path of ["/compare", "/trends"]) {
    const groups = getCatalogSeriesOptions(2);
    const selected = groups.find(group => group.catalogKey === family.key);
    const filters = renderPage(createElement(DeviceCatalogFilters, { path, groups, brand, category: "phone", series: selected.key }));
    assert.ok(filters.includes(`value="${family.key}" selected=""`), "对比与趋势的旧严格组链接应定位到合并系列");
    assert.ok(filters.includes(`value="${selected.key}" selected=""`), "具体分支不能在系列合并时丢失");
  }
}
const DevicesPage = loadTsModule("./src/app/devices/page.tsx").default;
const oldRedmiLink = renderPage(await DevicesPage({ searchParams: Promise.resolve({ brand: "Xiaomi", category: "phone", series: "xiaomi.phone.redmi-k-pro.standard" }) }));
assert.ok(oldRedmiLink.includes('<option value="Redmi" selected="">红米</option>'), "旧的小米品牌红米系列链接应兼容拆分后的品牌");
assert.ok(oldRedmiLink.includes('/devices/redmi-k20-2019') && oldRedmiLink.includes('/devices/redmi-k20-pro-2019'), "设备库合并系列包含标准版与 Pro，不丢型号");
assert.ok(!oldRedmiLink.includes('/devices/xiaomi-17-2025'), "红米系列结果不混入小米设备");
const oldSamsungLink = renderPage(await DevicesPage({ searchParams: Promise.resolve({ brand: "Samsung", category: "phone", series: "samsung.phone.galaxy-s-fe.standard" }) }));
const samsungS = catalogFamilies.find(group => group.label === "Galaxy S 系列");
assert.ok(oldSamsungLink.includes(`value="${samsungS.key}" selected=""`), "旧的 FE 链接应兼容整合后的 Galaxy S 系列");
assert.ok(!oldSamsungLink.includes('/devices/samsung-galaxy-z-fold5-2023'), "Galaxy S 筛选不能混入 Galaxy Z 型号");
const DeviceDetailPage = loadTsModule("./src/app/devices/[id]/page.tsx").default;
const { getSpecGridPositions } = loadTsModule("./src/components/DeviceSpecGrid.tsx");
const cardRows = [309, 406, 360, 733, 131, 341, 483, 280];
const balancedCards = getSpecGridPositions(cardRows, 2);
assert.deepEqual(balancedCards.slice(0, 2).map(({column, row}) => [column, row]), [[1, 1], [2, 1]], "价格与性能仍在顶部");
const columnBottoms = [1, 2].map(column => {
  const positions = balancedCards.filter(position => position.column === column).sort((a, b) => a.row - b.row);
  let bottom = 1;
  for (const position of positions) {
    assert.equal(position.row, bottom, "每列卡片连续填补空白，不重叠或拆开分类");
    bottom += position.span;
  }
  return bottom;
});
assert.ok(Math.abs(columnBottoms[0] - columnBottoms[1]) < 32, "典型长影像卡片不再造成两列整体失衡");
const expandedRows = cardRows.map((height, index) => index === 5 ? height + 500 : height);
const expandedCards = getSpecGridPositions(expandedRows, 2, balancedCards);
assert.deepEqual(expandedCards.map(position => position.column), balancedCards.map(position => position.column),
  "展开接口等任意详情不能让卡片从左列跳到右列");
for (const column of [1, 2]) {
  const order = positions => positions.map((position, index) => ({...position, index}))
    .filter(position => position.column === column).sort((a, b) => a.row - b.row);
  const before = order(balancedCards);
  const after = order(expandedCards);
  assert.deepEqual(after.map(position => position.index), before.map(position => position.index), "同列分类顺序也不能因展开而改变");
  for (let index = 1; index < after.length; index++) assert.equal(after[index].row, after[index - 1].row + after[index - 1].span,
    "展开后只推动同列后续卡片，间距连续且不重叠");
  assert.equal(after[0].row, 1);
}
assert.deepEqual(getSpecGridPositions(cardRows, 2, expandedCards), balancedCards, "收起后恢复原位置");
const singleColumn = getSpecGridPositions(cardRows, 1);
assert.ok(singleColumn.every((position, index) => position.column === 1 && position.row === 1 + cardRows.slice(0, index).reduce((sum, height) => sum + height, 0)),
  "手机端保持原始参数分类顺序");
assert.deepEqual(getSpecGridPositions([], 2), []);
assert.deepEqual(getSpecGridPositions([309], 2), [{column: 1, row: 1, span: 309}]);
const detailDevice = devices.get("iphone-18-pro");
const detailMarkup = renderPage(await DeviceDetailPage({ params: Promise.resolve({ id: detailDevice.id }) }));
assert.ok(detailMarkup.includes('class="device-spec-panel"') && detailMarkup.includes('class="card device-spec-group" aria-label="性能参数"'),
  "详细参数使用双列分类卡片，卡片不设等高拉伸");
assert.equal((detailMarkup.match(/class="card device-spec-group"/g) ?? []).length,
  new Set(getDeviceSpecFields([detailDevice]).map(field => field.group)).size + 1, "每个参数分类独立成卡片，保留价格在最前");
assert.ok(detailMarkup.includes('<dt class="device-spec-label">运行内存</dt><dd class="device-spec-value"><p>12GB</p></dd><dd class="device-spec-note">'),
  "补充说明单独显示，不能混在主要参数中或挤压字段名称");
assert.ok(detailMarkup.includes(renderToStaticMarkup(createElement("dd", { className: "device-spec-note" },
  createElement("span", null, "说明"), detailDevice.specs.memoryNote))),
  "备注不能在布局调整时被删除或改写");
const { getCameraDetailPresentation } = loadTsModule("./src/lib/device-spec-fields.ts");
const cameraPresentation = getCameraDetailPresentation(detailDevice);
assert.ok(!detailMarkup.includes('<dt class="device-spec-label">后置摄像头</dt>') && detailMarkup.includes('<dt class="device-spec-label">影像补充</dt>'),
  "已有镜头分项时去掉重复总述，只显示未覆盖的影像补充");
for (const key of ["mainCamera", "ultraWide", "telephoto"]) assert.ok(!cameraPresentation.supplement.includes(detailDevice.specs[key]), "影像补充不能再重复分项");
assert.ok(cameraPresentation.supplement.includes("同时支持 1200 万像素光学品质的 2 倍长焦功能"), "总述中特有的 2 倍长焦说明不丢失");
for (const part of cameraPresentation.supplement.split("；")) assert.ok(detailMarkup.includes(renderToStaticMarkup(createElement("li", null, part))), "未重复的原文完整保留");
const cameraFixture = { ...detailDevice, specs: {mainCamera:"50MP 主摄", ultraWide:"12MP 超广角", rearCamera:"50MP 主摄；12MP 超广角"} };
assert.equal(getCameraDetailPresentation(cameraFixture).supplement, "", "完全重复的总述无需补充行");
assert.equal(getCameraDetailPresentation({...cameraFixture, specs:{rearCamera:"双摄系统", mainCamera:"50MP 主摄"}}).supplement, undefined,
  "镜头分项不足时保留总述，不假装完整");
assert.ok(getCameraDetailPresentation(devices.get("oppo-find-x9-2025")).supplement.includes("5000 万像素超广角摄像头"),
  "安卓机未建立分项的镜头仍保留原文，不因去重而丢失");
const legacyCamera = getCameraDetailPresentation(devices.get("iphone-13"));
assert.deepEqual(legacyCamera.omittedLensKeys, ["mainCamera", "ultraWide"]);
assert.equal(legacyCamera.supplement, undefined, "历史双摄总述不能伪装成两条独立镜头规格");
assert.deepEqual(getCameraDetailPresentation({...detailDevice, specs:{mainCamera:"主摄及超广角",ultraWide:"主摄及超广角"}}).omittedLensKeys, [],
  "总述缺失时不能删除唯一已知的镜头信息");
const legacyCameraMarkup = renderPage(await DeviceDetailPage({ params: Promise.resolve({id:"iphone-13"}) }));
assert.ok(legacyCameraMarkup.includes('<dt class="device-spec-label">后置摄像头</dt>') && !legacyCameraMarkup.includes('<dt class="device-spec-label">主摄</dt>'),
  "重复且未细分的镜头改为保留一条完整总述");
assert.ok(!detailMarkup.includes("<details") && !detailMarkup.includes("<summary") && !detailMarkup.includes("device-spec-preview"),
  "参数完整显示，不使用详情折叠或截断摘要");
for (const field of getDeviceSpecFields([detailDevice]).filter(field => ["mainCamera", "ultraWide", "telephoto", "displayType", "port"].includes(field.key))) {
  const parts = splitDeviceSpecDescription(formatDeviceSpec(detailDevice, field));
  const hasIntroduction = parts.length > 1 && /[:：]$/.test(parts[0]);
  for (const [index, part] of parts.entries()) assert.ok(detailMarkup.includes(renderToStaticMarkup(createElement(
    parts.length > 1 && !(hasIntroduction && index === 0) ? "li" : "p", null, part))),
  `${field.label}: 原文完整显示，引导句与并列能力分开排版`);
}
assert.ok(detailMarkup.includes('<p>USB‑C 接口，支持：</p><ul><li>DisplayPort</li><li>USB 3 (最高可达 10Gb/s)</li></ul>'),
  "接口引导句不能与支持的两项能力混成三个并列规格");
const detailPrices = getPricesForComparison(detailDevice, "current");
assert.ok(detailPrices.length > 1);
assert.ok(detailMarkup.includes('<div class="device-spec-row is-detailed"><dt class="device-spec-label">当前价</dt><dd class="device-spec-value"><ul class="device-spec-quotes">'),
  "多配置报价直接展开，配置与金额分列对齐");
for (const price of detailPrices) assert.ok(detailMarkup.includes(renderToStaticMarkup(createElement("li", null,
  createElement("span", null, formatConfiguration(price.configuration)),
  createElement("strong", null, `${formatMaybeCurrency(price.value)}${price.estimated ? "（预估）" : ""}`)))),
"各配置价格均独立保留，不进入折叠摘要");
for (const id of ["ipad-pro-m4-11-2024", "macbook-air-13-m3-2024"]) {
  const pageMarkup = renderPage(await DeviceDetailPage({ params: Promise.resolve({ id }) }));
  for (const field of getDeviceSpecFields([devices.get(id)]).filter(field => ["chargingMethod", "powerAdapter"].includes(field.key))) {
    const parts = splitDeviceSpecDescription(formatDeviceSpec(devices.get(id), field));
    for (const part of parts) assert.ok(pageMarkup.includes(
      renderToStaticMarkup(createElement(parts.length > 1 ? "li" : "p", null, part))), "充电和适配器的括号内配置条件完整显示");
  }
  for (const key of ["chip", "memory", "cpu", "gpu"]) {
    const field = getDeviceSpecFields([devices.get(id)]).find(field => field.key === key);
    if (!field) continue;
    for (const line of formatDeviceSpec(devices.get(id), field).split("\n")) assert.ok(pageMarkup.includes(
      renderToStaticMarkup(createElement("p", null, line))), "配置对应的硬件差异不折叠或只展示第一条");
    if (devices.get(id).specs[`${key}Note`]) assert.ok(pageMarkup.includes(renderToStaticMarkup(createElement("dd", {className:"device-spec-note"},
      createElement("span", null, "说明"), devices.get(id).specs[`${key}Note`]))), "CPU/RAM 的存储条件保持直接可见");
  }
}
const androidDetail = renderPage(await DeviceDetailPage({ params: Promise.resolve({ id: androidPhone.id }) }));
assert.ok(androidDetail.includes('<dt class="device-spec-label">电池容量</dt>') && !androidDetail.includes('<dt class="device-spec-label">神经引擎</dt>'),
  "新布局保留品牌自身的参数类型，不套用 Apple 的字段");
const { CustomCompareContent } = loadTsModule("./src/components/CustomCompareContent.tsx");
const crossQuery = { device1: "iphone-17", device2: "xiaomi-17-2025", device3: "" };
const crossMarkup = renderPage(createElement(CustomCompareContent, { query: crossQuery }));
assert.ok(crossMarkup.includes('aria-label="品牌 1"') && crossMarkup.includes('aria-label="产品系列 1"') && crossMarkup.includes('aria-label="具体型号 1"'));
assert.ok(!crossMarkup.includes("配置 1") && !crossMarkup.includes("所选配置"));
for (const amount of [5099, 5199, 5499]) assert.ok(crossMarkup.includes(formatMaybeCurrency(amount)), "跨品牌对比不得只保留第一配置或前两笔价格");
assert.equal(renderPage(createElement(CustomCompareContent, { query: { ...crossQuery, config1: "2GB|64GB", config2: "12GB|256GB" } })), crossMarkup,
  "历史配置链接不能重新过滤参数与报价");
assert.ok(!renderPage(createElement(CustomCompareContent, { query: { device1: "", device2: "", device3: "" } })).includes("compare-overview-card"),
  "清空全部选择不能自动恢复默认设备");
const ComparePage = loadTsModule("./src/app/compare/page.tsx").default;
const sameQuery = { brand: "Apple", series: "iPhone::standard" };
const sameMarkup = renderPage(await ComparePage({ searchParams: Promise.resolve(sameQuery) }));
assert.ok(!sameMarkup.includes('id="compare-storage"') && sameMarkup.includes("运行内存") && sameMarkup.includes("存储"));
assert.equal(renderPage(await ComparePage({ searchParams: Promise.resolve({ ...sameQuery, storage: "64GB" }) })), sameMarkup);
const AdvisorPanel = loadTsModule("./src/components/DeviceAdvisorPanel.tsx").default;
const advisorMarkup = renderPage(createElement(AdvisorPanel, { initialCategory: "phone", categories: ["phone", "tablet", "laptop"] }));
assert.ok(!advisorMarkup.includes("最低运行内存") && !advisorMarkup.includes("最低存储空间") && !advisorMarkup.includes("配置要求（可选）"));
for (const id of ["ipad-pro-m4-11-2024", "ipad-pro-m5-11-2025"]) {
  assert.match(devices.get(id).specs.cpuNote, /256GB 或 512GB 存储容量机型：9 核/);
  assert.match(devices.get(id).specs.cpuNote, /1TB 或 2TB 存储容量机型：10 核/);
  assert.match(devices.get(id).specs.memoryNote, /1TB 或 2TB 存储容量机型：16GB/);
  assert.ok(!devices.get(id).specs.memoryNote.includes("内存带宽"));
}
for (const id of ["ipad-pro-11-m1-2021", "ipad-pro-m2-2022"]) assert.match(devices.get(id).specs.memoryNote,
  /8GB 内存 \(存储容量为 128GB、256GB 或 512GB 的机型\).*16GB 内存 \(存储容量为 1TB 或 2TB 的机型\)/);
for (const [group, ids] of [
  ["xiaomi.tablet.pad.standard", ["xiaomi-pad-6-2023", "xiaomi-pad-7-2024", "xiaomi-pad-8-2025"]],
  ["xiaomi.tablet.pad-pro.standard", ["xiaomi-pad-6-pro-2023", "xiaomi-pad-7-pro-2024", "xiaomi-pad-8-pro-2025"]],
  ["huawei.tablet.matepad-11-5.standard", ["huawei-matepad-11-5-2024", "huawei-matepad-11-5-2026"]],
  ["huawei.laptop.matebook-14.standard", ["huawei-matebook-14-2022", "huawei-matebook-14-2023", "huawei-matebook-14-2024", "huawei-matebook-14-harmonyos-2026"]],
]) assert.deepEqual(getDevicesByComparisonGroupKeyFlat(group).map((device) => device.id).filter((id) => ids.includes(id)), ids,
  `${group}: 扩容后仍须保留原有型号及其顺序`);
assert.equal(devices.get("huawei-matepad-11-5-2023").comparisonGroupId, "huawei.tablet.matepad-11-5.standard");
const redmiPro16 = devices.get("redmi-book-pro-16-2024");
assert.deepEqual(devices.get("xiaomi-book-pro-15-2017").configurations.map(({ memory, storage, chip }) => [memory, storage, chip]), [
  ["16GB", "256GB", "Intel 酷睿i7 8550U"], ["8GB", "256GB", "Intel 酷睿i7 8550U"], ["8GB", "256GB", "Intel 酷睿i5 8250U"],
], "2017 官方三个处理器/内存组合逐项保留，不能生成 16GB i5");
assert.match(getPriceConfiguration(redmiPro16, { configuration: "Ultra7 155H，32GB 运行内存 + 1TB 存储，国行" })?.chip, /Ultra7 155H/);
assert.match(getPriceConfiguration(redmiPro16, allDevices.find((device) => device.id === redmiPro16.id).specs.launchPrice)?.chip, /Ultra5 125H/);
assert.equal(getPriceConfiguration(redmiPro16, { configuration: "32GB 运行内存 + 1TB 存储，国行" })?.chip, undefined,
  "same RAM/storage cannot arbitrarily choose the first CPU");
assert.equal(getPriceConfiguration(redmiPro16, { configuration: "Ultra9 185H，32GB 运行内存 + 1TB 存储，国行" }), null);
for (const id of ["redmi-book-pro-14-2024", "redmi-book-pro-16-2024"]) assert.equal(devices.get(id).specs.gpu, undefined,
  "conflicting third-party Iris Xe entries cannot become Core Ultra GPU facts");
const matePad2022 = devices.get("huawei-matepad-pro-11-2022");
for (const chip of ["骁龙870", "骁龙888"]) assert.match(
  getPriceConfiguration(matePad2022, { configuration: `${chip}，8GB 运行内存 + 128GB 存储，国行` })?.chip, new RegExp(chip));
assert.match(matePad2022.specs.gpu, /骁龙870：.*650.*骁龙888：.*660/,
  "different chip versions must not inherit the first version GPU");
assert.deepEqual(getDeviceConfigurations(devices.get("huawei-matepad-11-5-2026")).map((item) => item.key), ["8GB|128GB"],
  "standard-screen 2026 MatePad must not inherit PaperMatte or cellular configurations");
assert.equal(devices.get("huawei-matepad-11-5-2024").launchPrice, 1699, "coupon price must not replace China launch list price");
assert.deepEqual(getDeviceConfigurations(devices.get("huawei-matebook-14-harmonyos-2026")).map((item) => item.key),
  ["24GB|512GB", "24GB|1TB", "32GB|1TB"], "HarmonyOS laptop must retain only named standard-screen SKUs");
for (const [id, expected] of [
  ["oppo-find-x9-2025", [["12GB|256GB", 4599], ["12GB|512GB", 5299], ["16GB|512GB", 5599]]],
  ["xiaomi-17-2025", [["12GB|256GB", 5099], ["12GB|512GB", 5199], ["16GB|512GB", 5499]]],
]) {
  assert.deepEqual(getPricesForComparison(devices.get(id), "current").map((price) => [price.configuration.key, price.value]), expected,
    "historical models must retain distinct RAM/storage prices, not promotional or launch amounts");
}
const m1Air = devices.get("macbook-air-13-m1-2020");
const m4Air = devices.get("macbook-air-13-m4-2025");
const honor8Prices = getPricesForComparison(devices.get("honor-magic8-pro-2025"), "current");
assert.equal(honor8Prices.find((price) => price.configuration.key === "12GB|512GB")?.value, 5699);
assert.equal(honor8Prices.find((price) => price.configuration.key === "12GB|512GB")?.estimated, true);
assert.equal(honor8Prices.find((price) => price.configuration.key === "16GB|1TB")?.estimated, false);
assert.equal(honor8Prices.find((price) => price.configuration.key === "16GB|1TB")?.value, 6699);
assert.ok(honor8Prices.some((price) => price.configuration.key === "16GB|512GB" && price.value === 5999), "new tiers must not overwrite the existing 16GB/512GB quote");
const newAirQuote = m4Air.currentPrices.find((price) => !price.excludedReason);
assert.ok(newAirQuote);
for (const condition of ["全新仅拆封", "全新已开封", "二手公开价", "全新资源机", "全新，自营退货", "准新品，基本全新", "全新翻新机", "公开价"]) {
  const device = { ...m4Air, currentPrices: [{ ...newAirQuote, condition }] };
  assert.deepEqual(getValidPriceFields(device, "current"), [], `${condition} must not reach comparison or advisor as new`);
}
for (const condition of ["全新，未拆封", "全新原封", "全新，未开封，公开价"]) {
  assert.equal(getValidPriceFields({ ...m4Air, currentPrices: [{ ...newAirQuote, condition }] }, "current").length, 1);
}
for (const chip of ["M3", "M4 Pro", "M4 Max", "M4 / M3"]) {
  assert.equal(getPriceConfiguration(m4Air, { configuration: `${chip}，16GB 运行内存 + 512GB 存储，国行` }), null);
}
assert.equal(getPriceConfiguration(m4Air, { configuration: "Apple m4，16GB 运行内存 + 512GB 存储，国行" })?.chip, "Apple M4 芯片");
assert.equal(m1Air.configurations.length, 15);
assert.match(m1Air.specs.gpu, /7 核图形处理器.*8 核图形处理器/);
assert.equal(getPriceConfiguration(m1Air, { configuration: "8GB 运行内存 + 128GB 存储，7 核 GPU，国行" })?.gpuCores, 7);
assert.equal(getPriceConfiguration(m1Air, { configuration: "16GB 运行内存 + 128GB 存储，国行" }), null);
assert.equal(getPriceConfiguration(m1Air, { configuration: "8GB 运行内存 + 256GB 存储，8 核 GPU，国行" }), null);
assert.equal(getPriceConfiguration(m1Air, { configuration: "16GB 运行内存 + 2TB 存储，8 核 GPU，国行" })?.gpuCores, 8);
const m2Air = devices.get("macbook-air-13-m2-2022");
assert.equal(m2Air.configurations.length, 23);
for (const gpu of [8, 10]) {
  assert.equal(getPriceConfiguration(m2Air, { configuration: `24GB 运行内存 + 512GB 存储，${gpu} 核 GPU，国行` })?.gpuCores, gpu);
}
assert.equal(getPriceConfiguration(m2Air, { configuration: "16GB 运行内存 + 256GB 存储，10 核 GPU，国行" })?.gpuCores, 10);
assert.equal(getPriceConfiguration(m2Air, { configuration: "8GB 运行内存 + 256GB 存储，10 核 GPU，国行" }), null);
for (const [id, count, lowMemories] of [
  ["macbook-air-13-m3-2024", 14, ["8GB", "16GB"]],
  ["macbook-air-13-m4-2025", 13, ["16GB"]],
]) {
  const air = devices.get(id);
  assert.equal(air.configurations.length, count);
  assert.equal(getDeviceConfigurations(air).length, 12);
  assert.deepEqual(air.configurations.filter((c) => c.gpuCores === 8).map((c) => `${c.memory}|${c.storage}`), lowMemories.map((m) => `${m}|256GB`));
  assert.equal(getPriceConfiguration(air, { configuration: "24GB 运行内存 + 512GB 存储，8 核 GPU，国行" }), null);
  assert.equal(getPriceConfiguration(air, { configuration: "24GB 运行内存 + 512GB 存储，国行" })?.gpuCores, 10);
  assert.equal(getPriceConfiguration(air, { configuration: "16GB 运行内存 + 256GB 存储，国行" })?.gpuCores, undefined);
  assert.equal(getPriceConfiguration(air, { configuration: "16GB 运行内存 + 256GB 存储，10 核 GPU，国行" })?.gpuCores, 10);
}
const m1Max14 = devices.get("macbook-pro-14-m1-max-2021");
assert.equal(m1Max14.configurations.length, 20);
assert.equal(getDeviceConfigurations(m1Max14).length, 10);
for (const gpu of [24, 32]) {
  const quote = { configuration: `64GB 运行内存 + 512GB 存储，M1 Max 10 核 CPU / ${gpu} 核 GPU，国行` };
  assert.equal(getPriceConfiguration(m1Max14, quote)?.gpuCores, gpu);
}
assert.equal(getPriceConfiguration(m1Max14, { configuration: "64GB 运行内存 + 8TB 存储，国行" })?.gpuCores, undefined);
assert.equal(getPriceConfiguration(m1Max14, { configuration: "16GB 运行内存 + 512GB 存储，国行" }), null);
assert.equal(getPriceConfiguration(m1Max14, { configuration: "32GB 运行内存 + 1TB 存储，16 核 GPU，国行" }), null);
const m1Pro14 = devices.get("macbook-pro-14-m1-pro-2021");
assert.match(m1Pro14.specs.cpu, /8 核中央处理器/);
assert.match(m1Pro14.specs.cpu, /10 核中央处理器/);
assert.match(m1Pro14.specs.gpu, /14 核图形处理器/);
assert.match(m1Pro14.specs.gpu, /16 核图形处理器/);
assert.doesNotMatch(m1Pro14.specs.cpu + m1Pro14.specs.gpu, /M1 Max|24 核图形处理器|32 核图形处理器/);
for (const id of ["macbook-pro-14-m1-max-2021", "macbook-pro-16-m1-max-2021"]) {
  const device = devices.get(id);
  assert.doesNotMatch(device.specs.cpu, /8 核中央处理器/);
  assert.doesNotMatch(device.specs.gpu, /14 核图形处理器|16 核图形处理器/);
  assert.match(device.specs.cpu, /10 核中央处理器/);
  assert.match(device.specs.gpu, /24 核图形处理器/);
  assert.match(device.specs.gpu, /32 核图形处理器/);
}
assert.match(devices.get("macbook-pro-16-m2-max-2023").specs.gpu, /30 核图形处理器/);
assert.match(devices.get("macbook-pro-16-m2-max-2023").specs.gpu, /38 核图形处理器/);
assert.doesNotMatch(devices.get("macbook-pro-16-m2-max-2023").specs.gpu, /19 核图形处理器/);
for (const [id, lens] of [
  ["iphone-12-pro", /^长焦：/], ["iphone-12-pro-max", /^长焦：/],
  ["iphone-13-pro", /^长焦：/], ["iphone-13-pro-max", /^长焦：/],
  ["iphone-14-pro", /3 倍长焦/], ["iphone-14-pro-max", /3 倍长焦/],
  ["iphone-15-pro", /3 倍长焦/], ["iphone-15-pro-max", /5 倍长焦/],
  ["iphone-16-pro", /5 倍长焦/], ["iphone-16-pro-max", /5 倍长焦/],
  ["iphone-17-pro", /4800 万像素融合式长焦/], ["iphone-17-pro-max", /4800 万像素融合式长焦/],
]) {
  assert.match(devices.get(id).specs.telephoto, lens);
  assert.doesNotMatch(devices.get(id).specs.telephoto, /同时支持|通过四合一像素传感器实现/);
}
for (const id of ["iphone-17-pro", "iphone-17-pro-max"]) {
  assert.match(devices.get(id).specs.mainCamera, /4800 万像素融合式主摄/);
}
for (const id of ["iphone-18-pro", "iphone-18-pro-max"]) {
  const device = devices.get(id);
  assert.equal(device.specs.memory, "12GB");
  assert.match(device.specs.mainCamera, /主摄.*可变光圈/);
  assert.match(device.specs.telephoto, /4800 万像素融合式长焦/);
  assert.deepEqual(getDeviceConfigurations(device).map((configuration) => configuration.key), ["12GB|256GB", "12GB|512GB", "12GB|1TB", "12GB|2TB"]);
  assert.equal(getPriceConfiguration(device, { configuration: "2GB 运行内存 + 256GB 存储，国行" }), null);
  assert.equal(device.releaseDate, "2026-09-18");
  assert.deepEqual(getPricesForComparison(device, "current").map((price) => price.value),
    id === "iphone-18-pro" ? [9999, 11999, 15499, 20499] : [10999, 12999, 16499, 21499]);
  assert.equal(getPricesForComparison(device, "used").length, 0);
}
for (const [id, count, memory, storage, cpu] of [
  ["macbook-air-13-intel-2020", 8, "16GB", "2TB", undefined],
  ["macbook-pro-13-2-port-2020", 8, "16GB", "2TB", 4],
  ["macbook-pro-13-4-port-2020", 8, "32GB", "4TB", 4],
  ["macbook-pro-15-2018", 10, "32GB", "4TB", 6],
  ["macbook-pro-15-2019", 10, "32GB", "4TB", undefined],
  ["macbook-pro-16-2019", 15, "64GB", "8TB", undefined],
  ["macbook-12-2017", 4, "16GB", "512GB", 2],
]) {
  const device = devices.get(id);
  assert.equal(getDeviceConfigurations(device).length, count);
  const configuration = getPriceConfiguration(device, { configuration: `${memory} 运行内存 + ${storage} 存储，国行` });
  assert.ok(configuration);
  assert.equal(configuration.cpuCores, cpu, "mixed CPU tiers must remain unknown without a quote-specific processor");
  assert.equal(configuration.chip, undefined);
}
for (const [id, count, cpu] of [
  ["macbook-pro-13-2-port-2016", 6, 2], ["macbook-pro-13-4-port-2016", 6, 2],
  ["macbook-pro-13-2-port-2017", 8, 2], ["macbook-pro-13-4-port-2017", 6, 2],
  ["macbook-pro-13-4-port-2018", 8, 4], ["macbook-pro-13-2-port-2019", 10, 4],
  ["macbook-pro-13-4-port-2019", 8, 4],
]) {
  const device = devices.get(id);
  assert.equal(getDeviceConfigurations(device).length, count);
  const quote = { configuration: "16GB 运行内存 + 1TB 存储，国行" };
  assert.equal(getPriceConfiguration(device, quote)?.cpuCores, cpu);
  assert.equal(getPriceConfiguration(device, quote)?.chip, undefined, "RAM/storage alone cannot identify an Intel processor variant");
  assert.equal(getPriceConfiguration(device, { configuration: `${quote.configuration}，8 核 CPU` }), null);
}
for (const [year, maximum] of [[2018, "1.5TB"], [2019, "1TB"]]) {
  const air = devices.get(`macbook-air-13-${year}`);
  assert.equal(getDeviceConfigurations(air).length, 8);
  assert.equal(getPriceConfiguration(air, { configuration: `16GB 运行内存 + ${maximum} 存储，国行` })?.cpuCores, 2);
  assert.equal(getPriceConfiguration(air, { configuration: "16GB 运行内存 + 2TB 存储，国行" }), null);
}
for (const [id, expected] of [
  ["macbook-pro-14-m5-pro-2026", [["48GB|1TB",26749],["64GB|2TB",33499]]],
  ["macbook-pro-16-m5-2026", [["48GB|1TB",29499],["64GB|2TB",36249]]],
  ["macbook-pro-14-m5-max-2026", [["48GB|2TB",38499],["64GB|2TB",41499]]],
  ["macbook-pro-16-m5-max-2026", [["48GB|2TB",40999],["64GB|2TB",43999]]],
]) {
  const prices = getPricesForComparison(devices.get(id), "current");
  assert.equal(prices.length, id.includes("max") ? 12 : 9);
  assert.deepEqual(new Set(prices.map((price) => price.configuration.key)), new Set(getDeviceConfigurations(devices.get(id)).map((configuration) => configuration.key)), "M5 Pro/Max quotes cover each verified RAM/storage pair without inventing CPU tiers");
  for (const [key, value] of expected) assert.equal(prices.find((p) => p.configuration.key === key)?.value, value);
}
for (const [id, key, value] of [["macbook-air-15-m4-2025", "24GB|1TB", 10799]]) {
  const prices = getPricesForComparison(devices.get(id), "used");
  assert.equal(prices.find((price) => price.configuration.key === key)?.value, value);
  assert.ok(prices.some((price) => price.configuration.key !== key), "simple reference-price additions must preserve earlier configurations");
}
const m5Max14 = devices.get("macbook-pro-14-m5-max-2026");
for (const [id, count, memory, cpu, gpu] of [
  ["macbook-air-15-m4-2025", 12, "32GB", 10, 10],
  ["macbook-air-15-m3-2024", 12, "24GB", 8, 10],
  ["macbook-air-15-m2-2023", 12, "24GB", 8, 10],
  ["macbook-pro-13-m1-2020", 8, "16GB", 8, 8],
  ["macbook-pro-13-m2-2022", 12, "24GB", 8, 10],
]) {
  const device = devices.get(id);
  assert.equal(getDeviceConfigurations(device).length, count);
  const quote = { configuration: `${memory} 运行内存 + 2TB 存储，国行` };
  assert.equal(getPriceConfiguration(device, quote)?.cpuCores, cpu);
  assert.equal(getPriceConfiguration(device, quote)?.gpuCores, gpu);
  assert.equal(getPriceConfiguration(device, { configuration: `${quote.configuration}，16 核 GPU` }), null);
}
for (const size of [14, 16]) {
  const max = devices.get(`macbook-pro-${size}-m2-max-2023`);
  assert.equal(max.configurations.length, 20);
  assert.equal(getDeviceConfigurations(max).length, 12);
  assert.equal(getPriceConfiguration(max, { configuration: "96GB 运行内存 + 8TB 存储，30 核 GPU，国行" }), null);
  assert.equal(getPriceConfiguration(max, { configuration: "96GB 运行内存 + 8TB 存储，国行" })?.gpuCores, 38);
}
for (const [id, count, invalidCores] of [
  ["macbook-pro-14-m2-pro-2023", 20, "10 核 CPU / 19 核 GPU"],
  ["macbook-pro-16-m2-2023", 10, "10 核 CPU / 16 核 GPU"],
  ["macbook-pro-14-m1-pro-2021", 30, "8 核 CPU / 16 核 GPU"],
  ["macbook-pro-16-m1-pro-2021", 10, "10 核 CPU / 14 核 GPU"],
]) {
  const device = devices.get(id);
  assert.equal(device.configurations.length, count);
  assert.equal(getPriceConfiguration(device, { configuration: `16GB 运行内存 + 512GB 存储，${invalidCores}，国行` }), null);
}
assert.equal(devices.get("macbook-pro-16-m1-max-2021").configurations.length, 16);
assert.equal(getPriceConfiguration(devices.get("macbook-pro-16-m1-max-2021"), { configuration: "64GB 运行内存 + 8TB 存储，24 核 GPU，国行" })?.cpuCores, 10);
for (const [id, count, cpu] of [["macbook-pro-14-m5-2025", 12, 10], ["macbook-pro-14-m4-2024", 9, 10], ["macbook-pro-14-m3-2023", 9, 8]]) {
  const device = devices.get(id);
  assert.equal(getDeviceConfigurations(device).length, count);
  assert.equal(getPriceConfiguration(device, { configuration: "16GB 运行内存 + 1TB 存储，国行" })?.cpuCores, cpu);
  assert.equal(getPriceConfiguration(device, { configuration: "16GB 运行内存 + 1TB 存储，8 核 GPU，国行" }), null);
}
for (const size of [14, 16]) {
  const max = devices.get(`macbook-pro-${size}-m3-max-2023`);
  assert.equal(getDeviceConfigurations(max).length, 20);
  assert.equal(getPriceConfiguration(max, { configuration: "96GB 运行内存 + 8TB 存储，国行" })?.cpuCores, 14);
  assert.equal(getPriceConfiguration(max, { configuration: "96GB 运行内存 + 8TB 存储，16 核 CPU / 40 核 GPU，国行" }), null);
  assert.equal(getPriceConfiguration(max, { configuration: "48GB 运行内存 + 1TB 存储，14 核 CPU / 30 核 GPU，国行" }), null);
}
const m3Pro14 = devices.get("macbook-pro-14-m3-pro-2023");
const m3Pro16 = devices.get("macbook-pro-16-m3-pro-2023");
assert.equal(m3Pro14.configurations.length, 16);
assert.equal(getDeviceConfigurations(m3Pro14).length, 8);
assert.equal(getDeviceConfigurations(m3Pro16).length, 8);
assert.equal(getPriceConfiguration(m3Pro14, { configuration: "18GB 运行内存 + 512GB 存储，11 核 CPU / 18 核 GPU，国行" }), null);
assert.equal(getPriceConfiguration(m3Pro16, { configuration: "18GB 运行内存 + 512GB 存储，11 核 CPU / 14 核 GPU，国行" }), null);
for (const size of [14, 16]) {
  const max = devices.get(`macbook-pro-${size}-m4-max-2024`);
  assert.equal(getDeviceConfigurations(max).length, 16);
  assert.equal(getPriceConfiguration(max, { configuration: "36GB 运行内存 + 1TB 存储，16 核 CPU / 40 核 GPU，国行" }), null);
  assert.equal(getPriceConfiguration(max, { configuration: "64GB 运行内存 + 2TB 存储，14 核 CPU / 32 核 GPU，国行" }), null);
  assert.equal(getPriceConfiguration(max, { configuration: "128GB 运行内存 + 8TB 存储，国行" })?.cpuCores, 16);
}
const m4Pro14 = devices.get("macbook-pro-14-m4-pro-2024");
const m4Pro16 = devices.get("macbook-pro-16-m4-2024");
assert.equal(m4Pro14.configurations.length, 16);
assert.equal(getDeviceConfigurations(m4Pro14).length, 8);
assert.equal(getDeviceConfigurations(m4Pro16).length, 8);
assert.equal(getPriceConfiguration(m4Pro14, { configuration: "48GB 运行内存 + 512GB 存储，12 核 CPU / 20 核 GPU，国行" }), null);
assert.equal(getPriceConfiguration(m4Pro16, { configuration: "24GB 运行内存 + 512GB 存储，12 核 CPU / 16 核 GPU，国行" }), null);
const m5Pro16 = devices.get("macbook-pro-16-m5-2026");
const m5Pro14 = devices.get("macbook-pro-14-m5-pro-2026");
assert.equal(m5Pro14.configurations.length, 15);
assert.equal(getDeviceConfigurations(m5Pro14).length, 9);
assert.equal(getPriceConfiguration(m5Pro14, { configuration: "64GB 运行内存 + 1TB 存储，15 核 CPU / 16 核 GPU，国行" }), null);
assert.equal(getPriceConfiguration(m5Pro14, { configuration: "48GB 运行内存 + 2TB 存储，15 核 CPU / 20 核 GPU，国行" }), null);
assert.equal(getPriceConfiguration(m5Pro14, { configuration: "64GB 运行内存 + 1TB 存储，国行" })?.gpuCores, 20);
assert.equal(getPriceConfiguration(m5Pro14, { configuration: "24GB 运行内存 + 1TB 存储，国行" })?.gpuCores, undefined);
const m5Max16 = devices.get("macbook-pro-16-m5-max-2026");
assert.equal(getDeviceConfigurations(m5Pro16).length, 9);
assert.equal(getDeviceConfigurations(m5Max16).length, 12);
assert.equal(getPriceConfiguration(m5Pro16, { configuration: "24GB 运行内存 + 1TB 存储，15 核 CPU / 16 核 GPU，国行" }), null, "the 14-inch low CPU tier is not a 16-inch configuration");
assert.equal(getPriceConfiguration(m5Pro16, { configuration: "64GB 运行内存 + 4TB 存储，国行" })?.cpuCores, 18);
assert.equal(getPriceConfiguration(m5Max16, { configuration: "36GB 运行内存 + 2TB 存储，40 核 GPU，国行" }), null);
assert.equal(getPriceConfiguration(m5Max16, { configuration: "128GB 运行内存 + 8TB 存储，国行" })?.gpuCores, 40);
assert.equal(getDeviceConfigurations(m5Max14).length, 12);
for (const [memory, gpu] of [["36GB", 40], ["48GB", 32], ["64GB", 32], ["128GB", 32]]) {
  assert.equal(getPriceConfiguration(m5Max14, { configuration: `${memory} 运行内存 + 2TB 存储，${gpu} 核 GPU，国行` }), null);
}
assert.equal(getPriceConfiguration(m5Max14, { configuration: "128GB 运行内存 + 8TB 存储，国行" })?.gpuCores, 40);
assert.equal(getPriceConfiguration(m5Max14, { configuration: "36GB 运行内存 + 2TB 存储，国行" })?.gpuCores, 32);
const coreConstrainedAir = { ...devices.get("macbook-air-13-m5-2026"), configurations: [
  { memory: "16GB", storage: "512GB", cpuCores: 10, gpuCores: 8 },
  { memory: "16GB", storage: "512GB", cpuCores: 10, gpuCores: 10 },
  { memory: "24GB", storage: "1TB", cpuCores: 10, gpuCores: 10 },
] };
assert.equal(getDeviceConfigurations(coreConstrainedAir).length, 2, "GPU variants must not duplicate RAM/storage selector options");
for (const cores of ["8 核 GPU", "12 核 CPU", "8 核 GPU、10 核 GPU"]) {
  assert.equal(getPriceConfiguration(coreConstrainedAir, { configuration: `24GB 运行内存 + 1TB 存储，${cores}，国行` }), null, "known CPU/GPU constraints must reject impossible or ambiguous quote variants");
}
assert.equal(getPriceConfiguration(coreConstrainedAir, { configuration: "24GB 运行内存 + 1TB 存储，国行" })?.gpuCores, 10);
assert.equal(getPriceConfiguration(coreConstrainedAir, { configuration: "16GB 运行内存 + 512GB 存储，国行" })?.gpuCores, undefined, "an ambiguous GPU tier must remain unknown");
assert.equal(getPriceConfiguration(coreConstrainedAir, { configuration: "16GB 运行内存 + 512GB 存储，8 核 GPU，国行" })?.gpuCores, 8);
const verifiedAirM5 = devices.get("macbook-air-13-m5-2026");
assert.equal(verifiedAirM5.configurations.length, 13);
assert.equal(getDeviceConfigurations(verifiedAirM5).length, 12);
assert.equal(getPriceConfiguration(verifiedAirM5, { configuration: "24GB 运行内存 + 1TB 存储，8 核 GPU，国行" }), null);
assert.equal(getPriceConfiguration(verifiedAirM5, { configuration: "16GB 运行内存 + 1TB 存储，8 核 GPU，国行" }), null);
assert.equal(getPricesForComparison(verifiedAirM5, "current").length, 13);
assert.equal(formatConfiguration(getPricesForComparison(verifiedAirM5, "current").find((price) => price.value === 10749).configuration), "16GB + 512GB（10 核 CPU / 10 核 GPU）");
const verifiedAir15M5 = devices.get("macbook-air-15-m5-2026");
assert.equal(verifiedAir15M5.configurations.length, 12);
assert.equal(getPricesForComparison(verifiedAir15M5, "current").length, 12);
assert.equal(getPriceConfiguration(verifiedAir15M5, { configuration: "16GB 运行内存 + 512GB 存储，8 核 GPU，国行" }), null);
assert.equal(getPricesForComparison(verifiedAir15M5, "current").find((price) => price.configuration.key === "32GB|4TB")?.value, 28499);
assert.ok(getPricesForComparison(verifiedAirM5, "current").every((price) => price.value !== 8000), "the unverified legacy mainland quote must stay excluded");
const verifiedProM5Prices = getPricesForComparison(devices.get("macbook-pro-14-m5-2025"), "current");
assert.equal(verifiedProM5Prices.length, 9);
assert.equal(verifiedProM5Prices.find((price) => price.configuration.key === "32GB|4TB")?.value, 30249);
assert.ok(!verifiedProM5Prices.some((price) => price.configuration.storage === "512GB"), "historically valid configurations must not acquire a current price by inference");
assert.equal(verifiedProM5Prices[0].value, 15999);
assert.equal(verifiedProM5Prices[0].configuration.key, "16GB|1TB");
assert.equal(getPricesForComparison(devices.get("macbook-pro-14-m5-2025"), "used").find((price) => price.configuration.key === "16GB|512GB")?.value, 10999);
assert.ok(!getPricesForComparison(devices.get("macbook-pro-14-m5-2025"), "used").some((price) => price.value === 11599), "the screen-replaced 1TB listing is not a normal used-price reference");
for (const [id, value] of [["macbook-air-15-m5-2026", 11699], ["macbook-pro-14-m5-2025", 14199]]) {
  const prices = getPricesForComparison(devices.get(id), "used");
  assert.equal(prices.find((price) => price.configuration.key === "24GB|1TB")?.value, value);
  if (id === "macbook-air-15-m5-2026") assert.ok(prices.some((price) => price.configuration.key === "16GB|512GB"), "larger used configurations must preserve existing base quotes");
}
for (const [id, memory, expected] of [["ipad-a16-2025", "6GB", [3799, 4299, 5999]], ["ipad-mini-a17-pro-2024", "8GB", [4799, 5299, 6999]]]) {
  const prices = getPricesForComparison(devices.get(id), "current");
  for (const [index, storage] of ["128GB", "256GB", "512GB"].entries()) assert.equal(prices.find((price) => price.configuration.key === `${memory}|${storage}`)?.value, expected[index]);
}
for (const [id, expected] of [["ipad-pro-m5-11-2025", [12499, 15899, 20099]], ["ipad-pro-m5-13-2025", [14999, 18399, 22599]]]) {
  const prices = getPricesForComparison(devices.get(id), "current");
  assert.ok(prices.some((price) => price.configuration.key === "12GB|256GB"));
  for (const [index, key] of ["12GB|512GB", "16GB|1TB", "16GB|2TB"].entries()) assert.equal(prices.find((price) => price.configuration.key === key)?.value, expected[index]);
}
for (const [id, expected] of [["ipad-air-m4-2025", [6499, 8199, 10699]], ["ipad-air-13-m4-2026", [8199, 9899, 12399]]]) {
  const prices = getPricesForComparison(devices.get(id), "current");
  assert.ok(prices.some((price) => price.configuration.key === "12GB|128GB"), "new capacity quotes must preserve the original 128GB snapshot");
  for (const [index, storage] of ["256GB", "512GB", "1TB"].entries()) assert.equal(prices.find((price) => price.configuration.key === `12GB|${storage}`)?.value, expected[index]);
}
assert.deepEqual(getPricesForComparison(devices.get("iphone-17"), "current").map((price) => [price.configuration.key, price.value]), [["8GB|256GB", 5380], ["8GB|512GB", 8799]], "adding an official 512GB quote must not discard the existing 256GB snapshot");
for (const [id, higherPrice] of [["oppo-find-x9-ultra-2026", 8499], ["vivo-x300-ultra-2026", 8999]]) {
  assert.deepEqual(getPricesForComparison(devices.get(id), "current").map((price) => [price.configuration.key, price.value]), [["12GB|256GB", 7499], ["12GB|512GB", 7999], ["16GB|512GB", higherPrice]], "512GB prices must distinguish 12GB and 16GB memory");
}
assert.deepEqual(getPricesForComparison(devices.get("samsung-galaxy-s26-ultra-2026"), "current").map((price) => [price.configuration.key, price.value]), [["12GB|256GB", 9999], ["12GB|512GB", 10599], ["16GB|1TB", 12999]]);
assert.deepEqual(getPricesForComparison(devices.get("iphone-17e-2026"), "current").map((price) => [price.configuration.key, price.value]), [["8GB|256GB", 5299], ["8GB|512GB", 7299]], "current official prices must stay attached to their selected capacity");
assert.equal(getPricesForComparison(devices.get("ipad-pro-m5-13-2025"), "used").find((price) => price.configuration.key === "12GB|512GB")?.value, 9899);
assert.equal(getPricesForComparison(devices.get("ipad-pro-m5-11-2025"), "used").find((price) => price.configuration.key === "12GB|512GB")?.value, 11249);
assert.deepEqual(getPricesForComparison(devices.get("iphone-15-pro-max"), "used").map((price) => price.value), [4929], "camera image defects must not be treated as ordinary cosmetic wear");
assert.equal(getPricesForComparison(devices.get("huawei-mate-80-pro-2025"), "used").find((price) => price.configuration.key === "16GB|1TB")?.value, 5999);
assert.deepEqual(getPricesForComparison(devices.get("iphone-17"), "used").map((price) => [price.configuration.key, price.value]), [["8GB|256GB", 4849], ["8GB|512GB", 6589]]);
for (const [id, basePrice, largerPrice] of [["iphone-17-pro", 7499, 8799], ["iphone-17-pro-max", 8099, 9399]]) {
  const prices = getPricesForComparison(devices.get(id), "used");
  assert.equal(prices.find((price) => price.configuration.key === "12GB|256GB")?.value, basePrice);
  assert.equal(prices.find((price) => price.configuration.key === "12GB|512GB")?.value, largerPrice, "512GB quotes must not overwrite or inherit the 256GB price");
}
for (const price of [
  { configuration: "8GB 运行内存 + 256GB 存储，美版" },
  { configuration: "8GB 运行内存 + 256GB 存储，国行/港版混发" },
  { configuration: "8GB 运行内存 + 256GB 存储", market: "US" },
  { configuration: "8GB 运行内存 + 256GB 存储", unit: "USD" },
]) assert.equal(getPriceConfiguration(devices.get("iphone-17"), price), null, "overseas currency or market must not enter mainland price comparisons");
assert.equal(devices.get("macbook-12-2016").specs.weight, 920, "Taiwan's 公斤 unit must be converted to grams");
assert.match(devices.get("macbook-12-2016").specs.port, /USB-C/);
assert.notEqual(devices.get("macbook-12-2016").specs.hasHDMI, true, "an HDMI adapter is still not a built-in port");
assert.match(devices.get("macbook-12-2016").specs.batteryLife, /10 小時無線上網.*11 小時 iTunes 電影播放/);
assert.match(devices.get("macbook-pro-15-2017").specs.batteryLife, /10 小时的无线网络浏览.*10 小时的 iTunes 影片播放/);
assert.match(devices.get("macbook-air-13-2018").specs.batteryLife, /12 小时的无线网络浏览.*13 小时的 iTunes 影片播放/);
for (const [id, expected] of [["macbook-12-2016", "Intel Core m3 / m5 / m7"],
  ["macbook-12-2017", "Intel Core m3 / i5 / i7"], ["macbook-pro-16-2019", "Intel Core i7 / i9"],
  ["macbook-air-13-intel-2020", "Intel Core i3 / i5 / i7"]]) {
  assert.equal(devices.get(id).specs.chip, expected, `${id}: optional processors must not collapse to the entry-level chip`);
  const field = allDevices.find((device) => device.id === id).specs.chip;
  for (const model of expected.replace("Intel Core ", "").split(" / ")) assert.ok(field.rawText.includes(`Intel Core ${model}`));
  assert.match(field.note, /可选处理器/);
}
for (const id of ["ipad-mini-6th-2021", "ipad-pro-11-1st-2018", "ipad-air-3rd-2019", "ipad-mini-5th-2019", "ipad-air-4th-2020", "macbook-pro-14-m3-2023"]) {
  const device = devices.get(id);
  assert.ok(device.usedPrices.some((price) => price.excludedReason), `${id}: retain the original quote and its exclusion reason`);
  const excludedPrices = device.usedPrices.filter((price) => price.excludedReason).map((price) => price.value);
  assert.ok(getPricesForComparison(device, "used").every((price) => !excludedPrices.includes(price.value)), `${id}: known screen defects must not become a normal used reference price`);
}
const mate80 = devices.get("huawei-mate-80-pro-2025");
assert.equal(devices.get("oppo-find-x9-ultra-2026").specs.refreshRateNote, "144Hz 只在部分游戏场景生效");
assert.match(devices.get("vivo-x200-ultra-2025").specs.weightNote, /银调约229g/);
assert.match(devices.get("honor-magic6-pro-2024").specs.weightNote, /素皮版约225g/);
assert.equal(devices.get("xiaomi-mi-10-ultra-2020").specs.waterResistance, undefined, "an Ultra name does not prove IP68 protection");
assert.equal(devices.get("xiaomi-mi-11-ultra-2021").specs.waterResistance, "IP68");
assert.match(devices.get("xiaomi-mi-10-ultra-2020").benchmarks[0].rawText, /score of 133.*version 4/);
const mi11Camera = devices.get("xiaomi-mi-11-ultra-2021").benchmarks[0];
assert.equal(mi11Camera.protocolVersion, "Camera v5");
assert.equal(mi11Camera.score, 141);
assert.match(mi11Camera.notes, /whats-new-in-dxomarks-protocol-updates/, "the retest protocol needs evidence beyond the score badge");
assert.match(mi11Camera.sourceSnapshotHash, /^[a-f0-9]{64}$/);
for (const [id, expected] of [["ipad-air-m4-2025", [["12GB|128GB", 4089], ["12GB|256GB", 4659]]],
  ["ipad-air-13-m4-2026", [["12GB|128GB", 5749], ["12GB|256GB", 6899], ["12GB|1TB", 8599]]]]) {
  const prices = getPricesForComparison(devices.get(id), "used");
  for (const [key, value] of expected) assert.equal(prices.find((price) => price.configuration.key === key)?.value, value, `${id}: per-capacity used prices must remain distinct`);
}
const honor8Launch = allDevices.find((device) => device.id === "honor-magic8-pro-2025").specs.launchPrice;
assert.equal(honor8Launch.value, 5699);
assert.match(honor8Launch.configuration, /12GB.*256GB/);
assert.match(honor8Launch.rawText, /12GB RAM\+256GB ROM：5699 元/);
assert.equal(getPriceConfiguration(devices.get("honor-magic8-pro-2025"), { configuration: "16GB 运行内存 + 256GB 存储" }), null);
assert.deepEqual(getDeviceConfigurations(mate80).map((item) => item.key), ["12GB|256GB", "12GB|512GB", "16GB|512GB", "16GB|1TB"]);
assert.equal(getPriceConfiguration(mate80, { configuration: "12GB 运行内存 + 1TB 存储" }), null);
assert.equal(getPriceConfiguration(mate80, { configuration: "16GB 运行内存 + 256GB 存储" }), null);
assert.equal(getPriceConfiguration(mate80, { configuration: "12GB 运行内存 + 512GB 存储" }).chip, "麒麟 9030");
assert.equal(getPriceConfiguration(mate80, { configuration: "16GB 运行内存 + 512GB 存储" }).chip, "麒麟 9030 Pro");
assert.equal(getDeviceConfigurations(devices.get("huawei-mate-70-pro-2024")).length, 4);

assert.deepEqual(
  getSharedStorageOptions(getDevicesByComparisonGroupKeyFlat("iPhone::standard")),
  ["256GB", "512GB"],
  "the selector should contain only storage tiers shared by the latest three generations",
);
assert.equal(
  formatLatestConfigurationOption(getDevicesByComparisonGroupKeyFlat("iPhone::standard"), "256GB"),
  "8GB + 256GB",
  "selector labels should use the latest generation's primary memory tier",
);
assert.equal(
  formatMemoryForComparison(devices.get("iphone-15"), true, "256GB"),
  "6GB",
  "each device should show its own memory in the comparison table",
);
assert.equal(formatMemoryForComparison(devices.get("iphone-17"), true, "256GB"), "8GB");
assert.deepEqual(
  getSharedStorageOptions(getDevicesByComparisonGroupKeyFlat("iPad Air::11-inch")),
  ["128GB", "256GB", "512GB"],
  "the selector should cap shared tiers at three mainstream options",
);

const iphone17 = devices.get("iphone-17");
for (const configuration of ["2GB 运行内存 + 256GB 存储", "8GB 运行内存 + 64GB 存储", "8GB 运行内存 + 1256GB 存储"]) {
  assert.equal(getPriceConfiguration(iphone17, { configuration }), null, `must reject nonexistent iPhone 17 configuration: ${configuration}`);
}
assert.equal(getPriceConfiguration(devices.get("honor-magic7-pro-2024"), { configuration: "16GB 运行内存 + 256GB 存储" }), null);
assert.equal(getPriceConfiguration(devices.get("honor-magic8-pro-2025"), { configuration: "512GB 存储" }), null, "ambiguous RAM must not be guessed");
assert.deepEqual(
  getDeviceConfigurations(iphone17).map((configuration) => configuration.key),
  ["8GB|256GB", "8GB|512GB"],
  "iPhone 17 should expose only its real memory and storage combinations",
);

const iphone8 = devices.get("iphone-8-2017");
assert.deepEqual(
  formatConfigurationForComparison(iphone8, false, "256GB"),
  "2GB + 256GB",
  "devices before the latest three generations should show their own highest configuration",
);

assert.equal(formatConfigurationForComparison(iphone17, true, "256GB"), "8GB + 256GB");
assert.equal(formatConfigurationForComparison(iphone17, true, "64GB"), "");

const iphone12 = devices.get("iphone-12");
assert.equal(
  getPricesForComparison(iphone12, "used").length,
  1,
  "an older device's verified price must remain visible even when it is not the highest configuration",
);

const iphone13 = devices.get("iphone-13");
assert.equal(getPricesForComparison(iphone13, "used")[0]?.configuration.key, "4GB|256GB");

const macbookAirM3 = devices.get("macbook-air-13-m3-2024");
const sameMemoryVariants = getPricesForComparison({ ...macbookAirM3, currentPrices: [
  { value: 6500, configuration: "8GB 运行内存 + 256GB 存储，8 核 GPU", condition: "全新", observedAt: "2026-09-01" },
  { value: 7000, configuration: "8GB 运行内存 + 256GB 存储，10 核 GPU", condition: "全新", observedAt: "2026-09-01" },
] }, "current");
assert.equal(sameMemoryVariants.length, 2, "CPU/GPU variants must not be collapsed into the cheapest RAM/storage pair");
assert.match(formatConfiguration(sameMemoryVariants[1].configuration), /10 核 GPU/);
const repriced = getPricesForComparison({ ...iphone17, currentPrices: [
  { value: 4000, configuration: "8GB 运行内存 + 256GB 存储", condition: "全新", observedAt: "2026-08-01" },
  { value: 5000, configuration: "8GB 运行内存 + 256GB 存储", condition: "全新", observedAt: "2026-09-01" },
] }, "current");
assert.equal(repriced[0].value, 5000, "newer quotes must supersede stale cheaper ones");
assert.deepEqual(
  getPricesForComparison(devices.get("macbook-air-13-m4-2025"), "current").map((price) => `${price.configuration.key}:${price.value}`),
  ["16GB|256GB:7999", "16GB|512GB:9499"],
  "multiple verified prices for one model should stay separated by configuration",
);
assert.deepEqual(getPricesForComparison(macbookAirM3, "current"), [], "mainland retail channel alone does not prove a mainland hardware version");

const ipadProM5 = devices.get("ipad-pro-m5-11-2025");
assert.deepEqual(
  getDeviceConfigurations(ipadProM5).map((configuration) => configuration.key),
  ["12GB|256GB", "12GB|512GB", "16GB|1TB", "16GB|2TB"],
  "iPad memory tiers should stay paired with their supported storage tiers",
);

const macbookProM3Max = { ...devices.get("macbook-pro-14-m3-max-2023"), configurations: undefined };
assert.equal(formatConfigurationForComparison(macbookProM3Max, false, "2TB"), "", "unknown legacy matrices must not fabricate a highest RAM/storage pair");
assert.equal(
  formatConfigurationForComparison(macbookProM3Max, true, "2TB"),
  "2TB 存储；运行内存 36GB / 48GB / 64GB / 96GB / 128GB",
  "MacBook independent option lists must not be expanded into unverified combinations",
);

const xiaomiUltra = getDevicesByComparisonGroupKeyFlat("xiaomi.phone.xiaomi-ultra.standard");
assert.equal(xiaomiUltra.length, 7, "the second-brand pilot should include the full Ultra product line");
assert.deepEqual(
  getDeviceConfigurations(devices.get("xiaomi-mi-10-ultra-2020")).map((configuration) => configuration.key),
  ["16GB|512GB"],
  "devices older than the latest five generations should keep only the highest configuration",
);
assert.deepEqual(
  getDeviceConfigurations(devices.get("xiaomi-mi-11-ultra-2021")).map((configuration) => configuration.key),
  ["8GB|256GB", "12GB|256GB", "12GB|512GB"],
  "recent generations should keep their real configuration matrix",
);
assert.deepEqual(
  getDeviceConfigurations(devices.get("xiaomi-15-ultra-2025")).map((configuration) => configuration.key),
  ["12GB|256GB", "16GB|512GB", "16GB|1TB"],
  "explicit configuration matrices must not expand into unsupported memory and storage pairs",
);
assert.equal(
  formatLatestConfigurationOption(xiaomiUltra, "512GB"),
  "12GB + 512GB",
  "the selector should use the latest generation's primary verified combination",
);
assert.equal(getPricesForComparison(devices.get("xiaomi-15-ultra-2025"), "current")[0]?.value, 6499);
assert.equal(getPricesForComparison(devices.get("xiaomi-17-ultra-2025"), "current")[0]?.value, 6999);
assert.deepEqual(
  [
    "xiaomi-17-ultra-2025",
    "xiaomi-15-ultra-2025",
    "xiaomi-14-ultra-2024",
    "xiaomi-13-ultra-2023",
    "xiaomi-12s-ultra-2022",
    "xiaomi-mi-11-ultra-2021",
  ].map((id) => getPricesForComparison(devices.get(id), "used")[0]?.value),
  [5149, 3619, 2569, 1809, 1219, 1299],
  "verified Xiaomi Ultra used-price snapshots should remain available",
);
assert.equal(getPricesForComparison(devices.get("xiaomi-mi-10-ultra-2020"), "used").length, 0);

const oppoFindXUltra = getDevicesByComparisonGroupKeyFlat("oppo.phone.find-x-ultra.standard");
assert.equal(oppoFindXUltra.length, 3, "the OPPO pilot should include the complete Find X Ultra lineage");
assert.deepEqual(
  getSharedStorageOptions(oppoFindXUltra),
  ["256GB", "512GB"],
  "OPPO configuration options should include only storage tiers shared by all three generations",
);
assert.deepEqual(
  getDeviceConfigurations(devices.get("oppo-find-x9-ultra-2026")).map((configuration) => configuration.key),
  ["12GB|256GB", "12GB|512GB", "16GB|512GB", "16GB|1TB"],
  "OPPO configurations must preserve the official memory and storage combinations",
);
assert.equal(formatLatestConfigurationOption(oppoFindXUltra, "512GB"), "12GB + 512GB");
assert.equal(
  devices.get("oppo-find-x9-ultra-2026").mainCameraMp,
  200,
  "Chinese 2 亿像素 wording should normalize to 200MP for comparison",
);

const vivoXUltra = getDevicesByComparisonGroupKeyFlat("vivo.phone.x-ultra.standard");
assert.equal(vivoXUltra.length, 3, "the vivo pilot should include every released X Ultra generation");
assert.deepEqual(getSharedStorageOptions(vivoXUltra), ["256GB", "512GB", "1TB"]);
assert.deepEqual(
  getDeviceConfigurations(devices.get("vivo-x300-ultra-2026")).map((configuration) => configuration.key),
  ["12GB|256GB", "12GB|512GB", "16GB|512GB", "16GB|1TB"],
  "vivo configurations must preserve the official memory and storage combinations",
);
assert.equal(devices.get("vivo-x300-ultra-2026").mainCameraMp, 200);
assert.deepEqual(
  ["oppo-find-x7-ultra-2024", "oppo-find-x8-ultra-2025", "oppo-find-x9-ultra-2026"]
    .map((id) => getPricesForComparison(devices.get(id), "used")[0]?.value),
  [2499, 4099, 6599],
  "verified OPPO used-price snapshots should remain available",
);
assert.deepEqual(
  ["vivo-x100-ultra-2024", "vivo-x200-ultra-2025", "vivo-x300-ultra-2026"]
    .map((id) => getPricesForComparison(devices.get(id), "used")[0]?.value),
  [undefined, 4059, 6499],
  "vivo should expose only uniquely matched used-price snapshots",
);
assert.deepEqual(
  getDeviceConfigurations(devices.get("huawei-pura-80-ultra-2025")).map((configuration) => configuration.key),
  ["16GB|512GB", "16GB|1TB"],
  "HUAWEI Pura Ultra configurations must preserve official China variants",
);
assert.deepEqual(getDeviceConfigurations(devices.get("huawei-pura-70-ultra-2024")).map((configuration) => configuration.key), ["12GB|512GB", "16GB|512GB", "16GB|1TB"]);
assert.equal(getPriceConfiguration(devices.get("huawei-pura-70-ultra-2024"), { configuration: "12GB 运行内存 + 1TB 存储" }), null);
assert.equal(devices.get("huawei-pura-70-ultra-2024").benchmarks[0].score, 163);
assert.equal(devices.get("huawei-pura-80-ultra-2025").benchmarks[0].score, 175);
assert.deepEqual(
  ["huawei-pura-70-ultra-2024", "huawei-pura-80-ultra-2025"]
    .map((id) => getPricesForComparison(devices.get(id), "used").find((price) => price.configuration.key === "16GB|512GB")?.value),
  [2899, 4749],
  "verified HUAWEI Pura Ultra used-price snapshots should remain available",
);
assert.deepEqual(
  ["huawei-pura-70-ultra-2024", "huawei-pura-80-ultra-2025"]
    .map((id) => getPricesForComparison(devices.get(id), "current")[0]?.value),
  [4498, 7999],
  "verified HUAWEI Pura Ultra current-price snapshots should remain available",
);
assert.deepEqual(
  getDeviceConfigurations(devices.get("honor-magic8-pro-2025")).map((configuration) => configuration.key),
  ["12GB|256GB", "12GB|512GB", "16GB|512GB", "16GB|1TB"],
  "HONOR Magic8 Pro configurations must preserve official China variants",
);
assert.deepEqual(
  ["honor-magic6-pro-2024", "honor-magic7-pro-2024", "honor-magic8-pro-2025"].map((id) => devices.get(id).benchmarks[0].score),
  [158, 148, 164],
  "HONOR DXOMARK scores must keep their protocol-specific values",
);
assert.deepEqual(
  ["honor-magic6-pro-2024", "honor-magic7-pro-2024", "honor-magic8-pro-2025"]
    .map((id) => getPricesForComparison(devices.get(id), "used").find((price) => price.configuration.key === "16GB|512GB")?.value),
  [2279, 2949, 4479],
  "verified HONOR Magic Pro used-price snapshots should remain available",
);
assert.deepEqual(
  ["honor-magic6-pro-2024", "honor-magic7-pro-2024", "honor-magic8-pro-2025"]
    .map((id) => getPricesForComparison(devices.get(id), "current").find((price) => price.configuration.key === "16GB|512GB")?.value),
  [5600, 5199, 5999],
  "verified HONOR Magic Pro current-price snapshots should remain available",
);

// 历史扩容不能破坏已核验的新款；固定样本验真，不把组的总数锁死在首批规模。
const samsungGalaxySUltra = getDevicesByComparisonGroupKeyFlat("samsung.phone.galaxy-s-ultra.standard").filter((device) => device.releaseYear >= 2024);
const xiaomiStandard = getDevicesByComparisonGroupKeyFlat("xiaomi.phone.xiaomi.standard").filter((device) => device.releaseYear >= 2022);
assert.deepEqual(xiaomiStandard.map((device) => [device.screenSize, device.mainCameraMp, device.launchPrice]),
  [[6.36, 50, undefined], [6.36, 50, 3999], [6.36, 50, 4499], [6.3, 50, 4499]]);
assert.deepEqual(getDeviceConfigurations(devices.get("xiaomi-14-2023")).map((configuration) => configuration.key),
  ["8GB|256GB", "12GB|256GB", "16GB|512GB", "16GB|1TB"], "do not synthesize an 8GB+512GB Xiaomi 14 configuration");
assert.deepEqual(getDeviceConfigurations(devices.get("xiaomi-17-pro-max-2025")).map((configuration) => configuration.key),
  ["12GB|512GB", "16GB|512GB", "16GB|1TB"], "17 Pro Max must not inherit the 17 Pro 256GB option");
assert.equal(getDeviceConfigurations(devices.get("xiaomi-17-2025")).some((configuration) => configuration.key === "16GB|1TB"), true, "include the explicitly published later 1TB standard option");
assert.deepEqual(getDevicesByComparisonGroupKeyFlat("xiaomi.phone.xiaomi-pro.standard").filter((device) => device.releaseYear >= 2022).map((device) => device.launchPrice), [undefined, 4999, 5299, 4999, 5999]);
assert.equal(devices.get("xiaomi-15-pro-2024").weight, 213);
assert.equal(devices.get("xiaomi-18-pro-2026").mainCameraMp, 200);
assert.equal(devices.get("xiaomi-18-pro-max-2026").launchPrice, 6999);
assert.equal(devices.get("xiaomi-18-pro-max-2026").screenSize, 6.9);
const oppoFindX = getDevicesByComparisonGroupKeyFlat("oppo.phone.find-x.standard")
  .filter((device) => ["oppo-find-x8-2024", "oppo-find-x9-2025", "oppo-find-x10-2026"].includes(device.id));
assert.deepEqual(oppoFindX.map((device) => [device.screenSize, device.mainCameraMp, device.launchPrice]),
  [[6.59, 50, 4199], [6.59, 50, 4399], [6.59, 200, 5499]]);
assert.deepEqual(getDevicesByComparisonGroupKeyFlat("oppo.phone.find-x-pro.standard").filter((device) => device.releaseYear >= 2024).map((device) => device.launchPrice), [5299, 5299]);
assert.deepEqual(getDeviceConfigurations(devices.get("oppo-find-x10-e-2026")).map((configuration) => configuration.key),
  ["12GB|256GB", "16GB|512GB"], "Find X10 E does not inherit the standard model's 12GB+512GB option");
assert.deepEqual(getDeviceConfigurations(devices.get("oppo-find-x8-2024")).map((configuration) => configuration.key),
  ["12GB|256GB", "16GB|256GB", "12GB|512GB", "16GB|512GB", "16GB|1TB"]);
assert.equal(devices.get("oppo-find-x10-pro-max-2026").comparisonGroupId, "oppo.phone.find-x-pro-max.standard");
assert.ok(oppoFindX.every((device) => !device.benchmarks.length));
assert.equal(devices.get("oppo-find-x7-2024").launchPrice, 3999);
assert.deepEqual(getDeviceConfigurations(devices.get("vivo-x100-2023")).map(configuration => configuration.key),
  ["12GB|256GB", "16GB|256GB", "16GB|512GB", "16GB|1TB"]);
assert.deepEqual(getDeviceConfigurations(devices.get("vivo-x100-lpddr5t-limited-2023")).map(configuration => configuration.key), ["16GB|1TB"]);
assert.notEqual(devices.get("vivo-x100-2023").comparisonGroupId, devices.get("vivo-x100-lpddr5t-limited-2023").comparisonGroupId,
  "同容量的 LPDDR5T 限量版不能混入普通版配置/报价");
assert.equal(devices.get("vivo-x100-2023").launchPrice, 3999);
assert.equal(devices.get("vivo-x100-lpddr5t-limited-2023").launchPrice, 5099);
const vivoX = getDevicesByComparisonGroupKeyFlat("vivo.phone.x.standard").filter((device) => device.releaseYear >= 2024);
const vivoXPro = getDevicesByComparisonGroupKeyFlat("vivo.phone.x-pro.standard").filter((device) => device.releaseYear >= 2024);
assert.equal(vivoX.length, 3);
assert.equal(vivoXPro.length, 3);
assert.deepEqual(vivoX.map((device) => [device.screenSize, device.mainCameraMp, device.launchPrice]),
  [[6.67, 50, 4299], [6.31, 200, 4399], [6.59, 50, 5499]], "historical launch prices must not track later MSRP changes");
assert.deepEqual(vivoXPro.map((device) => device.launchPrice), [5299, 5299, 6499]);
assert.deepEqual(getDeviceConfigurations(devices.get("vivo-x500-2026")).map((configuration) => configuration.key),
  ["12GB|256GB", "12GB|512GB", "16GB|512GB", "12GB|1TB"], "do not synthesize a 16GB+1TB X500 standard configuration");
assert.deepEqual(getDeviceConfigurations(devices.get("vivo-x200-pro-2024")).map((configuration) => configuration.key),
  ["12GB|256GB", "16GB|512GB", "16GB|1TB"], "X200 Pro does not inherit the base model's 12GB+512GB configuration");
assert.equal(devices.get("vivo-x500-pro-max-2026").comparisonGroupId, "vivo.phone.x-pro-max.standard");
assert.equal(devices.get("vivo-x200-pro-mini-2024").comparisonGroupId, "vivo.phone.x-pro-mini.standard");
const samsungGalaxyS = getDevicesByComparisonGroupKeyFlat("samsung.phone.galaxy-s.standard").filter((device) => device.releaseYear >= 2024);
const samsungGalaxySPlus = getDevicesByComparisonGroupKeyFlat("samsung.phone.galaxy-s-plus.standard").filter((device) => device.releaseYear >= 2024);
const samsungS24 = devices.get("samsung-galaxy-s24-2024");
assert.equal(samsungS24.generationOrder > 1, true, "历史 S 系列应接续至既有 S24，而不是另起比较组");
assert.equal(samsungS24.upgradeMagnitude, undefined, "旧首代空评分失效后不得伪造新的代际分数");
assert.equal(samsungGalaxyS.length, 3);
assert.equal(samsungGalaxySPlus.length, 3);
assert.deepEqual(getDeviceConfigurations(devices.get("samsung-galaxy-s24-2024")).map((configuration) => configuration.key),
  ["8GB|256GB", "12GB|256GB", "8GB|512GB"], "S24 must not synthesize the nonexistent mainland 12GB+512GB option");
assert.deepEqual(getDeviceConfigurations(devices.get("samsung-galaxy-s26-2026")).map((configuration) => configuration.key),
  ["12GB|256GB"], "the S26 mainland standard model must not inherit the Plus 512GB option");
assert.deepEqual(getSharedStorageOptions(samsungGalaxyS), ["256GB"]);
assert.deepEqual(getSharedStorageOptions(samsungGalaxySPlus), ["256GB", "512GB"]);
assert.deepEqual(samsungGalaxyS.map((device) => [device.screenSize, device.weight, device.mainCameraMp, device.launchPrice]),
  [[6.2, 167, 50, 5499], [6.2, 162, 50, 5999], [6.3, 167, 50, 6999]]);
assert.deepEqual(samsungGalaxySPlus.map((device) => [device.screenSize, device.weight, device.mainCameraMp, device.launchPrice]),
  [[6.7, 196, 50, 6999], [6.7, 190, 50, 6999], [6.7, 190, 50, 7999]]);
assert.ok([...samsungGalaxyS, ...samsungGalaxySPlus].every((device) => !device.benchmarks.length), "unverified camera scores must remain absent");
assert.equal(samsungGalaxySUltra.length, 3, "the Samsung pilot should include the latest three Galaxy S Ultra generations");
assert.deepEqual(getSharedStorageOptions(samsungGalaxySUltra), ["256GB", "512GB", "1TB"]);
assert.equal(formatLatestConfigurationOption(samsungGalaxySUltra, "512GB"), "12GB + 512GB");
assert.deepEqual(
  getDeviceConfigurations(devices.get("samsung-galaxy-s26-ultra-2026")).map((configuration) => configuration.key),
  ["12GB|256GB", "12GB|512GB", "16GB|1TB"],
  "Samsung Galaxy S26 Ultra configurations must preserve official China variants",
);
assert.deepEqual(
  ["samsung-galaxy-s24-ultra-2024", "samsung-galaxy-s25-ultra-2025", "samsung-galaxy-s26-ultra-2026"]
    .map((id) => devices.get(id).benchmarks[0].score),
  [144, 151, 157],
  "Samsung DXOMARK scores must keep their protocol-specific values",
);
assert.equal(devices.get("samsung-galaxy-s26-ultra-2026").mainCameraMp, 200);
assert.deepEqual(
  ["samsung-galaxy-s24-ultra-2024", "samsung-galaxy-s25-ultra-2025", "samsung-galaxy-s26-ultra-2026"]
    .map((id) => getPricesForComparison(devices.get(id), "current")[0]?.value),
  [5499, 6999, 9999],
  "verified Samsung Galaxy S Ultra current-price snapshots should remain available",
);
assert.deepEqual(
  ["samsung-galaxy-s24-ultra-2024", "samsung-galaxy-s25-ultra-2025", "samsung-galaxy-s26-ultra-2026"]
    .map((id) => getPricesForComparison(devices.get(id), "used")[0]?.value),
  [3629, 4899, 7899],
  "verified Samsung Galaxy S Ultra used-price snapshots should remain available",
);
assert.deepEqual(["redmi-book-14-2023", "redmi-book-14-2024", "redmi-book-14-2025"].map((id) => devices.get(id).launchPrice),
  [undefined, 4199, 4599], "Redmi Book 14 launch prices must follow the named mainland configurations; missing prices stay missing");
assert.deepEqual(getDeviceConfigurations(devices.get("redmi-book-14-2025")).map((item) => item.key),
  ["16GB|512GB", "16GB|1TB", "32GB|1TB"], "do not synthesize a 32GB+512GB Redmi Book 14 offer");

console.log("Passed compare configuration scenarios: shared_storage_options, latest_configuration_label, memory_table_value, mainstream_cap, latest_device_options, legacy_highest_only, legacy_price_visible, multi_configuration_prices, ipad_memory_tiers, macbook_independent_options, explicit_second_brand_configurations, xiaomi_used_prices, oppo_official_configurations, vivo_official_configurations, domestic_ultra_used_prices, huawei_pura_ultra_pilot, huawei_pura_prices, honor_magic_pro_pilot, honor_magic_prices, samsung_galaxy_s_ultra_prices");
