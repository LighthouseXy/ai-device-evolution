import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { loadTsModule } from "./lib/load-ts-module.mjs";
import { getSourceSnapshot } from "./lib/source-snapshot.mjs";
import { plainText } from "./lib/zol-device.mjs";
import { safeImageUrl, readOfficialColorGallery } from "./lib/device-images.mjs";
import { evidence, readWearableRows, readAppleWearable } from "./sync-wearable-devices.mjs";

const read = async file => JSON.parse(await fs.readFile(file, "utf8"));
const db = await read("src/data/devices-db.json");
const wearable = db.devices.filter(device => ["watch", "band"].includes(device.category));
const sources = await read("src/data/device-sources.json");
const registry = new Map(Object.values(sources).filter(Array.isArray).flat().map(source => [source.id, source]));
const images = await read("src/data/device-images.json");
const minYears = { Apple: 2016, Xiaomi: 2017, Redmi: 2017, Samsung: 2017, Huawei: 2022, OPPO: 2022, vivo: 2022, HONOR: 2022 };
const targets = await read("scripts/fixtures/wearable-targets.json");
assert.equal(wearable.length, targets.length + 19, "采集清单与19个Apple目录型号必须全部保留");
assert.equal(wearable.filter(device => device.category === "watch").length, targets.filter(device => device.category === "watch").length + 19);
assert.equal(wearable.filter(device => device.category === "band").length, targets.filter(device => device.category === "band").length);
assert.ok(targets.every(target => wearable.some(device => device.id === target.id)), "不能漏掉已通过来源检查的目标");
assert.deepEqual([...new Set(wearable.map(device => device.brand))].sort(), Object.keys(minYears).sort());
assert.deepEqual(Object.fromEntries(["phone", "tablet", "laptop"].map(category =>
  [category, db.devices.filter(device => device.category === category).length])), { phone: 477, tablet: 160, laptop: 115 });
// 仅还原已验收的两个颜色数组拆分，继续锁住其他所有非穿戴数据。
const beforeColorSplit = device => ["iphone-18-pro", "iphone-18-pro-max"].includes(device.id)
  ? { ...device, specs: { ...device.specs, colors: { ...device.specs.colors, value: [device.specs.colors.value.join("、")] } } }
  : device;
const appleBeforeColorSplit = await read("src/data/apple-devices-db.json");
appleBeforeColorSplit.devices = appleBeforeColorSplit.devices.map(beforeColorSplit);
assert.equal(createHash("sha256").update(JSON.stringify(appleBeforeColorSplit, null, 2) + "\n").digest("hex"),
  "8b05cd2513d7bbbf2675f9f6a6269012cf77daf2f7bc03417d0b3f9785ca1edc", "Apple既有数据未被穿戴采集改写");
assert.equal(createHash("sha256").update(JSON.stringify(db.devices.filter(device => !["watch", "band"].includes(device.category)).map(beforeColorSplit))).digest("hex"),
  // 中文影像补证与小米15发布配色补证后的基线；新增配色另有逐字快照回放。
  "a62597b8c6e8c50efd65e9c903ce25afa2378ae97c5fd15cd37d1611a93af449", "穿戴采集不得改写现有手机、平板、笔记本");
for (const device of wearable) {
  assert.ok(device.releaseYear >= minYears[device.brand] && device.releaseYear <= 2026);
  assert.equal(device.market, "CN");
  assert.equal(device.releaseDate, undefined, "只有年份时不能伪造1月1日");
  assert.equal(device.configurations, undefined, "不生成穿戴RAM/存储配置组合");
  assert.equal(device.specs.memory, undefined);
  const source = registry.get(device.id);
  assert.equal(source.sourcePageType, "wearable_spec_snapshots");
  assert.equal(source.releaseDatePrecision, "year");
  assert.equal(source.releaseEvidence.value, String(device.releaseYear));
  assert.match(source.releaseEvidence.sourceSnapshotHash, /^[a-f0-9]{64}$/);
  for (const field of Object.values(device.specs)) {
    assert.ok(field.rawText && field.fetchedAt && source.referenceUrls.includes(field.sourceUrl));
    assert.match(field.sourceSnapshotHash, /^[a-f0-9]{64}$/);
    assert.equal(field.evidenceKind, "excerpt");
  }
  assert.equal(safeImageUrl(images[device.id]?.url), images[device.id]?.url);
  assert.ok(images[device.id]?.url, "必须有实际型号主图，不能用相似机型顶替");
  assert.equal(images[device.id].modelName, device.modelName);
  assert.equal(images[device.id].licenseStatus, "unknown", "来源图片不冒充获商业许可");
}

