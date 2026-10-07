import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getSourceSnapshot } from "./lib/source-snapshot.mjs";
import { verifyCameraScore } from "./lib/dxomark-snapshot.mjs";
import { extractZolProductImage, importZolSeries, readRelease, readSingleCapacity, readStorageCapacity, readZolOptionalSpecs, zolRows } from "./lib/zol-device.mjs";
import { readOfficialAndroidSpecs, readOppoShopData } from "./lib/android-official-specs.mjs";
import { mergeColorImages, readAppleColorImages, readAppleIdentificationImage, readAppleSupportColorImages, readOfficialColorGallery, readPconlineProductImage, readReviewedProductImage, readShihuoColorImages, readXiaomiPro2017Image, readZolColorImages, readZolGalleryImage, readZolColors, safeImageUrl } from "./lib/device-images.mjs";

const catalog = JSON.parse(await fs.readFile("src/data/device-images.json", "utf8"));
const database = JSON.parse(await fs.readFile("src/data/devices-db.json", "utf8"));
const registry = JSON.parse(await fs.readFile("src/data/device-sources.json", "utf8"));
const models = new Map(database.devices.map((device) => [device.id, device]));
const sources = new Map(registry.devices.map((source) => [source.id, source]));
const palettes = JSON.parse(await fs.readFile("src/data/device-image-galleries.json", "utf8"));
const existingColors = [{ name: "黑色", image: { url: "verified-black" } }, { name: "白色", image: { url: "verified-white" } }];
assert.deepEqual(mergeColorImages(existingColors, [{ name: "黑色" }]), existingColors, "文字参数页和后续请求失败不能擦除已核验颜色图片");
assert.deepEqual(mergeColorImages(existingColors, [{ name: "黑色", image: { url: "new-verified-black" } }]),
  [{ name: "黑色", image: { url: "new-verified-black" } }, existingColors[1]], "官方单 SKU 一种颜色不能删除其他已核验配色");
assert.deepEqual(mergeColorImages(existingColors, []), existingColors, "空页面重放不能损失已核验配色");
assert.equal(safeImageUrl("https://cdn.cnbj1.fds.api.mi-img.com/product-images/redmiBooks/14-20248abe56/section-01.jpg?v2="), null, "已拒绝 CPU 广告冲突图不能进入补图名单");
const reviewedImage = { status: "downloaded_and_visually_reviewed", targetIds: ["own-standard"],
  anchor: '<img src="/content/dam/huawei-cbg-site/cn/own.png" alt="银色"/>',
  sourceUrl: "https://consumer.huawei.com/cn/tablets/own/specs/",
  url: "https://consumer.huawei.com/content/dam/huawei-cbg-site/cn/own.png" };
assert.equal(readReviewedProductImage(reviewedImage.anchor, { id: "own-standard", modelName: "本型号" }, reviewedImage).url, reviewedImage.url);
assert.throws(() => readReviewedProductImage(reviewedImage.anchor, { id: "own-yuexiang" }, reviewedImage), /版型/, "基型图不能擅自套悦享款");
assert.throws(() => readReviewedProductImage("<title>same</title>", { id: "own-standard" }, reviewedImage), /锚点/);
assert.throws(() => readReviewedProductImage(reviewedImage.anchor, { id: "own-standard" }, { ...reviewedImage, url: reviewedImage.url.replace("own.png", "other.png") }), /资源/);
const shopImage = "https://msecfs.opposhop.cn/commons-media-picture/GOODS/20260101/standard.png";
const shopProduct = { goodsSpuName: "OPPO Pad Air5", goodsSkuId: "12", name: "OPPO Pad Air5 银色 8GB+256GB WIFI版", url: shopImage,
  baseAttributes: [{}], attributes: { skuItems: [{ skuId: "12", key1: "银色", key3: "WIFI版" }, { skuId: "13", key1: "银色 柔光版", key3: "WIFI版" }] },
  attributesColorParams: [{ color: "银色", colorUrl: shopImage }, { color: "银色 柔光版", colorUrl: shopImage.replace("standard", "soft") }] };
const shopHtml = `window.__NUXT__=(function(a){return {data:[{resData:a}]}}(${JSON.stringify(shopProduct)}));</script>`;
const shopDevice = { brand: "OPPO", modelName: "OPPO Pad Air5 Wi-Fi版", variant: "wifi" };
assert.deepEqual(readOppoShopData(shopHtml), shopProduct);
assert.deepEqual(readOfficialColorGallery(shopHtml, shopDevice, "https://www.opposhop.cn/cn/web/products/12.html").colors, [{ name: "银色", url: shopImage }]);
assert.throws(() => readOfficialColorGallery(shopHtml, { ...shopDevice, variant: "wifi-soft-light", modelName: "OPPO Pad Air5 Wi-Fi柔光版" }, "https://www.opposhop.cn/cn/web/products/12.html"), /版型/);
assert.throws(() => readOfficialColorGallery(shopHtml, shopDevice, "https://www.opposhop.cn/cn/web/products/13.html"));
assert.throws(() => readOfficialColorGallery(shopHtml.replace('"WIFI版"', '"SIM版"'), shopDevice, "https://www.opposhop.cn/cn/web/products/12.html"), /网络/);
assert.throws(() => readOppoShopData(shopHtml.replace("resData:a", "resData:fetch()")), /标识符/, "不得执行来源脚本或函数调用");
const samsungShopUrl = "https://www.samsung.com.cn/smartphones/galaxy-z/galaxy-z-flip6-yellow-256gb-sm-f7410zyachc/buy/";
const samsungShopImage = "https://images.samsung.com.cn/is/image/samsung/p6pim/cn/2407/gallery/cn-galaxy-zflip6-sm-f7410zyachc-12345";
const samsungShopGroup = { groupName: "Galaxy Z Flip6", presetModel: "SM-F7410ZYACHC", products: { SM_F7410: null,
  "SM-F7410ZYACHC": { modelCode: "SM-F7410ZYACHC", hingePopupImage: samsungShopImage } } };
