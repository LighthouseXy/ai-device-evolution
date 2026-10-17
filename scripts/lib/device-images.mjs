import assert from "node:assert/strict";
import { plainText, zolRows } from "./zol-device.mjs";
import { readOppoShopData } from "./android-official-specs.mjs";

const reviewedSamsungS23PlusPurpleUrl = "https://api.samsungmobilepress.com/api/v1/file/DF891757399C82C9CC0CF9B98EE9BC9568F416604A3E3FD5CB9DEC9FDC9A259300B89890B5EBC8AFA6AD9D58BED873F844CF4EA43F672EDAD3EF15678CBC48110485B4392DCD52BD17F92086A29B77A1205A62AE020640D1AFBC86F9B3CB91984BF2390CD43F9288B9ECDDD46777DA46A559FECD7A176DFC6655AD63B6662FFC";

export const attribute = (tag, name) => tag.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1];
const splitColorNames = (names) => [...new Set(names.flatMap((name) => name.split(/[,，、/]/).map((value) => value.trim())).filter(Boolean))];
const hasBothViews = image => image?.viewScope === "front_back" || (/正面/.test(image?.alt ?? "") && /背面/.test(image?.alt ?? ""));
const sourcePriority = image => {
  try {
    const host = new URL(image.sourceUrl).hostname;
    if (/(^|\.)(apple\.com(?:\.cn)?|mi\.com|samsung\.com\.cn|samsungmobilepress\.com|huawei\.com|oppo\.com|opposhop\.cn|vivo\.com\.cn|honor\.com)$/.test(host)) return 0;
    if (/(^|\.)(jd\.com|tmall\.com|taobao\.com|pinduoduo\.com|yangkeduo\.com)$/.test(host)) return 1;
  } catch { /* 来源缺失不提升优先级。 */ }
  return 2;
};

// 颜色文字或失败刷新不能擦掉同型号已核验的照片；特别版边界由调用方的明确配色清单过滤。
export function mergeColorImages(previous = [], incoming = []) {
  const colors = new Map();
  for (const entry of [...previous, ...incoming]) {
    const color = { ...entry, name: entry.name.trim() };
    if (!color.name) continue;
    const prior = colors.get(color.name);
    colors.set(color.name, prior?.image && (hasBothViews(prior.image) && !hasBothViews(color.image)
      || hasBothViews(prior.image) === hasBothViews(color.image) && sourcePriority(prior.image) < sourcePriority(color.image)) ? prior
      : color.image ? color : prior ?? color);
  }
  // MIX Fold 图库的同一龙鳞纤维款式有带品牌/不带品牌两种写法；空白旧标签不重复保留。
  if (colors.get("龙鳞纤维版")?.image && !colors.get("小米龙鳞纤维版")?.image) {
    colors.delete("小米龙鳞纤维版");
  }
  return [...colors.values()];
}