const sample = { url: "https://detail.zol.com.cn/1/123/param.shtml", fetchedAt: "2026-10-06T00:00:00.000Z", sha256: "a".repeat(64) };
assert.equal(plainText('<p>&ldquo;实时活动&rdquo;，0&deg;C，466&times;466</p>'), '“实时活动”，0°C，466×466');
const rows = entries => `<h1>测试手表</h1><table>${entries.map(([label, value]) => `<tr><th>${label}</th><td>${value}</td></tr>`).join("")}</table>`;
const parsed = readWearableRows({ ...sample, html: rows([
  ["屏幕尺寸", "1.43英寸"], ["产品重量", "蓝牙版27g；eSIM版35g"],
  ["电池容量", "蓝牙版486mAh；eSIM版520mAh"], ["运行内存", "4GB"], ["NFC", "可选"], ["其它功能", "线性马达"],
]) });
assert.equal(parsed.screenSize.value, 1.43);
assert.equal(parsed.batteryCapacity, undefined, "多版电池不可擅自取第一个容量");
assert.equal(parsed.batteryCapacityDetails.value, "蓝牙版486mAh；eSIM版520mAh");
assert.equal(parsed.wearableWeight.value, "蓝牙版27g；eSIM版35g");
assert.equal(parsed.memory, undefined, "第三方穿戴RAM字段可能误标，未核验不采入");
assert.equal(parsed.hasNFC, undefined, "可选不等于本版支持");
assert.equal(parsed.healthFeatures, undefined, "线性马达不是健康监测功能");
assert.equal(parsed.wearableFeatures.value, "线性马达");
assert.equal(readWearableRows({ ...sample, html: rows([["屏幕尺寸", "40毫米 / 44毫米"]]) }).screenSize, undefined);
const aliases = readWearableRows({ ...sample, html: rows([
  ["WiFi", "不支持"], ["定位功能", "GPS、北斗"], ["其他功能", "独立GPS定位"],
  ["表壳材质", "不锈钢"], ["SIM卡支持", "支持，eSIM卡"], ["NFC", "支持读卡，卡模拟"],
  ["屏幕尺寸", "1.64英寸英寸"], ["产品尺寸", "44.7*28.8*11mmmm"], ["产品重量", "约20.5gg"],
]) });
assert.equal(aliases.wifi.value, "不支持");
assert.equal(aliases.positioning.value, "GPS、北斗");
assert.equal(aliases.wearableFeatures.value, "独立GPS定位");
assert.equal(aliases.material.value, "不锈钢");
assert.equal(aliases.cellular.value, "支持，eSIM卡");
assert.equal(aliases.hasNFC.value, true);
assert.equal(aliases.screenSize.value, 1.64);
assert.equal(aliases.dimensions.value, "44.7*28.8*11mm");
assert.equal(aliases.dimensions.rawText, "44.7*28.8*11mmmm", "清理展示笔误不改写证据原文");
assert.equal(aliases.wearableWeight.value, "约20.5g");
const bluetoothConnection = readWearableRows({ ...sample, html: rows([["通讯网络", "支持蓝牙通话"]]) });
assert.equal(bluetoothConnection.cellular, undefined, "蓝牙通话不能误标为蜂窝网络");
assert.equal(bluetoothConnection.connectivity.value, "支持蓝牙通话");
assert.equal(readWearableRows({ ...sample, html: rows([["通讯网络", "eSIM、蓝牙通话"]]) }).cellular.value, "eSIM、蓝牙通话");
const mixedBattery = "独立通信(一号双终端模式)常规使用场景 7天；独立通信(独立终端模式)常规使用场景 3天；关闭独立通信最长使用场景 16天；关闭独立通信常规使用场景 8天";
const mixedPage = { ...sample, html: rows([["续航时间", mixedBattery], ["其它功能", "应用商店、独立在线听歌等"]]) };
const bluetoothOnly = readWearableRows(mixedPage, { brand: "vivo", id: "vivo-watch-3-2023" });
assert.equal(bluetoothOnly.batteryLife.value, "蓝牙模式最长使用场景 16天；蓝牙模式常规使用场景 8天");
assert.equal(bluetoothOnly.batteryLife.rawText, mixedBattery);
assert.equal(bluetoothOnly.wearableFeatures.value, "应用商店等");
assert.equal(readWearableRows(mixedPage, { brand: "vivo", id: "vivo-watch-3-esim-2023" }).batteryLife.value, mixedBattery);
assert.equal(readWearableRows({ ...sample, html: rows([["防护级别", "IPX8防水防尘"]]) }).waterResistance.value, "IPX8");
assert.equal(readWearableRows({ ...sample, html: rows([["防护级别", "IP68防水防尘"]]) }).waterResistance.value, "IP68防水防尘");
assert.equal(evidence({ ...sample, url: "https://consumer.huawei.com/cn/wearables/watch-fit4/specs/" }, "AMOLED", "AMOLED").sourceType, "official");
assert.equal(evidence({ ...sample, url: "https://consumer.huawei.com.example.com/cn/wearables/" }, "AMOLED", "AMOLED").sourceType, "reference");
const findWearable = id => wearable.find(device => device.id === id);
{
  const id = "samsung-galaxy-watch5-40-2022", expected = ["哥特太空", "繁樱花园", "幽紫秘境"];
  const device = findWearable(id), source = registry.get(id), verification = source.colorVersionVerification;
  assert.deepEqual(device.specs.colors.value, expected, "44毫米款配色不能套入40毫米款");
  assert.deepEqual(verification.allowedColors, expected);
  assert.deepEqual(source.rejectedColorNames, ["晴空海岸", "云雾冰川"]);
  assert.equal(verification.rejectedEvidence.value.length, 5, "保留误混颜色的原始证据，不能算作新增图片");
  const page = await getSourceSnapshot(verification.sourceUrl, { offline: true });
  assert.equal(page.sha256, verification.sourceSnapshotHash);
  assert.ok(plainText(page.html).includes(verification.rawText));
  assert.match(verification.rawText, /40mm可选颜色为哥特太空、繁樱花园、幽紫秘境/);
  const target = targets.find(target => target.id === id);
  assert.deepEqual(plainText(page.html).match(new RegExp(target.additionalSpecs.fields.colors))?.[0].split("、"), expected);
}
for (const id of ["vivo-watch-3-2023", "vivo-watch-3-esim-2023", "vivo-watch-3-bluetooth-leather-2023", "vivo-watch-3-esim-leather-2023"]) {
  const expected = id.includes("leather") ? ["皓月", "星辉"] : ["辰夜黑", "月光白"];
  const device = findWearable(id), source = registry.get(id), verification = source.colorVersionVerification;
  assert.deepEqual(device.specs.colors.value, expected, "原配表带颜色不能笛卡尔组合");
  assert.deepEqual(verification.allowedColors, expected);
  const page = await getSourceSnapshot(verification.sourceUrl, { offline: true });
  assert.equal(page.sha256, verification.sourceSnapshotHash);
  assert.ok(plainText(page.html).includes(verification.rawText));
  assert.match(verification.rawText, /皓月、星辉配色采用真皮表带材质，辰夜黑、月光白配色采用软胶表带材质/);
  assert.equal(verification.rejectedEvidence.value.length, 4, "错误来源证据保留，不把真实性修正统计成补图");
  assert.ok(source.rejectedColorNames.every(color => !device.specs.colors.value.includes(color)));
  const gallery = (await read("src/data/device-image-galleries.json"))[id];
  assert.ok(gallery.colors.every(color => expected.includes(color.name)), "图片入口与原配版本保持一致");
  const target = targets.find(target => target.id === id);
  const excerpt = plainText(page.html).match(new RegExp(target.additionalSpecs.fields.colors))?.[0];
  assert.deepEqual(excerpt?.split("、"), expected, "重复采集仍使用准确原配颜色");
}
assert.equal(findWearable("huawei-kids-watch-5-pro-2024").specs.waterResistance.value, "IPX8");
for (const id of ["vivo-watch-3-2023", "vivo-watch-3-bluetooth-leather-2023"]) {
  assert.equal(findWearable(id).specs.batteryLife.value, bluetoothOnly.batteryLife.value);
  assert.ok(!findWearable(id).specs.wearableFeatures.value.includes("独立在线听歌"));
  assert.match(findWearable(id).specs.wearableFeatures.note, /蓝牙版不支持独立蜂窝/);
}
const s2small = findWearable("xiaomi-watch-s2-42-2022"), s2large = findWearable("xiaomi-watch-s2-46-2022");
assert.equal(s2small.specs.screenSize.value, 1.32);
assert.equal(s2large.specs.screenSize.value, 1.43);
assert.equal(s2small.specs.launchPrice.value, 999);
assert.equal(s2large.specs.launchPrice.value, 1099);
assert.equal(s2small.specs.strapMaterial.value, "黑硅胶表带", "具体硅胶版不能保留通用真皮+硅胶行");
for (const device of [s2small, s2large]) {
  assert.equal(device.specs.wifi, undefined, "与官方支持资料冲突的Wi-Fi字段不得继续展示");
  const source = registry.get(device.id);
  assert.ok(source.excludedFields.some(gap => gap.field === "wifi" && /冲突/.test(gap.reason)));
  assert.match(source.excludedFields[0].rejectedEvidence.value, /支持/);
  assert.match(source.excludedFields[0].conflictEvidence.rawText, /WLAN Not support/);
}
assert.equal(findWearable("xiaomi-band-9-nfc-2024").specs.batteryLife.value, "NFC 版为 18 天");
assert.equal(findWearable("xiaomi-band-9-2024").specs.batteryLife.value, "续航提升至 21 天", "标准版续航不能保留第三方错误的15天");
assert.equal(findWearable("xiaomi-band-9-2024").specs.displayType.value, "AMOLED 屏幕");
assert.equal(findWearable("redmi-watch-5-esim-2024").specs.batteryLife.value, "eSIM 典型续航模式标称可达 12 天");
assert.equal(findWearable("redmi-watch-5-esim-2024").specs.launchPrice.value, 799);
assert.equal(findWearable("redmi-watch-5-2024").specs.launchPrice.value, 599);
assert.equal(findWearable("xiaomi-watch-color-2019").releaseYear, 2019, "不能用2020年开售报道日期替代2019年推出年份");
const s4small = findWearable('xiaomi-watch-s4-41-2025');
assert.equal(s4small.releaseYear, 2025);
assert.equal(s4small.specs.screenSize.value, 1.32);
assert.equal(s4small.specs.batteryCapacity.value, 320);
assert.equal(s4small.specs.waterResistance.value, '5ATM');
assert.match(s4small.specs.compatibility.value, /iOS 14/);
assert.equal(s4small.specs.wearableWeight.value, '约 32g（不含表带）');
assert.equal(s4small.specs.launchPrice, undefined, '不同表带报价不能在未绑定具体版型时取最低价冒充所有版本');
const galleries = await read("src/data/device-image-galleries.json");
{
  const id = "honor-band-9-2024", expected = ["曜石黑", "云水蓝", "晨辉紫"];
  const device = findWearable(id), source = registry.get(id), verification = source.colorVersionVerification;
  assert.deepEqual(device.specs.colors.value, expected, "不能把旧图库空标签当作荣耀手环9真实配色");
  assert.deepEqual(verification.allowedColors, expected);
  const official = await getSourceSnapshot(verification.sourceUrl, { offline: true });
  assert.equal(official.sha256, verification.sourceSnapshotHash);
  assert.ok(plainText(official.html).includes(verification.rawText));
  const release = await getSourceSnapshot(device.specs.colors.sourceUrl, { offline: true });
  assert.equal(release.sha256, device.specs.colors.sourceSnapshotHash);
  assert.ok(plainText(release.html).includes(device.specs.colors.rawText));
  assert.deepEqual(targets.find(target => target.id === id).supplement.colors.split("、"), expected);
  assert.deepEqual(source.rejectedColorNames, ["晨晖金", "幻夜黑", "星空蓝"]);
  assert.equal(verification.rejectedEvidence.origin, "legacy_gallery_placeholder");
  assert.ok(galleries[id].colors.every(color => !source.rejectedColorNames.includes(color.name)));
  const { getDeviceImageGallery } = loadTsModule("./src/lib/device-images.ts");
  const publicColors = getDeviceImageGallery(id).colors.filter(color => color.name.startsWith("标准版 · "));
  assert.deepEqual(publicColors.map(color => color.name.replace("标准版 · ", "")).sort(), [...expected].sort());
  assert.ok(publicColors.every(color => color.image && color.image.viewScope !== "front_back"), "原有单面图不冒充正反同框");
  assert.equal(images[id].colorScope, "all_colors", "原有已核验三色宣传图继续保留，不计新增合集");
  assert.equal(images[id].url, "https://www-file.honor.com/content/dam/honor/cn/product/wear/honor-band-9/imgs/sec1/kv-pc.jpg");
}
assert.equal(findWearable("huawei-watch-fit-4-pro-2025").specs.cellular, undefined);
assert.equal(findWearable("huawei-watch-fit-4-pro-2025").specs.connectivity.value, "支持蓝牙通话");
for (const [id, count] of [["huawei-watch-fit-4-2025", 5], ["huawei-watch-fit-4-pro-2025", 3]]) {
  const device = findWearable(id);
  assert.equal(device.specs.displayType.value, "AMOLED 彩色屏幕", "表镜材质不能误作显示屏类型");
  assert.equal(device.specs.displayType.sourceType, "official");
  assert.equal(galleries[id].colors.length, count);
  assert.equal(new Set(galleries[id].colors.map(color => color.image.url)).size, count, "不能用同图冒充不同颜色");
  assert.ok(galleries[id].colors.every(color => color.image.licenseStatus === "unknown" && color.image.sourceUrl.includes("consumer.huawei.com/cn/")));
}
const apple = readAppleWearable({ ...sample, url: "https://support.apple.com/zh-cn/121202", html:
  "<h1>Apple Watch Series 10</h1><h2>显示屏</h2><ul><li>46 毫米</li><li>416 x 496 像素</li><li>42 毫米</li><li>374 x 446 像素</li><li>OLED 显示屏</li></ul><h2>电源和电池</h2><p>低电量模式最长36小时</p><footer></footer>" });