const samsungShopHtml = `<script>var BC_GROUP = ${JSON.stringify(samsungShopGroup)};</script>`;
assert.equal(readOfficialColorGallery(samsungShopHtml, { brand: "Samsung", modelName: "Samsung Galaxy Z Flip6" }, samsungShopUrl).image.url, samsungShopImage);
assert.throws(() => readOfficialColorGallery(samsungShopHtml, { brand: "Samsung", modelName: "Samsung Galaxy Z Fold6" }, samsungShopUrl), /准确/);
assert.throws(() => readOfficialColorGallery(samsungShopHtml.replaceAll("CHC", "XAA"), { brand: "Samsung", modelName: "Samsung Galaxy Z Flip6" }, samsungShopUrl), /准确/, "海外代码不能当国行图片绑定");
const samsungSupportImage = "https://images.samsung.com.cn/is/image/samsung/cn-galaxy-c8-sm-c7100zdgchc-12345?$624_624_PNG$";
assert.equal(readOfficialColorGallery(`<h1>盖乐世 C8</h1><img class="image__main" data-mobile-src="${samsungShopImage}"><img class="image__main" data-mobile-src="${samsungSupportImage}">`,
  { brand: "Samsung", modelName: "Samsung Galaxy C8" }, "https://www.samsung.com.cn/support/model/SM-C7100ZDGCHC/").image.url, samsungSupportImage);
const identifyHtml = '<h2>iPhone 11 Pro</h2><img class="gb-image" src="https://cdsassets.apple.com/live/images/pro.jpg">'
  + '<h2>iPhone 11</h2><img class="gb-image" src="https://cdsassets.apple.com/live/images/standard.jpg">'
  + '<p>推出年份：2019 年，型号：A2223（中国大陆）</p><h2>iPhone XS</h2>';
assert.ok(readAppleIdentificationImage(identifyHtml, { modelName: "iPhone 11", releaseYear: 2019 }).url.endsWith("/standard.jpg"));
assert.equal(readAppleIdentificationImage(identifyHtml, { modelName: "iPhone 11 Pro Max", releaseYear: 2019 }), null);
assert.throws(() => readAppleIdentificationImage(identifyHtml, { modelName: "iPhone 11", releaseYear: 2020 }), /年份/);
const pconlineImageHtml = '<title>Xiaomi 18 Pro参数_详细参数</title><img src="https://evil.example.com/image.png">'
  + '<div class="item"><div><img src="http://img4.pconline.com.cn/pconline/images/product/20260923/63154620.png?x-oss-process=image/resize,mfit,w_750"></div></div>';
assert.ok(readPconlineProductImage(pconlineImageHtml, { modelName: "小米 18 Pro" }).url.startsWith("https://img4.pconline.com.cn/"));
assert.throws(() => readPconlineProductImage(pconlineImageHtml, { modelName: "小米 18 Pro Max" }), /准确型号/);
const pconlineCompareImage = '<title>Xiaomi Watch S4 41mm参数_详细参数</title><a onclick="compareBar.comparePro(this,\'//product.pconline.com.cn/smartwatch/xiaomi/2678839.html\',\'Xiaomi Watch S4 41mm\',\'//img4.pconline.com.cn/pconline/images/product/20250627/29068523_cn.jpg\',\'999\')">对比</a>';
assert.equal(readPconlineProductImage(pconlineCompareImage, { modelName: '小米 Watch S4 41mm' }).url, 'https://img4.pconline.com.cn/pconline/images/product/20250627/29068523_cn.jpg');
assert.equal(readPconlineProductImage(pconlineCompareImage.replace("'Xiaomi Watch S4 41mm'", "'Xiaomi Watch S4 46mm'"), { modelName: '小米 Watch S4 41mm' }), null);
const miProHtml = '<title>小米笔记本Pro 15.6寸 - 小米商城</title><p>i5-8250U / i7-8550U MX150</p>'
  + '<img data-src="//i1.mifile.cn/f/i/17/mibookpro/index/bg-top.jpg">';
