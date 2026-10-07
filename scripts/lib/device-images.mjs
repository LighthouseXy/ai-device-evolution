import assert from "node:assert/strict";
import { plainText, zolRows } from "./zol-device.mjs";
import { readOppoShopData } from "./android-official-specs.mjs";

export const attribute = (tag, name) => tag.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1];
const splitColorNames = (names) => [...new Set(names.flatMap((name) => name.split(/[,，、/]/).map((value) => value.trim())).filter(Boolean))];

// 颜色文字或失败刷新不能擦掉同型号已核验的照片；特别版边界由调用方的明确配色清单过滤。
export function mergeColorImages(previous = [], incoming = []) {
  const colors = new Map(previous.map((color) => [color.name, color]));
  for (const color of incoming) colors.set(color.name, color.image ? color : colors.get(color.name) ?? color);
  return [...colors.values()];
}

export function readReviewedProductImage(html, device, candidate) {
  assert.equal(candidate.status, "downloaded_and_visually_reviewed");
  assert.ok(candidate.targetIds?.includes(device.id), "核对实图必须明确绑定当前版型");
  assert.ok(candidate.anchor && html.includes(candidate.anchor), "核对实图的原页锚点缺失");
  const tag = candidate.anchor.match(/^<img\b[^>]*>$/)?.[0];
  const path = tag && (attribute(tag, "src") ?? attribute(tag, "data-src"));
  const url = path && safeImageUrl(new URL(path, candidate.sourceUrl).href);
  assert.equal(url, candidate.url, "核对实图不能改用其他资源");
  return { url, name: candidate.color, imageScope: candidate.imageScope, note: candidate.note,
    alt: `${device.modelName} ${candidate.color ?? ""}外观参考` };
}

export function readZolColors(html) {
  html = html.replace(/<a\b[^>]*>\s*查看外观(?:&gt;|[>＞])?\s*<\/a>/gi, "");
  const rows = zolRows(html);
  const field = rows.get("机身颜色") ?? rows.get("产品颜色") ?? "";
  const section = html.match(/<strong\b[^>]*>\s*颜色[：:]\s*<\/strong>([\s\S]*?)<\/div>/)?.[1] ?? "";
  const names = [...section.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)].map((match) => plainText(match[1]));
  return [...new Set([...field.split(/[,，、/\s]+/), ...names].filter(Boolean))];
}