assert.equal(apple.resolution.value, "46 毫米：416 x 496 像素；42 毫米：374 x 446 像素");
assert.equal(apple.screenSize, undefined, "表壳毫米不是屏幕英寸");
assert.equal(apple.caseSize.value, "46 毫米 / 42 毫米");
assert.equal(apple.batteryLife.value, "低电量模式最长36小时");
const appleVersions = readAppleWearable({ ...sample, url: "https://support.apple.com/zh-cn/121202", html:
  '<h1>Apple Watch Series 10</h1><h2>尺寸和重量</h2><p>46mm</p><p>高度：46 毫米</p><p>重量 (铝金属；GPS)：36.2 克</p><p>重量 (钛金属)：41.7 克</p><p>42mm</p><p>高度：42 毫米</p><p>重量 (铝金属；GPS)：30.0 克</p><h2>连接</h2><p>L1 GPS、GLONASS 和北斗</p><p>LTE 和 UMTS</p><p>无线局域网 (802.11n)</p><p>蓝牙 5.3</p><p>Apple Pay</p><h2>兼容性</h2><p>iPhone Xs 或后续机型，以及 iPhone SE (第二代或后续机型)，并安装 iOS 18 或更新系统</p><footer></footer>' });
assert.equal(appleVersions.wearableWeight.value, '46mm：重量 (铝金属；GPS)：36.2 克；46mm：重量 (钛金属)：41.7 克；42mm：重量 (铝金属；GPS)：30.0 克');
assert.equal(appleVersions.dimensions.value, '46mm；高度：46 毫米；42mm；高度：42 毫米');
assert.equal(appleVersions.bluetooth.value, '蓝牙 5.3');
assert.equal(appleVersions.wifi.value, '无线局域网 (802.11n)');
assert.equal(appleVersions.positioning.value, 'L1 GPS、GLONASS 和北斗');
assert.equal(appleVersions.cellular.value, 'LTE 和 UMTS');
assert.match(appleVersions.cellular.note, /仅适用于/);
assert.equal(appleVersions.connectivity.value, 'Apple Pay');
assert.match(appleVersions.compatibility.value, /iPhone SE/);
const legacyCompatibility = readAppleWearable({ ...sample, url: 'https://support.apple.com/zh-cn/111932', html:
  '<h1>Apple Watch Series 4</h1><h2>显示屏</h2><p>OLED</p><p>Apple Watch Series 4 (GPS + 蜂窝网络) 需要使用 <a href="/iphone-6">iPhone 6</a> 或更新机型，并安装 iOS 12 或更新系统。</p><p>Apple Watch Series 4 (GPS) 需要使用 iPhone 5s 或更新机型，并安装 iOS 12 或更新系统。</p><footer></footer>' });
