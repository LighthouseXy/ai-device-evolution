import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { getSourceSnapshot } from "./lib/source-snapshot.mjs";
import { extractZolProductImage, plainText } from "./lib/zol-device.mjs";
import { mergeColorImages, readAppleColorImages, readAppleIdentificationImage, readAppleProductImage, readAppleSupportColorImages, readOfficialColorGallery, readPconlineProductImage, readReviewedProductImage, readShihuoColorImages, readXiaomiPro2017Image, readZolColorImages, readZolGalleryImage, readZolColors, safeImageUrl } from "./lib/device-images.mjs";

// 默认离线重放；--fetch 只沿已登记型号的页面链接补图，不搜索相似型号替代。
const { devices: sources } = JSON.parse(await fs.readFile("src/data/device-sources.json", "utf8"));
const { devices } = JSON.parse(await fs.readFile("src/data/devices-db.json", "utf8"));
const models = new Map(devices.map((device) => [device.id, device]));
const priorImages = JSON.parse(await fs.readFile("src/data/device-images.json", "utf8"));
const priorGalleries = JSON.parse(await fs.readFile("src/data/device-image-galleries.json", "utf8"));
const imageRecovery = JSON.parse(await fs.readFile("scripts/fixtures/xiaomi-image-recovery.json", "utf8"));
const stillRegistered = (id, value) => {
  const source = sources.find((item) => item.id === id);
  const urls = [source?.officialSpecUrl, source?.supportUrl, ...source?.referenceUrls ?? [], models.get(id)?.specs.colors?.sourceUrl];
  return value.modelName === models.get(id)?.modelName && urls.includes(value.linkedFromUrl ?? value.sourceUrl);
};
// 补图失败不删除既有的同型号、已登记来源图片；无效或已移除型号不沿用。
const images = Object.fromEntries(Object.entries(priorImages).filter(([id, value]) =>
  stillRegistered(id, value) && safeImageUrl(value.url) === value.url));
const galleries = Object.fromEntries(Object.entries(priorGalleries).filter(([id, value]) => stillRegistered(id, value)));
const gaps = [];
const cache = new Map();
const options = { offline: !process.argv.includes("--fetch") };
const snapshot = (url) => {
  if (!cache.has(url)) cache.set(url, getSourceSnapshot(url, { ...options, validate(html) {
    assert.ok(/<(?:title|h1)\b[^>]*>[\s\S]*?<\/(?:title|h1)>/i.test(html), "不是有效产品页面");
  } }));
  return cache.get(url);
};
const asset = (image, device, page, sourceName, linkedFromUrl) => ({ ...image,
  alt: image.alt || `${device.modelName}${image.name ? ` ${image.name}` : ""}外观参考`, modelName: device.modelName,
  sourceUrl: page.url, sourceName, fetchedAt: page.fetchedAt, sourceSnapshotHash: page.sha256,
  licenseStatus: "unknown",
  ...(linkedFromUrl ? { linkedFromUrl } : {}) });