export function readReviewedProductImage(html, device, candidate, css) {
  assert.equal(candidate.status, "downloaded_and_visually_reviewed");
  assert.ok(candidate.targetIds?.includes(device.id), "核对实图必须明确绑定当前版型");
  assert.ok(candidate.anchor && html.includes(candidate.anchor), "核对实图的原页锚点缺失");
  if (candidate.finishAnchor) assert.ok(html.includes(candidate.finishAnchor), "宣传图完整配色原文缺失");
  if (candidate.officialColorGalleryBinding) {
    // 荣耀规格页把色名写在 input.value，而非图片 alt；复用官方图库解析，不用文件名推断颜色。
    assert.equal(device.brand, "HONOR", "官方配色结构绑定仅支持已核验的荣耀规格页");
    assert.match(candidate.sourceUrl, /^https:\/\/www\.honor\.com\/cn\/phones\/[\w-]+\/spec\/$/);
    const matches = readOfficialColorGallery(html, device, candidate.sourceUrl).colors
      .filter(color => color.name === candidate.color);
    assert.equal(matches.length, 1, "官方具名配色必须唯一");
    assert.equal(matches[0].url, candidate.url, "官方配色图片不能换用其他颜色资源");
  }
  if (candidate.henanMobileColorBinding) {
    assert.equal(device.id, "honor-magic5-2023");
    assert.equal(device.modelName, "荣耀 Magic5");
    assert.equal(device.releaseYear, 2023);
    assert.equal(candidate.sourceUrl, "https://www.ha.10086.cn/shop/release/goods/65915/index.html");
    assert.equal(plainText(html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ""), "荣耀Magic5 12+256G");
    const resource = { "珊瑚紫": ["T17WYTBydT1R4cSCrK", "67166", "珊瑚紫"], "燃橙色": ["T19WKTByKT1R4cSCrK", "67168", "燃橙色（素皮）"] }[candidate.color];
    assert.ok(resource, "移动商城已审配色不符");
    const matches = [...html.matchAll(/<li\b[^>]*>/g)].map(([tag]) => tag)
      .filter(tag => attribute(tag, "colorName") === resource[2]);
    assert.equal(matches.length, 1, "移动商城具名配色 SKU 必须唯一");
    assert.equal(attribute(matches[0], "skuIds"), resource[1]);
    assert.equal(attribute(matches[0], "pic"), `/tfs/${resource[0]}.png`);
    assert.equal(candidate.url, `https://www.ha.10086.cn/v1/tfs/${resource[0]}.png`);
    assert.equal(candidate.viewScope, "front_back");
  }
  if (candidate.samsungSingleSkuBinding) {
    assert.equal(device.brand, "Samsung", "三星单 SKU 绑定不能跨品牌");
    const code = candidate.sourceUrl.match(/^https:\/\/www\.samsung\.com\.cn\/(?:tablets|smartphones)\/[\w-]+\/[\w-]+-(sm-[a-z0-9]+(?:chn|chc))\/buy\/$/i)?.[1];
    assert.ok(code, "三星配色图片必须来自国行单 SKU 购买页");
    if (device.category === "phone") {
      assert.equal(plainText(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "").split("|")[0].trim(), device.modelName, "三星单 SKU 手机型号不符");
    } else {
      const colors = readOfficialColorGallery(html, device, candidate.sourceUrl).colors;
      assert.ok(colors.some(color => color.name === candidate.color), "三星官方具名配色不符");
    }
    const selected = [...html.matchAll(/<input\b[^>]*>/g)].map(([tag]) => tag).filter(tag =>
      attribute(tag, "name") === "pd-color" && attribute(tag, "checked") === "checked"
      && attribute(tag, "data-modelcode")?.toLowerCase() === code.toLowerCase());
    assert.equal(selected.length, 1, "三星配色必须绑定唯一选中 SKU");
    assert.equal(attribute(selected[0], "data-colorname")?.trim(), candidate.color, "三星选中 SKU 配色不符");
    const imagePath = new URL(candidate.url).pathname.toLowerCase();
    assert.ok(device.category === "phone" ? /^\/is\/image\/samsung\/p6pim\/cn\/\d{4}\/gallery\//.test(imagePath) && imagePath.includes(`-${code.toLowerCase()}-`)
      : imagePath.includes(`/p6pim/cn/${code.toLowerCase()}/gallery/`), "三星图片 SKU 不符");
  }
  if (candidate.colorAnchor) {
    assert.ok(html.includes(candidate.colorAnchor), "具名配色锚点缺失");
    if (candidate.editionColorBinding) {
      const binding = candidate.editionColorBinding;
      assert.equal(device.id, "redmi-k80-pro-2024", "特别版颜色不能跨型号");
      assert.equal(candidate.sourceUrl, "https://www.ithome.com/0/813/723.htm");
      assert.equal(binding.edition, "冠军版");
      assert.equal(binding.sourceColor, "深灰色");
      assert.equal(candidate.color, binding.edition + binding.sourceColor, "特别版颜色不能换用普通版或其他颜色");
      assert.ok(binding.modelAnchor && html.includes(binding.modelAnchor) && /REDMI K80 Pro 冠军版/.test(plainText(binding.modelAnchor)), "特别版型号证据缺失");
      assert.ok(plainText(candidate.colorAnchor).includes(binding.sourceColor), "特别版具名配色缺失");
    } else {
      assert.ok(candidate.color && plainText(candidate.colorAnchor).replace(/\s+/g, "").includes(candidate.color.replace(/\s+/g, "")), "图片配色必须由具名原文绑定");
    }
  }
  if (candidate.finishAnchor) {
    assert.ok(html.includes(candidate.finishAnchor), "表壳配色证据锚点缺失");
    assert.ok(candidate.caseColors?.length && candidate.caseColors.every(color => plainText(candidate.finishAnchor).includes(color)), "表壳配色必须与原页具名证据一致");
  }
  if (candidate.appleIpadIdentificationBinding) {
    assert.equal(candidate.sourceUrl, "https://support.apple.com/zh-cn/108043");
    assert.equal(device.brand, "Apple");
    assert.equal(device.category, "tablet");
    const binding = {
      "ipad-pro-12-9-m1-2021": ["12.9 英寸 iPad Pro（第 5 代）", 2021, "A2378"],
      "ipad-pro-11-2nd-2020": ["11 英寸 iPad Pro（第 2 代）", 2020, "A2228"],
    }[device.id];
    assert.ok(binding, "iPad 合集不能借用其他型号");
    assert.equal(device.modelName, device.id === "ipad-pro-12-9-m1-2021" ? "12.9 英寸 iPad Pro（第 5 代，M1）" : binding[0]);
    assert.equal(device.releaseYear, binding[1]);
    assert.equal(plainText(candidate.modelAnchor), binding[0]);
    const headings = [...html.matchAll(/<h2\b[^>]*>[\s\S]*?<\/h2>/g)];
    const index = headings.findIndex(([heading]) => heading === candidate.modelAnchor);
    assert.ok(index >= 0, "准确 iPad 章节缺失");
    const section = html.slice(headings[index].index, headings[index + 1]?.index ?? html.length);
    assert.ok(section.includes(candidate.anchor), "合集图片必须属于准确 iPad 章节");
    assert.ok(plainText(section).includes(`年份：${binding[1]} 年`) && plainText(section).includes(binding[2]), "iPad 章节年份或硬件型号不符");
    const image = readAppleProductImage(section);
    assert.equal(image?.url, candidate.url);
    assert.equal(image.colorScope, "all_colors");
    assert.equal(candidate.colorScope, "all_colors");
    assert.equal(candidate.color, undefined, "合集不能作为单色照片");
    if (device.id === "ipad-pro-12-9-m1-2021") {
      assert.equal(candidate.resourceChain?.[0]?.sourceUrl, "https://support.apple.com/zh-cn/111896");
      assert.ok(candidate.resourceChain[0].anchors.some(anchor => /Apple M1\s*芯片/.test(plainText(anchor))));
    }
  }
  if (candidate.appleIdentificationBinding) {
    assert.match(candidate.sourceUrl, /^https:\/\/support\.apple\.com\/zh-cn\/108044(?:\?[^#]*)?$/);
    assert.equal(device.brand, "Apple");
    const image = readAppleIdentificationImage(html, device);
    assert.equal(image?.url, candidate.url, "识别页图片必须属于准确机型章节");
    assert.equal(image.colorScope, "all_colors");
    assert.equal(candidate.colorScope, "all_colors");
  }
  const tag = candidate.anchor.match(/^<(?:img|source)\b[^>]*>$/)?.[0];
  if (candidate.huaweiSuningSkuBinding) {
    const binding = candidate.huaweiSuningSkuBinding;
    const model = {
      "huawei-pura-80-2025": ["HUAWEI Pura 80", { "丝绒白": "12451517563", "丝绒金": "12451517567", "丝绒黑": "12451517569" }],
      "huawei-pura-80-pro-plus-2025": ["HUAWEI Pura 80 Pro+", { "釉白": "12451517556", "釉黑": "12451517558", "釉青": "12451517557" }],
      "huawei-pura-80-ultra-2025": ["HUAWEI Pura 80 Ultra", { "鎏光黑": "12447018268", "鎏光金": "12447018267" }],
      "huawei-matepad-pro-11-2024": ["HUAWEI MatePad Pro 11 (2024)", { "雅川青": "12424173149" }, 2023, "0070073500"],
    }[device.id];
    assert.ok(model && model[0] === device.modelName && device.releaseYear === (model[2] ?? 2025), "零售图片机型或年份不符");
    const tablet = device.id === "huawei-matepad-pro-11-2024";
    if (tablet) {
      assert.equal(device.category, "tablet");
      assert.equal(device.variant, "standard");
    }
    const shop = model[3] ?? "0071615758";
    assert.equal(binding.sku, model[1][binding.sourceColor]);
    assert.equal(candidate.sourceUrl, `https://product.suning.com/${shop}/${binding.sku}.html`);
    assert.ok(binding.skuAnchor && html.includes(binding.skuAnchor), "零售配色 SKU 原文缺失");
    assert.ok(binding.skuAnchor.includes(`href="//product.suning.com/${shop}/${binding.sku}.html"`));
    assert.equal(attribute(binding.skuAnchor, "title"), (tablet ? "MatePad Pro 24款" : device.modelName.replace(/^HUAWEI /, "")) + " " + binding.sourceColor);
    assert.ok(candidate.modelAnchor && html.includes(candidate.modelAnchor));
    const compact = value => value.replace(/\s+/g, "").toLowerCase();
    for (const text of [plainText(candidate.modelAnchor), attribute(tag, "alt") ?? ""]) {
      if (tablet) assert.match(text, /MatePad\s*Pro\s*11英寸\s*2024款/, "平板必须绑定11英寸2024款，不使用12.6/13.2英寸图");
      else {
        const models = [...text.matchAll(/\bPura\s*80(?:\s*Pro\s*\+?|\s*Ultra)?/gi)].map(match => compact(match[0]));
        assert.ok(models.length && models.every(name => name === compact(device.modelName.replace(/^HUAWEI /, ""))), "零售标题与原图不得混用 Pro、Pro+ 或 Ultra");
      }
      assert.ok(text.includes(binding.sourceColor), "零售原图配色不符");
    }
    if (candidate.colorScope === "all_colors") {
      assert.equal(device.id, "huawei-pura-80-pro-plus-2025");
      assert.equal(candidate.color, undefined, "合集不得归入某一具名颜色");
      assert.deepEqual(candidate.caseColors, ["釉青", "釉红", "釉黑", "釉白"]);
      const palette = candidate.resourceChain?.[0];
      assert.equal(palette?.sourceUrl, "https://consumer.huawei.com/cn/phones/pura80-pro-plus/specs/");
      assert.equal(palette.anchors.length, 1);
      assert.deepEqual(plainText(palette.anchors[0]).split(/[，,]/).sort(), [...candidate.caseColors].sort(), "合集完整配色必须由同型号官网证实");
    } else {
      assert.equal(candidate.color, binding.sourceColor);
      assert.equal(candidate.viewScope, "front_back");
    }
  }
  if (candidate.appleMiniRetailBinding) {
    assert.equal(device.id, "iphone-12-mini");
    assert.equal(device.modelName, "iPhone 12 mini");
    assert.equal(device.releaseYear, 2020);
    const sku = { "白色": "0000000000/12283217952", "绿色": "0070836486/000000012271739857", "黑色": "0000000000/12168127172" }[candidate.color];
    assert.ok(sku);
    assert.equal(candidate.sourceUrl, `https://m.suning.com/product/${sku}.html`);
    assert.ok(candidate.modelAnchor && html.includes(candidate.modelAnchor));
    assert.match(plainText(candidate.modelAnchor), /Apple iPhone 12 mini/);
    assert.ok(plainText(candidate.modelAnchor).includes(candidate.color));
    assert.ok(candidate.parameterAnchors?.length);
    for (const anchor of candidate.parameterAnchors) assert.ok(html.includes(anchor), "mini 参数绑定缺失");
    assert.ok(candidate.parameterAnchors.some(anchor => plainText(anchor).includes("5.4英寸")), "mini 尺寸不能混用普通版");
    assert.equal(candidate.viewScope, "front_back");
  }
  if (candidate.honorShopSkuBinding) {
    const binding = candidate.honorShopSkuBinding;
    assert.equal(device.brand, "HONOR");
    assert.equal(device.releaseYear, binding.releaseYear);
    assert.match(candidate.sourceUrl, /^https:\/\/www\.honor\.com\/cn\/shop\/product\/\d+\.html(?:\?[^#]*)?$/);
    assert.match(candidate.anchor, /^_pro_sbomList\.push\(\{/);
    const decode = value => value.replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
      .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
    const fields = {};
    for (const key of ["sbomCode", "name", "photoName", "photoPath"]) {
      const values = [...candidate.anchor.matchAll(new RegExp(`\\b${key}:"([^"]*)"`, "g"))];
      assert.equal(values.length, 1, "官方 SKU 图片字段必须唯一");
      fields[key] = decode(values[0][1]);
      assert.equal(fields[key], binding[key], "官方 SKU 图片原文不符");
    }
    const name = fields.name.replace(/^【[^】]*】/, "").replace(/\s+/g, "");
    const model = device.modelName.replace(/\s+/g, "");
    const tabletSize = {
      "honor-magicpad2-2024": "12.3",
      "honor-pad-v9-2024": "11.5",
      "honor-pad8-2022": "12",
    }[device.id];
    let skuConfiguration = name.slice(model.length);
    if (tabletSize) {
      assert.equal(device.category, "tablet");
      assert.equal(device.variant, "standard", "平板图片不得借用柔光等独立版本");
      const prefix = `${tabletSize}英寸WIFI`;
      assert.ok(skuConfiguration.startsWith(prefix), "官方平板尺寸或网络版本不符");
      skuConfiguration = skuConfiguration.slice(prefix.length);
    }
    assert.ok(name.startsWith(model) && /^\d+GB\+/.test(skuConfiguration), "官方 SKU 型号或版型不符");
    assert.ok(fields.name.split(/\s+/).includes(candidate.color), "官方 SKU 具名配色不符");
    assert.match(fields.photoPath, /^\/product\/\d+\/$/);
    assert.match(fields.photoName, /^[A-Z0-9]+mp\.png$/);
    assert.ok(html.includes(binding.scriptAnchor) && html.includes(binding.mediaPathAnchor), "官方图片模板链接缺失");
    assert.equal(attribute(binding.scriptAnchor, "src"), candidate.resourceChain?.[0]?.sourceUrl);
    assert.equal(binding.mediaPathAnchor, 'ec.mediaPath = "https://hshop.honorfile.com/pimages/";');
    assert.equal(candidate.viewScope, "front_back");
  }
  if (candidate.samsungBuyingOptionBinding) {
    const binding = candidate.samsungBuyingOptionBinding;
    const model = {
      "samsung-galaxy-s25-2025": ["Samsung Galaxy S25", 2025, "SM-S9310", "galaxy-s25"],
      "samsung-galaxy-s24-2024": ["Samsung Galaxy S24", 2024, "SM-S9210", "galaxy-s24"],
      "samsung-galaxy-s24-plus-2024": ["Samsung Galaxy S24+", 2024, "SM-S9260", "galaxy-s24"],
      "samsung-galaxy-s24-ultra-2024": ["Samsung Galaxy S24 Ultra", 2024, "SM-S9280", "galaxy-s24-ultra"],
    }[device.id];
    assert.ok(model && device.modelName === model[0] && device.releaseYear === model[1], "官网购买选项型号或年份不符");
    assert.equal(candidate.sourceUrl, `https://www.samsung.com.cn/smartphones/${model[3]}/buy/`);
    assert.equal(candidate.anchor, JSON.stringify(binding.modelCode) + ":{", "审核锚点必须对应准确 SKU");
    const groupsJson = [...html.matchAll(/var BC_GROUP = (\{[^\n]+\});/g)];
    assert.equal(groupsJson.length, 1, "购买选项 JSON 必须唯一");
    const product = JSON.parse(groupsJson[0][1]).products[binding.modelCode];
    assert.ok(product, "官网购买选项缺少已审 SKU");
    assert.equal(product.modelCode, binding.modelCode);
    assert.equal(product.modelName, model[2]);
    const mappings = product.optionMappings.filter(row => row.typeCode === "OPT-027");
    assert.equal(mappings.length, 1, "选中颜色必须唯一");
    const groups = product.buyingOptions.filter(row => row.typeCode === "OPT-027");
    assert.equal(groups.length, 1);
    const colors = groups[0].optionItems.filter(row => row.itemId === mappings[0].itemId);
    assert.equal(colors.length, 1);
    assert.equal(plainText(colors[0].displayName).trim(), candidate.color);
    assert.equal(colors[0].modelCode, binding.modelCode, "颜色必须绑定同一 SKU");
    assert.ok(product.optionGallery.some(row => row.mediaType === "IMAGE" && new URL(row.largeImage, candidate.sourceUrl).href === candidate.url), "图片必须由该 SKU 图库声明");
    assert.equal(candidate.viewScope, "front_back");
  }
  if (candidate.samsungPressAltBinding) {
    assert.equal(device.id, "samsung-galaxy-s23-plus-2023");
    assert.equal(device.modelName, "Samsung Galaxy S23+");
    assert.equal(candidate.color, "悠雾紫", "官方审核配色不符");
    assert.equal(candidate.sourceUrl, "https://www.samsungmobilepress.com/articles/infographic-galaxy-s23-s23-plus-the-essential-smartphone-tailored-to-you");
    assert.equal(attribute(tag, "alt"), "Galaxy S23+", "官方图片型号标签不符");
    assert.equal(candidate.url, reviewedSamsungS23PlusPurpleUrl, "官方审核资源不符");
  }
  if (candidate.samsungNewsColorBinding) {
    assert.equal(device.id, "samsung-galaxy-s25-edge-2025");
    assert.equal(device.modelName, "Samsung Galaxy S25 Edge");
    assert.equal(candidate.sourceUrl, "https://www.samsung.com.cn/news/product/galaxy-s25-edge/");
    const suffix = { "钛银": "3", "钛黑": "2", "钛蓝": "1" }[candidate.color];
    assert.ok(suffix, "官方审核配色不符");
    assert.equal(candidate.url, `https://images.samsung.com.cn/is/image/samsung/assets/cn/news/20250522/mobile-mo${suffix === "1" ? "-" : ""}720-480-${suffix}.png?$720_N_PNG$`, "官方配色资源不符");
  }
  let path = tag && (attribute(tag, "data-original") ?? attribute(tag, "data-src") ?? attribute(tag, "data-desktop-src") ?? attribute(tag, "data-src-pc") ?? attribute(tag, "data-src-1440") ?? attribute(tag, "data-srcset") ?? attribute(tag, "src") ?? attribute(tag, "srcset"));
  if (candidate.huaweiSuningSkuBinding) path = attribute(tag, "src-large");
  if (candidate.honorShopSkuBinding) path = "https://hshop.honorfile.com/pimages/" + candidate.honorShopSkuBinding.photoPath
    + "800_800_" + candidate.honorShopSkuBinding.photoName;
  if (candidate.samsungBuyingOptionBinding) path = candidate.url;
  if (candidate.xiaomiLegacyNativeImage) {
    const binding = {
      "xiaomi-9-transparent-2019": ["小米9 透明尊享版", 2019, "https://www.mi.com/mi9tr", "透明", "/f/i/2019/mi9tr/gallery3.jpg"],
      "xiaomi-8-screen-fingerprint-2018": ["小米8屏幕指纹版", 2018, "https://www.mi.com/mi8ud/specs", "暮光金", "/f/i/2018/mi8ud/specs-banner-img1.jpg"],
      "xiaomi-6-2017": ["小米6", 2017, "https://www.mi.com/mi6", "亮蓝色", "/f/i/17/mi6/index/kind-blue.png"],
      "xiaomi-mix-2-2017": ["小米MIX 2", 2017, "https://www.mi.com/mix2/specs", "黑色", "/f/i/17/mix2/specs-version-b.png?v4"],
    }[device.id];
    assert.ok(binding, "历史官网图片不能跨型号");
    assert.equal(device.modelName, binding[0]);
    assert.equal(device.releaseYear, binding[1]);
    assert.equal(candidate.sourceUrl, binding[2]);
    assert.equal(candidate.color, binding[3], "已审原图配色不符");
    const title = plainText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, "");
    assert.equal(title, binding[0].replace(/\s+/g, "") + (["xiaomi-8-screen-fingerprint-2018", "xiaomi-mix-2-2017"].includes(device.id) ? "参数" : "") + "-小米商城", "官网标题型号不符");
    if (device.id === "xiaomi-8-screen-fingerprint-2018") {
      const preview = html.match(/<li\b[^>]*id="J_colorPreview"[^>]*>([\s\S]*?)<\/li>/)?.[1];
      const selected = preview?.match(/<dd class="active">([\s\S]*?)<\/dd>/)?.[1];
      assert.equal(plainText(selected ?? ""), "暮光金", "默认颜色控件必须明确选中暮光金");
      assert.ok(preview?.includes(candidate.anchor) && attribute(tag, "class") === "active", "默认图片必须属于同一选中配色容器");
    } else if (device.id === "xiaomi-6-2017") {
      const resource = candidate.resourceChain?.[0];
      assert.equal(resource?.sourceUrl, "https://s01.mifile.cn/css/product/mi6/index.min.css?5b4ae6");
      assert.ok([...html.matchAll(/<link\b[^>]*>/g)].some(([tag]) => new URL(attribute(tag, "href"), candidate.sourceUrl).href === resource.sourceUrl), "官网必须链接该配色样式表");
      assert.deepEqual(resource.anchors, ['.mi6-index .section-kinds.preload .item02{background:url("//c1.mifile.cn/f/i/17/mi6/index/kind-blue.png") no-repeat center center}']);
      const labels = [...candidate.anchor.matchAll(/class="text J_textItem">([^<]+)/g)].map(match => match[1]);
      assert.equal(labels[1], "亮蓝", "第二配色项必须由官网标签绑定亮蓝");
      path = resource.anchors[0].match(/url\("([^"]+)"\)/)[1];
    } else if (device.id === "xiaomi-mix-2-2017") {
      const resource = candidate.resourceChain?.[0];
      assert.equal(resource?.sourceUrl, "https://s01.mifile.cn/css/product/mix2/specs.min.css?74fe35");
      assert.ok([...html.matchAll(/<link\b[^>]*>/g)].some(([tag]) => new URL(attribute(tag, "href"), candidate.sourceUrl).href === resource.sourceUrl));
      assert.equal(candidate.anchor, '<div class="tab-title">黑色陶瓷版</div>\n                    <div class="tab tab-b current" data-ver="b"><span><i></i></span>黑色</div>');
      assert.deepEqual(resource.anchors, ['.mix2-specs .section-intro.preload .version-pic .pic-b{background-image:url("//i1.mifile.cn/f/i/17/mix2/specs-version-b.png?v4")}']);
      path = resource.anchors[0].match(/url\("([^"]+)"\)/)[1];
    } else assert.match(plainText(html), /小米9 透明尊享版/);
    assert.equal(new URL(path, candidate.sourceUrl).href, (device.id === "xiaomi-6-2017" ? "https://c1.mifile.cn" : "https://i1.mifile.cn") + binding[4], "已审原图资源不能替换");
    assert.equal(candidate.viewScope, "front_back");
  }
  if (candidate.dixintongOriginalBinding) {
    const binding = {
      "oppo-pad2-2023|星云灰": ["OPPO Pad 2", 2023, "星云灰", "products.aspx?cid=202&contractFlag=0&par=19498&sid=0", "【OPPO OPPO Pad 2 平板电脑 星云灰 】", "2023-03-24/230324160806456413.jpg"],
      "iphone-14|红色": ["iPhone 14", 2022, "红色", "product-18893-202.html", "【苹果 苹果 iPhone 14 全网通5G 双卡双待手机 特别请注意线上优惠不与店内优惠叠加使用 红色 】", "2022-09-14/220914174947779384.jpg"],
      "iphone-14|紫色": ["iPhone 14", 2022, "紫色", "product-18892-202-0-0.html", "【苹果 苹果 iPhone 14 全网通5G 双卡双待手机 特别请注意线上优惠不与店内优惠叠加使用 紫色 】", "2022-09-14/220914174927365411.jpg"],
      "iphone-13|粉色": ["iPhone 13", 2021, "粉色", "products-18264-202-0-0.html", "【苹果 苹果Apple iPhone 13 粉色 】", "2021-09-26/210926141711227454.jpg"],
      "oppo-find-x7-ultra-2024|松影墨韵": ["OPPO Find X7 Ultra", 2024, "松影墨韵", "product-19840-202-0-0.html", "【OPPO Find X7 Ultra 1英寸双潜望四主摄 哈苏大师影像 第三代骁龙8 5G拍照手机 松影墨韵 】", "2024-01-12/240112163956005709.jpg"],
      "oppo-find-x7-ultra-2024|大漠银月": ["OPPO Find X7 Ultra", 2024, "大漠银月", "product-19838-202-0-0.html", "【OPPO Find X7 Ultra 1英寸双潜望四主摄 哈苏大师影像 第三代骁龙8 5G拍照手机 大漠银月 】", "2024-01-12/240112163909164267.jpg"],
      "oppo-find-x7-ultra-2024|海阔天空": ["OPPO Find X7 Ultra", 2024, "海阔天空", "product-19839-202-0-0.html", "【OPPO Find X7 Ultra 1英寸双潜望四主摄 哈苏大师影像 第三代骁龙8 5G拍照手机 海阔天空 】", "2024-01-12/240112163942645168.jpg"],
      "samsung-galaxy-note9-2018|寒霜蓝": ["Samsung Galaxy Note9", 2018, "寒霜蓝", "products-6259-288.html", "三星 Galaxy Note9 8GB+512GB 移动联通电信4G手机双卡双待 寒霜蓝", "2018-08-29/180829102908255921.jpg"],
    }[`${device.id}|${candidate.color}`];
    assert.ok(binding, "零售原图不能跨型号");
    assert.equal(device.modelName, binding[0]);
    assert.equal(device.releaseYear, binding[1]);
    assert.equal(candidate.sourceUrl, "https://shop.dixintong.com/" + binding[3]);
    assert.equal(candidate.color, binding[2]);
    assert.ok(candidate.modelAnchor && html.includes(candidate.modelAnchor)
      && plainText(candidate.modelAnchor).startsWith(binding[4]), "零售商品型号和配色证据缺失");
    const selectedAnchor = device.id === "samsung-galaxy-note9-2018"
      ? `<span data-colorid="${binding[2]}" class="color01 border-cur">${binding[2]}</span>`
      : `<a data-colorid="${binding[2]}" href="javascript:void(0);" class="item J_item on">${binding[2]}</a>`;
    assert.ok(html.includes(selectedAnchor), "零售图片必须绑定选中配色");
    assert.equal(path, "http://img.dixintong.com/InUpImg/ProImg/" + binding[5], "零售图库资源不能换用");
    path = path.replace(/^http:/, "https:");
  }
  if (candidate.samsungNewsColorBinding) path = attribute(tag, "data-mobile-src");
  if (candidate.samsungA53FeatureBinding) {
    assert.equal(device.id, "samsung-galaxy-a53-2022");
    assert.equal(device.modelName, "Samsung Galaxy A53");
    assert.equal(candidate.color, "糯糯白");
    assert.equal(candidate.sourceUrl, "https://www.samsung.com.cn/smartphones/galaxy-a/galaxy-a53-5g-awesome-white-128gb-sm-a5360zwmchc/");
    assert.ok(candidate.modelAnchor && html.includes(candidate.modelAnchor), "官方型号标题缺失");
    assert.equal(path, "//images.samsung.com.cn/is/image/samsung/p6pim/cn/2202/feature/cn-feature-galaxy-a53-5g-a536-531589642?$FB_TYPE_A_JPG$");
    assert.equal(candidate.viewScope, "front_back");
  }
  if (candidate.imageAttribute) {
    if (candidate.imageAttribute === "href") {
      assert.equal(device.id, "xiaomi-mitu-watch-5x-2021");
      assert.equal(candidate.sourceUrl, "https://news.mydrivers.com/1/770/770741.htm");
      assert.ok(candidate.modelAnchor && html.includes(candidate.modelAnchor) && /手表5X/.test(plainText(candidate.modelAnchor)));
      assert.match(candidate.anchor, /^<a\b[^>]*><img\b[^>]*\/><\/a>$/);
      path = attribute(candidate.anchor.match(/^<a\b[^>]*>/)[0], "href");
      assert.equal(path, "//img1.mydrivers.com/img/20210720/aa744607fdf1477a9f822e726b9a3d77.png");
    } else {
      assert.equal(candidate.imageAttribute, "srcset", "审核图片只允许明确指定原页高清 srcset");
      path = tag && attribute(tag, candidate.imageAttribute);
    }
  }
  if (path && tag && (attribute(tag, "data-srcset") === path || attribute(tag, "srcset") === path)) path = path.split(",")[0].trim().split(/\s+/)[0];
  if (candidate.appleTechSpecsCollection) {
    const binding = candidate.appleTechSpecsCollection;
    const sizes = { "macbook-air-13-m5-2026": "13", "macbook-air-15-m5-2026": "15" };
    const size = sizes[device.id];
    assert.ok(size && device.modelName === size + " 英寸 MacBook Air (M5)" && device.releaseYear === 2026 && device.specs.chip.value === "Apple M5 芯片", "官方合集尺寸或芯片不符");
    assert.equal(candidate.sourceUrl, "https://www.apple.com/tw/macbook-air/specs/");
    assert.equal(candidate.colorScope, "all_colors");
    assert.deepEqual(candidate.caseColors, ["天蓝色", "银色", "星光色", "午夜色"]);
    assert.equal(binding.chipAnchor, '<p class="techspecs-subheader">Apple&nbsp;M5&nbsp;晶片</p>');
    assert.ok(html.includes(binding.chipAnchor) && html.includes(binding.finishAnchor), "官方合集芯片或外观原文缺失");
    assert.ok(binding.finishAnchor.includes(candidate.anchor), "官方合集图片不在对应尺寸外观分组中");
    assert.ok(["天藍色", "銀色", "星光色", "午夜色"].every(color => plainText(binding.finishAnchor).includes(color)), "官方合集完整配色不符");
    assert.ok(binding.finishAnchor.includes('data-analytics-activitymap-region-id="finish ' + size + ' inch"'), "官方配色尺寸分组不符");
    const entries = attribute(tag, "srcset").split(",").map(entry => entry.trim().split(/\s+/));
    assert.equal(entries.filter(entry => entry[1] === "2x").length, 1);
    path = entries.find(entry => entry[1] === "2x")[0];
    assert.ok(path.includes("/specs/" + size + "-inch/") && path.endsWith("_large_2x.jpg"), "官方合集资源尺寸不符");
  }
  if (candidate.appleMacSelectionCollection) {
    const models = {
      "macbook-pro-14-m5-pro-2026": ["14", "Pro"], "macbook-pro-14-m5-max-2026": ["14", "Max"],
      "macbook-pro-16-m5-2026": ["16", "Pro"], "macbook-pro-16-m5-max-2026": ["16", "Max"],
    };
    const [size, tier] = models[device.id] ?? [];
    assert.ok(size && device.modelName === `${size} 英寸 MacBook Pro (M5 ${tier})` && device.releaseYear === 2026
      && device.specs.chip.value === `Apple M5 ${tier} 芯片`, "官方商城合集尺寸、年份或芯片不符");
    assert.ok(candidate.sourceUrl.startsWith(`https://www.apple.com.cn/shop/buy-mac/macbook-pro/${size}-inch-silver-standard-display-apple-m5-${tier.toLowerCase()}-chip-`), "官方商城合集 SKU 不符");
    const title = plainText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
    assert.ok(title.startsWith(`购买 MacBook Pro ${size} 英寸 (M5 ${tier}) - 银色 - `), "官方商城标题不符");
    assert.equal(candidate.colorScope, "all_colors");
    assert.deepEqual(candidate.caseColors, ["深空黑色", "银色"]);
    assert.ok(attribute(tag, "alt")?.includes(`${size} 英寸 MacBook Pro`) && candidate.caseColors.every(color => attribute(tag, "alt").includes(color)), "官方商城合集配色或尺寸说明不符");
    assert.equal(new URL(path).pathname, `/1/as-images.apple.com/is/mac-macbook-pro-size-select-202601-${size}inch`, "官方商城合集不能换用局部图");
  }
  if (candidate.vivoLaunchCollection) {
    const resources = { "vivo-x100-2023": ["vivo X100", "9a44bd5ce5d719d3b842f38ff4079f1c"], "vivo-x100pro-2023": ["vivo X100 Pro", "2b7bf7cfb5254d1df3cd64f20da4579a"] };
    const [model, resource] = resources[device.id] ?? [];
    assert.ok(model && device.modelName === model && device.releaseYear === 2023, "官方发布海报型号、年份或限量版不符");
    assert.equal(candidate.sourceUrl, "https://www.vivo.com.cn/brand/news/detail?id=1206");
    assert.ok(html.includes('<h3 data-id="1206">蔡司影像，心临其境 vivo X100系列正式发布</h3>') && html.includes("产品发布·2023年11月13日"), "官方发布型号或年份原文缺失");
    assert.equal(candidate.colorScope, "all_colors");
    assert.deepEqual(candidate.caseColors, ["辰夜黑", "白月光", "星迹蓝", "落日橙"]);
    assert.equal(path, `https://wwwstatic.vivo.com.cn/vivoportal/files/image/brand/20231115/${resource}.png`, "官方发布海报资源不能跨型号");
  }
  if (candidate.oppoFlipCollection) {
    assert.equal(device.id, "oppo-find-n2-flip-2022");
    assert.equal(device.modelName, "OPPO Find N2 Flip");
    assert.equal(device.releaseYear, 2022);
    assert.equal(candidate.sourceUrl, "https://www.oppo.com/cn/smartphones/series-find-n/find-n2-flip/");
    assert.deepEqual(candidate.caseColors, ["慕紫", "流金", "雅黑"]);
    assert.equal(candidate.colorScope, "all_colors");
    assert.ok(candidate.caseColors.every(color => html.includes(`data-gtm-label="${color}"`)), "官方合集具名颜色缺失");
    assert.equal(path, "/content/dam/oppo/product-asset-library/find/find-n2-series/cn/find-n2-flip/v1/assets/images-color-phone-color-1.png.webp", "官方合集不能换用单色图");
  }
  if (candidate.imageRendition) {
    if (candidate.imageRendition === "suning_large") {
      if (["xiaomi-11-lite-2021", "redmi-pad-se-2023"].includes(device.id)) {
        const lite = device.id === "xiaomi-11-lite-2021";
        assert.equal(device.modelName, lite ? "小米11青春版" : "REDMI Pad SE");
        assert.equal(device.releaseYear, lite ? 2021 : 2023);
        assert.equal(candidate.color, lite ? "夏日柠檬" : "深灰色");
        assert.equal(candidate.sourceUrl, lite ? "https://m.suning.com/product/0000000000/000000012265208373.html?src=2203557881&srcPoint=2203557881" : "https://product.suning.com/0000000000/12439747488.html");
        assert.ok(candidate.modelAnchor && html.includes(candidate.modelAnchor));
        const expected = lite ? /小米11青春版.*夏日柠檬.*骁龙780G/ : /Redmi Pad SE 11英寸.*深灰色/;
        assert.match(plainText(candidate.modelAnchor), expected);
        assert.match(attribute(tag, "alt") ?? "", expected);
        if (lite) {
          assert.equal(plainText(candidate.parameterAnchor).replace(/\s+/g, ""), "CPU型号780G");
          assert.ok(html.includes(candidate.parameterAnchor), "青春版不得混用778G活力版");
        }
        path = attribute(tag, "src");
        assert.equal(path, lite ? "//imgservice.suning.cn/uimg1/b2c/image/phqH85AOw6xOG1uNFaDrpA.jpg_800w_800h_4e_80Q_is" : "//imgservice.suning.cn/uimg1/b2c/image/g3jbKUh6q6QnqbRqhxyzDQ.jpg_800w_800h_4e");
        assert.equal(candidate.viewScope, "front_back");
      } else if (device.id === "xiaomi-10s-2021") {
        assert.equal(device.modelName, "小米10S");
        assert.equal(device.releaseYear, 2021);
        assert.equal(candidate.color, "黑色");
        assert.equal(candidate.sourceUrl, "https://product.suning.com/0070739933/12390115555.html");
        assert.ok(candidate.modelAnchor && html.includes(candidate.modelAnchor));
        assert.match(plainText(candidate.modelAnchor), /小米10S 5G 黑色/);
        assert.match(attribute(tag, "alt") ?? "", /小米10S 5G 黑色/);
        path = attribute(tag, "src-large");
        assert.equal(path, "//imgservice.suning.cn/uimg1/b2c/image/v1YSBH4wzL_G2bhMmmx1kw.png_800w_800h_4e");
        assert.equal(candidate.viewScope, "front_back");
      } else if (device.id === "samsung-galaxy-note9-2018") {
        assert.equal(candidate.sourceUrl, "https://product.suning.com/0000000000/10583204066.html");
        assert.ok(candidate.modelAnchor && html.includes(candidate.modelAnchor) && /Galaxy Note9\(SM-N9600\)/.test(plainText(candidate.modelAnchor)), "苏宁国行 Note9 型号不符");
        assert.match(attribute(tag, "alt") ?? "", /Galaxy Note9\(SM-N9600\).*玄镜铜/);
        path = attribute(tag, "src-large");
        assert.equal(path, "//imgservice.suning.cn/uimg1/b2c/image/eL2LF89wFt4ivMjUuwav2Q.jpg_800w_800h_4e");
      } else {
      assert.equal(device.id, "samsung-galaxy-s21-plus-2021", "苏宁图片必须绑定已审核的国行 S21+ 型号");
      assert.match(candidate.sourceUrl, /^https:\/\/product\.suning\.com\/\d+\/\d+\.html$/);
      assert.ok(candidate.modelAnchor && html.includes(candidate.modelAnchor) && /S21\+\s+G9960/.test(plainText(candidate.modelAnchor)), "苏宁商品型号标题缺失");
      assert.match(attribute(tag, "alt") ?? "", /S21\+\s+G9960\s+梵梦紫/);
      path = attribute(tag, "src-large");
      }
    } else {
    assert.equal(candidate.imageRendition, "jd_original", "不允许任意改写图片资源");
    assert.match(candidate.sourceUrl, /^https:\/\/item\.jd\.com\/product\/[\w-]+\.html$/);
    if (candidate.jdGalleryOriginalBinding) {
      const binding = {
        "iphone-12-pro|海蓝色": ["iPhone 12 Pro", 2020, "TgefIjOdKzbf8OtYffQHhA", "海蓝色", "c50bdab4f4fcb606.jpg"],
        "iphone-12-pro|金色": ["iPhone 12 Pro", 2020, "hZLzRoNbz4xBW6IXFxTrlw", "金色", "783695559a939ede.jpg"],
        "iphone-12-pro|石墨色": ["iPhone 12 Pro", 2020, "2UU_JvQVT5fmnJ5iA1tlSQ", "石墨色", "b6d41b9545450e69.jpg"],
        "iphone-13-pro-max|苍岭绿色": ["iPhone 13 Pro Max", 2021, "CcBa9DhXwHlvaqLMSIzbeQ", "苍岭绿", "df4b3333ea64e00c.jpg"],
        "iphone-12-pro-max|石墨色": ["iPhone 12 Pro Max", 2020, "XzRypMCPSX9qHPL0YPhe5A", "石墨色", "a66b666eb8c0f270.jpg"],
        "iphone-12-pro-max|金色": ["iPhone 12 Pro Max", 2020, "quOal3Sso9vzSKXJ08ZvCA", "金色", "af630a02d5aa8951.png"],
        "iphone-12-pro-max|海蓝色": ["iPhone 12 Pro Max", 2020, "68Rb3SqzVmhcjYJlFC8QRg", "海蓝色", "2469fde617839c81.jpg"],
        "iphone-12-pro-max|银色": ["iPhone 12 Pro Max", 2020, "8XKZ_qaU8Vw_k703J0Rk0A", "银色", "4ce6ecf583638950.jpg"],
        "iphone-13-pro-max|金色": ["iPhone 13 Pro Max", 2021, "rTAaLZpoPFYPJlLPEel0hQ", "金色", "55a2ee89f248ec77.jpg"],
        "iphone-13-pro-max|石墨色": ["iPhone 13 Pro Max", 2021, "_ZsZKxp9-IqMamTUF1xb-w", "石墨色", "82844008b3bd5493.jpg"],
      }[`${device.id}|${candidate.color}`];
      assert.ok(binding && device.modelName === binding[0] && device.releaseYear === binding[1], "京东图库已审型号或年份不符");
      assert.equal(candidate.sourceUrl, `https://item.jd.com/product/${binding[2]}.html`, "京东图库已审 SKU 不符");
      assert.ok(plainText(candidate.modelAnchor ?? "").includes(binding[3]), "京东图库 SKU 配色不符");
      assert.equal(candidate.viewScope, "front_back");
      const gallery = html.match(/<div\b[^>]*id="spec-list"[^>]*>([^]*?)<\/div>/)?.[1];
      assert.ok(gallery?.includes(candidate.anchor), "京东原图必须属于同一商品图库，不得借推荐商品图");
      assert.equal(attribute(tag, "data-img"), "1");
      assert.ok(attribute(tag, "data-url")?.endsWith("/" + binding[4]) && new URL(path, candidate.sourceUrl).pathname.endsWith("/" + binding[4]), "京东已审原图资源不符");
    } else {
      assert.equal(tag && attribute(tag, "id"), "spec-img", "京东图必须绑定具体商品主图");
    }
    assert.ok(candidate.modelAnchor && html.includes(candidate.modelAnchor), "京东商品型号标题缺失");
    // 部分已审京东 SKU 在 iPhone 与代号之间插入“苹果”；仅对精确图库绑定规范化，不扩展到混合型号商品。
    const modelTitle = candidate.jdGalleryOriginalBinding
      ? plainText(candidate.modelAnchor).replace(/\biPhone\s*苹果(?=\d)/gi, "iPhone ") : plainText(candidate.modelAnchor);
    const names = [...modelTitle.matchAll(/\biPhone\s*(?:\d+(?:\s*(?:Pro\s*Max|Pro|Plus|mini)|e)?|XS(?:\s*Max)?|XR|X)\b/gi)].map(match => match[0].replace(/\s+/g, "").toLowerCase());
    if (device.id === "ipad-a16-2025") {
      assert.equal(device.modelName, "iPad (A16)");
      assert.ok(plainText(candidate.modelAnchor).startsWith("【Apple/苹果iPad（A16芯片）】") && plainText(candidate.modelAnchor).includes("Apple/苹果 iPad11英寸 A16芯片2025年款"), "京东 iPad A16 年份与型号不符");
      assert.ok(!/iPad\s*(?:Pro|Air|mini)/i.test(plainText(candidate.modelAnchor)), "京东 iPad 型号不能混用");
    } else if (device.id === "ipad-8th-2020") {
      assert.equal(device.modelName, "iPad（第 8 代）");
      assert.ok(plainText(candidate.modelAnchor).startsWith("【Apple/苹果iPad（第 8 代）】") && /iPad8\b/.test(plainText(candidate.modelAnchor)) && plainText(candidate.modelAnchor).includes("FYN12CHA"), "京东 iPad 8 代际与已审 SKU 必须准确绑定");
      assert.ok(!/iPad\s*(?:Pro|Air|mini)/i.test(plainText(candidate.modelAnchor)), "京东 iPad 型号不能混用");
    } else {
    assert.ok(names.length && names.every(name => name === device.modelName.replace(/\s+/g, "").toLowerCase()) && !/iPhone\s*(?:\d+|XS|XR|X)\s*\//i.test(modelTitle), "商品标题必须是同一具体型号，不能混用 Pro/Max");
    }
    const thumbnail = new URL(path, candidate.sourceUrl);
    assert.match(thumbnail.hostname, /^img\d+\.360buyimg\.com$/);
    assert.match(thumbnail.pathname, /^\/n4\/s114x114_jfs\/[\w/.-]+\.(?:png|jpe?g)$/i);
    path = thumbnail.href.replace("/n4/s114x114_jfs/", "/n0/jfs/");
    }
  }
  if (candidate.shihuoStyleBinding) {
    const binding = candidate.shihuoStyleBinding;
    assert.match(candidate.sourceUrl, /^https:\/\/www\.shihuo\.cn\/page\/pcGoodsDetail\?goodsId=\d+(?:&(?:styleId|skuId)=\d+)*$/);
    assert.equal(device.modelName, binding.modelName, "识货型号绑定不符");
    const data = JSON.parse(html.match(/<script\b[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)[1]).props.pageProps;
    assert.equal(String(data.query.goodsId), new URL(candidate.sourceUrl).searchParams.get("goodsId"), "识货来源商品编号不符");
    assert.equal(data.data.data.meta_title, binding.title, "识货商品标题不符");
    const styles = data.styleListData.data.list.list.filter(style => String(style.style_id) === binding.styleId);
    assert.equal(styles.length, 1, "识货配色款式不唯一");
    const image = styles[0].img_arr[0];
    assert.equal(JSON.stringify(image), binding.styleImageAnchor, "识货配色资源锚点不符");
    assert.equal(candidate.anchor, binding.styleImageAnchor, "识货原图必须由配色 JSON 绑定");
    const product = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(match => JSON.parse(match[1])).find(value => value["@type"] === "Product");
    assert.ok(product && product.name === binding.productName && binding.title.startsWith(product.name + "【"), "识货 Product 型号标题不符");
    for (const [field, name] of [["chip", "CPU型号"], ["screenSize", "屏幕尺寸"], ["releaseDate", "上市时间"]])
      assert.equal(product.additionalProperty.find(property => property.name === name)?.value, binding[field], "识货芯片、尺寸或年份证据不符");
    const chipCode = value => String(value ?? "").match(/(?:A\d+[XZ]?|M\d+)(?:\s*(?:Pro|Max))?/i)?.[0]?.replace(/\s+/g, "").toLowerCase();
    assert.ok(binding.chip ? chipCode(binding.chip) === chipCode(device.specs.chip.value) : device.category === "phone", "识货芯片不能跨版本");
    const sizes = [device.specs.screenSize.value, device.modelName.match(/(\d+(?:\.\d+)?)\s*英寸/)?.[1], device.specs.displayType?.rawText?.match(/(\d+(?:\.\d+)?)\s*英寸/)?.[1]].filter(Boolean).map(String);
    assert.ok(sizes.includes(binding.screenSize.replace(/英寸/g, "")) || device.id === "ipad-10th-2022" && binding.screenSize === "10.9英寸", "识货尺寸不能混用");
    assert.ok(binding.releaseDate ? binding.releaseDate.startsWith(String(device.releaseYear)) : device.category === "phone" || binding.title.includes(String(device.releaseYear)), "识货代际年份不符");
    const reviewed = readShihuoColorImages(html, device.modelName, [candidate.color], device).find(color => color.name === candidate.color);
    const imageUrl = image.img_url.replace(/^http:\/\/static\.shihuocdn\.cn\//, "https://static.shihuocdn.cn/");
    assert.equal(reviewed?.url, imageUrl, "识货具名配色与原图不符");
    path = imageUrl;
  }
  if (candidate.appleRefurbishedImage) {
    const binding = candidate.appleRefurbishedImage;
    assert.match(candidate.sourceUrl, /^https:\/\/www\.apple\.com\/(?:[a-z]{2}\/)?shop\/product\/[a-z0-9]+\/a\/refurbished-/i);
    const models = {
      "ipad-mini-a17-pro-2024": ["iPad mini (A17 Pro)", "iPad mini (A17 Pro)"],
      "ipad-a16-2025": ["iPad (A16)", "iPad (A16)"],
      "ipad-air-m2-2024": ["11 英寸 iPad Air (M2)", "11-inch iPad Air (M2)"],
      "ipad-air-13-m2-2024": ["13 英寸 iPad Air (M2)", "13-inch iPad Air (M2)"],
      "ipad-air-m3-2025": ["11 英寸 iPad Air (M3)", "11-inch iPad Air (M3)"],
      "ipad-air-13-m3-2025": ["13 英寸 iPad Air (M3)", "13-inch iPad Air (M3)"],
      "ipad-mini-6th-2021": ["iPad mini (第 6 代)", "iPad mini 6"],
      "ipad-air-m1-2022": ["iPad Air（第 5 代，M1）", "iPad Air", "(5th Generation)", "Apple M1 chip, 8GB RAM"],
      "ipad-10th-2022": ["iPad (第 10 代)", "iPad", "(10th Generation)", "A14 Bionic chip"],
      "ipad-7th-2019": ["iPad（第 7 代）", "iPad", "(7th Generation)", "A10 Fusion chip with 64-bit architecture"],
      "ipad-pro-11-1st-2018": ["11 英寸 iPad Pro（第 1 代）", "11-inch iPad Pro", null, "A12X Bionic chip with 64-bit architecture"],
      "ipad-pro-12-9-3rd-2018": ["12.9 英寸 iPad Pro（第 3 代）", "12.9-inch iPad Pro", "(3rd Generation)", "A12X Bionic chip with 64-bit architecture"],
      "ipad-pro-m4-13-2024": ["13 英寸 iPad Pro (M4)", "iPad Pro 13-inch (M4)"],
      "ipad-pro-m4-11-2024": ["11 英寸 iPad Pro (M4)", "iPad Pro 11-inch (M4)"],
    };
    const model = models[device.id];
    assert.ok(model && device.modelName === model[0], "官方翻新图必须绑定准确尺寸与芯片型号");
    assert.ok(html.includes(binding.titleAnchor), "官方 SKU 标题缺失");
    assert.ok(plainText(binding.titleAnchor).replaceAll("‑", "-").toLowerCase().startsWith(`Refurbished ${model[1]} Wi-Fi `.toLowerCase()), "官方 SKU 尺寸或芯片不符");
    if (["ipad-pro-m4-11-2024", "ipad-pro-m4-13-2024"].includes(device.id)) {
      const size = device.id === "ipad-pro-m4-11-2024" ? 11 : 13;
      assert.equal(device.releaseYear, 2024);
      assert.equal(device.specs.chip.value, "Apple M4 芯片");
      assert.ok(["Originally released May 2024", `${size}-inch Ultra Retina XDR display`, "Apple M4 chip"].every(text => plainText(html).includes(text)), "官方原页尺寸、芯片和首发年份不符");
      assert.equal(binding.imageName, { "银色": `refurb-ipad-pro-${size}inch-8th-gen-wifi-silver-202512`, "深空黑色": `refurb-ipad-pro-${size}inch-8th-gen-wifi-space-black-202512` }[candidate.color], "官方 M4 图片不能换版型或颜色");
    }
    const colors = { "蓝色": "Blue", "紫色": "Purple", "星光色": "Starlight", "深空灰色": "Space Gray", "粉色": "Pink", "黄色": "Yellow", "银色": "Silver", "金色": "Gold", "深空黑色": "Space Black" };
    const products = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(match => JSON.parse(match[1])).filter(value => value["@type"] === "Product");
    assert.equal(products.length, 1, "官方 Product SKU 必须唯一");
    const product = products[0];
    const skuUrl = url => new URL(url).href.replace(/(\/shop\/product\/)([^/]+)\/([aA])\//, (_, prefix, sku) => `${prefix}${sku.toLowerCase()}/a/`);
    assert.equal(skuUrl(product.url), skuUrl(candidate.sourceUrl), "官方 Product URL 不能换用 SKU");
    assert.equal(product.name, binding.productName, "官方 Product 名称不符");
    assert.equal(plainText(binding.titleAnchor), `${product.name} - Apple${binding.storeSuffix}`, "官方标题与 Product SKU 不一致");
    assert.equal(product.color, binding.sourceColor, "官方 Product 配色不符");
    if (device.id === "ipad-7th-2019") assert.equal(product.name, {
      "银色": "Refurbished iPad Wi-Fi 128GB Silver (7th Generation)",
      "金色": "Refurbished iPad Wi-Fi 128GB Gold (7th Generation)",
      "深空灰色": "Refurbished iPad Wi-Fi 32GB - Space Gray (7th Generation)",
    }[candidate.color], "第 7 代官方 SKU 名称配色不符");
    else assert.ok(product.name.replaceAll("–", "-").endsWith(` - ${product.color}${model[2] ? ` ${model[2]}` : ""}`), "官方 SKU 名称配色或代际不符");
    assert.equal(attribute(tag, "alt"), binding.alt, "官方图说明不符");
    const thumbnail = new URL(attribute(tag, "src").replaceAll("&amp;", "&"));
    assert.equal(thumbnail.pathname.split("/").at(-1), binding.imageName, "官方缩略图资源不符");
    if (candidate.colorScope === "all_colors") {
      assert.equal(device.id, "ipad-air-13-m2-2024", "合集只绑定已核验的 13 英寸 M2");
      assert.equal(binding.imageName, "refurb-ipad-air-13inch-m2-wifi-blue-202504_AV1");
      assert.deepEqual(candidate.caseColors, ["蓝色", "紫色", "星光色", "深空灰色"]);
      assert.equal(binding.alt, "iPad Air in all four available colors, blue, purple, starlight, space gray, single-lens camera, front all-screen design");
      assert.ok(html.includes(binding.galleryAnchor), "官方合集图库 JSON 锚点缺失");
      const gallery = JSON.parse(binding.galleryAnchor);
      assert.equal(gallery.imageName, binding.imageName);
      assert.equal(gallery.alt, binding.alt);
      assert.equal(gallery.sources.length, 1);
      path = gallery.sources[0].srcSet;
    } else {
      assert.equal(colors[candidate.color], product.color, "官方中英文具名配色不符");
      if (model[3]) {
        // 旧 SKU 的 alt 通用；仅重放已审图的明确代际资源与芯片/尺寸原文。
        const legacyImages = { "ipad-air-m1-2022": "refurb-ipad-air-5th-gen-wifi-pink-202409", "ipad-10th-2022": "refurb-ipad-10th-gen-wifi-blue-202409",
          "ipad-7th-2019": { "银色": "refurb-ipad-wifi-silver-2019", "深空灰色": "refurb-ipad-wifi-space-2019", "金色": "refurb-ipad-wifi-gold-2019" }[candidate.color],
          "ipad-pro-11-1st-2018": { "银色": "refurb-ipad-pro-11-wifi-silver-2019", "深空灰色": "refurb-ipad-pro-11-wifi-spacegray-2019" }[candidate.color],
          "ipad-pro-12-9-3rd-2018": { "银色": "refurb-ipad-pro-12-wifi-silver-2019", "深空灰色": "refurb-ipad-pro-12-wifi-spacegray-2019" }[candidate.color] };
        assert.equal(binding.imageName, legacyImages[device.id], "旧款图片不能跨代或换配色");
        assert.equal(binding.alt, "Thumbnail - 1", "旧款原文 alt 不能虚构");
        assert.equal(binding.chipAnchor, model[3], "旧款芯片证据不符");
        assert.equal(binding.screenAnchor, device.id === "ipad-7th-2019" ? "10.2-inch Retina display" : device.id === "ipad-pro-11-1st-2018" ? "11-inch Liquid Retina display" : device.id === "ipad-pro-12-9-3rd-2018" ? "12.9-inch Liquid Retina display" : "10.9-inch Liquid Retina display", "旧款尺寸证据不符");
        assert.ok(html.includes(binding.chipAnchor) && html.includes(binding.screenAnchor), "旧款芯片或尺寸原文缺失");
        if (device.id === "ipad-7th-2019") {
          assert.equal(device.releaseYear, 2019);
          assert.equal(device.specs.screenSize.value, 10.2);
          assert.match(device.specs.chip.value, /A10 Fusion/);
          assert.ok(plainText(html).includes("Originally released September 2019"), "第 7 代首发年份原文不符");
        }
        if (["ipad-pro-11-1st-2018", "ipad-pro-12-9-3rd-2018"].includes(device.id)) {
          assert.equal(device.releaseYear, 2018);
          assert.equal(device.specs.screenSize.value, device.id === "ipad-pro-11-1st-2018" ? 11 : 12.9);
          assert.match(device.specs.chip.value, /A12X/);
          assert.ok(plainText(html).includes("Originally released October 2018"), "2018 年 iPad Pro 首发年份原文不符");
        }
      } else {
      assert.ok(binding.alt.toLowerCase().includes(product.color.toLowerCase()), "官方图片说明配色不符");
      assert.match(binding.alt, /back exterior/);
      assert.match(binding.alt, /front exterior/);
      }
      if (device.id !== "ipad-7th-2019") assert.ok(binding.imageName.replaceAll("-", "").includes(product.color.toLowerCase().replaceAll(" ", "")), "官方图片资源配色不符");
      path = product.image;
    }
    const original = new URL(path);
    assert.equal(original.hostname, "store.storeimages.cdn-apple.com");
    assert.equal(original.pathname, thumbnail.pathname, "官方原图不能换资源");
  }
  if (candidate.cssUrl) {
    assert.match(candidate.cssUrl, /^https:\/\/s01\.mifile\.cn\/css\/product\/[\w-]+\/specs\.min\.css(?:\?[\w-]+)?$/);
    const href = attribute(candidate.anchor, "href");
    assert.equal(href && new URL(href, candidate.sourceUrl).href, candidate.cssUrl, "主图 CSS 必须由本型号原页链接");
    assert.ok(css?.includes(candidate.cssAnchor), "主图 CSS 图片锚点缺失");
    const cssPath = candidate.cssAnchor.match(/^url\(["']?([^)'"\s]+)["']?\)$/)?.[1];
    path = cssPath && new URL(cssPath, candidate.cssUrl).href;
  }
  if (candidate.galleryProductId) {
    assert.match(candidate.sourceUrl, new RegExp(`^https://detail\\.zol\\.com\\.cn/picture_index_\\d+/index\\d+_0_p${candidate.galleryProductId}\\.shtml$`));
    assert.match(candidate.galleryProductId, /^\d+$/);
    path = readZolGalleryImage(html, candidate.galleryProductId)?.url;
  }
  if (candidate.zolProductId) {
    assert.match(candidate.zolProductId, /^\d+$/);
    assert.match(candidate.sourceUrl, new RegExp(`^https://detail\\.zol\\.com\\.cn/picture_index_\\d+/index\\d+_\\d+_p${candidate.zolProductId}\\.shtml$`));
    const photo = JSON.parse(candidate.anchor);
    assert.equal(String(photo.proId), candidate.zolProductId, "宣传图必须来自本型号图片清单");
    assert.equal(photo.picId, candidate.zolPicId, "宣传图编号不能换用");
    assert.equal(photo.hash, candidate.zolHash, "宣传图资源不能换用");
    path = photo.picSrc?.replace(/_\d+x\d+(?=\/)/, "");
    if (candidate.color) assert.ok(readZolColorImages(html, { productId: candidate.zolProductId, includeAlternates: true })
      .some(image => image.name === candidate.color && image.url === path), "审核配色必须绑定同型号具名图库分类");
    assert.match(path ?? "", /^https:\/\/\d[a-z]\.zol-img\.com\.cn\/product\/\d+\/\d+\/[\w-]+\.(?:png|jpe?g)$/i);
  }
  if (candidate.resourceBaseUrl) {
    // 小米此产品页用编译脚本加载图片；只重放已核对的正式资源根和 img 绑定，不运行脚本。
    if (["xiaomi-watch-color-2-2021", "redmi-watch-2-2021"].includes(device.id)) {
      const binding = device.id === "xiaomi-watch-color-2-2021"
        ? ["xiaomiwatchcolor2/index.7d6071ac.js", "xiaomiwatchcolor2p4b1/", "section-07.jpg", 'e.imgPath+"section-07.jpg"', 'd["a"]', ["皓月白", "海洋蓝", "星耀黑"]]
        : ["redmiwatch2/index.a194de65.js", "redmiwatch2c87cfe/", "262.png", 't.imgPath+"262.png"', 'u["a"]', ["典雅黑", "象牙白", "深空蓝"]];
      assert.equal(candidate.sourceUrl, "https://cdn.cnbj1.fds.api.mi-img.com/mi.com-assets/shop/pro/js/product/" + binding[0]);
      assert.equal(candidate.resourceBaseUrl, "https://cdn.cnbj1.fds.api.mi-img.com/product-images/" + binding[1]);
      assert.equal(candidate.resourcePath, binding[2]);
      assert.equal(candidate.anchor, binding[3]);
      assert.ok(html.includes('productFileSite:"https://cdn.cnbj1.fds.api.mi-img.com/product-images"'));
      assert.ok(html.includes(`imgPath:"".concat(${binding[4]}.productFileSite,"/${binding[1]}")`));
      assert.equal(candidate.colorScope, "all_colors");
      assert.deepEqual(candidate.caseColors, binding[5]);
      assert.ok(binding[5].every(color => html.includes(color)), "三色表体原文缺失，不用另购表带充数");
    } else if (device.id === "redmi-watch-4-2023") {
      assert.equal(candidate.sourceUrl, "https://cdn.cnbj1.fds.api.mi-img.com/mi.com-assets/shop/pro/js/product/redmi-watch-4/index.73959eba.js");
      assert.equal(candidate.resourceBaseUrl, "https://cdn.cnbj1.fds.api.mi-img.com/product-images/redmiwatch4ll77jq/index/");
      assert.ok(html.includes('productFileSite:"https://cdn.cnbj1.fds.api.mi-img.com/product-images"'));
      assert.ok(html.includes('.concat(d["a"].productFileSite,"/redmiwatch4ll77jq/index/")'));
      assert.match(candidate.resourcePath, /^\d+\.png$/);
      assert.equal(candidate.anchor, `e.resizeImg(e.imgPath+"${candidate.resourcePath}")`);
    } else {
    assert.match(candidate.sourceUrl, /^https:\/\/mishop-pc\.cnbj1\.mi-fds\.com\/mishop-pc\/production\/mishop_pc\/xiaomi-smart-band-10\/entry-\d+\.js$/);
    assert.equal(candidate.resourceBaseUrl, "https://cdn.cnbj1.fds.api.mi-img.com/product-images/xiaomi-smart-band-10_505982");
    assert.ok(html.includes(`prod:"${candidate.resourceBaseUrl}"`));
    assert.match(candidate.resourcePath, /^\/images\/\d+\.png$/);
    assert.equal(candidate.anchor, `"data-src":a.imgPath+"${candidate.resourcePath}"`);
    }
    path = candidate.resourceBaseUrl + candidate.resourcePath;
  }
  if (candidate.chinaMobileOriginalBinding) {
    // 商城图库包含多色，而非当前 SKU 专属图片；逐图审阅后的固定绑定不按 SKU/排列顺序猜颜色。
    const model = {
      "xiaomi-12s-2022": ["小米 12S", 2022, "100_100_1087750_1080058", 1087750, 1006445, "【移动商城】小米12S 5G手机", { "白色": "tc4zyx7fkxhz9err", "原野绿": "tc4zyzheb5k42zsd", "紫色": "tc4zgtu52kz45kgt", "黑色": "tc4zgtdstysttukaq" }],
      "iphone-12": ["iPhone 12", 2020, "280_817_1084643_1071762", 1084643, 1006437, "【移动商城】iPhone 12 公开版", { "红色": "ts89gxjc4amxj7tu8" }],
    }[device.id];
    assert.ok(model, "移动商城原图不能跨型号");
    assert.equal(device.modelName, model[0]);
    assert.equal(device.releaseYear, model[1]);
    assert.equal(candidate.sourceUrl, `https://shop.10086.cn/goods/${model[2]}.html`);
    const matches = [...html.matchAll(/var goods=(\{[^\n]+\}),?\s*\n/g)];
    assert.equal(matches.length, 1, "移动商城商品 JSON 必须唯一");
    const goods = JSON.parse(matches[0][1]);
    assert.equal(goods.goods_id, model[3]);
    assert.equal(goods.product_id, model[4]);
    assert.equal(goods.goods_name, model[5]);
    const resource = model[6][candidate.color];
    assert.ok(resource && goods.pictures.includes(resource), "移动商城已审配色资源缺失");
    assert.ok(goods.sku.some(sku => sku.name.startsWith(candidate.color + "  ")), "移动商城具名配色 SKU 缺失");
    assert.equal(path, `//img1.shop.10086.cn/goods/${resource}_90x90.png`, "移动商城原图必须绑定图库缩略图");
    assert.equal(candidate.viewScope, "front_back");
    path = `https://img1.shop.10086.cn/file/${resource}.png`;
  }
  const url = path && safeImageUrl(new URL(path, candidate.sourceUrl).href);
  assert.equal(url, candidate.url, "核对实图不能改用其他资源");
  return { url, name: candidate.color, imageScope: candidate.imageScope, colorScope: candidate.colorScope, viewScope: candidate.viewScope, note: candidate.note,
    alt: `${device.modelName} ${candidate.color ?? ""}外观参考` };
}

// 只重放已逐图核验的 Ultra 配色 DOM；不按颜色或图片排列顺序猜绑定。
export function readReviewedSamsungPanelColors(html, device, review) {
  assert.equal(review.status, "downloaded_and_visually_reviewed");
  const match = review.sourceUrl.match(/^https:\/\/www\.samsung\.com\.cn\/smartphones\/galaxy-s(25|26)-ultra\/$/);
  assert.ok(match && device.id === `samsung-galaxy-s${match[1]}-ultra-20${match[1]}` && device.modelName === `Samsung Galaxy S${match[1]} Ultra`, "官网配色必须绑定准确 Ultra 型号");
  const title = plainText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").split("|")[0].trim();
  assert.equal(title, device.modelName.replace(/^Samsung /, ""), "官网配色标题型号不符");
  const block = (anchor, element, start = html.indexOf(anchor)) => {
    assert.ok(start >= 0, "官网配色 DOM 锚点缺失");
    const tags = html.slice(start + anchor.length).matchAll(new RegExp(`<\\/?${element}\\b[^>]*>`, "g"));
    let depth = 1;
    for (const tag of tags) {
      depth += tag[0].startsWith("</") ? -1 : 1;
      if (!depth) return html.slice(start, start + anchor.length + tag.index + tag[0].length);
    }
    assert.fail("官网配色 DOM 容器未闭合");
  };
  const normalized = value => value.normalize("NFKC").trim();
  return review.samsungPanelBindings.map(binding => {
    const { panelId, panelAnchor, controlAnchor, labelAnchor, imageAnchor, color } = binding;
    assert.match(panelId, /^[a-z][a-z-]+$/);
    assert.equal(attribute(panelAnchor, "id"), panelId);
    assert.match(attribute(panelAnchor, "class") ?? "", /\bfeatures-colors__panel-item\b/);
    assert.equal([...html.matchAll(/<div\b[^>]*>/g)].filter(([tag]) => attribute(tag, "id") === panelId).length, 1, "官网配色面板 ID 不唯一");
    assert.ok(html.includes(controlAnchor) && html.includes(labelAnchor), "官网配色控件或标签锚点缺失");
    assert.match(controlAnchor, /^<button\b[^>]*>$/);
    assert.match(attribute(controlAnchor, "class") ?? "", /\bjs-colorchip-button\b/);
    assert.equal(attribute(controlAnchor, "data-colors"), panelId, "配色控件不能指向其他面板");
    const controlled = attribute(controlAnchor, "aria-controls");
    assert.ok(!controlled || controlled === panelId, "配色控件面板不符");
    const labelIds = (attribute(controlAnchor, "aria-labelledby") ?? "").split(/\s+/);
    const labelId = labelIds[0];
    assert.ok(labelIds.slice(1).every(id => id === "exclusive-to" && /<[^>]+\bid="exclusive-to"[^>]*>/.test(html)), "附加配色说明标签不符");
    assert.ok(labelId === `color-${panelId}` || labelId === `color-${panelId}-highband`, "配色标签 ID 不符");
    assert.equal(attribute(labelAnchor, "id"), labelId);
    const labels = [...html.matchAll(/<span\b[^>]*>/g)].filter(([tag]) => attribute(tag, "id") === labelId);
    // S26 官网桌面/移动控件重复同 ID；每份具名文字都必须相同，不能只信第一份。
    for (const label of labels) {
      const names = [...block(label[0], "span", label.index).matchAll(/<span\b[^>]*class="features-colors__chip-name-text"[^>]*>([\s\S]*?)<\/span>/g)];
      assert.equal(names.length, 1, "具名颜色文字不唯一");
      assert.equal(normalized(plainText(names[0][1])), normalized(color), "具名颜色标签不符");
    }
    const images = [...block(panelAnchor, "div").matchAll(/<img\b[^>]*>/g)].map(([tag]) => tag);
    assert.deepEqual(images, [imageAnchor], "配色图必须属于该唯一面板");
    const expected = `https://images.samsung.com.cn/cn/smartphones/galaxy-s${match[1]}-ultra/images/galaxy-s${match[1]}-ultra-features-colors-${panelId}.jpg`;
    const url = safeImageUrl(new URL(attribute(imageAnchor, "data-src-pc"), review.sourceUrl).href);
    assert.equal(url, expected, "配色图片型号或面板路径不符");
    assert.equal(url, review.colors[color], "已核验图片不能换资源");
    const alt = normalized(attribute(imageAnchor, "alt") ?? "");
    assert.ok(alt.includes(normalized(color)) && alt.includes(device.modelName.replace(/^Samsung /, "")), "配色图片说明型号或颜色不符");
    return { name: normalized(color), url, alt, viewScope: "front_back" };
  });
}

// 历史官网把颜色标签放在 HTML、对应照片放在 CSS；两份原文同时核对，不按颜色顺序猜图。
export function readReviewedCssColorImages(html, css, review) {
  assert.match(review.sourceUrl, /^https:\/\/www\.mi\.com\/[\w-]+\/specs$/);
  assert.match(review.cssUrl, /^https:\/\/s01\.mifile\.cn\/css\/product\/[\w-]+\/specs\.min\.css(?:\?[\w-]+)?$/);
  const linked = [...html.matchAll(/<link\b[^>]*>/gi)].some(([tag]) => {
    const href = attribute(tag, "href");
    return href && new URL(href, review.sourceUrl).href === review.cssUrl;
  });
  assert.ok(linked, "颜色图片 CSS 必须由本型号官网明确链接");
  return review.bindings.map(binding => {
    if (binding.sourceColorName) {
      if (review.sourceUrl === "https://www.mi.com/mipad3/specs") {
        assert.equal(review.modelName, "小米平板3");
        assert.equal(binding.color, "金色");
        assert.equal(binding.sourceColorName, "香槟金");
        assert.match(binding.htmlAnchor, /class="tab-active"/);
        assert.equal(binding.selector, ".mipad-specs .section-design .preview-content-1");
      } else {
        assert.equal(review.sourceUrl, "https://www.mi.com/mi6/specs");
        assert.equal(review.modelName, "小米6");
        assert.equal(binding.sourceColorName, { "亮黑色": "亮黑", "亮白色": "亮白" }[binding.color], "小米6官网颜色名称不符");
      }
    }
    assert.ok(html.includes(binding.htmlAnchor) && plainText(binding.htmlAnchor).includes(binding.sourceColorName ?? binding.color), "官网配色标签缺失");
    assert.ok(css.includes(`${binding.selector}{`) && css.includes(binding.anchor), "官网配色图片规则缺失");
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
    const rule = rules.find(([, selector]) => selector === binding.selector)?.[2];
    assert.ok(rule?.includes(binding.anchor), "图片必须属于指定配色选择器");
    const path = binding.anchor.match(/^url\(["']?([^)'"\s]+)["']?\)$/)?.[1];
    const url = path && safeImageUrl(new URL(path, review.cssUrl).href);
    assert.equal(url, review.colors[binding.color], "官网配色图不能更换资源");
    return { name: binding.color, url };
  });
}

export function readZolColors(html) {
  html = html.replace(/<a\b[^>]*>\s*查看外观(?:&gt;|[>＞])?\s*<\/a>/gi, "");
  const rows = zolRows(html);
  const field = rows.get("机身颜色") ?? rows.get("产品颜色") ?? "";
  const section = html.match(/<strong\b[^>]*>\s*颜色[：:]\s*<\/strong>([\s\S]*?)<\/div>/)?.[1] ?? "";
  const names = [...section.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)].map((match) => plainText(match[1]));
  return [...new Set([...field.split(/[,，、/\s]+/), ...names].filter(Boolean))];
}

const reviewedSamsungWatchUrls = new Set([
  "https://images.samsung.com.cn/is/image/samsung/p6pim/global/wearable/f2607/global-wearable-Galaxy_Watch9_Silver_44_Side_Sport_Olive_1600x864_PC-554008521",
  "https://images.samsung.com.cn/is/image/samsung/p6pim/global/wearable/f2607/global-wearable-Galaxy_Watch9_Graphite_44_Side_Sport_Black_1600x864_PC-554009326",
  "https://images.samsung.com.cn/is/image/samsung/p6pim/global/wearable/f2607/global-wearable-Galaxy_Watch9_Silver_44_Side_Sport_Olive_1600x864_PC-554008054",
  "https://images.samsung.com.cn/is/image/samsung/p6pim/global/wearable/f2607/global-wearable-Galaxy_Watch9_Graphite_44_Side_Sport_Black_1600x864_PC-554008440",
  "https://images.samsung.com.cn/is/image/samsung/p6pim/global/wearable/f2607/global-wearable-Galaxy_Watch9_Cream_40_Side_Sport_Cream_1600x864_PC-554008597",
  "https://images.samsung.com.cn/is/image/samsung/p6pim/global/wearable/f2607/global-wearable-Galaxy_Watch9_Graphite_40_Side_Sport_Black_1600x864_PC-554009431"
]);

export function safeImageUrl(value) {
  try {
    const url = new URL(value.replace(/&amp;/g, "&"));
    if (url.protocol === "http:" && url.hostname === "static.shihuocdn.cn") url.protocol = "https:";
    if (url.protocol === "http:" && /^img\d\.pconline\.com\.cn$/.test(url.hostname)) url.protocol = "https:";
    if (url.protocol !== "https:") return null;
    if (url.hostname === "img.dixintong.com"
      && ["/InUpImg/ProImg/2023-03-24/230324160806456413.jpg", "/InUpImg/ProImg/2022-09-14/220914174947779384.jpg", "/InUpImg/ProImg/2022-09-14/220914174927365411.jpg", "/InUpImg/ProImg/2021-09-26/210926141711227454.jpg", "/InUpImg/ProImg/2024-01-12/240112163956005709.jpg", "/InUpImg/ProImg/2024-01-12/240112163909164267.jpg", "/InUpImg/ProImg/2024-01-12/240112163942645168.jpg" , "/InUpImg/ProImg/2018-08-29/180829102908255921.jpg"].includes(url.pathname) && !url.search) return url.href;
    if (url.hostname === "img1.shop.10086.cn" && ["tc4zyx7fkxhz9err", "tc4zyzheb5k42zsd", "tc4zgtu52kz45kgt", "tc4zgtdstysttukaq", "ts89gxjc4amxj7tu8"].some(resource => url.pathname === `/file/${resource}.png`) && !url.search) return url.href;
    if (url.hostname === "hshop.honorfile.com" && /^\/pimages\/\/product\/\d+\/800_800_[A-Z0-9]+mp\.png$/.test(url.pathname) && !url.search) return url.href;
    if (["https://www.ha.10086.cn/v1/tfs/T17WYTBydT1R4cSCrK.png", "https://www.ha.10086.cn/v1/tfs/T19WKTByKT1R4cSCrK.png"].includes(url.href)) return url.href;
    if (url.href === reviewedSamsungS23PlusPurpleUrl) return url.href;
    if (url.href === "https://c1.mifile.cn/f/i/17/mi6/index/kind-blue.png") return url.href;
    if (url.href === "https://c1.mifile.cn/f/i/17/mipad3/specs/colors-jin.jpg") return url.href;
    if (url.href === "https://i1.mifile.cn/f/i/17/mix2/specs-version-b.png?v4") return url.href;
    if ([
      "https://imgservice.suning.cn/uimg1/b2c/image/phqH85AOw6xOG1uNFaDrpA.jpg_800w_800h_4e_80Q_is",
      "https://imgservice.suning.cn/uimg1/b2c/image/2PhGC16DcF2LAlcx5L5_mA.jpg_800w_800h_4e_80Q_is",
      "https://imgservice.suning.cn/uimg1/b2c/image/aFAMI33aHXdjLKwTjBg3ug.jpg_800w_800h_4e_80Q_is",
      "https://imgservice.suning.cn/uimg1/b2c/image/VafNBIuavVLbgP6u8AbVJw.jpg_800w_800h_4e_80Q_is",
    ].includes(url.href)) return url.href;
    if ([
      "https://images.samsung.com.cn/cn/smartphones/galaxy-s25/buy/Color_Selection_Global_Mint_PC.png",
      "https://images.samsung.com.cn/cn/smartphones/galaxy-s25/buy/Color_Selection_Global_Icyblue_PC.png",
      "https://images.samsung.com.cn/cn/smartphones/galaxy-s25/buy/Color_Selection_Samsung_com_only_Blueblack_PC.png",
      "https://images.samsung.com.cn/cn/smartphones/galaxy-s25/buy/Color_Selection_Samsung_com_only_Coralred_PC_0108.png",
      "https://images.samsung.com.cn/cn/smartphones/galaxy-s25/buy/Color_Selection_Samsung_com_only_Pinkgold_PC.png",
      "https://images.samsung.com.cn/cn/smartphones/galaxy-s25/buy/Color_Selection_Global_Silver_Shadow_PC.png",
    ].includes(url.href)) return url.href;
    if (url.href === "https://images.samsung.com.cn/is/image/samsung/p6pim/cn/2202/feature/cn-feature-galaxy-a53-5g-a536-531589642?$FB_TYPE_A_JPG$") return url.href;
    if (url.href === "https://img1.mydrivers.com/img/20210720/aa744607fdf1477a9f822e726b9a3d77.png") return url.href;
    if ([
      "https://imgservice.suning.cn/uimg1/b2c/image/G5Q7lZwBsrxyHtah-iTCPw.jpg_800w_800h_4e_80Q_is",
      "https://imgservice.suning.cn/uimg1/b2c/image/_5-XEGTrlzkNRvbMkmAoZw.jpg_800w_800h_4e_80Q_is",
      "https://imgservice.suning.cn/uimg1/b2c/image/tlGNunYApNfFiU0vJkVD9A.jpg_800w_800h_4e_80Q_is",
      "https://imgservice.suning.cn/uimg1/b2c/image/zPiXB3DhaP3DO5jNFqEA0Q.png_800w_800h_4e_80Q_is",
    ].includes(url.href)) return url.href;
    if (url.href === "https://doc-fd.zol-img.com.cn/t_s2000x2000/g7/M00/06/08/ChMkK2fcot6If6DsAAEqWvfmuEcAAqPWADIJukAASpy940.jpg") return url.href;
    if (reviewedSamsungWatchUrls.has(url.href)) return url.href;
    if (url.hostname === "imgservice.suning.cn" && /^\/uimg1\/b2c\/image\/[\w-]+\.(?:png|jpe?g)_800w_800h_4e$/.test(url.pathname) && !url.search) return url.href;
    if (/^img\d+\.360buyimg\.com$/.test(url.hostname)
      && /^\/(?:pop\/|n\d+\/(?:s\d+x\d+_)?)?jfs\/[\w/.-]+\.(?:png|jpe?g|webp)$/i.test(url.pathname)) return url.href;
    // 保留已核对原页的完整带水印资源，不生成去水印或其他变体地址。
    if (url.href === "https://img.ithome.com/newsuploadfiles/2024/11/1c195c21-84b5-4337-94f1-3716963b32ae.jpg?x-bce-process=image/watermark,image_aW1nL3dhdGVybWFyay9xdy9xdzEyNy5wbmc=,t_100,g_9,y_22,x_22,a_0/format,f_auto") return url.href;
    if (url.href === "https://img.ithome.com/newsuploadfiles/2022/4/a648baa2-c0cb-4832-89b3-106406484b83.jpg@s_2,w_820,h_372") return url.href;
    if (url.hostname === "img.ithome.com" && (/^\/newsuploadfiles\/\d{4}\/\d{1,2}\/[a-f\d-]+\.(?:png|jpe?g|webp)$/i.test(url.pathname) || ["/newsuploadfiles/2021/3/20210317_230024_865.jpg@s_2,w_820,h_413", "/newsuploadfiles/2021/1/20210118202111_3449.jpg@s_2,w_820,h_822", "/newsuploadfiles/2022/5/c44c8be9-d7f5-41d3-9d0d-790cff4fe6e1.jpg@s_2,w_820,h_1294", "/newsuploadfiles/2022/5/8d6358aa-96a3-4180-b335-a450b7223656.jpg@s_2,w_820,h_1093"].includes(url.pathname))
      && (!url.search || url.search === "?x-bce-process=image/format,f_auto")) return url.href;
    if (/^2[a-f]\.zol-img\.com\.cn$/.test(url.hostname)
      && /^\/product\/\d+(?:_\d+x\d+)?\/\d+\/[\w-]+\.(?:png|jpe?g|webp)$/i.test(url.pathname)) return url.href;
    if (["cdsassets.apple.com", "store.storeimages.cdn-apple.com"].includes(url.hostname)
      && /\/(?:images|is)\//.test(url.pathname)) return url.href;
    if (url.hostname === "www.apple.com" && ["/v/macbook-air/specs/c/images/specs/13-inch/mba_13_specs_hero__gcrzfzta9pyu_large_2x.jpg","/v/macbook-air/specs/c/images/specs/15-inch/mba_15_finish__qtorusvjufma_large_2x.jpg"].includes(url.pathname) && !url.search) return url.href;
    if (url.hostname === "www.apple.com.cn" && [
      "/newsroom/images/product/mac/standard/MacBook-Air-family-10302018_inline.jpg.large.jpg",
      "/newsroom/images/product/iphone/standard/Apple_new-iphone-se-white_04152020_big.jpg.large.jpg",
      "/newsroom/images/2026/03/macbook-neo-iphone-17e-ipad-air-with-m4-and-more-are-now-available/article/Apple-March-2026-MacBook-Neo-color-lineup_big.jpg.large.jpg",
    ].includes(url.pathname) && !url.search) return url.href;
    if (url.hostname === "c1.mifile.cn" && url.pathname === "/f/i/16/chain/shouhuan3//atlas-4.jpg" && !url.search) return url.href;
    if (url.hostname === "static.shihuocdn.cn" && [
      "/def/20190319/ddb61afe1625f393aee1614331fd34331552965827.jpg",
      "/admin/imgs/20221019/ed64f76c3988284cb2e643eca05c11fc_1112x1112.png",
      "/admin/imgs/20221018/b2b6abea3c00df1592a6d821ece528a4_1112x1112.jpeg",
      "/def/20190319/65054608c2db280e25b8fec2362b81a21552965040.jpg",
      "/admin/imgs/20220908/4854302db8fcf9c2fa94bde2f2a0f8a5_800x800.jpg",
    ].includes(url.pathname) && !url.search) return url.href;
    if (url.hostname === "static.shihuocdn.cn" && /^\/(?:common|goods)\/.*\.(?:png|jpe?g|webp)$/i.test(url.pathname)) return url.href;
    if (url.hostname === "eimage.shihuocdn.cn" && /^\/[\w/-]+\/[\w=+%-]+$/.test(url.pathname)) return url.href;
    if (url.hostname === "wwwstatic.vivo.com.cn" && /^\/vivoportal\/files\/image\/detail\/.*\.(?:png|jpe?g|webp)$/i.test(url.pathname)) return url.href;
    if (url.hostname === "wwwstatic.vivo.com.cn" && ["/vivoportal/files/image/brand/20240514/c2a0cb06033b23c28e7f77a002a5d287.jpg", "/vivoportal/files/image/brand/20240514/50d299e2dfd1e95a84ee5b649006785a.jpg", "/vivoportal/files/image/brand/20220426/f0525ff48456bc24f1294af9fadd5694.png", "/vivoportal/files/image/brand/20220426/6983c32b56e98db33a7e2fd7c22c686e.png", "/vivoportal/files/image/brand/20231115/9a44bd5ce5d719d3b842f38ff4079f1c.png", "/vivoportal/files/image/brand/20231115/2b7bf7cfb5254d1df3cd64f20da4579a.png"].includes(url.pathname) && !url.search) return url.href;
    if (url.hostname === "cn-exstatic-vivofs.iqoo.com" && /^\/[\w/-]+\.(?:png|jpe?g|webp)$/i.test(url.pathname)) return url.href;
    if (url.hostname === "consumer.huawei.com" && /^\/(?:dam\/)?content\/dam\/huawei-cbg-site\/.*\.(?:png|jpe?g|webp)$/i.test(url.pathname)) return url.href;
    if (url.hostname === "consumer-tkbdownload.huawei.com" && /^\/ctkbfm\/servlet\/download\/downloadServlet\/[A-Za-z0-9_%=-]+\.(?:png|jpe?g)$/.test(url.pathname) && !url.search) return url.href;
    if (url.hostname === "www.oppo.com" && /^\/content\/dam\/oppo(?:_com)?\/.*\.(?:png|jpe?g|webp|avif)$/i.test(url.pathname)) return url.href;
    if (url.hostname === "msecfs.opposhop.cn" && /^\/commons-media-picture\/GOODS\/\d{8}\/[-\w]+\.(?:png|jpe?g|webp)$/i.test(url.pathname)) return url.href;
    if (url.hostname === "www-file.honor.com" && /^\/content\/dam\/honor\/.*\.(?:png|jpe?g|webp)$/i.test(url.pathname)) return url.href;
    if (url.hostname === "images.samsung.com.cn" && [
      "/is/image/samsung/p6pim/cn/feature/165098802/cn-feature-galaxy-fit3-r390-540618958",
      "/is/image/samsung/p6pim/cn/feature/166835482/cn-feature-galaxy-tab-a11-plus-sm-x230-574939-550586235",
    ].includes(url.pathname) && url.search === "?$FB_TYPE_K_JPG$") return url.href;
    if (url.hostname === "images.samsung.com.cn" && [
      "/cn/smartphones/galaxy-s25-ultra/images/galaxy-s25-ultra-features-colors-titanium-silverblue.jpg",
      "/cn/smartphones/galaxy-s25-ultra/images/galaxy-s25-ultra-features-colors-titanium-black.jpg",
      "/cn/smartphones/galaxy-s25-ultra/images/galaxy-s25-ultra-features-colors-titanium-gray.jpg",
      "/cn/smartphones/galaxy-s25-ultra/images/galaxy-s25-ultra-features-colors-titanium-whitesilver.jpg",
      "/cn/smartphones/galaxy-s25-ultra/images/galaxy-s25-ultra-features-colors-titanium-jetblack.jpg",
      "/cn/smartphones/galaxy-s25-ultra/images/galaxy-s25-ultra-features-colors-titanium-jadegreen.jpg",
      "/cn/smartphones/galaxy-s25-ultra/images/galaxy-s25-ultra-features-colors-titanium-pinkgold.jpg",
      "/cn/smartphones/galaxy-s26-ultra/images/galaxy-s26-ultra-features-colors-cobalt-violet.jpg",
      "/cn/smartphones/galaxy-s26-ultra/images/galaxy-s26-ultra-features-colors-sky-blue.jpg",
      "/cn/smartphones/galaxy-s26-ultra/images/galaxy-s26-ultra-features-colors-black.jpg",
      "/cn/smartphones/galaxy-s26-ultra/images/galaxy-s26-ultra-features-colors-white.jpg",
      "/cn/smartphones/galaxy-s26-ultra/images/galaxy-s26-ultra-features-colors-silver-shadow.jpg",
      "/cn/smartphones/galaxy-s26-ultra/images/galaxy-s26-ultra-features-colors-pink-gold.jpg",
    ].includes(url.pathname) && !url.search) return url.href;
    if (url.hostname === "images.samsung.com.cn" && /^\/is\/image\/samsung\/assets\/cn\/.*\.(?:png|jpe?g|webp)$/i.test(url.pathname)) return url.href;
    if (url.hostname === "images.samsung.com.cn"
      && /^\/is\/image\/samsung\/p6pim\/cn\/(?:sm-[a-z0-9]+(?:chn|chc)|\d{4})\/gallery\/[a-z0-9-]+$/i.test(url.pathname)) return url.href;
    if (url.hostname === "images.samsung.com.cn"
      && /^\/is\/image\/samsung\/cn-[a-z0-9-]+-sm-[a-z0-9]+(?:chn|chc)-\d+$/i.test(url.pathname)) return url.href;
    if (/^img\d\.pconline\.com\.cn$/.test(url.hostname)
      && /^\/pconline\/images\/product\/\d{8}\/\d+(?:_(?:m2|cn))?\.(?:png|jpe?g|webp)$/i.test(url.pathname)) return url.href;
    if (url.hostname === "i1.mifile.cn" && url.pathname === "/f/i/17/mibookpro/index/bg-top.jpg") return url.href;
    if (url.hostname === "i1.mifile.cn" && ["/f/i/16/chain/redmibook14-rlb/specs-banner.jpg", "/f/i/2019/micc9/specs/pro.jpg",
      "/f/i/2019/redmik20pro/specs_header02.jpg", "/f/i/2019/redmik20pro/section27_img3.jpg", "/f/i/2019/redmik20/specs_header.jpg"].includes(url.pathname)) return url.href;
    if (url.hostname === "i1.mifile.cn" && ["/f/i/2019/mi9tr/gallery3.jpg", "/f/i/2018/mi8ud/specs-banner-img1.jpg"].includes(url.pathname) && !url.search) return url.href;
    if (["i1.mifile.cn", "c1.mifile.cn"].includes(url.hostname)
      && /^\/f\/i\/(?:17|18|2018|2019)\/(?:mi5c|mi5x|mi9se|8i|mi8i|mi8yong|mi8youth|mi6x|minote3|miplay|redminote4x|redmi4x|redminote5a|redmi5|redminote5|redmi6|redmi6pro|redmi6a|redmis2|redmi7|redmi7a|redminote7|redminote7pro|mix2s|mix3)\/[\w/.-]+\.(?:png|jpe?g)$/i.test(url.pathname)) return url.href;
    if (url.hostname === "c1.mifile.cn" && ["/f/i/17/mi6/specs/s-black.jpg", "/f/i/17/mi6/specs/s-white.jpg"].includes(url.pathname) && !url.search) return url.href;
    if (url.hostname === "i1.mifile.cn" && ["/f/i/18/migaminglaptop/banner.jpg", "/f/i/18/gamelaptop//banner.jpg",
      "/f/i/2019/milaptop/gaming-2019/section01_bg.jpg"].includes(url.pathname)) return url.href;
    if (url.hostname === "cdn.cnbj1.fds.api.mi-img.com" && ["/product-images/xiaomiwatchcolor2p4b1/section-07.jpg", "/product-images/redmiwatch2c87cfe/262.png", "/product-images/redmiwatch4ll77jq/index/22278.png", "/product-images/xiaomi-smart-band-10_505982/images/739.png", "/product-images/redmiBooks/14-20248abe56/section-16.jpg",
      "/product-images/new-product-images/xiaomi-pad-8_66003/images/7101.png",
      "/product-images/new-product-images/xiaomi-pad-8-pro_3305/images/8416.png"].includes(url.pathname)) return url.href;
  } catch { /* 外部素材地址不合法时留空。 */ }
  return null;
}

export function readXiaomiPro2017Image(html, device, sourceUrl) {
  if (device.id !== "xiaomi-book-pro-15-2017" || sourceUrl !== "https://www.mi.com/mibookpro") return null;
  const title = plainText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const text = plainText(html);
  assert.ok(title.includes("小米笔记本Pro 15.6寸") && /i5-8250U/.test(text) && /i7-8550U/.test(text) && /MX150/.test(text), "2017 Pro 官方年份/芯片版本不匹配");
  const tag = [...html.matchAll(/<img\b[^>]*>/gi)].map(([tag]) => tag)
    .find((tag) => attribute(tag, "data-src")?.endsWith("/f/i/17/mibookpro/index/bg-top.jpg"));
  const url = tag && safeImageUrl(new URL(attribute(tag, "data-src"), sourceUrl).href);
  return url ? { url, alt: `${device.modelName} 正面外观` } : null;
}

// 官网规格将材质附在色名后，商城只写色名。两份同型号原文共同核验，不做通用模糊别名。
export function readReviewedOppoColorImages(html, labelHtml, device, review) {
  assert.equal(device.brand, "OPPO");
  assert.match(review.sourceUrl, /^https:\/\/www\.opposhop\.cn\/cn\/web\/products\/\d+\.html$/);
  assert.match(review.linkedFromUrl, /^https:\/\/www\.oppo\.com\/cn\/smartphones\/[\w/-]+\/specs\/$/);
  const labels = readOfficialColorGallery(labelHtml, device, review.linkedFromUrl).colors;
  const photos = readOfficialColorGallery(html, device, review.sourceUrl).colors;
  return Object.entries(review.colors).map(([name, url]) => {
    const sourceName = review.sourceColorNames?.[name];
    assert.ok(sourceName && name === `${sourceName}（${name.match(/（(玻纤|素皮|板材|锻造碳)）$/)?.[1]}）`, "仅允许官网明确标注的颜色材质说明");
    assert.equal(labels.filter(color => color.name === name).length, 1, "完整颜色材质标签必须属于该型号官网");
    assert.equal(photos.filter(color => color.name === sourceName && color.url === url).length, 1, "商城原图必须绑定相同具名颜色");
    return { name, url, viewScope: "front_back" };
  });
}

export function readOfficialColorGallery(html, device, sourceUrl) {
  if (device.brand === "OPPO" && /^https:\/\/www\.opposhop\.cn\/cn\/web\/products\/\d+\.html$/.test(sourceUrl)) {
    const data = readOppoShopData(html);
    const base = device.modelName.replace(/\s*(?:Wi-?Fi(?:柔光)?版|柔光版)$/i, "");
    const soft = /soft-light/.test(device.variant ?? "") || /柔光版$/.test(device.modelName);
    const wifi = /wifi/.test(device.variant ?? "") || /Wi-?Fi/i.test(device.modelName);
    assert.equal(data.goodsSpuName, base, "商城图片必须对应准确产品");
    assert.equal(String(data.goodsSkuId), sourceUrl.match(/\/(\d+)\.html$/)[1]);
    const own = data.attributes.skuItems.find(sku => String(sku.skuId) === String(data.goodsSkuId));
    assert.ok(own && Boolean(own.key1.includes("柔光版")) === soft && (!wifi || /^(?:wi-?fi)(?:版)?$/i.test(own.key3?.trim() ?? "")), "商城主图版型/网络必须一致");
    const colors = data.attributesColorParams.filter(color => Boolean(color.color.includes("柔光版")) === soft
      && data.attributes.skuItems.some(sku => sku.key1 === color.color && (!wifi || /^(?:wi-?fi)(?:版)?$/i.test(sku.key3?.trim() ?? ""))))
      .map(color => ({ name: color.color.replace(/ 柔光版$/, ""), url: safeImageUrl(color.colorUrl) }));
    const url = safeImageUrl(data.url);
    return { image: url ? { url, alt: data.name } : undefined, colors };
  }
  const compact = (text) => text.replace(/^(?:oppo|vivo)\s*/i, "")
    .replace(/华为|huawei|荣耀|honor|三星|samsung/gi, "").replace(/[\s()（）]/g, "").toLowerCase();
  const title = plainText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  if (device.brand === "Samsung" && /^https:\/\/www\.samsung\.com\.cn\/support\/model\/SM-[A-Z0-9]+(?:CHN|CHC)\/$/i.test(sourceUrl)) {
    const code = sourceUrl.match(/\/(SM-[A-Z0-9]+)\/$/i)[1].toLowerCase();
    const normalize = value => compact(value).replace(/galaxy|盖乐世/g, "");
    const heading = plainText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
    assert.equal(normalize(heading), normalize(device.modelName), "售后主图型号必须一致");
    const tag = [...html.matchAll(/<img\b[^>]*>/g)].map(([tag]) => tag).find(tag => /\bimage__main\b/.test(attribute(tag, "class") ?? "")
      && (attribute(tag, "data-mobile-src") ?? attribute(tag, "data-desktop-src") ?? "").toLowerCase().includes(code));
    const path = tag && (attribute(tag, "data-mobile-src") ?? attribute(tag, "data-desktop-src"));
    const url = path && path.toLowerCase().includes(code) && safeImageUrl(new URL(path, sourceUrl).href);
    return { image: url ? { url } : undefined, colors: [] };
  }
  if (device.brand === "Samsung" && sourceUrl.endsWith("/buy/") && html.includes("var BC_GROUP = ")) {
    const group = JSON.parse(html.match(/var BC_GROUP = (\{[^\n]+\});/)?.[1] ?? "null");
    const code = sourceUrl.match(/(sm-[a-z0-9]+(?:chn|chc))\/buy\/$/i)?.[1]?.toUpperCase();
    assert.ok(group && code && group.presetModel === code && compact(group.groupName) === compact(device.modelName), "商城主图必须绑定准确中国SKU和型号");
    const own = group.products?.[code];
    const url = own?.modelCode === code && safeImageUrl(new URL(own.hingePopupImage, sourceUrl).href);
    assert.ok(url && url.toLowerCase().includes(code.toLowerCase()), "商城主图型号代码不符");
    return { image: { url }, colors: [] };
  }
  const samsungCode = device.brand === "Samsung" && html.match(/id="modelCode"[^>]*value="([^"]+)"/)?.[1]?.toLowerCase();
  const singleSamsungSku = samsungCode && /(?:chn|chc)$/.test(samsungCode) && sourceUrl.toLowerCase().includes(samsungCode);
  const titleModel = device.brand === "Samsung" && !singleSamsungSku ? device.modelName.replace(/\+|\s+Ultra$/g, "")
    : device.brand === "Huawei" && device.category === "laptop" ? device.modelName.replace(/\s*\(\d{4}\)|鸿蒙版/g, "") : device.modelName;
  const titleAt = compact(title).indexOf(compact(titleModel));
  assert.ok(titleAt >= 0 && (device.brand === "Samsung" || !/^(?:pro|max|mini|ultra|\+)/.test(compact(title).slice(titleAt + compact(titleModel).length))), "官方图片页型号不匹配");
  const readImage = (tag) => {
    const path = attribute(tag, "data-src-1440") ?? attribute(tag, "data-src") ?? attribute(tag, "src") ?? "";
    const url = path && safeImageUrl(new URL(path, sourceUrl).href);
    return url ? { url, alt: attribute(tag, "alt") || `${device.modelName}外观参考` } : undefined;
  };
  let colors = [], image;
  if (device.brand === "vivo") {
    const section = html.match(/<ul\b[^>]*class="color-image-list"[^>]*>([\s\S]*?)<\/ul>/)?.[1] ?? "";
    colors = [...section.matchAll(/<img\b[^>]*>/g)].flatMap(([tag]) => {
      const name = attribute(tag, "alt")?.match(/\(([^)]+)\)\s*$/)?.[1];
      const photo = readImage(tag);
      return name ? [{ name, ...photo }] : [];
    });
  } else if (device.brand === "Huawei") {
    const section = html.match(/<ul\b[^>]*class="specs-banner-img"[^>]*>([\s\S]*?)<\/ul>/)?.[1] ?? "";
    // 部分儿童款只给多配色合照。它可作型号主图，不拆成每种颜色的独立照片。
    const modelPhoto = [...section.matchAll(/<img\b[^>]*>/g)].map(([tag]) => tag)
      .find(tag => compact(attribute(tag, "alt") ?? "") === compact(device.modelName));
    image = modelPhoto && readImage(modelPhoto);
    colors = [...section.matchAll(/<img\b[^>]*>/g)].flatMap(([tag]) => {
      const name = attribute(tag, "alt");
      return name && name !== device.modelName ? [{ name, ...readImage(tag) }] : [];
    });
    // 新版规格页的尺寸分组使用具名配色按钮；只取按钮声明的图片，不扫描装饰图。
    if (!colors.length) colors = [...html.matchAll(/<span\b[^>]*class="color-icon"[^>]*>/g)].flatMap(([tag]) => {
      const name = attribute(tag, "data-name"), path = attribute(tag, "data-image");
      const url = path && safeImageUrl(new URL(path, sourceUrl).href);
      return name && url ? [{ name, url, alt: name }] : [];
    });
  } else if (device.brand === "HONOR") {
    colors = [...html.matchAll(/<input\b[^>]*class="color-name-list"[^>]*>([\s\S]*?)<\/picture>/g)].map(([block, picture]) => {
      const name = attribute(block.match(/<input\b[^>]*>/)[0], "value");
      return { name, ...readImage(picture.match(/<img\b[^>]*>/)?.[0] ?? "") };
    }).filter((color) => color.name);
  } else if (device.brand === "Samsung") {
    const code = samsungCode;
    if (singleSamsungSku) {
      const heading = plainText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
      const model = (value) => compact(value).replace(/(?:wlan|wi-?fi|5g)$/g, "");
      assert.equal(model(heading), model(device.modelName), "官方单 SKU 图必须对应准确型号");
      assert.equal(/5G\s*$/.test(heading), device.variant === "5g", "官方单 SKU 图网络版本不匹配");
      const color = [...html.matchAll(/<span class="pdd39-anchor-nav__info-spec">([\s\S]*?)<\/span>/g)]
        .map((match) => plainText(match[1])).find((text) => !/\d+(?:GB|TB)/i.test(text));
      const paths = [...html.matchAll(/<(?:img|source)\b[^>]*>/g)].flatMap(([tag]) =>
        ["srcset", "data-src", "data-desktop-src", "src"].map((key) => attribute(tag, key)).filter(Boolean))
        .filter((path) => path.includes(`/p6pim/cn/${code}/gallery/`));
      const path = paths.find((path) => path.includes("$1164_776_PNG$")) ?? paths[0];
      const url = path && safeImageUrl(new URL(path, sourceUrl).href);
      return { image: url ? { url } : undefined, colors: color ? [{ name: color, ...(url ? { url } : {}) }] : [] };
    }
    const wModel = device.modelName.match(/^Samsung (W\d+(?: Flip)?)$/)?.[1];
    if (wModel && new URL(sourceUrl).pathname === `/smartphones/samsung-${wModel.toLowerCase().replace(" ", "-")}/`) {
      const tag = [...html.matchAll(/<img\b[^>]*>/g)].map(([tag]) => tag).find((tag) =>
        new RegExp(`/samsung-${wModel.toLowerCase().replace(" ", "-")}/images/${wModel.replace(" ", "-")}-KV-`, "i").test(attribute(tag, "data-src") ?? attribute(tag, "src") ?? ""));
      const url = tag && safeImageUrl(new URL(attribute(tag, "data-src") ?? attribute(tag, "src"), sourceUrl).href);
      return { image: url ? { url } : undefined, colors: [] };
    }
    // 同页含标准/Plus/Ultra：按官方 tab 的 aria-controls 找到准确的型号区域。
    const button = [...html.matchAll(/(<button\b[^>]*>)([\s\S]*?)<\/button>/g)]
      .find(([, , text]) => compact(plainText(text)) === compact(device.modelName));
    const panel = button && attribute(button[1], "aria-controls");
    assert.ok(panel, "官方图片页没有对应型号的配色区域");
    const start = panel ? html.indexOf(`id="${panel}"`) : -1;
    const section = start >= 0 ? html.slice(start).split(/<div\b[^>]*class="specification-tab__container/)[0] : "";
    colors = [...section.matchAll(/<figure\b[^>]*>([\s\S]*?)<\/figure>/g)].flatMap(([, figure]) => {
      const name = plainText(figure.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/)?.[1] ?? "");
      const tag = [...figure.matchAll(/<img\b[^>]*>/g)].map(([tag]) => tag)
        .find((tag) => /\bimage__main\b/.test(attribute(tag, "class") ?? ""));
      return name && tag ? [{ name, ...readImage(tag) }] : [];
    });
  } else if (device.brand === "OPPO") {
    const names = plainText(html.match(/<div\b[^>]*class="color-list-name[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "");
    colors = names.split(/\s*[|，、]\s*/).filter(Boolean).map((name) => ({ name }));
    const tag = [...html.matchAll(/<img\b[^>]*>/g)].map(([tag]) => tag)
      .find((tag) => compact(attribute(tag, "alt") ?? "") === compact(device.modelName));
    image = tag && readImage(tag);
    const section = html.split('id="section-color"')[1]?.split(/\bid="section-[^"]+"/)[0] ?? "";
    const photos = [...section.matchAll(/<img\b[^>]*>/g)].map(([tag]) => tag);
    for (const [button] of section.matchAll(/<div\b[^>]*data-gtm-label=[^>]*>/g)) {
      const name = attribute(button, "data-gtm-label"), index = attribute(button, "class")?.match(/\bbtn-(\d+)\b/)?.[1];
      const photo = index && photos.find((tag) => new RegExp(`\\bcolor-img-${index}\\b`).test(attribute(tag, "class") ?? "") && attribute(tag, "data-src-1440"));
      if (name && photo) {
        const color = { name, ...readImage(photo) }, at = colors.findIndex((color) => color.name === name);
        if (at >= 0) colors[at] = color; else colors.push(color);
      }
    }
  }
  return { image: image ?? colors.find((color) => color.url), colors };
}

export function readAppleSupportColorImages(html, knownColors = []) {
  const section = html.match(/<h[23]\b[^>]*>\s*(?:外观|外觀|颜色|顏色)\s*<\/h[23]>([\s\S]*?)<\/ul>/)?.[1] ?? "";
  const names = splitColorNames(knownColors.length ? knownColors : [...section.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)]
    .map(([, text]) => plainText(text).replace(/銀/g, "银")));
  const codes = { 银色: "silver", 金色: "gold", 玫瑰金色: "rosegold", 黑色: "black", 亮黑色: "jetblack", 红色: "red",
    深空灰色: "(?:spacegray|gray|space)", 太空灰色: "(?:spacegray|gray|space)" };
  const tags = [...html.matchAll(/<img\b[^>]*>/g)].map(([tag]) => tag).filter((tag) => /\bgb-image\b/.test(attribute(tag, "class") ?? ""));
  return names.map((name) => {
    const code = codes[name];
    const tag = code && tags.find((tag) => new RegExp(`[_-]${code}(?:[_-]|\\d|\\.|$)`, "i").test(attribute(tag, "src") ?? "")
      && !/port|connector|diagram|expansion|sim-card/i.test(attribute(tag, "src") ?? ""));
    const url = tag && safeImageUrl(attribute(tag, "src"));
    return { name, ...(url ? { url, alt: `Apple ${name}产品外观参考` } : {}) };
  });
}

export function readShihuoColorImages(html, modelName, knownColors, device) {
  const raw = html.match(/<script\b[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(raw, "没有商品页面数据");
  const page = JSON.parse(raw).props?.pageProps;
  const title = page?.data?.data?.meta_title ?? "";
  const compact = (text) => text.replace(/华为|HUAWEI|Apple|苹果|小米|Xiaomi|三星|Samsung|荣耀|Honor/gi, "")
    .replace(/红米/g, "Redmi").replace(/[\s()（）·]/g, "").toLowerCase();
  const expected = compact(modelName), normalized = compact(title);
  const start = normalized.indexOf(expected);
  let matches = expected && start >= 0 && !/^(?:[/-]?(?:pro|max|plus|mini|e))/.test(normalized.slice(start + expected.length));
  if (!matches && device?.brand === "Apple" && device.category !== "phone") {
    // 标题顺序可不同，但产品族、实际/标称尺寸、年份与显式芯片均必须一致。
    const family = modelName.match(/(?:iPad|MacBook)(?:\s+(?:Air|Pro|mini|Neo))?/i)?.[0];
    const normalizedFamily = family && compact(family);
    const at = normalizedFamily ? normalized.indexOf(normalizedFamily) : -1;
    const ownFamily = at >= 0 && !/^(?:air|pro|mini|neo)/.test(normalized.slice(at + normalizedFamily.length));
    const sizes = [device.specs.screenSize?.value, modelName.match(/(\d+(?:\.\d+)?)\s*英寸/)?.[1],
      device.specs.displayType?.rawText?.match(/(\d+(?:\.\d+)?)\s*英寸/)?.[1]].filter(Boolean);
    const generation = modelName.match(/^iPad\s*\(第\s*(\d+)\s*代\)/)?.[1];
    const basicChip = modelName.match(/^iPad\s*\((A\d+)\)/i)?.[1];
    // 标准 iPad 可由明确代数/芯片定位，避免把官方矩形测量 10.86 与标称 10.9/11 混为身份差异。
    const ownSize = sizes.some((size) => normalized.includes(`${size}英寸`) || normalized.includes(`${size}寸`))
      || (generation && new RegExp(`\\biPad\\s*${generation}(?:\\s|\\b)`, "i").test(title))
      || (basicChip && normalized.includes(basicChip.toLowerCase()));
    const chip = compact(modelName).match(/[ma]\d+(?:pro|max)?/)?.[0];
    const statedChips = [...normalized.matchAll(/[ma]\d+(?:pro|max)?/g)].map(([value]) => value);
    matches = ownFamily && ownSize && normalized.includes(String(device.releaseYear))
      && (!chip || !statedChips.length || statedChips.every((value) => value === chip));
  }
  assert.ok(matches, "商品型号不匹配");
  const styles = (page?.styleListData?.data?.list?.list ?? []).flatMap((style) => {
    const image = style.img_arr?.[0];
    const name = image?.img_alt?.match(/^商品配色：\s*(.+)$/)?.[1]?.trim();
    const url = image && safeImageUrl(image.img_url);
    return name && url ? [{ name, url, alt: `${modelName} ${name}配色参考` }] : [];
  });
  const colorKey = (name) => name.replace(/色$/, "");
  return (knownColors.length ? knownColors : [...new Set(styles.map((style) => style.name))])
    .map((name) => { const image = styles.find((style) => colorKey(style.name) === colorKey(name));
      return image ? { ...image, name } : { name }; });
}

export function readZolColorImages(html, { seriesId, productId, includeAlternates = false }) {
  const raw = html.match(/var picList\s*=\s*(\[[\s\S]*?\]);/)?.[1];
  assert.ok(raw, "图片页没有可读取的图片清单");
  const rows = JSON.parse(raw);
  assert.ok(Array.isArray(rows) && rows.length, "图片清单为空");
  const own = rows.filter((row) => productId ? String(row.proId) === productId : String(row.sid) === seriesId);
  assert.ok(own.length, "图片页型号不匹配");
  const section = html.match(/<div\b[^>]*class="category-filter category-color-filter"[^>]*>([\s\S]*?)<\/div><\/div>/)?.[1] ?? "";
  const colors = [];
  for (const [tag] of section.matchAll(/<a\b[^>]*>/g)) {
    const name = attribute(tag, "title"), id = attribute(tag, "data-id");
    if (!name || !id || colors.some((color) => color.name === name)) continue;
    // 优先独立外观图；不把跑分截图、拆机图或其他型号的评测配图当成配色产品图。
    const candidates = own.filter((row) => String(row.classId4) === id && (/^(?:外观图|精美图赏|官方图)$/.test(row.className)
      || includeAlternates && (row.className === "整体外观图" || row.curClassId === 4 && row.className === plainText(name))));
    if (includeAlternates) {
      for (const candidate of candidates) {
        const url = safeImageUrl(candidate.picSrc?.replace(/_\d+x\d+(?=\/)/, ""));
        if (url) colors.push({ name: plainText(name), url });
      }
      continue;
    }
    const photo = candidates.find(row => hasBothViews({ alt: row.brief })) ?? candidates[0];
    // 与 ZOL 公开查看器相同的原图规则，只去掉尺寸后缀，不修改颜色或图像内容。
    const url = photo && safeImageUrl(photo.picSrc?.replace(/_\d+x\d+(?=\/)/, ""));
    colors.push({ name: plainText(name), ...(url ? { url,
      ...(hasBothViews({ alt: photo.brief }) ? { viewScope: "front_back" } : {}) } : {}) });
  }
  return colors;
}

export function readReviewedZolColorImages(html, review) {
  for (const binding of review.zolBindings ?? []) assert.ok(html.includes(binding.anchor), "已审配色图片原文锚点缺失");
  const photos = readZolColorImages(html, { productId: review.productId, includeAlternates: Boolean(review.zolBindings) });
  if (!review.zolBindings) return photos;
  return review.zolBindings.map(binding => {
    const row = JSON.parse(binding.anchor);
    assert.equal(String(row.proId), review.productId, "配色图片型号不符");
    assert.equal(String(row.classId4), binding.classId4, "配色分类不符");
    assert.equal(row.picId, binding.picId, "已审图片编号不符");
    assert.equal(row.hash, binding.hash, "已审图片资源不符");
    assert.ok(photos.some(photo => photo.name === binding.sourceColor && photo.url === binding.url), "原页颜色与已审照片绑定不符");
    assert.equal(review.colors[binding.color], binding.url, "配色别名不能换图");
    return { name: binding.color, url: binding.url };
  });
}

export function readZolGalleryImage(html, productId) {
  const raw = html.match(/var picList\s*=\s*(\[[\s\S]*?\]);/)?.[1];
  if (!raw || !productId) return null;
  const rows = JSON.parse(raw);
  const photo = rows.find((row) => String(row.proId) === productId && /^(?:外观图|精美图赏|官方图)$/.test(row.className));
  const url = photo && safeImageUrl(photo.picSrc?.replace(/_\d+x\d+(?=\/)/, ""));
  return url ? { url } : null;
}

export function readReviewedAppleColorImages(html, device, review) {
  assert.equal(review.status, "downloaded_and_visually_reviewed");
  assert.equal(review.modelName, device.modelName, "Apple 审图型号不能换成其他版本");
  assert.match(review.sourceUrl, /^https:\/\/www\.apple\.com\.cn\/shop\/buy-iphone\/[^/]+$/);
  assert.equal(review.bindings.length, Object.keys(review.colors).length, "Apple 核验配色绑定必须完整");
  assert.equal(new Set(review.bindings.map(binding => binding.color)).size, review.bindings.length, "Apple 颜色绑定不能重复");
  const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
    .map(match => match[1]).find(script => script.includes("window.PRODUCT_SELECTION_BOOTSTRAP ="));
  assert.ok(script, "Apple JSON 图片字典缺失");
  const raw = script.split("productSelectionData:")[1]?.trim().replace(/\s*}\s*;?\s*$/, "");
  const data = JSON.parse(raw);
  const colors = readAppleColorImages(html, device.modelName, Object.keys(review.colors));
  return review.bindings.map(binding => {
    const image = data.imageDictionary?.[binding.imageName];
    assert.equal(image?.imageName, binding.imageName, "Apple JSON imageName 缺失");
    assert.equal(image.alt, binding.alt, "Apple JSON alt 型号和颜色绑定已变化");
    assert.equal(image.sources?.[0]?.srcSet, review.colors[binding.color], "Apple JSON source 不能換成局部图或其他版本");
    assert.ok(colors.some(color => color.name === binding.color && color.url === image.sources[0].srcSet
      && color.viewScope === "front_back"), "Apple JSON 必须绑定当前型号颜色的正反图");
    return { name: binding.color, url: image.sources[0].srcSet, alt: image.alt, viewScope: "front_back" };
  });
}

export function readAppleColorImages(html, modelName, knownColors) {
  const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
    .map((match) => match[1]).find((script) => script.includes("window.PRODUCT_SELECTION_BOOTSTRAP ="));
  if (!script) return [];
  // 仅解析页面自身的 JSON 数据，不执行外部页面脚本。
  const raw = script.split("productSelectionData:")[1]?.trim().replace(/\s*}\s*;?\s*$/, "");
  if (!raw) return [];
  const data = JSON.parse(raw);
  const images = Object.values(data.imageDictionary ?? {});
  const compact = (value) => value.replace(/[（(][^()（）]*[)）]/g, "").replace(/[\s\u00a0]/g, "").toLowerCase();
  const expected = compact(modelName);
  return splitColorNames(knownColors).map((name) => {
    const candidates = images.filter((image) => {
      const alt = compact(image.alt ?? "");
      const prefix = `${compact(name)}${expected}`;
      return (alt.startsWith(prefix) && !/^(?:plus|pro|max|mini)/.test(alt.slice(prefix.length)))
        || alt.startsWith(`${expected}，展示机身背面、${compact(name)}外观、`);
    });
    const image = candidates.find(hasBothViews) ?? candidates[0];
    const url = image && safeImageUrl(image.sources?.[0]?.srcSet);
    return { name, ...(url ? { url, alt: image.alt, ...(hasBothViews(image) ? { viewScope: "front_back" } : {}) } : {}) };
  });
}

export function readAppleProductImage(html) {
  const tags = [...html.matchAll(/<img\b[^>]*>/g)].map(([tag]) => tag);
  const tag = tags.find((tag) => /\bgb-image\b/.test(attribute(tag, "class") ?? "")
    && !/port|connector|diagram|sim-card/i.test(attribute(tag, "alt") ?? "")
    && safeImageUrl(attribute(tag, "src") ?? ""));
  if (!tag) return null;
  const alt = attribute(tag, "alt") || "Apple 产品外观参考";
  return { url: safeImageUrl(attribute(tag, "src")), alt,
    ...(/所有可选颜色/.test(alt) ? { colorScope: "all_colors" } : {}),
    ...(/背面/.test(alt) && /正面/.test(alt) ? { viewScope: "front_back" } : {}) };
}

export function readAppleIdentificationImage(html, device) {
  const headings = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)];
  const normalize = value => value.replace(/（/g, "(").replace(/）/g, ")").replace(/\s+/g, "");
  const index = headings.findIndex((match) => normalize(plainText(match[1])) === normalize(device.modelName));
  if (index < 0) return null;
  const section = html.slice(headings[index].index + headings[index][0].length, headings[index + 1]?.index ?? html.length);
  assert.ok(plainText(section).includes(`推出年份：${device.releaseYear} 年`), "机型识别章节的年份必须一致");
  assert.ok(plainText(section).includes("中国大陆"), "机型识别章节必须包含国行型号");
  // 每个 h2 是一个准确机型；章节合照仅作主图，不拆作每种颜色的独立照片。
  return readAppleProductImage(section);
}

export function readPconlineProductImage(html, device) {
  const normalize = (name) => name.replace(/小米|xiaomi/gi, "xiaomi").replace(/\s/g, "").toLowerCase();
  const title = plainText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").split(/参数|_/)[0];
  assert.equal(normalize(title), normalize(device.modelName), "太平洋图片页必须是准确型号，不能混用 Pro/Max");
  const heading = plainText(html.match(/<h1\b[^>]*>([^]*?)<\/h1>/)?.[1] ?? "");
  const tag = html.match(/<div\s+class="item">\s*<div>\s*(<img\b[^>]*>)/)?.[1]
    ?? (normalize(heading) === normalize(device.modelName) ? [...html.matchAll(/<img\b[^>]*>/g)].map(([tag]) => tag)
      .find(tag => normalize(attribute(tag, "alt") ?? "") === normalize(`${device.modelName}效果图`)) : undefined);
  // 参数页的对比按钮也绑定了准确型号的缩略图，不能取正文中的任意评测图。
  const comparison = [...html.matchAll(/compareBar\.comparePro\(this,'[^']+','([^']+)','([^']+)'/g)]
    .find(match => normalize(match[1]) === normalize(device.modelName));
  const path = (tag && (attribute(tag, "src2") ?? attribute(tag, "src"))) ?? comparison?.[2];
  const url = path && safeImageUrl(path.startsWith("//") ? `https:${path}` : path);
  return url ? { url, alt: `${device.modelName}产品图库外观参考`, previewFocus: "top" } : null;
}

// 只重放逐图核验的国行 SKU、具名选项和原装表带；不执行来源脚本。
export function readReviewedSamsungWatchColors(html, device, review) {
  assert.equal(review.targetId, device.id, "手表型号绑定不符");
  const normalize = value => value.normalize("NFKC").trim();
  if (review.reader === "samsung_watch5_named_colors") {
    assert.ok(html.includes(review.anchor), "手表配色原文锚点缺失");
    if (device.id === "samsung-galaxy-watch5-44-2022") {
      assert.equal(review.sourceUrl, "https://www.samsung.com.cn/watches/galaxy-watch/galaxy-watch5-44mm-silver-bluetooth-sm-r910nzsachc/");
      assert.ok(plainText(review.anchor).includes("Galaxy Watch5 蓝牙版 44mm可选颜色为哥特太空、晴空海岸、云雾冰川"), "蓝牙尺寸配色不符");
    } else {
      assert.equal(device.id, "samsung-galaxy-watch5-44-lte-2022");
      assert.equal(review.sourceUrl, "https://www.samsung.com.cn/watches/galaxy-watch/galaxy-watch5-44mm-graphite-lte-sm-r9150zaachc/buy/");
      assert.ok(html.includes('digitalData.product.displayName = "Galaxy Watch5 LTE版 44mm"'), "LTE尺寸不符");
      const expected = { SM_R9150ZAACHC: "哥特太空", SM_R9150ZBACHC: "晴空海岸", SM_R9150ZSACHC: "云雾冰川" };
      const controls = [...html.matchAll(/<input\b[^>]*name="pd-color"[^>]*>/g)].map(([tag]) => tag);
      assert.equal(controls.length, 3, "LTE颜色控件不唯一");
      const bound = controls.map(tag => {
        const sku = attribute(tag, "data-modelcode");
        const name = normalize(attribute(tag, "data-colorname") ?? "");
        assert.equal(name, expected[sku?.replace("-", "_")], "LTE颜色SKU不符");
        return name;
      });
      assert.equal(new Set(bound).size, 3, "LTE颜色SKU重复");
    }
    const names = ["哥特太空", "晴空海岸", "云雾冰川"];
    assert.deepEqual(review.allowedColors, names, "手表配色白名单不符");
    return names.map(name => ({ name }));
  }
  assert.equal(review.reader, "samsung_watch9_buying_options");
  assert.equal(review.status, "downloaded_and_visually_reviewed");
  const variants = {
    "samsung-galaxy-watch9-40-2026": ["40mm", "Bluetooth", ["SM-L340NZEACHC", "SM-L340NZKACHC"]],
    "samsung-galaxy-watch9-44-2026": ["44mm", "Bluetooth", ["SM-L350NZSACHC", "SM-L350NZKACHC"]],
    "samsung-galaxy-watch9-44-lte-2026": ["44mm", "Bluetooth + 4G", ["SM-L3550ZSACHC", "SM-L3550ZKACHC"]],
  };
  const variant = variants[device.id];
  assert.ok(variant, "手表型号不在白名单");
  assert.equal(review.sourceUrl, `https://www.samsung.com.cn/watches/galaxy-watch9/buy/?modelCode=${variant[2][1]}`, "手表来源SKU不符");
  const marker = "var buyingOptions = ";
  const start = html.indexOf(marker);
  assert.ok(start >= 0 && html.indexOf(marker, start + marker.length) === -1, "手表JSON标记不唯一");
  let depth = 0, quoted = false, escaped = false, end;
  for (let i = start + marker.length; i < html.length; i++) {
    const c = html[i];
    if (quoted) { if (escaped) escaped = false; else if (c === "\\") escaped = true; else if (c === '"') quoted = false; continue; }
    if (c === '"') quoted = true;
    else if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") { if (!--depth) { end = i + 1; break; } }
  }
  assert.ok(end && /^\s*;/.test(html.slice(end)), "手表JSON未闭合");
  const data = JSON.parse(html.slice(start + marker.length, end));
  assert.deepEqual(data.products.map(p => p.sku).sort(), [...variant[2]].sort(), "手表SKU集合不符");
  assert.deepEqual(review.bindings.map(b => b.sku).sort(), [...variant[2]].sort(), "核验SKU集合不符");
  const one = (items, predicate) => { const matches = items.filter(predicate); assert.equal(matches.length, 1, "手表具名选项不唯一"); return matches[0]; };
  return review.bindings.map(binding => {
    const product = one(data.products, p => p.sku === binding.sku);
    assert.equal(product.casePresetModelCode, binding.sku, "手表预设SKU不符");
    const option = type => {
      const mapping = one(product.optionMappings, m => m.typeCode === type);
      return one(one(product.buyingOptions, g => g.typeCode === type).optionItems, item => item.id === mapping.id);
    };
    assert.equal(option("C-DVC").engName, "Galaxy Watch9", "手表型号不符");
    assert.equal(option("C-SIZ").engName, variant[0], "手表尺寸不符");
    assert.equal(option("C-CON").engName, variant[1], "手表连接版本不符");
    assert.equal(option("C-CON").casePresetModelCode, binding.sku, "连接版本SKU不符");
    const color = option("C-CLR");
    const label = one(one(data.fullBuyingOptions, g => g.typeCode === "C-CLR").optionItems, item => item.id === color.id);
    const name = normalize(label.name);
    const expected = binding.sku.includes("ZEACHC") ? "云凝白" : binding.sku.includes("ZSACHC") ? "远空银" : "岩影灰";
    assert.equal(name, expected, "手表具名颜色不符");
    assert.equal(name, normalize(binding.color), "核验颜色不符");
    assert.equal(color.casePresetModelCode, binding.sku, "颜色SKU不符");
    assert.equal(color.pairBandCode, binding.bandCode, "原装表带不符");
    const band = one(color.subOptions, b => b.bandCode === color.pairBandCode);
    const image = one(band.image, image => image.imgType === "RP-PCH");
    assert.deepEqual(image, binding.image, "核验图片说明或资源不符");
    const url = safeImageUrl(new URL(image.imgPath, review.sourceUrl).href);
    assert.equal(url, binding.url, "手表图片资源不符");
    assert.ok(url, "手表图片不在白名单");
    return { name, url, alt: image.imgAltText, viewScope: "front" };
  });
}