assert.match(legacyCompatibility.compatibility.value, /GPS \+ 蜂窝网络.*iPhone 6/);
assert.match(legacyCompatibility.compatibility.value, /\(GPS\).*iPhone 5s/);
const series10 = findWearable('apple-watch-series-10-2024');
assert.match(series10.specs.wearableWeight.value, /46mm：重量 \(铝金属；GPS\)： 36.2 克/);
assert.match(series10.specs.wearableWeight.value, /42mm：重量 \(铝金属；GPS\)： 30.0 克/);
assert.equal(series10.specs.bluetooth.value, '蓝牙 5.3');
assert.match(series10.specs.compatibility.value, /iPhone SE/);
const childrenImage = readOfficialColorGallery(
  '<title>华为儿童手表 5X 规格参数</title><ul class="specs-banner-img"><li><img src="/content/dam/huawei-cbg-site/cn/mkt/pdp/wearables/kids-watch-5x/specs.png" alt="华为儿童手表 5X"></li></ul>',
  { brand: "Huawei", category: "watch", modelName: "华为儿童手表 5X" },
  "https://consumer.huawei.com/cn/wearables/kids-watch-5x/specs/");
assert.ok(childrenImage.image?.url, "官方多配色合照可作为准确型号主图");
assert.deepEqual(childrenImage.colors, [], "合照不能拆作多张独立配色照片");
assert.equal(findWearable("samsung-galaxy-fit2-2021").releaseYear, 2021, "不能把海外2020发布年份当成国行上线年份");
assert.match(findWearable("samsung-galaxy-fit2-2021").specs.compatibility.value, /iOS 设备可能不支持部分功能/);
assert.equal(findWearable("redmi-band-3-2024").specs.screenSize.value, 1.47);
assert.equal(findWearable("redmi-band-3-2024").specs.chargingMethod, undefined, "不得复制第一代USB直充");
assert.deepEqual(findWearable("redmi-band-3-2024").specs.colors.value, ["黑色", "米色"]);
assert.equal(findWearable("xiaomi-mitu-watch-4-2020").specs.resolution, undefined, "ppi不能冒充像素分辨率");
assert.equal(findWearable("honor-watch-5-pro-bluetooth-2025").specs.cellular, undefined, "蓝牙版不能继承eSIM版能力");
assert.match(findWearable("huawei-kids-watch-5x-pro-2022").specs.displayType.value, /主屏.*副屏/);
assert.equal(findWearable("huawei-band-11-pro-2026").specs.screenSize.value, 1.62);
assert.equal(findWearable("samsung-galaxy-watch4-40-2021").specs.launchPrice.value, 1699, "国行正式上市价不得混用先行者尝鲜价");
assert.equal(findWearable("honor-watch-gs-3-leather-2022").specs.wearableChip, undefined, "第三方错误的Apple 4芯片不能出现在荣耀手表中");
assert.equal(findWearable("xiaomi-mitu-watch-7-2024").specs.onboardStorage.value, "8GB");
assert.equal(findWearable("xiaomi-mitu-watch-7x-2024").specs.onboardStorage.value, "4GB");
assert.equal(findWearable("xiaomi-mitu-watch-7x-2024").specs.healthFeatures, undefined, "7X不能继承7的健康监测能力");
assert.equal(findWearable("xiaomi-mitu-watch-7a-2024").specs.wearableCamera.value, "前置 200 万像素超广角摄像头");
assert.match(findWearable("xiaomi-mitu-watch-7a-2024").specs.wearableFeatures.value, /QQ、微信儿童版暂不支持/);
assert.deepEqual(findWearable("xiaomi-mitu-watch-7a-2024").specs.colors.value, ["蓝色", "绿色", "粉色"]);
assert.equal(findWearable("xiaomi-band-9-ceramic-2024").specs.launchPrice.value, 349);
assert.match(findWearable("xiaomi-band-9-ceramic-2024").specs.material.value, /陶瓷/);
assert.equal(findWearable("xiaomi-band-9-ceramic-2024").specs.batteryLife.value, "NFC 版为 18 天");
assert.equal(findWearable("xiaomi-band-8-pro-leather-2023").specs.strapMaterial.value, "真皮");
assert.equal(findWearable("xiaomi-band-8-pro-leather-2023").specs.launchPrice.value, 449);
const photochromic = findWearable("huawei-kids-watch-5-pro-photochromic-2024");
assert.equal(photochromic.specs.waterResistance.value, "IPX8", "IPX8不能冒充防尘等级");
assert.match(photochromic.specs.wearableCamera.value, /200 万像素.*500 万像素/);
assert.match(photochromic.specs.launchPrice.condition, /50元券/);
const x1 = findWearable("huawei-kids-watch-x1-2026"), x1pro = findWearable("huawei-kids-watch-x1-pro-2026");
assert.equal(x1.specs.onboardStorage.value, "32 GB ROM");
assert.equal(x1pro.specs.onboardStorage.value, "64 GB ROM");
assert.equal(x1.specs.strapMaterial.value, "硅胶表带");
assert.equal(x1pro.specs.strapMaterial.value, "硬胶表带");
assert.deepEqual(galleries[x1.id].colors.map(color => color.name), ["星际蓝", "星云粉"]);
assert.deepEqual(galleries[x1pro.id].colors.map(color => color.name), ["幻夜黑", "梦幻紫"]);
assert.equal(x1.specs.launchPrice.sourceType, "official");
assert.equal(x1.specs.launchPrice.value, 1598);
assert.equal(x1pro.specs.launchPrice.value, 2298);
for (const [suffix, color, price, size] of [
  ["43-white", "星芒白", 3499, 1.38], ["43-ceramic", "陶瓷白", 4899, 1.38],
  ["46-brown", "木星棕", 3599, 1.5], ["46-silver", "钛空银", 3999, 1.5], ["46-space", "太空探索", 4999, 1.5],
]) {
  const row = findWearable(`huawei-watch-6-pro-${suffix}-2026`);
  assert.equal(row.specs.screenSize.value, size);
  assert.equal(row.specs.launchPrice.value, price);
  assert.deepEqual(galleries[row.id].colors.map(photo => photo.name), [color], "不得混入其他尺寸或材质版照片");
  assert.equal(images[row.id].url, galleries[row.id].colors[0].image.url);
}
assert.match(findWearable("huawei-watch-6-pro-46-space-2026").specs.wearableWeight.value, /60 g/);
assert.match(findWearable("huawei-watch-6-pro-46-silver-2026").specs.wearableWeight.value, /57 g/);
assert.equal(findWearable("xiaomi-band-11-tricolor-ceramic-2026").specs.launchPrice.value, 499);
assert.equal(findWearable("xiaomi-band-11-tricolor-ceramic-2026").specs.strapMaterial.value, "精密复合编织表带");
const groupedColorGallery = readOfficialColorGallery(
  '<title>HUAWEI WATCH 6 Pro 参数规格</title><span class="color-icon" data-name="陶瓷白" data-image="/content/dam/huawei-cbg-site/cn/mkt/pdp/wearables/watch-6-pro/list/43mm/ceramic-white.png"></span><span class="color-icon" data-name="伪造图片" data-image="https://example.com/image.png"></span>',
  { brand: "Huawei", category: "watch", modelName: "HUAWEI WATCH 6 Pro" },
  "https://consumer.huawei.com/cn/wearables/watch-6-pro/specs/");