const registerColors = (device, colors, page, sourceName, linkedFromUrl) => {
  if (!colors.length) return;
  const previous = galleries[device.id];
  const incoming = colors.map(({ name, url, alt }) => ({ name, ...(url ? {
    image: asset({ url, alt: alt ?? `${device.modelName} ${name}外观参考` }, device, page, sourceName, linkedFromUrl),
  } : {}) }));
  galleries[device.id] = { ...(previous && !incoming.some((color) => color.image) ? previous : {
    modelName: device.modelName, sourceUrl: page.url, sourceName,
    fetchedAt: page.fetchedAt, sourceSnapshotHash: page.sha256, ...(linkedFromUrl ? { linkedFromUrl } : {}),
  }), colors: mergeColorImages(previous?.colors, incoming) };
  if (!images[device.id]) images[device.id] = galleries[device.id].colors.find((color) => color.image)?.image;
};
async function sync(source) {
  const device = models.get(source.id);
  assert.ok(device, `${source.id}: 图片登记设备不存在`);
  const references = (source.referenceUrls ?? []).filter((url) => typeof url === "string");
  const pconlineUrl = references.find((url) => /^https:\/\/g\.pconline\.com\.cn\/product\/mobile\/[^/]+\/\d+_detail\.html$/.test(url));
  if (pconlineUrl && (!images[device.id] || images[device.id].sourceUrl === pconlineUrl)) {
    try {
      const page = await snapshot(pconlineUrl);
      const image = readPconlineProductImage(page.html, device);
      if (image) images[device.id] = asset(image, device, page, "太平洋产品图库");
    } catch (error) { gaps.push(`${device.id}: ${error.message}`); }
  }
  const configurationUrl = device.configurations?.map((configuration) => configuration.evidence?.sourceUrl)
    .find((url) => references.includes(url) && /^https:\/\/detail\.zol\.com\.cn\/\d+\/\d+\/param\.shtml$/.test(url));
  const url = configurationUrl || references.find((url) => /^https:\/\/detail\.zol\.com\.cn\/series\/(?:57|702|16)\/\d+_1\.html$/.test(url))
    || references.find((url) => /^https:\/\/detail\.zol\.com\.cn\/\d+\/\d+\/param\.shtml$/.test(url))
    || references.find((url) => /^https:\/\/detail\.zol\.com\.cn\/series\/(?:57|702|16)\/\d+\/param_\d+_0_1\.html$/.test(url));
  const seriesUrl = references.find((entry) => /^https:\/\/detail\.zol\.com\.cn\/series\/(?:57|702|16)\/\d+_1\.html$/.test(entry));
  // 已登记的同型号系列图库覆盖多种配色；具体 SKU 页只作为配置/主图首选，不删除系列配色证据。
  for (const candidateUrl of [...new Set([url, seriesUrl].filter(Boolean))]) {
    const url = candidateUrl;
    try {
      let page = await snapshot(url);
      const sid = url.match(/\/series\/\d+\/\d+\/param_(\d+)_0_1\.html$/)?.[1];
      const link = sid && [...page.html.matchAll(/href=["']([^"']+)["']/g)]
        .map((match) => match[1]).find((href) => new RegExp(`^/series/(?:57|702|16)/${sid}_1\\.html$`).test(href));
      if (link) page = await snapshot(new URL(link, url).href);
      const image = extractZolProductImage(page.html);
      if (image && (!configurationUrl || url === configurationUrl || !images[device.id])) {
        images[device.id] = asset(image, device, page, "中关村在线", page.url !== url ? url : undefined);
      }
      const known = readZolColors(page.html).map((name) => ({ name }));
      registerColors(device, known, page, "中关村在线", page.url !== url ? url : undefined);
      const seriesId = url.match(/\/series\/\d+\/(\d+)_1\.html$/)?.[1] ?? url.match(/\/series\/\d+\/\d+\/param_(\d+)_0_1\.html$/)?.[1];
      const productId = url.match(/\/\d+\/(\d+)\/param\.shtml$/)?.[1];
      const pictureLinks = (html) => [...new Set([...html.matchAll(/href=["']([^"']*\/picture_index_\d+\/index\d+_\d+_p(\d+)\.shtml)["']/g)]
        .filter((match) => !productId || match[2] === productId).map((match) => match[1]))].slice(0, 2);
      let hrefs = pictureLinks(page.html);
      // 已有色名不等于已有图片；只沿参数页直接提供的同产品 ID 图库补缺。
      if (!hrefs.length && productId && (!images[device.id] || galleries[device.id]?.colors.some((color) => !color.image))) {
        const overviewHref = [...page.html.matchAll(/href=["']([^"']+)["']/g)].map((match) => match[1])
          .find((href) => new RegExp(`^/\\d+/${productId}/pic\\.shtml$`).test(href));
        if (overviewHref) hrefs = pictureLinks((await snapshot(new URL(overviewHref, url).href)).html);
      }
      let pictureError;
      for (const href of hrefs) {
        try {
          const picture = await snapshot(new URL(href, url).href);
          const colors = readZolColorImages(picture.html, { seriesId, productId });
          const primary = !images[device.id] && readZolGalleryImage(picture.html, productId);
          if (primary) images[device.id] = asset(primary, device, picture, "中关村在线型号图库", url);
          const palette = [...known.map((color) => colors.find((entry) => entry.name === color.name) ?? color),
            ...colors.filter((color) => !known.some((entry) => entry.name === color.name))];
          registerColors(device, palette, picture, "中关村在线", url);
          pictureError = undefined;
          break;
        } catch (error) { pictureError = error; }
      }
      if (pictureError) throw pictureError;
    } catch (error) { gaps.push(`${device.id}: ${error.message}`); }
  }
  if (source.officialSpecUrl && !source.imageFieldGaps && ["vivo", "Huawei", "HONOR", "Samsung", "OPPO"].includes(device.brand)) {
    try {
      const page = await snapshot(source.officialSpecUrl);
      const { image, colors } = readOfficialColorGallery(page.html, device, page.url);
      if (image) images[device.id] = asset(image, device, page, `${device.brand} 中国官网`);
      if (colors.length) {
        registerColors(device, colors, page, `${device.brand} 中国官网`);
      }
      if (device.brand === "OPPO" && colors.some((color) => !color.url)) {
        const productUrl = references.find((url) => /^https:\/\/www\.oppo\.com\/cn\/smartphones\/series-find-x\/[^/]+\/$/.test(url));
        if (productUrl) {
          const product = await snapshot(productUrl);
          const photos = readOfficialColorGallery(product.html, device, product.url).colors;
          registerColors(device, colors.map((color) => photos.find((photo) => photo.name === color.name && photo.url) ?? color), product, "OPPO 中国官网");
        }
      }
    } catch (error) { gaps.push(`${device.id}: ${error.message}`); }
  }
  const colors = device.specs.colors?.value;
  if (device.brand === "Apple" && (Array.isArray(colors) || source.supportUrl)) {
    const specUrl = device.specs.colors?.sourceUrl ?? source.supportUrl;
    try {
      const page = await snapshot(specUrl);
      const image = readAppleProductImage(page.html);
      if (image) images[device.id] = asset(image, device, page, "Apple 中文技术规格");
      registerColors(device, readAppleSupportColorImages(page.html, colors), page, "Apple 中文技术规格");
    } catch (error) { gaps.push(`${device.id}: ${error.message}`); }
    if (device.category === "phone") {
      const identifyUrl = references.find((url) => url === "https://support.apple.com/zh-cn/108044");
      if (!images[device.id] && identifyUrl) {
        try {
          const page = await snapshot(identifyUrl);
          const image = readAppleIdentificationImage(page.html, device);
          if (image) images[device.id] = asset(image, device, page, "Apple 中文机型识别");
        } catch (error) { gaps.push(`${device.id}: ${error.message}`); }
      }
      const shopUrl = references.find((url) => /^https:\/\/www\.apple\.com\.cn\/shop\/buy-iphone\/[^/]+$/.test(url));
      if (shopUrl) {
        try {
          const page = await snapshot(shopUrl);
          const colors = readAppleColorImages(page.html, device.modelName, device.specs.colors.value);
          if (colors.some((color) => color.url)) registerColors(device, colors, page, "Apple 中国商店");
        } catch (error) { gaps.push(`${device.id}: ${error.message}`); }
      }
    }
  }
  const previous = galleries[device.id];
  if (!previous || previous.colors.some((color) => !color.image)) {
    const shihuoUrl = references.find((url) => /^https:\/\/www\.shihuo\.cn\/page\/pcGoodsDetail\?/.test(url));
    if (shihuoUrl) {
      try {
        const page = await snapshot(shihuoUrl);
        const colors = readShihuoColorImages(page.html, device.modelName, previous?.colors.map((color) => color.name) ?? [], device);
        registerColors(device, colors, page, "识货配色参考");
        // 保留已有官方/参数图库的照片，只补缺少的同名配色，不用色名相似度猜图。
        if (previous) galleries[device.id].colors = galleries[device.id].colors.map((color) =>
          previous.colors.find((entry) => entry.name === color.name && entry.image) ?? color);
      } catch (error) { gaps.push(`${device.id}: ${error.message}`); }
    }
  }
  // 少数历史批次以主图、图库分开登记，统一重放同一份原页证据，不直接信任保存的 URL。
  const legacyGallery = source.colorGallery;
  const reviewedPrimary = source.primaryImageCandidate?.anchor ? source.primaryImageCandidate : undefined;
  const primaryCandidate = source.productImage ?? (reviewedPrimary ? undefined : source.primaryImageCandidate);
  const legacyPage = legacyGallery ?? primaryCandidate;
  const recorded = source.productImages ?? (legacyPage ? {
    modelName: primaryCandidate?.modelName ?? device.modelName,
    sourceUrl: legacyPage.sourceUrl, sourceSnapshotHash: legacyPage.sourceSnapshotHash,
    seriesId: references.map((entry) => entry.match(/\/series\/\d+\/(\d+)_1\.html$/)?.[1]).find(Boolean),
    primary: primaryCandidate,
    colors: legacyGallery?.colors.map((color) => ({ ...color, sourceUrl: legacyGallery.sourceUrl,
      sourceSnapshotHash: legacyGallery.sourceSnapshotHash })),
  } : null);
  if (recorded) {
    // 即使某张证据页未缓存，也不能把已排除的特别版颜色重新并入标准版。
    if (recorded.modelName === device.modelName && recorded.colors?.length && galleries[device.id]) {
      const standardColors = new Set(recorded.colors.map((color) => color.name));
      galleries[device.id] = { ...galleries[device.id],
        colors: galleries[device.id].colors.filter((color) => standardColors.has(color.name)) };
    }
    try {
      assert.equal(recorded.modelName, device.modelName, "图片清单的型号必须一致");
      const registered = new Set([source.officialSpecUrl, ...references].filter(Boolean));
      const verifiedPage = async (entry) => {
        assert.ok(registered.has(entry.sourceUrl), "图片证据页面必须登记");
        const page = await snapshot(entry.sourceUrl);
        assert.equal(page.sha256, entry.sourceSnapshotHash, "图片清单与原始快照必须一致");
        return page;
      };
      if (recorded.primary) {
        const page = await verifiedPage(recorded.primary);
        const primary = page.url.includes("/picture_index_")
          ? readZolColorImages(page.html, { seriesId: recorded.seriesId, productId: page.url.match(/_p(\d+)\.shtml$/)?.[1] })
            .find((color) => (!recorded.primary.name || color.name === recorded.primary.name) && color.url === recorded.primary.url)
          : page.url.includes("detail.zol.com.cn") ? extractZolProductImage(page.html)
          : readOfficialColorGallery(page.html, device, page.url).image;
        assert.equal(primary?.url, recorded.primary.url, "主图必须可由对应型号的原页重放");
        images[device.id] = asset(primary, device, page, "已核对型号产品图");
      }
      const colors = [];
      for (const entry of recorded.colors ?? []) {
        if (!entry.url) { colors.push({ name: entry.name }); continue; }
        const page = await verifiedPage(entry);
        const found = page.url.includes("detail.zol.com.cn") ? readZolColorImages(page.html, {
          seriesId: recorded.seriesId, productId: page.url.match(/_p(\d+)\.shtml$/)?.[1],
        }) : readOfficialColorGallery(page.html, device, page.url).colors;
        const color = found.find((item) => item.name === entry.name && item.url === entry.url);
        assert.ok(color, `${entry.name}: 颜色与图片绑定必须可重放`);
        colors.push({ name: entry.name, image: asset({ url: entry.url, alt: `${device.modelName} ${entry.name}` }, device, page, "已核对型号配色图") });
      }
      if (colors.length) {
        const page = await verifiedPage(recorded);
        // 以本批确认的标准版本配色为界；不把典藏/柔光版颜色并入标准版。
        galleries[device.id] = { modelName: device.modelName, sourceUrl: page.url, sourceName: "已核对型号配色图",
          fetchedAt: page.fetchedAt, sourceSnapshotHash: page.sha256,
          colors: mergeColorImages(galleries[device.id]?.colors.filter((color) => colors.some((entry) => entry.name === color.name)), colors) };
      }
    } catch (error) { gaps.push(`${device.id}: ${error.message}`); }
  }
  if (reviewedPrimary) {
    try {
      assert.ok(references.includes(reviewedPrimary.sourceUrl) || source.officialSpecUrl === reviewedPrimary.sourceUrl);
      const page = await snapshot(reviewedPrimary.sourceUrl);
      assert.equal(page.sha256, reviewedPrimary.sourceSnapshotHash);
      images[device.id] = asset(readReviewedProductImage(page.html, device, reviewedPrimary), device, page, `${device.brand} 中国官网`);
    } catch (error) { gaps.push(`${device.id}: ${error.message}`); }
  }
  // 实图核对可补充主图的确定颜色；不能把未查看的候选或特别版颜色计为已补齐。
  if (device.id === "xiaomi-book-pro-15-2017" && references.includes("https://www.mi.com/mibookpro")) {
    try {
      const page = await snapshot("https://www.mi.com/mibookpro");
      const image = readXiaomiPro2017Image(page.html, device, page.url);
      if (image) images[device.id] = asset(image, device, page, "小米中国官网");
    } catch (error) { gaps.push(`${device.id}: ${error.message}`); }
  }
  const recovery = imageRecovery.candidates.find((entry) => entry.deviceId === device.id);
  if (recovery) {
    try {
      assert.equal(recovery.model, device.modelName, "官方外观补证必须是同型号");
      assert.ok(references.includes(recovery.sourceUrl) && recovery.actualImageEvidence.visuallyVerified);
      assert.equal(safeImageUrl(recovery.imageUrl), recovery.imageUrl);
      const rows = [recovery, recovery.imageAnchor, recovery.versionEvidence, ...recovery.resourceChain ?? []];
      let product;
      for (const entry of rows) {
        const page = await getSourceSnapshot(entry.sourceUrl, options);
        assert.equal(page.sha256, entry.sourceSnapshotHash, "官方图片资源链必须可重放");
        if (entry.rawText) assert.ok((entry === recovery.versionEvidence ? plainText(page.html) : page.html)
          .includes(entry.rawText), "官方图片资源锚点缺失");
        if (entry.baseUrl) assert.equal(entry.baseUrl + entry.imagePath, recovery.imageUrl);
        if (entry === recovery) product = page;
      }
      images[device.id] = asset({ url: recovery.imageUrl, imageScope: recovery.imageScope, note: recovery.note,
        usageBoundary: recovery.usageBoundary, alt: `${device.modelName} 同型号外观参考` }, device, product, "小米中国官网");
    } catch (error) { gaps.push(`${device.id}: ${error.message}`); }
  }
  for (const candidate of source.colorImageCandidates ?? []) {
    if (candidate.status !== "downloaded_and_visually_reviewed") continue;
    const knownColors = (source.colorEvidence?.value ?? "").split(/[,，]/).map((name) => name.trim());
    if (!knownColors.includes(candidate.color)) continue;
    let colorImage = images[device.id];
    if (candidate.anchor) {
      try {
        assert.ok(references.includes(candidate.sourceUrl) || source.officialSpecUrl === candidate.sourceUrl);
        const page = await snapshot(candidate.sourceUrl);
        assert.equal(page.sha256, candidate.sourceSnapshotHash);
        colorImage = asset(readReviewedProductImage(page.html, device, candidate), device, page, `${device.brand} 中国官网`);
      } catch (error) { gaps.push(`${device.id}: ${error.message}`); continue; }
    } else if (candidate.url !== colorImage?.url) continue;
    if (!colorImage) continue;
    const gallery = galleries[device.id] ?? { modelName: device.modelName,
      sourceUrl: colorImage.sourceUrl, sourceName: colorImage.sourceName,
      sourceSnapshotHash: colorImage.sourceSnapshotHash, fetchedAt: colorImage.fetchedAt,
      colors: knownColors.map((name) => ({ name })) };
    gallery.colors = gallery.colors.map((color) => color.name === candidate.color
      ? { ...color, image: { ...colorImage, alt: `${device.modelName} ${color.name}` } } : color);
    galleries[device.id] = gallery;
  }
  // 明确拒绝的型号/年份图片不能被通用系列页自动抓取重新写回。
  const rejected = source.rejectedImageCandidate?.url;
  if (rejected) {
    if (images[device.id]?.url === rejected) delete images[device.id];
    if (galleries[device.id]) galleries[device.id].colors = galleries[device.id].colors.map((color) =>
      color.image?.url === rejected ? { name: color.name } : color);
  }
}
// ponytail: 最多三个型号并发；每个型号只取一份包含各配色映射的图片清单。
for (let i = 0; i < sources.length; i += 3) {
  await Promise.all(sources.slice(i, i + 3).map(sync));
  if (i % 30 === 0) console.log(`图片处理进度 ${Math.min(i + 3, sources.length)}/${sources.length}`);
}
for (const id of Object.keys(images)) if (!images[id]) delete images[id];
assert.ok(Object.keys(images).length, "没有可核对型号的产品图，保留现有登记");
const sorted = (records) => Object.fromEntries(Object.entries(records).sort(([a], [b]) => a.localeCompare(b)));
await fs.writeFile("src/data/device-images.json", `${JSON.stringify(sorted(images), null, 2)}\n`);
await fs.writeFile("src/data/device-image-galleries.json", `${JSON.stringify(sorted(galleries), null, 2)}\n`);
console.log(JSON.stringify({ devicesWithImages: Object.keys(images).length, galleries: Object.keys(galleries).length,
  colors: Object.values(galleries).reduce((n, gallery) => n + gallery.colors.length, 0),
  colorsWithImages: Object.values(galleries).reduce((n, gallery) => n + gallery.colors.filter((color) => color.image).length, 0),
  completeGalleries: Object.values(galleries).filter((gallery) => gallery.colors.every((color) => color.image)).length,
  sourceGaps: gaps.length }));
if (gaps.length) console.log(`未补证页面：${gaps.slice(0, 8).join("；")}（其余省略；缺图不以其他颜色替代）`);