assert.ok(readXiaomiPro2017Image(miProHtml, { id: "xiaomi-book-pro-15-2017", modelName: "小米笔记本 Pro (2017)" }, "https://www.mi.com/mibookpro")?.url);
assert.equal(readXiaomiPro2017Image(miProHtml, { id: "xiaomi-book-pro-15-2019" }, "https://www.mi.com/mibookpro"), null);
assert.throws(() => readXiaomiPro2017Image(miProHtml.replace("MX150", "MX250"), { id: "xiaomi-book-pro-15-2017" }, "https://www.mi.com/mibookpro"), /版本/);
function validateImage(id, image) {
  assert.equal(image.modelName, models.get(id)?.modelName, `${id}: 图片不得错配到其他型号`);
  const source = sources.get(id);
  assert.notEqual(image.url, source?.rejectedImageCandidate?.url, `${id}: 明确拒绝的年份/型号图片不能重新登记`);
  const known = [...source?.referenceUrls ?? [], source?.supportUrl, source?.officialSpecUrl, models.get(id)?.specs.colors?.sourceUrl];
  assert.ok(known.includes(image.linkedFromUrl ?? image.sourceUrl), `${id}: 图片必须出自登记的型号页面或其直接链接`);
  assert.equal(safeImageUrl(image.url), image.url, `${id}: 素材域名和路径受限`);
  assert.match(image.sourceSnapshotHash, /^[a-f0-9]{64}$/);
  assert.ok(Number.isFinite(Date.parse(image.fetchedAt)) && image.alt);
}
for (const [id, image] of Object.entries(catalog)) validateImage(id, image);
for (const [id, palette] of Object.entries(palettes)) {
  assert.equal(palette.modelName, models.get(id)?.modelName);
  assert.equal(new Set(palette.colors.map((color) => color.name)).size, palette.colors.length, `${id}: 配色重复`);
  for (const color of palette.colors) {
    assert.ok(color.name.trim());
    assert.notEqual(color.name, "查看外观", `${id}: 导航文字不能进入产品配色清单`);
    if (color.image) validateImage(id, color.image);
  }
}
for (const [id, value, memory, storage] of [
  ["redmi-k70-2023", 2499, "12GB", "256GB"], ["redmi-k70-pro-2023", 3299, "12GB", "256GB"],
  ["redmi-k80-2024", 2499, "12GB", "256GB"], ["redmi-k80-pro-2024", 3699, "12GB", "256GB"],
  ["xiaomi-pad-6-max-14-2023", 3599, "8GB", "256GB"], ["xiaomi-pad-6s-pro-12-4-2024", 3299, "8GB", "256GB"],
  ["xiaomi-pad-7s-pro-2025", 3299, "8GB", "256GB"],
  ["huawei-pura-70-2024", 5499, "12GB", "256GB"], ["huawei-pura-70-pro-2024", 6499, "12GB", "256GB"],
]) {
  const device = models.get(id);
  assert.equal(device.specs.launchPrice.value, value, `${id}: 首发价不是当前价或其他配置的价格`);
  assert.ok(device.configurations.some((config) => config.memory === memory && config.storage === storage));
  assert.match(device.specs.launchPrice.configuration, new RegExp(`${memory}.*${storage}`));
}
assert.equal(models.get("huawei-pura-70-2024").specs.chip.value, "麒麟 9000S1", "标准版不能混用卫星版处理器");
assert.equal(models.get("huawei-pura-70-pro-2024").specs.chip.value, "麒麟 9010");
assert.equal(models.get("huawei-pura-70-pro-plus-2024").specs.chip.value, "麒麟 9010");