export function safeImageUrl(value) {
  try {
    const url = new URL(value.replace(/&amp;/g, "&"));
    if (url.protocol === "http:" && url.hostname === "static.shihuocdn.cn") url.protocol = "https:";
    if (url.protocol === "http:" && /^img\d\.pconline\.com\.cn$/.test(url.hostname)) url.protocol = "https:";
    if (url.protocol !== "https:") return null;
    if (/^2[a-f]\.zol-img\.com\.cn$/.test(url.hostname)
      && /^\/product\/\d+(?:_\d+x\d+)?\/\d+\/[\w-]+\.(?:png|jpe?g|webp)$/i.test(url.pathname)) return url.href;
    if (["cdsassets.apple.com", "store.storeimages.cdn-apple.com"].includes(url.hostname)
      && /\/(?:images|is)\//.test(url.pathname)) return url.href;
    if (url.hostname === "static.shihuocdn.cn" && /^\/(?:common|goods)\/.*\.(?:png|jpe?g|webp)$/i.test(url.pathname)) return url.href;
    if (url.hostname === "eimage.shihuocdn.cn" && /^\/[\w/-]+\/[\w=+%-]+$/.test(url.pathname)) return url.href;
    if (url.hostname === "wwwstatic.vivo.com.cn" && /^\/vivoportal\/files\/image\/detail\/.*\.(?:png|jpe?g|webp)$/i.test(url.pathname)) return url.href;
    if (url.hostname === "cn-exstatic-vivofs.iqoo.com" && /^\/[\w/-]+\.(?:png|jpe?g|webp)$/i.test(url.pathname)) return url.href;
    if (url.hostname === "consumer.huawei.com" && /^\/content\/dam\/huawei-cbg-site\/.*\.(?:png|jpe?g|webp)$/i.test(url.pathname)) return url.href;
    if (url.hostname === "www.oppo.com" && /^\/content\/dam\/oppo(?:_com)?\/.*\.(?:png|jpe?g|webp|avif)$/i.test(url.pathname)) return url.href;
    if (url.hostname === "msecfs.opposhop.cn" && /^\/commons-media-picture\/GOODS\/\d{8}\/[-\w]+\.(?:png|jpe?g|webp)$/i.test(url.pathname)) return url.href;
    if (url.hostname === "www-file.honor.com" && /^\/content\/dam\/honor\/.*\.(?:png|jpe?g|webp)$/i.test(url.pathname)) return url.href;
    if (url.hostname === "images.samsung.com.cn" && /^\/is\/image\/samsung\/assets\/cn\/.*\.(?:png|jpe?g|webp)$/i.test(url.pathname)) return url.href;
    if (url.hostname === "images.samsung.com.cn"
      && /^\/is\/image\/samsung\/p6pim\/cn\/(?:sm-[a-z0-9]+(?:chn|chc)|\d{4})\/gallery\/[a-z0-9-]+$/i.test(url.pathname)) return url.href;
    if (url.hostname === "images.samsung.com.cn"
      && /^\/is\/image\/samsung\/cn-[a-z0-9-]+-sm-[a-z0-9]+(?:chn|chc)-\d+$/i.test(url.pathname)) return url.href;
    if (/^img\d\.pconline\.com\.cn$/.test(url.hostname)
      && /^\/pconline\/images\/product\/\d{8}\/\d+(?:_(?:m2|cn))?\.(?:png|jpe?g|webp)$/i.test(url.pathname)) return url.href;
    if (url.hostname === "i1.mifile.cn" && url.pathname === "/f/i/17/mibookpro/index/bg-top.jpg") return url.href;
    if (url.hostname === "i1.mifile.cn" && ["/f/i/18/migaminglaptop/banner.jpg", "/f/i/18/gamelaptop//banner.jpg",
      "/f/i/2019/milaptop/gaming-2019/section01_bg.jpg"].includes(url.pathname)) return url.href;
    if (url.hostname === "cdn.cnbj1.fds.api.mi-img.com" && ["/product-images/redmiBooks/14-20248abe56/section-16.jpg",
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

export function readZolColorImages(html, { seriesId, productId }) {
  const raw = html.match(/var picList\s*=\s*(\[[\s\S]*?\]);/)?.[1];
  assert.ok(raw, "图片页没有可读取的图片清单");
  const rows = JSON.parse(raw);
  assert.ok(Array.isArray(rows) && rows.length, "图片清单为空");
  const own = rows.filter((row) => seriesId ? String(row.sid) === seriesId : String(row.proId) === productId);
  assert.ok(own.length, "图片页型号不匹配");
  const section = html.match(/<div\b[^>]*class="category-filter category-color-filter"[^>]*>([\s\S]*?)<\/div><\/div>/)?.[1] ?? "";
  const colors = [];
  for (const [tag] of section.matchAll(/<a\b[^>]*>/g)) {
    const name = attribute(tag, "title"), id = attribute(tag, "data-id");
    if (!name || !id || colors.some((color) => color.name === name)) continue;
    // 优先独立外观图；不把跑分截图、拆机图或其他型号的评测配图当成配色产品图。
    const photo = own.find((row) => String(row.classId4) === id && /^(?:外观图|精美图赏|官方图)$/.test(row.className));
    // 与 ZOL 公开查看器相同的原图规则，只去掉尺寸后缀，不修改颜色或图像内容。
    const url = photo && safeImageUrl(photo.picSrc?.replace(/_\d+x\d+(?=\/)/, ""));
    colors.push({ name: plainText(name), ...(url ? { url } : {}) });
  }
  return colors;
}

export function readZolGalleryImage(html, productId) {
  const raw = html.match(/var picList\s*=\s*(\[[\s\S]*?\]);/)?.[1];
  if (!raw || !productId) return null;
  const rows = JSON.parse(raw);
  const photo = rows.find((row) => String(row.proId) === productId && /^(?:外观图|精美图赏|官方图)$/.test(row.className));
  const url = photo && safeImageUrl(photo.picSrc?.replace(/_\d+x\d+(?=\/)/, ""));
  return url ? { url } : null;
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
    const image = images.find((image) => {
      const alt = compact(image.alt ?? "");
      const prefix = `${compact(name)}${expected}`;
      return (alt.startsWith(prefix) && !/^(?:plus|pro|max|mini)/.test(alt.slice(prefix.length)))
        || alt.startsWith(`${expected}，展示机身背面、${compact(name)}外观、`);
    });
    const url = image && safeImageUrl(image.sources?.[0]?.srcSet);
    return { name, ...(url ? { url, alt: image.alt } : {}) };
  });
}

export function readAppleProductImage(html) {
  const tags = [...html.matchAll(/<img\b[^>]*>/g)].map(([tag]) => tag);
  const tag = tags.find((tag) => /\bgb-image\b/.test(attribute(tag, "class") ?? "")
    && !/port|connector|diagram|sim-card/i.test(attribute(tag, "alt") ?? "")
    && safeImageUrl(attribute(tag, "src") ?? ""));
  return tag ? { url: safeImageUrl(attribute(tag, "src")), alt: attribute(tag, "alt") || "Apple 产品外观参考" } : null;
}

export function readAppleIdentificationImage(html, device) {
  const headings = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)];
  const index = headings.findIndex((match) => plainText(match[1]) === device.modelName);
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