assert.deepEqual(groupedColorGallery.colors.map(photo => photo.name), ["陶瓷白"], "只接受厂商声明的安全图片地址");
const { compareCatalogSeries } = loadTsModule("./src/lib/catalog-order.ts");
const watchSeries = family => ({ brand: "Xiaomi", category: "watch", family, variant: "standard", label: family });
assert.ok(compareCatalogSeries(watchSeries("小米 Watch S"), watchSeries("米兔儿童手表")) < 0, "主流手表系列排在儿童款前，不使用虚构热度评分");

const { allDevices, allDevicesFlat, flattenDevice, categoryNames, getComparisonGroupLabelFlat } = loadTsModule("./src/lib/devices-db.ts");
assert.deepEqual(categoryNames, ["phone", "tablet", "laptop", "watch", "band"], "品类顺序不依赖数据批次插入顺序");
assert.equal(getComparisonGroupLabelFlat("小米手环", "pro-leather"), "小米手环 Pro 真皮版");
assert.equal(getComparisonGroupLabelFlat("小米手环", "ceramic"), "小米手环 陶瓷版");
assert.equal(getComparisonGroupLabelFlat("Galaxy Watch", "44mm-bluetooth"), "Galaxy Watch 44mm 蓝牙版");
assert.equal(getComparisonGroupLabelFlat("MacBook Air", "13-inch"), "MacBook Air 13 英寸");
const { getDeviceConfigurations, getPriceConfiguration } = loadTsModule("./src/lib/device-configurations.ts");
const { getDeviceSpecFields } = loadTsModule("./src/lib/device-spec-fields.ts");
const wearableFlat = allDevicesFlat.filter(device => ["watch", "band"].includes(device.category));
assert.ok(wearableFlat.every(device => getDeviceConfigurations(device).length === 0));
const fields = getDeviceSpecFields(wearableFlat);
for (const key of ["memory", "storage", "cpu", "gpu", "rearCamera", "port", "neuralEngine"]) {
  assert.ok(!fields.some(field => field.key === key), `${key} 不是穿戴默认核心字段`);
}
assert.ok(fields.some(field => field.key === "compatibility"));
assert.ok(fields.some(field => field.key === "healthFeatures"));
const device = allDevices.find(device => device.id === "xiaomi-watch-s3-2023");
const flat = flattenDevice(device);
assert.ok(getPriceConfiguration(flat, { configuration: `国行 ${flat.model}`, unit: "CNY", market: "中国大陆" }));
for (const configuration of [`国行 ${flat.model} eSIM版`, `港版 ${flat.model}`, "8GB + 256GB", "国行 小米 Watch S4 标准版"]) {
  assert.equal(getPriceConfiguration(flat, { configuration }), null);
}
assert.equal(getPriceConfiguration(flat, { configuration: `国行 ${flat.model}`, market: "US" }), null);
assert.equal(getPriceConfiguration(flat, { configuration: `国行 ${flat.model}`, unit: "USD" }), null);
assert.equal(getPriceConfiguration(flattenDevice(s2small), { configuration: `国行 ${s2large.modelName}`, unit: "CNY", market: "中国大陆" }), null,
  "42mm硅胶版不能绑定46mm硅胶版报价");