const directory = await fs.mkdtemp(path.join(os.tmpdir(), "device-source-test-"));
const url = "https://example.com/spec";
let calls = 0;
const fetcher = async () => { calls += 1; return new Response("<html>16GB</html>"); };
try {
  const colorHtml = '<div class="category-filter category-color-filter"><div><a data-id="1" title="黑色"><i></i></a><a data-id="2" title="白色"></a></div></div>'
    + ' <script>var picList = [{"sid":"88","proId":100,"classId4":"1","className":"外观图","picSrc":"https://2d.zol-img.com.cn/product/270_100x75/321/phone.png"},'
    + '{"sid":"99","proId":101,"classId4":"2","className":"外观图","picSrc":"https://2d.zol-img.com.cn/product/270_100x75/321/other.png"}];</script>';
  const colorImages = readZolColorImages(colorHtml, { seriesId: "88" });
  assert.deepEqual(readZolColors('<strong class="head-title">颜色：</strong><div><a><b></b>黑色</a><a>白色</a></div>'), ["黑色", "白色"], "无照片的已售配色仍列出");
  assert.deepEqual(readZolColors('<tr><th>机身颜色</th><td><span>黑色，白色，岩石青，雪山粉&nbsp;&nbsp;<a href="/pic.shtml">查看外观></a></span><em>纠错</em></td></tr>'),
    ["黑色", "白色", "岩石青", "雪山粉"], "查看外观是导航链接，不是产品配色");
  assert.equal(colorImages[0].url, "https://2d.zol-img.com.cn/product/270/321/phone.png");
  assert.equal(readZolGalleryImage(colorHtml, "100")?.url, "https://2d.zol-img.com.cn/product/270/321/phone.png");
  assert.equal(readZolGalleryImage(colorHtml, "102"), null, "缺主图不能借用相关型号的图库照片");
  assert.equal(readZolGalleryImage(colorHtml.replace('"className":"外观图"', '"className":"评测图解"'), "100"), null);
  assert.deepEqual(colorImages[1], { name: "白色" }, "缺图不取其他型号或其他颜色的图片");
  assert.throws(() => readZolColorImages(colorHtml, { productId: "102" }), /型号/);
  assert.equal(readZolColorImages(colorHtml.replace('"className":"外观图"', '"className":"评测图解"'), { seriesId: "88" })[0].url, undefined);
  assert.equal(safeImageUrl("javascript:alert(1)"), null);
  assert.equal(safeImageUrl("https://evil.example.com/product/270/321/phone.png"), null);
  const vivoHtml = '<title>vivo X200 参数</title><img src="https://wwwstatic.vivo.com.cn/vivoportal/files/image/detail/other.png" alt="vivo (其他色)">'
    + '<ul class="color-image-list"><li><img src="https://wwwstatic.vivo.com.cn/vivoportal/files/image/detail/own.png" alt="vivo (辰夜黑)"></li></ul>';
  assert.deepEqual(readOfficialColorGallery(vivoHtml, { brand: "vivo", modelName: "vivo X200" }, "https://www.vivo.com.cn/vivo/param/x200").colors.map((c) => c.name), ["辰夜黑"], "官方导航图片不进入配色图库");
  assert.throws(() => readOfficialColorGallery(vivoHtml, { brand: "vivo", modelName: "vivo X300" }, "https://www.vivo.com.cn/vivo/param/x300"), /型号/);
  const samsungHtml = '<title>Galaxy S25 参数</title><button aria-controls="standard">Galaxy S25</button><button aria-controls="plus">Galaxy S25+</button>'
    + '<div class="specification-tab__container" id="standard"><figure><img class="image__main" data-src="//images.samsung.com.cn/is/image/samsung/assets/cn/own.jpg"><figcaption>冷川蓝</figcaption></figure></div>'
    + '<div class="specification-tab__container" id="plus"><figure><img class="image__main" data-src="//images.samsung.com.cn/is/image/samsung/assets/cn/plus.jpg"><figcaption>远海蓝</figcaption></figure></div>';
  assert.deepEqual(readOfficialColorGallery(samsungHtml, { brand: "Samsung", modelName: "Samsung Galaxy S25+" }, "https://www.samsung.com.cn/smartphones/galaxy-s25/specs/").colors.map((c) => c.name), ["远海蓝"], "同页标准版与 Plus 配色图按型号隔离");
  const oppoHtml = '<title>OPPO Find X8</title><div class="color-list-name"><div>浮光白 | 星野黑</div></div><section id="section-color"><img class="color-img-2" data-src-1440="/content/dam/oppo/find-x8/white.png.avif">'
    + '<div class="btn-2" data-gtm-label="浮光白"></div><div class="btn-3" data-gtm-label="星野黑"></div></section>';
  assert.ok(readOfficialColorGallery(oppoHtml, { brand: "OPPO", modelName: "OPPO Find X8" }, "https://www.oppo.com/cn/smartphones/series-find-x/find-x8/").colors[0].url, "已有色名清单时仍补入对应颜色图片");
  const supportHtml = '<h3>外观</h3><ul><li>银色</li><li>深空灰色</li></ul><img class="gb-image" src="https://cdsassets.apple.com/live/images/sp/mbp13-silver.jpg">';
  assert.ok(readAppleSupportColorImages(supportHtml)[0].url);
  assert.deepEqual(readAppleSupportColorImages(supportHtml)[1], { name: "深空灰色" }, "不能给灰色复用银色照片");
  const appleBlackHtml = '<img class="gb-image" src="https://cdsassets.apple.com/live/images/sp/iphone7-jetblack.png">'
    + '<img class="gb-image" src="https://cdsassets.apple.com/live/images/sp/iphone7-black.png">'
    + '<img class="gb-image" src="https://cdsassets.apple.com/live/images/sp/iphone7-red.png">';
  const blackColors = readAppleSupportColorImages(appleBlackHtml, ["黑色、亮黑色、红色"]);
  assert.deepEqual(blackColors.map((color) => color.name), ["黑色", "亮黑色", "红色"], "逗号连接的配色拆成独立选项");
  assert.ok(blackColors[0].url.endsWith("iphone7-black.png"), "黑色不能误用亮黑色图片");
  assert.ok(blackColors[1].url.endsWith("iphone7-jetblack.png"));
  assert.ok(blackColors[2].url.endsWith("iphone7-red.png"));
  const macGrayHtml = '<img class="gb-image" src="https://cdsassets.apple.com/live/images/sp/mbp13touch-space-select-202005.png">'
    + '<img class="gb-image" src="https://cdsassets.apple.com/live/images/sp/mbp13touch-space-ports.png">';
  assert.ok(readAppleSupportColorImages(macGrayHtml, ["深空灰色"])[0].url.endsWith("space-select-202005.png"));
  assert.deepEqual(readAppleSupportColorImages(macGrayHtml.replace("space-select-202005", "spacesilver"), ["深空灰色"]),
    [{ name: "深空灰色" }], "端口图和名称相似的其他色不能充当外观图");
  const appleHtml = '<script>window.PRODUCT_SELECTION_BOOTSTRAP = { productSelectionData: '
    + JSON.stringify({ imageDictionary: { own: { alt: "黑色 iPhone 16，背面外观", sources: [{ srcSet: "https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/iphone16-black?wid=940" }] },
      other: { alt: "白色 iPhone 16 Plus，背面外观", sources: [{ srcSet: "https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/iphone16plus-white?wid=940" }] } } }) + ' }</script>';
  const appleColors = readAppleColorImages(appleHtml, "iPhone 16", ["黑色", "白色"]);
  assert.ok(appleColors[0].url);
  assert.deepEqual(appleColors[1], { name: "白色" }, "同色的 Plus 型号不得套用到标准版");
  const appleVariantHtml = '<script>window.PRODUCT_SELECTION_BOOTSTRAP = { productSelectionData: '
    + JSON.stringify({ imageDictionary: {
      own: { alt: "冰川蓝色 (浅蓝色系) iPhone 18 Pro，展示机身背面", sources: [{ srcSet: "https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/iphone18pro-blue" }] },
      ownModelFirst: { alt: "iPhone 16，展示机身背面、深青色外观、摄像头系统", sources: [{ srcSet: "https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/iphone16-teal" }] },
      otherModelFirst: { alt: "iPhone 16 Plus，展示机身背面、粉色外观、摄像头系统", sources: [{ srcSet: "https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/iphone16plus-pink" }] },
    } }) + ' }</script>';
  assert.ok(readAppleColorImages(appleVariantHtml, "iPhone 18 Pro", ["冰川蓝色"])[0].url, "官网色系括号注释不影响准确的型号和色名匹配");
  assert.ok(readAppleColorImages(appleVariantHtml, "iPhone 16", ["深青色"])[0].url, "支持官网型号在前、色名在后的图片说明");
  assert.deepEqual(readAppleColorImages(appleVariantHtml, "iPhone 16", ["粉色"]), [{ name: "粉色" }]);
  assert.deepEqual(readAppleColorImages('<script>throw new Error("not executed")</script>', "iPhone 16", ["黑色"]), []);
  const shihuoHtml = '<script id="__NEXT_DATA__" type="application/json">' + JSON.stringify({ props: { pageProps: {
    data: { data: { meta_title: "Apple/苹果 iPhone 15 Pro 5G" } }, styleListData: { data: { list: { list: [{
      img_arr: [{ img_alt: "商品配色： 原色钛金属", img_url: "http://static.shihuocdn.cn/common/natural.jpeg" }],
    }] } } },
  } } }) + '</script>';
  assert.equal(readShihuoColorImages(shihuoHtml, "iPhone 15 Pro", ["原色钛金属"])[0].url, "https://static.shihuocdn.cn/common/natural.jpeg");
  assert.throws(() => readShihuoColorImages(shihuoHtml, "iPhone 15", ["原色钛金属"]), /型号/);
  assert.deepEqual(readShihuoColorImages(shihuoHtml, "iPhone 15 Pro", ["白色钛金属"]), [{ name: "白色钛金属" }]);
  const tabletHtml = shihuoHtml.replace("iPhone 15 Pro 5G", "iPad Air7 2025款 11英寸 M3芯片");
  const tablet = { brand: "Apple", category: "tablet", releaseYear: 2025, specs: { screenSize: { value: 11 } } };
  assert.ok(readShihuoColorImages(tabletHtml, "11 英寸 iPad Air (M3)", ["原色钛金属"], tablet)[0].url);
  assert.throws(() => readShihuoColorImages(tabletHtml, "13 英寸 iPad Air (M3)", [], { ...tablet, specs: { screenSize: { value: 13 } } }), /型号/);
  assert.throws(() => readShihuoColorImages(tabletHtml.replace("M3芯片", "M4芯片"), "11 英寸 iPad Air (M3)", [], tablet), /型号/);
  const basicTablet = { ...tablet, releaseYear: 2022, specs: { screenSize: { value: 10.86 } } };
  const basicHtml = shihuoHtml.replace("iPhone 15 Pro 5G", "iPad10 2022款 10.9英寸");
  assert.ok(readShihuoColorImages(basicHtml, "iPad (第 10 代)", ["原色钛金属"], basicTablet)[0].url);
  assert.throws(() => readShihuoColorImages(basicHtml.replace("iPad10", "iPad11"), "iPad (第 10 代)", [], basicTablet), /型号/);
  const imageHtml = '<h1>REDMI K80</h1><meta itemprop="image" content="https://2d.zol-img.com.cn/product/270_280x210/321/phone.png"><img src="https://2d.zol-img.com.cn/product/270_320x240/321/phone.png" alt="红米K80">';
  assert.equal(extractZolProductImage(imageHtml).alt, "红米K80");
  assert.equal(extractZolProductImage(imageHtml.replace('alt="红米K80"', 'alt="红米K80 Pro"')), null, "不能用相似型号图片");
  const samsungImageHtml = imageHtml.replaceAll("REDMI K80", "Samsung（三星）Galaxy A55").replace('alt="红米K80"', 'alt="Samsung（三星）Galaxy A54"');
  assert.equal(extractZolProductImage(samsungImageHtml), null, "三星的品牌括号不能导致不同 Galaxy 型号被视为同一设备");
  assert.equal(extractZolProductImage(imageHtml.replaceAll("2d.zol-img.com.cn", "evil.example.com")), null, "图片域名必须受信");
  assert.equal(extractZolProductImage(imageHtml.replaceAll("https://2d.zol-img.com.cn", "invalid")), null, "无效图片地址安全跳过");
  assert.equal(extractZolProductImage('<h1>REDMI K80</h1><img src="https://2d.zol-img.com.cn/product/270_320x240/321/phone.png" alt="红米K80">'), null, "不选任意正文图片");
  assert.equal(readRelease(new Map([["上市日期", "2024年08"]])).date, "2024-08");
  assert.equal(readRelease(new Map([["上市日期", "2024年2月29日"]])).date, "2024-02-29");
  assert.throws(() => readRelease(new Map([["上市日期", "2023年2月29日"]])), /无效/);
  assert.throws(() => readRelease(new Map([["上市日期", "2026年12月"]])), /尚未上市/);
  assert.equal(readRelease(new Map([["上市日期", "2017年3月3日"]]), { minYear: 2017 }).date, "2017-03-03");
  assert.throws(() => readRelease(new Map([["上市日期", "2017年3月3日"]])), /收录范围/);
  assert.throws(() => readRelease(new Map([["上市日期", "2016年12月"]]), { minYear: 2017 }), /收录范围/);
  assert.equal(zolRows('<tr><th>内存容量</th><td>16GB <em>纠错</em><a>更多参数</a></td></tr>').get("内存容量"), "16GB");
  assert.equal(readSingleCapacity("16GB（8GB×2） 极速运行"), "16GB");
  assert.equal(readSingleCapacity("16GB（8GB×4）"), null);
  assert.equal(readSingleCapacity("16GB（16GB×2）"), null);
  assert.equal(readSingleCapacity("64GB/128GB"), null);
  assert.equal(readStorageCapacity("256GB+1TB", "laptop"), "256GB + 1TB");
  assert.equal(readStorageCapacity("256GB+1TB", "phone"), null);
  assert.equal(readStorageCapacity("256GB/1TB", "laptop"), null);
  assert.equal(readStorageCapacity("256GB+1TB可选", "laptop"), null);
  const referenceFields = readZolOptionalSpecs({ html: '<table><tr><th>屏幕尺寸</th><td>主：7.92英寸 副：6.43英寸</td></tr><tr><th>NFC</th><td>不支持NFC</td></tr><tr><th>有线充电</th><td>66w</td></tr><tr><th>无线充电</th><td>50w</td></tr><tr><th>操作系统</th><td>MagicOS 8.0.1</td></tr></table>',
    url: "https://detail.zol.com.cn/1/1/param.shtml", fetchedAt: "2026-10-06T00:00:00Z", sha256: "b".repeat(64) });
  assert.equal(referenceFields.hasNFC.value, false);
  assert.equal(referenceFields.chargingMethod.value, "有线充电：66w；无线充电：50w");
  assert.equal(referenceFields.screenSizeDetails.value, "主：7.92英寸 副：6.43英寸");
  assert.equal(referenceFields.operatingSystem.value, "MagicOS 8.0.1");
  const officialPage = { html: "<p>RAM 规格 LPDDR5X ROM 规格 UFS 4.1 扩展存储 不支持 操作系统 5 ColorOS 15.0 定位功能</p>",
    url: "https://www.oppo.com/cn/test/specs/", fetchedAt: "2026-10-06T00:00:00Z", sha256: "a".repeat(64) };
  const officialFields = readOfficialAndroidSpecs("OPPO", officialPage);
  assert.equal(officialFields.memoryType.value, "LPDDR5X");
  assert.equal(officialFields.storageType.value, "UFS 4.1");
  assert.equal(officialFields.operatingSystem.value, "ColorOS 15.0");
  assert.equal(officialFields.chargingMethod, undefined, "官网未列快充段时不得从机型推测");
  const oppoFields = readOfficialAndroidSpecs("OPPO", { ...officialPage,
    html: "<p>亮度 1300 尼特峰值亮度 NFC 支持 NFC-SIM 操作系统 ColorOS 12.1 蓝牙 5.2 数据接口 USB Type-C 音频接口</p>" });
  assert.equal(oppoFields.peakBrightness.value, 1300);
  assert.equal(oppoFields.peakBrightness.unit, "nit");
  assert.equal(oppoFields.hasNFC.value, true);
  assert.equal(oppoFields.bluetooth.value, "5.2");
  assert.equal(oppoFields.port.value, "USB Type-C");
  const vivoFields = readOfficialAndroidSpecs("vivo", { ...officialPage,
    html: "<p>操作系统 操作系统 OriginOS Ocean 数据连接 WLAN 支持 WLAN热点 支持 NFC 不支持 云服务 支持</p>" });
  assert.equal(vivoFields.operatingSystem.value, "OriginOS Ocean");
  assert.equal(vivoFields.hasNFC.value, false, "官网明确不支持应保留 false，不能当成缺失");
  const oppoGalleryHtml = '<title>Find X7 Ultra 参数 | OPPO 官网</title><img alt="Find X7 Ultra" src="https://www.oppo.com/content/dam/oppo/cn/test/find-x7-ultra.png">';
  const oppoModel = { brand: "OPPO", category: "phone", modelName: "OPPO Find X7 Ultra" };
  assert.ok(readOfficialColorGallery(oppoGalleryHtml, oppoModel, "https://www.oppo.com/cn/test/specs/").image,
    "官方 alt 省略品牌前缀时仍应识别同一型号");
  assert.equal(readOfficialColorGallery(oppoGalleryHtml.replace('alt="Find X7 Ultra"', 'alt="Find X7"'), oppoModel,
    "https://www.oppo.com/cn/test/specs/").image, undefined, "省略品牌不能放松具体型号校验");
  const samsungSkuHtml = '<title>Galaxy Tab S9 FE WLAN | 三星</title><h1>Galaxy Tab S9 FE WLAN</h1>'
    + '<input id="modelCode" value="SM-X510NZAACHN"><span class="pdd39-anchor-nav__info-spec">石墨灰</span>'
    + '<source srcset="https://images.samsung.com.cn/is/image/samsung/p6pim/cn/sm-x510nzaachn/gallery/own-model?$1164_776_PNG$">'
    + '<source srcset="https://images.samsung.com.cn/is/image/samsung/p6pim/cn/sm-x616czaachc/gallery/other-model?$1164_776_PNG$">';
  const samsungSku = { brand: "Samsung", modelName: "Samsung Galaxy Tab S9 FE", variant: "wifi" };
  const skuUrl = "https://www.samsung.com.cn/tablets/galaxy-tab-s/galaxy-tab-s9-fe-wlan-sm-x510nzaachn/buy/";
  assert.equal(readOfficialColorGallery(samsungSkuHtml, samsungSku, skuUrl).colors[0].name, "石墨灰");
  assert.ok(readOfficialColorGallery(samsungSkuHtml, samsungSku, skuUrl).image.url.includes("own-model"));
  assert.throws(() => readOfficialColorGallery(samsungSkuHtml, { ...samsungSku, modelName: "Samsung Galaxy Tab S9 FE+" }, skuUrl), /型号/);
  assert.ok(readOfficialColorGallery(samsungSkuHtml.replaceAll("S9 FE WLAN", "S9 FE+ WLAN"),
    { ...samsungSku, modelName: "Samsung Galaxy Tab S9 FE+" }, skuUrl).image, "单SKU型号里的Plus标识必须保留");
  assert.throws(() => readOfficialColorGallery(samsungSkuHtml, { ...samsungSku, variant: "5g" }, skuUrl), /网络版本/);
  assert.equal(zolRows('<tr><th>无线网卡</th><td>WiFi6&gt; ，支持802.11ax&gt;</td></tr>').get("无线网卡"), "WiFi6 ，支持802.11ax");
  const seriesUrl = "https://detail.zol.com.cn/series/57/999_1.html";
  const skuPage = (capacity, release, cpu = "") => `<h1>Test Phone (${capacity})</h1><table><tr><th>RAM容量</th><td>8GB</td></tr><tr><th>ROM容量</th><td>128GB</td></tr><tr><th>上市日期</th><td>${release}</td></tr><tr><th>后置摄像头</th><td>800万像素</td></tr><tr><th>后置拍照功能</th><td>1080P视频拍摄</td></tr>${cpu ? `<tr><th>CPU型号</th><td>${cpu}</td></tr>` : ""}</table>`;
  const pages = new Map([
    [seriesUrl, '<h1>Test Phone</h1><a href="/cell_phone/index1001.shtml">Test Phone (8GB/128GB)</a><a href="/cell_phone/index1002.shtml">Test Phone (8GB/128GB)</a><a href="/cell_phone/index1003.shtml">Test Phone (16GB/256GB)</a><a href="/cell_phone/index1004.shtml">Test Phone (16GB RAM)</a><a href="/cell_phone/index1005.shtml">Test Phone (256GB ROM)</a>'],
    ["https://detail.zol.com.cn/2/1001/param.shtml", skuPage("8GB/128GB", "2022年")],
    ["https://detail.zol.com.cn/2/1002/param.shtml", skuPage("8GB/128GB", "2022年05月31日", "高通 骁龙870")],
    ["https://detail.zol.com.cn/2/1003/param.shtml", skuPage("16GB/256GB", "2022年05月31日")],
    ["https://detail.zol.com.cn/2/1004/param.shtml", skuPage("16GB RAM", "2022年05月31日")],
    ["https://detail.zol.com.cn/2/1005/param.shtml", skuPage("256GB ROM", "2022年05月31日")],
  ]);
  const imported = await importZolSeries({ id: "test-phone", brand: "Xiaomi", category: "phone", modelName: "Test Phone", family: "Test", comparisonGroupId: "test", seriesUrl },
    { directory, fetcher: async (address) => { assert.ok(pages.has(String(address))); return new Response(pages.get(String(address))); } });
  assert.equal(imported.device.releaseDate, "2022-05-31", "partial dates must not discard a known release day");
  assert.equal(imported.device.configurations.length, 1);
  assert.match(imported.device.specs.chip.rawText, /骁龙870/);
  assert.match(imported.device.specs.rearCamera.value, /800万像素/, "视频规格不能覆盖摄像头像素参数");
  assert.equal(imported.source.excludedConfigurations.length, 3, "完整或仅 RAM/ROM 的标题容量冲突均应排除，不能拼接配置");
  assert.ok(imported.source.fieldGaps.some((gap) => gap.field === "launchPrice"));
  const laptopUrl = "https://detail.zol.com.cn/series/16/998_1.html";
  const laptopHtml = '<h1>Test Laptop (16GB/256GB+1TB)</h1><table><tr><th>内存容量</th><td>16GB（8GB×2）</td></tr>'
    + '<tr><th>硬盘容量</th><td>256GB+1TB</td></tr><tr><th>上市时间</th><td>2018年08月</td></tr></table>';
  const laptopPages = new Map([[laptopUrl, '<h1>Test Laptop</h1><a href="/notebook/index2001.shtml">Test Laptop (16GB/256GB+1TB)</a>'
    + '<a href="/notebook/index2002.shtml">Test Laptop (16GB/256GB)</a>'],
  ["https://detail.zol.com.cn/3/2001/param.shtml", laptopHtml], ["https://detail.zol.com.cn/3/2002/param.shtml", laptopHtml]]);
  const laptopImport = await importZolSeries({ id: "test-laptop", category: "laptop", brand: "Xiaomi", modelName: "Test Laptop", family: "Test",
    comparisonGroupId: "test.laptop", seriesUrl: laptopUrl, minYear: 2017 },
  { directory, fetcher: async (address) => new Response(laptopPages.get(String(address))) });
  assert.equal(laptopImport.device.configurations.length, 1);
  assert.equal(laptopImport.device.configurations[0].storage, "256GB + 1TB");
  assert.equal(laptopImport.source.excludedConfigurations.length, 1, "标题仅单盘时不能冒充完整双盘SKU");
  const first = await getSourceSnapshot(url, { directory, fetcher });
  assert.equal(first.cacheHit, false);
  const second = await getSourceSnapshot(url, { directory, fetcher });
  const offline = await getSourceSnapshot(url, { directory, offline: true, fetcher });
  assert.equal(calls, 1);
  assert.equal(second.sha256, first.sha256);
  assert.equal(offline.html, first.html);
  await assert.rejects(getSourceSnapshot(url, { directory, refresh: true, fetcher: async () => new Response("", { status: 503 }) }));
  assert.equal((await getSourceSnapshot(url, { directory, offline: true })).sha256, first.sha256);
  const validate = (html) => { if (!html.includes("16GB")) throw new Error("参数页身份不符"); };
  await assert.rejects(getSourceSnapshot(url, { directory, refresh: true, validate, fetcher: async () => new Response("<html>目录页</html>") }), /身份/);
  assert.equal((await getSourceSnapshot(url, { directory, offline: true, validate })).sha256, first.sha256, "invalid 200 response preserves the previous snapshot");
  await assert.rejects(getSourceSnapshot(url, { directory, offline: true, validate: () => { throw new Error("身份不符"); } }), /身份/);
  await assert.rejects(getSourceSnapshot(`${url}/missing`, { directory, offline: true, fetcher }));
  assert.equal(calls, 1, "offline misses never issue requests");
  const gbk = await getSourceSnapshot(`${url}/gbk`, { directory, fetcher: async () => new Response(new Uint8Array([0xd6, 0xd0, 0xce, 0xc4]), { headers: { "content-type": "text/html; charset=gb2312" } }) });
  assert.equal(gbk.html, "中文", "legacy Chinese pages must not become replacement characters");
  const cameraOptions = { directory, fetcher: async () => new Response('<title>Test Phone Camera test - DXOMARK</title><div class="scoreBadgeValue">167</div><div>Photo 173; Other Phone 190</div><script>{"datePublished":"2025-08-06T12:00:00Z"}</script>') };
  assert.equal((await verifyCameraScore("Test Phone", 167, `${url}/camera`, cameraOptions)).rawText, "167");
  await assert.rejects(verifyCameraScore("Test Phone", 173, `${url}/camera`, { directory, offline: true }), /总分/);
  await assert.rejects(verifyCameraScore("Test Phone Pro", 167, `${url}/camera`, { directory, offline: true }), /型号/);
  const updated = await getSourceSnapshot(url, { directory, refresh: true, fetcher: async () => new Response("<html>24GB</html>") });
  assert.notEqual(updated.sha256, first.sha256);
  assert.equal(await fs.readFile(path.join(directory, `${first.sha256}.html`), "utf8"), first.html, "historical source is retained");
  await fs.writeFile(path.join(directory, `${updated.sha256}.html`), "corrupt");
  await assert.rejects(getSourceSnapshot(url, { directory, offline: true }), /哈希/);
  await assert.rejects(getSourceSnapshot(url, { directory, offline: true, refresh: true }));
  console.log("source snapshot: cache reuse, offline replay, failed refresh protection, history and corruption checks passed");
} finally {
  await fs.rm(directory, { recursive: true, force: true });
}