const multiSize = allDevicesFlat.find(device => device.id === "apple-watch-series-10-2024");
assert.equal(getPriceConfiguration(multiSize, { configuration: `国行 ${multiSize.model}` }), null,
  "多尺寸汇总记录不能冒充一个可直接下单的准确报价版型");
const { buildDeviceAdvisorContext, buildDeviceAdvisorPrompt, normalizeDeviceAdvisorInput } = loadTsModule("./src/lib/device-advisor.ts");
assert.equal(buildDeviceAdvisorContext({ intent: "买一块手表搭配我的手机跑步" }).userProfile.category, "watch");
assert.equal(buildDeviceAdvisorContext({ intent: "买手环，能连iPhone" }).userProfile.category, "band");
assert.equal(normalizeDeviceAdvisorInput({ category: "band" }).category, "band");
assert.ok(buildDeviceAdvisorContext({ category: "band", budget: 500 }).candidateShortlist.every(candidate =>
  candidate.referencePrice === null && /不用于预算筛选|待补充/.test(candidate.priceText)), "首发价不是当前价，不算预算内");
const prompt = buildDeviceAdvisorPrompt({ category: "watch", intent: "运动健康和续航" });
assert.match(prompt, /手机兼容性|compatibility/);
assert.match(prompt, /医疗诊断/);
assert.match(prompt, /batteryLife/);
const priced = { ...device, id: "regression-wearable-quote", specs: { ...device.specs, currentPrice: {
  ...device.specs.launchPrice, value: 600, priceType: "current", observedAt: "2026-10-06",
  condition: "全新", configuration: `国行 ${device.modelName}`,
} } };
allDevices.push(priced);
try {
  const within = buildDeviceAdvisorContext({ category: "watch", budget: { min: 600, max: 600 } });
  assert.equal(within.candidateShortlist.length, 1);
  assert.equal(within.candidateShortlist[0].deviceId, priced.id);
  assert.equal(within.candidateShortlist[0].facts.memory, undefined);
  assert.equal(within.candidateShortlist[0].facts.storage, undefined);
  assert.equal(within.candidateShortlist[0].facts.priceConfiguration, `国行 ${device.modelName}`);
} finally { allDevices.pop(); }

// 可选：使用本轮采集的内容寻址缓存重放，普通CI无需联网/私有缓存。
if (process.argv.includes("--snapshots")) {
  const directory = process.env.WEARABLE_SOURCE_CACHE ?? ".source-cache";
  const snapshots = new Map();
  for (const device of wearable) {
    const source = registry.get(device.id);
    for (const field of [...Object.values(device.specs), source.releaseEvidence,
      ...(source.excludedFields ?? []).flatMap(row => [row.rejectedEvidence, row.conflictEvidence]).filter(Boolean)]) {
      if (!snapshots.has(field.sourceUrl)) snapshots.set(field.sourceUrl, await getSourceSnapshot(field.sourceUrl, { directory, offline: true }));
      const page = snapshots.get(field.sourceUrl);
      assert.equal(page.sha256, field.sourceSnapshotHash);
      assert.equal(page.fetchedAt, field.fetchedAt);
      if (source.excludedFields?.some(row => row.conflictEvidence === field)) assert.ok(plainText(page.html).includes(field.rawText));
    }
    const imagePage = await getSourceSnapshot(images[device.id].sourceUrl, { directory, offline: true });
    assert.equal(imagePage.sha256, images[device.id].sourceSnapshotHash);
    assert.ok(imagePage.html.includes(images[device.id].url.split("/").at(-1)));
    for (const color of galleries[device.id]?.colors ?? []) {
      const origin = await getSourceSnapshot(color.image.sourceUrl, { directory, offline: true });
      assert.equal(origin.sha256, color.image.sourceSnapshotHash);
      assert.ok(origin.html.includes(color.image.url.split("/").at(-1)) && origin.html.includes(color.name));
    }
    if (device.specs.launchPrice) {
      const field = device.specs.launchPrice;
      assert.ok(plainText(snapshots.get(field.sourceUrl).html).includes(field.rawText));
      assert.ok(field.rawText.replace(/(?<=\d),(?=\d)/g, "").includes(String(field.value)));
    }
  }
  const colorCount = wearable.reduce((count, device) => count + (galleries[device.id]?.colors.length ?? 0), 0);
  console.log(`穿戴来源离线重放通过：${snapshots.size} 个参数/发布快照，${wearable.length} 张型号主图与${colorCount}张配色图`);
}
console.log(`穿戴回归通过：${wearable.length}台、五品类、版本/报价绑定、单位清理、官方冲突修正、非虚构配置与预算空值`);
