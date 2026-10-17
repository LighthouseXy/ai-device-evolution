import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getSourceSnapshot } from "./lib/source-snapshot.mjs";
import { readReviewedZolColorImages, readReviewedSamsungWatchColors, readReviewedAppleColorImages } from "./lib/device-images.mjs";
import { verifyCameraScore } from "./lib/dxomark-snapshot.mjs";
import { extractZolProductImage, importZolSeries, readRelease, readSingleCapacity, readStorageCapacity, readZolOptionalSpecs, zolRows } from "./lib/zol-device.mjs";
import { readOfficialAndroidSpecs, readOfficialCameraSpecs, readOppoShopData } from "./lib/android-official-specs.mjs";
import { plainText, assertZolModel, readZolCameraSpecs } from "./lib/zol-device.mjs";
import { readSamsungCameraSpecs } from "./lib/android-official-specs.mjs";
import { mergeColorImages, readAppleColorImages, readAppleIdentificationImage, readAppleSupportColorImages, readOfficialColorGallery, readPconlineProductImage, readReviewedCssColorImages, readReviewedOppoColorImages, readReviewedSamsungPanelColors, readReviewedProductImage, readShihuoColorImages, readXiaomiPro2017Image, readZolColorImages, readZolGalleryImage, readZolColors, safeImageUrl } from "./lib/device-images.mjs";

const catalog = JSON.parse(await fs.readFile("src/data/device-images.json", "utf8"));
const database = JSON.parse(await fs.readFile("src/data/devices-db.json", "utf8"));
const rejectedGalleries = JSON.parse(await fs.readFile("src/data/device-image-galleries.json", "utf8"));
for (const id of ["xiaomi-11-lite-2021", "xiaomi-mix-2-2017", "redmi-pad-se-2023"]) {
  const source = JSON.parse(await fs.readFile("src/data/device-sources.json", "utf8")).devices.find(row => row.id === id);
  const candidate = source.colorImageCandidates.find(row => row.xiaomiLegacyNativeImage || row.imageRendition === "suning_large");
  const device = database.devices.find(row => row.id === id);
  const page = await getSourceSnapshot(candidate.sourceUrl, { offline: true });
  assert.equal(page.sha256, candidate.sourceSnapshotHash);
  assert.equal(readReviewedProductImage(page.html, device, candidate).url, candidate.url);
  assert.equal(rejectedGalleries[id].colors.find(row => row.name === candidate.color)?.image?.url, candidate.url);
  for (const key of ["color", "url", "sourceUrl", "viewScope"]) assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, [key]: "wrong" }));
  assert.throws(() => readReviewedProductImage(page.html, { ...device, releaseYear: device.releaseYear - 1 }, candidate));
  assert.throws(() => readReviewedProductImage(page.html, { ...device, modelName: device.modelName + " Pro" }, candidate));
  assert.throws(() => readReviewedProductImage(page.html.replaceAll(candidate.anchor, ""), device, candidate));
  if (candidate.parameterAnchor) {
    assert.throws(() => readReviewedProductImage(page.html.replace(candidate.parameterAnchor, ""), device, candidate));
    assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, parameterAnchor: candidate.parameterAnchor.replace("780G", "778G") }));
  }
  if (candidate.resourceChain) {
    for (const resource of candidate.resourceChain) {
      const linked = await getSourceSnapshot(resource.sourceUrl, { offline: true });
      assert.equal(linked.sha256, resource.sourceSnapshotHash);
      for (const anchor of resource.anchors) assert.ok(linked.html.includes(anchor));
    }
    assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, resourceChain: [] }));
    assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, resourceChain: candidate.resourceChain.map(resource => ({ ...resource, anchors: resource.anchors.map(anchor => anchor.replace(".pic-b", ".pic-pb")) })) }));
  }
}
const reviewedPrimaryText = await fs.readFile("scripts/fixtures/reviewed-primary-images.json", "utf8");
const primaryIds = [...reviewedPrimaryText.matchAll(/^  "([^"]+)": \{/gm)].map(match => match[1]);
assert.equal(new Set(primaryIds).size, primaryIds.length, "图片审核记录不能有重复型号键，否则排除规则会被覆盖");
const reviewedPrimaries = JSON.parse(reviewedPrimaryText);
for (const [id, candidate] of Object.entries(reviewedPrimaries)) {
  if (!candidate.appleIdentificationBinding && !candidate.appleIpadIdentificationBinding) continue;
  const device = database.devices.find(row => row.id === id);
  const page = await getSourceSnapshot(candidate.sourceUrl, { offline: true });
  assert.equal(page.sha256, candidate.sourceSnapshotHash);
  for (const resource of candidate.resourceChain ?? []) {
    const linked = await getSourceSnapshot(resource.sourceUrl, { offline: true });
    assert.equal(linked.sha256, resource.sourceSnapshotHash);
    for (const anchor of resource.anchors) assert.ok(linked.html.includes(anchor));
  }
  assert.equal(readReviewedProductImage(page.html, device, candidate).url, candidate.url);
  assert.equal(catalog[id].url, candidate.url);
  assert.throws(() => readReviewedProductImage(page.html, { ...device, releaseYear: device.releaseYear - 1 }, candidate));
  assert.throws(() => readReviewedProductImage(page.html, { ...device, modelName: device.modelName + " Max" }, candidate));
  assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, url: candidate.url + "?other=1" }));
  assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, colorScope: "single_color" }));
  assert.throws(() => readReviewedProductImage(page.html.replaceAll(candidate.anchor, ""), device, candidate));
  if (candidate.appleIpadIdentificationBinding) {
    assert.throws(() => readReviewedProductImage(page.html.replaceAll(candidate.modelAnchor, ""), device, candidate));
    assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, modelAnchor: '<h2 class="gb-header">iPad（第 6 代）</h2>' }));
    assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, color: "银色" }));
    if (device.id === "ipad-pro-12-9-m1-2021") assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, resourceChain: [] }));
  }
}
const reviewedColorText = await fs.readFile("scripts/fixtures/reviewed-color-views.json", "utf8");
const colorIds = [...reviewedColorText.matchAll(/^  "([^"]+)": \{/gm)].map(match => match[1]);
assert.equal(new Set(colorIds).size, colorIds.length, "配色审核记录不能有重复型号键，否则已核验图片会被静默覆盖");
const reviewedColorViews = JSON.parse(reviewedColorText);
{
  const review = reviewedColorViews["xiaomi-pad-3-2017"], page = await getSourceSnapshot(review.sourceUrl, { offline: true }), css = await getSourceSnapshot(review.cssUrl, { offline: true });
  assert.equal(page.sha256, review.sourceSnapshotHash);
  assert.equal(css.sha256, review.cssSnapshotHash);
  assert.equal(readReviewedCssColorImages(page.html, css.html, review)[0].url, review.colors["金色"]);
  assert.equal(rejectedGalleries["xiaomi-pad-3-2017"].colors.find(color => color.name === "金色")?.image?.url, review.colors["金色"]);
  assert.throws(() => readReviewedCssColorImages(page.html, css.html, { ...review, modelName: "小米平板2" }));
  for (const key of ["color", "sourceColorName", "selector", "htmlAnchor", "anchor"]) {
    assert.throws(() => readReviewedCssColorImages(page.html, css.html, { ...review, bindings: review.bindings.map(binding => ({ ...binding, [key]: "wrong" })) }));
  }
}
{
  const review = reviewedColorViews["oppo-find-n2-2022"], device = database.devices.find(row => row.id === "oppo-find-n2-2022");
  const page = await getSourceSnapshot(review.sourceUrl, { offline: true });
  assert.equal(page.sha256, review.sourceSnapshotHash);
  assert.equal(readOfficialColorGallery(page.html, device, review.sourceUrl).colors.find(color => color.name === "素黑")?.url, review.colors["素黑"]);
  assert.equal(rejectedGalleries[device.id].colors.find(color => color.name === "素黑")?.image?.url, review.colors["素黑"]);
  assert.throws(() => readOfficialColorGallery(page.html, { ...device, modelName: "OPPO Find N2 Flip" }, review.sourceUrl));
  assert.throws(() => readOfficialColorGallery(page.html, device, review.sourceUrl.replace("9414.html", "9415.html")));
}
{
  const review = reviewedColorViews["xiaomi-15-pro-2024"];
  assert.equal(review.colors["云杉绿"], "https://2c.zol-img.com.cn/product/270/854/ce1a2LNUG5qF2.png");
  assert.equal(review.colors["云衫绿"], undefined);
  assert.ok(!rejectedGalleries["xiaomi-15-pro-2024"].colors.some(color => color.name === "云衫绿"));
  assert.equal(rejectedGalleries["xiaomi-15-pro-2024"].colors.find(color => color.name === "云杉绿")?.image?.url, review.colors["云杉绿"]);
  const resource = review.resourceChain[0], official = await getSourceSnapshot(resource.sourceUrl, { offline: true });
  assert.equal(official.sha256, resource.sourceSnapshotHash);
  for (const anchor of resource.anchors) assert.ok(official.html.includes(anchor) && anchor.includes("云杉绿"));
  const page = await getSourceSnapshot(review.sourceUrl, { offline: true });
  assert.equal(readReviewedZolColorImages(page.html, review).find(color => color.name === "云杉绿").url, review.colors["云杉绿"]);
}
{
  const sources = JSON.parse(await fs.readFile("src/data/device-sources.json", "utf8")).devices;
  const candidates = sources.flatMap(source => (source.colorImageCandidates ?? []).filter(row => row.huaweiSuningSkuBinding).map(candidate => ({ id: source.id, candidate })));
  candidates.push({ id: "huawei-pura-80-pro-plus-2025", candidate: reviewedPrimaries["huawei-pura-80-pro-plus-2025"] });
  assert.equal(candidates.length, 9);
  for (const { id, candidate } of candidates) {
    const device = database.devices.find(row => row.id === id), page = await getSourceSnapshot(candidate.sourceUrl, { offline: true });
    assert.equal(page.sha256, candidate.sourceSnapshotHash);
    for (const resource of candidate.resourceChain ?? []) {
      const linked = await getSourceSnapshot(resource.sourceUrl, { offline: true });
      assert.equal(linked.sha256, resource.sourceSnapshotHash);
      for (const anchor of resource.anchors) assert.ok(linked.html.includes(anchor));
    }
    assert.equal(readReviewedProductImage(page.html, device, candidate).url, candidate.url);
    assert.equal(candidate.color ? rejectedGalleries[id].colors.find(row => row.name === candidate.color)?.image?.url : catalog[id].url, candidate.url);
    for (const key of ["color", "url", "sourceUrl"]) assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, [key]: "wrong" }));
    for (const key of ["sku", "sourceColor", "skuAnchor"]) assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, huaweiSuningSkuBinding: { ...candidate.huaweiSuningSkuBinding, [key]: "wrong" } }));
    for (const anchor of [candidate.anchor, candidate.modelAnchor, candidate.huaweiSuningSkuBinding.skuAnchor]) assert.throws(() => readReviewedProductImage(page.html.replaceAll(anchor, ""), device, candidate));
    assert.throws(() => readReviewedProductImage(page.html, { ...device, modelName: "HUAWEI Pura 80 Pro", releaseYear: 2024 }, candidate));
    if (id === "huawei-matepad-pro-11-2024") {
      assert.throws(() => readReviewedProductImage(page.html, { ...device, releaseYear: 2024 }, candidate), "2024款实际于2023年上市，不能改写发布时间");
      assert.throws(() => readReviewedProductImage(page.html, { ...device, variant: "soft-light" }, candidate));
      assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, anchor: candidate.anchor.replace("11英寸", "12.6英寸") }));
    }
    if (!candidate.color) {
      assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, resourceChain: [] }));
      assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, caseColors: ["釉青"] }));
    }
  }
}
for (const id of ["xiaomi-11-lite-2021", "xiaomi-mi-11-ultra-2021", "redmi-10x-5g-2020"]) {
  const source = JSON.parse(await fs.readFile("src/data/device-sources.json", "utf8")).devices.find(row => row.id === id);
  const device = database.devices.find(row => row.id === id);
  const candidate = source.colorImageCandidates.find(row => row.zolProductId);
  const page = await getSourceSnapshot(candidate.sourceUrl, { offline: true });
  assert.equal(page.sha256, candidate.sourceSnapshotHash);
  assert.equal(readReviewedProductImage(page.html, device, candidate).url, candidate.url);
  assert.equal(rejectedGalleries[id].colors.find(row => row.name === candidate.color)?.image?.url, candidate.url);
  for (const key of ["color", "url", "zolProductId", "zolPicId", "zolHash"]) assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, [key]: String(candidate[key]) + "-other" }));
  assert.throws(() => readReviewedProductImage(page.html, { ...device, id: id + "-other" }, candidate));
  assert.throws(() => readReviewedProductImage(page.html.replaceAll(candidate.anchor, ""), device, candidate));
}
{
  const source = JSON.parse(await fs.readFile("src/data/xiaomi-history-sources.json", "utf8")).phone.find(row => row.id === "xiaomi-10s-2021");
  const device = database.devices.find(row => row.id === source.id);
  const candidate = source.colorImageCandidates.find(row => row.imageRendition === "suning_large");
  const page = await getSourceSnapshot(candidate.sourceUrl, { offline: true });
  assert.equal(page.sha256, candidate.sourceSnapshotHash);
  assert.equal(readReviewedProductImage(page.html, device, candidate).url, candidate.url);
  assert.equal(rejectedGalleries[source.id].colors.find(row => row.name === candidate.color)?.image?.url, candidate.url);
  for (const key of ["color", "url", "sourceUrl", "viewScope"]) assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, [key]: "wrong" }));
  assert.throws(() => readReviewedProductImage(page.html, { ...device, modelName: "小米10" }, candidate));
  assert.throws(() => readReviewedProductImage(page.html, { ...device, releaseYear: 2020 }, candidate));
  assert.throws(() => readReviewedProductImage(page.html.replaceAll(candidate.modelAnchor, ""), device, candidate));
}
{
  const source = Object.values(JSON.parse(await fs.readFile("src/data/apple-sources.json", "utf8"))).flat().find(row => row?.id === "iphone-12-mini");
  const device = database.devices.find(row => row.id === source.id);
  for (const candidate of source.colorImageCandidates.filter(row => row.appleMiniRetailBinding)) {
    const page = await getSourceSnapshot(candidate.sourceUrl, { offline: true });
    assert.equal(page.sha256, candidate.sourceSnapshotHash);
    assert.equal(readReviewedProductImage(page.html, device, candidate).url, candidate.url);
    assert.equal(rejectedGalleries[source.id].colors.find(row => row.name === candidate.color)?.image?.url, candidate.url);
    for (const key of ["color", "url", "sourceUrl", "viewScope"]) assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, [key]: "wrong" }));
    assert.throws(() => readReviewedProductImage(page.html, { ...device, id: "iphone-12", modelName: "iPhone 12" }, candidate));
    assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, parameterAnchors: [] }));
    for (const anchor of [candidate.anchor, candidate.modelAnchor, ...candidate.parameterAnchors]) assert.throws(() => readReviewedProductImage(page.html.replaceAll(anchor, ""), device, candidate));
  }
}
{
  const sources = Object.values(JSON.parse(await fs.readFile("src/data/samsung-sources.json", "utf8"))).flat();
  const candidates = sources.flatMap(source => (source?.colorImageCandidates ?? []).filter(c => c.samsungBuyingOptionBinding).map(candidate => ({ source, candidate })));
  assert.equal(candidates.length, 25, "本轮官网购买选项颜色必须完整登记");
  for (const { source, candidate } of candidates) {
    const device = database.devices.find(row => row.id === source.id);
    const page = await getSourceSnapshot(candidate.sourceUrl, { offline: true });
    assert.equal(page.sha256, candidate.sourceSnapshotHash);
    assert.equal(readReviewedProductImage(page.html, device, candidate).url, candidate.url);
    assert.equal(rejectedGalleries[source.id].colors.find(row => row.name === candidate.color)?.image?.url, candidate.url);
    for (const key of ["color", "url", "sourceUrl", "viewScope"]) assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, [key]: "wrong" }));
    assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, samsungBuyingOptionBinding: { modelCode: "SM-S9360" } }));
    assert.throws(() => readReviewedProductImage(page.html, { ...device, modelName: device.modelName + " Ultra" }, candidate));
    assert.throws(() => readReviewedProductImage(page.html.replaceAll(candidate.anchor, ""), device, candidate));
    assert.throws(() => readReviewedProductImage(page.html, { ...device, releaseYear: device.releaseYear - 1 }, candidate));
  }
}
for (const file of ["honor-five-year-batch3-sources.json", "honor-five-year-batch4-sources.json", "honor-five-year-batch5-sources.json", "honor-five-year-batch6-sources.json", "honor-sources.json"]) {
  const sources = Object.values(JSON.parse(await fs.readFile(`src/data/${file}`, "utf8"))).flat();
  for (const source of sources) for (const candidate of source?.colorImageCandidates ?? []) {
    if (!candidate.honorShopSkuBinding) continue;
    const device = database.devices.find(row => row.id === source.id);
    const page = await getSourceSnapshot(candidate.sourceUrl, { offline: true });
    assert.equal(page.sha256, candidate.sourceSnapshotHash);
    for (const resource of candidate.resourceChain) {
      const linked = await getSourceSnapshot(resource.sourceUrl, { offline: true });
      assert.equal(linked.sha256, resource.sourceSnapshotHash);
      for (const anchor of resource.anchors) assert.ok(linked.html.includes(anchor));
    }
    assert.equal(readReviewedProductImage(page.html, device, candidate).url, candidate.url);
    assert.equal(rejectedGalleries[source.id].colors.find(row => row.name === candidate.color)?.image?.url, candidate.url);
    for (const key of ["color", "url", "sourceUrl", "viewScope"]) assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, [key]: "wrong" }));
    for (const key of ["sbomCode", "name", "photoName", "photoPath", "scriptAnchor", "mediaPathAnchor"]) {
      assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, honorShopSkuBinding: { ...candidate.honorShopSkuBinding, [key]: "wrong" } }));
    }
    if (device.category === "tablet") {
      assert.throws(() => readReviewedProductImage(page.html, { ...device, variant: "soft-light" }, candidate));
      assert.throws(() => readReviewedProductImage(page.html, { ...device, modelName: device.modelName + " Pro" }, candidate));
      const wrongSize = candidate.anchor.replace(/(12\.3|11\.5|12)&#x82f1;/, "99&#x82f1;");
      assert.notEqual(wrongSize, candidate.anchor);
      assert.throws(() => readReviewedProductImage(page.html.replace(candidate.anchor, wrongSize), device, { ...candidate, anchor: wrongSize, honorShopSkuBinding: { ...candidate.honorShopSkuBinding, name: candidate.honorShopSkuBinding.name.replace(/(12\.3|11\.5|12)英寸/, "99英寸") } }));
    }
    assert.throws(() => readReviewedProductImage(page.html, { ...device, modelName: device.modelName + " Plus" }, candidate));
    assert.throws(() => readReviewedProductImage(page.html, { ...device, releaseYear: device.releaseYear - 1 }, candidate));
    assert.throws(() => readReviewedProductImage(page.html.replaceAll(candidate.anchor, ""), device, candidate));
    assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, resourceChain: [] }));
    assert.equal(safeImageUrl(candidate.url.replace("800_800", "428_428")), null);
  }
}
{
  const source = JSON.parse(await fs.readFile("src/data/samsung-batch2-sources.json", "utf8")).phone.find(row => row.id === "samsung-galaxy-a53-2022");
  const device = database.devices.find(row => row.id === source.id);
  const candidate = source.colorImageCandidates.find(row => row.samsungA53FeatureBinding);
  const page = await getSourceSnapshot(candidate.sourceUrl, { offline: true });
  assert.equal(page.sha256, candidate.sourceSnapshotHash);
  assert.equal(readReviewedProductImage(page.html, device, candidate).url, candidate.url);
  assert.equal(rejectedGalleries[source.id].colors.find(row => row.name === candidate.color)?.image?.url, candidate.url);
  for (const key of ["color", "sourceUrl", "viewScope"]) assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, [key]: "wrong" }));
  for (const anchor of [candidate.anchor, candidate.modelAnchor, candidate.colorAnchor]) assert.throws(() => readReviewedProductImage(page.html.replace(anchor, ""), device, candidate));
  assert.throws(() => readReviewedProductImage(page.html, { ...device, modelName: "Samsung Galaxy A52" }, candidate));
  assert.equal(safeImageUrl(candidate.url + "&other=1"), null);
  assert.equal(safeImageUrl(candidate.url.replace("531589642", "531589645")), null);
}
for (const [file, id] of [["oppo-five-year-batch3-sources.json", "oppo-k9x-2022"], ["oppo-five-year-batch2-sources.json", "oppo-reno11-pro-2023"], ["vivo-five-year-sources.json", "vivo-s18-2023"]]) {
  const source = JSON.parse(await fs.readFile(`src/data/${file}`, "utf8")).phone.find(row => row.id === id);
  const device = database.devices.find(row => row.id === id);
  for (const candidate of source.colorImageCandidates.filter(row => row.zolProductId)) {
    const page = await getSourceSnapshot(candidate.sourceUrl, { offline: true });
    assert.equal(page.sha256, candidate.sourceSnapshotHash);
    assert.equal(readReviewedProductImage(page.html, device, candidate).url, candidate.url);
    assert.equal(rejectedGalleries[id].colors.find(row => row.name === candidate.color)?.image?.viewScope, "front_back");
    assert.throws(() => readReviewedProductImage(page.html, { ...device, id: id + "-other" }, candidate));
    assert.throws(() => readReviewedProductImage(page.html.replace(candidate.anchor, ""), device, candidate));
    for (const key of ["color", "url", "zolProductId", "zolPicId", "zolHash"]) {
      assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, [key]: String(candidate[key]) + "-other" }));
    }
  }
}
for (const [file, id] of [["xiaomi-history-batch5-sources.json", "xiaomi-9-transparent-2019"], ["xiaomi-history-batch2-sources.json", "xiaomi-8-screen-fingerprint-2018"], ["xiaomi-history-sources.json", "xiaomi-6-2017"]]) {
  const source = JSON.parse(await fs.readFile(`src/data/${file}`, "utf8")).phone.find(source => source.id === id);
  const candidate = source.colorImageCandidates.find(candidate => candidate.xiaomiLegacyNativeImage);
  const device = database.devices.find(device => device.id === id);
  const page = await getSourceSnapshot(candidate.sourceUrl, { offline: true });
  assert.equal(page.sha256, candidate.sourceSnapshotHash);
  assert.equal(readReviewedProductImage(page.html, device, candidate).url, candidate.url);
  assert.equal(rejectedGalleries[id].colors.find(color => color.name === candidate.color)?.image?.url, candidate.url);
  assert.throws(() => readReviewedProductImage(page.html, { ...device, releaseYear: device.releaseYear + 1 }, candidate));
  assert.throws(() => readReviewedProductImage(page.html, { ...device, modelName: device.modelName + " Pro" }, candidate));
  assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, color: "其他颜色" }));
  assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, sourceUrl: candidate.sourceUrl + "wrong" }));
  assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, url: candidate.url + "?other=1" }));
  assert.equal(safeImageUrl(candidate.url + "?other=1"), null);
  assert.throws(() => readReviewedProductImage(page.html.replace(candidate.anchor, ""), device, candidate));
  if (id === "xiaomi-8-screen-fingerprint-2018") assert.throws(() => readReviewedProductImage(page.html.replace('<span>暮光金</span>', '<span>曜石黑</span>'), device, candidate));
  if (id === "xiaomi-6-2017") {
    const resource = candidate.resourceChain[0], css = await getSourceSnapshot(resource.sourceUrl, { offline: true });
    assert.equal(css.sha256, resource.sourceSnapshotHash);
    for (const anchor of resource.anchors) assert.ok(css.html.includes(anchor));
    assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, resourceChain: [] }));
    assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, resourceChain: [{ ...resource, anchors: [resource.anchors[0].replace("item02", "item03")] }] }));
    assert.throws(() => readReviewedProductImage(page.html.replaceAll("亮蓝", "亮白"), device, { ...candidate, anchor: candidate.anchor.replaceAll("亮蓝", "亮白") }));
  }
}
for (const id of ["iphone-18-pro", "iphone-18-pro-max"]) {
  const expected = ["黑色", "银色", "冰川蓝色", "勃艮第酒红色"];
  const device = database.devices.find(device => device.id === id);
  assert.deepEqual(device.specs.colors.value, expected, "官网单段列出的四种颜色不能变成第五个连写选项");
  const source = Object.values(JSON.parse(await fs.readFile("src/data/apple-sources.json", "utf8"))).flat().find(row => row?.id === id);
  const review = source.colorNameReconciliation, page = await getSourceSnapshot(review.sourceUrl, { offline: true });
  assert.equal(page.sha256, review.sourceSnapshotHash);
  assert.ok(plainText(page.html).includes(review.rawText));
  assert.deepEqual(review.canonicalNames, expected);
  assert.ok(rejectedGalleries[id].colors.every(color => !color.name.includes("、")));
  assert.ok(expected.every(name => rejectedGalleries[id].colors.some(color => color.name === name)), "拆分不能丢失已有具名配色");
}
for (const id of ["xiaomi-8-se-2018", "xiaomi-note-3-2017"]) {
  const review = reviewedColorViews[id];
  const names = rejectedGalleries[id].colors.map(color => color.name);
  assert.ok(review.rejectedColorNames.every(name => !names.includes(name)), "旧颜色别名不能与官方同色重复显示");
  assert.ok(review.colorNameReconciliation.canonicalNames.every(name => names.includes(name)), "删除别名不能删除官方具名配色");
}
const p60Source = JSON.parse(await fs.readFile("src/data/huawei-expansion-sources.json", "utf8")).phone.find(row => row.id === "huawei-p60-2023");
const p60Colors = p60Source.colorNameReconciliation;
for (const evidence of [p60Colors, p60Colors.excludedVersion]) {
  const page = await getSourceSnapshot(evidence.sourceUrl, { offline: true });
  assert.equal(page.sha256, evidence.sourceSnapshotHash);
  assert.ok(plainText(page.html).includes(evidence.rawText));
}
assert.deepEqual(p60Colors.canonicalNames, ["洛可可白", "翡冷翠", "羽砂紫", "羽砂黑"]);
assert.deepEqual(p60Colors.excludedVersion.colors, ["流沙金", "蔚蓝海"]);
assert.deepEqual(rejectedGalleries[p60Source.id].colors.map(color => color.name).sort(), p60Colors.canonicalNames.toSorted(), "Art 专属配色不能混入 P60，不能删除 P60 的正确配色");
assert.ok(rejectedGalleries[p60Source.id].colors.every(color => color.image?.viewScope === "front_back"), "清理错误版型必须保留四种已有合格原图");
for (const file of ["huawei-five-year-batch2-sources.json", "huawei-five-year-sources.json", "vivo-five-year-batch2-sources.json"]) {
  const sources = JSON.parse(await fs.readFile(`src/data/${file}`, "utf8")).phone;
  for (const source of sources.filter(source => ["huawei-pura-x-max-2026", "huawei-enjoy-70s-2024", "huawei-nova-10-lite-2023", "iqoo-neo7-2022"].includes(source.id))) {
    for (const candidate of (source.colorImageCandidates ?? []).filter(candidate => candidate.viewScope === "front_back")) {
      const page = await getSourceSnapshot(candidate.sourceUrl, { offline: true });
      assert.equal(page.sha256, candidate.sourceSnapshotHash);
      assert.equal(readReviewedProductImage(page.html, { id: source.id }, candidate).url, candidate.url);
      assert.throws(() => readReviewedProductImage(page.html, { id: source.id }, { ...candidate, color: "错误配色" }));
      assert.throws(() => readReviewedProductImage(page.html, { id: source.id }, { ...candidate, url: candidate.url + "?other" }));
      assert.throws(() => readReviewedProductImage(page.html, { id: source.id + "-other" }, candidate));
    }
  }
}
const samsungA11Collection = reviewedPrimaries["samsung-galaxy-tab-a11-plus-2026"];
assert.equal(safeImageUrl(samsungA11Collection.url), samsungA11Collection.url);
assert.equal(safeImageUrl(samsungA11Collection.url + "&other=1"), null, "仅允许原页已核验的原始海报格式，不任意添加参数");
assert.equal(safeImageUrl(samsungA11Collection.url.replace("550586235", "550586234")), null, "不能把其他资源当作已审核合集");
for (const [id, candidate] of Object.entries(reviewedPrimaries)) {
  for (const name of candidate.rejectedColorNames ?? []) {
    assert.ok(!rejectedGalleries[id]?.colors.some(color => color.name === name), "已核对的错误配色名称不得重复生成颜色选项");
  }
  for (const rejected of candidate.rejectedColorImages ?? []) {
    assert.notEqual(rejectedGalleries[id]?.colors.find(color => color.name === rejected.color)?.image?.url, rejected.url,
      "多配色集合图不能冒充单一配色的细节图");
  }
  for (const url of candidate.rejectedImageUrls ?? []) {
    assert.notEqual(catalog[id]?.url, url, "已排除的错误图片不能重新作为默认图");
    assert.ok(!rejectedGalleries[id]?.colors.some(color => color.image?.url === url), "错误配色图片不能被同步重新写回");
  }
  if (candidate.status === "rejected_invalid_image") continue;
  if (candidate.status === "rejected_stage_photo") {
    assert.notEqual(catalog[id]?.url, candidate.url, "现场翻拍图不得重新用作默认图");
    continue;
  }
  const page = await getSourceSnapshot(candidate.sourceUrl, { offline: true });
  assert.equal(page.sha256, candidate.sourceSnapshotHash);
  const cssPage = candidate.cssUrl && await getSourceSnapshot(candidate.cssUrl, { offline: true });
  if (cssPage) assert.equal(cssPage.sha256, candidate.cssSnapshotHash);
  assert.equal(readReviewedProductImage(page.html, database.devices.find(device => device.id === id), candidate, cssPage?.html).url, catalog[id].url);
  if (candidate.finishAnchor) assert.throws(() => readReviewedProductImage(page.html,
    database.devices.find(device => device.id === id), { ...candidate, finishAnchor: candidate.finishAnchor + " altered" }, cssPage?.html), /完整配色原文/);
  if (candidate.appleRefurbishedImage && candidate.colorScope === "all_colors") {
    const model = { id, modelName: catalog[id].modelName };
    assert.throws(() => readReviewedProductImage(page.html, model, { ...candidate, caseColors: ["蓝色"] }));
    assert.throws(() => readReviewedProductImage(page.html, model, { ...candidate,
      appleRefurbishedImage: { ...candidate.appleRefurbishedImage, sourceColor: "Purple" } }), /配色/);
    assert.throws(() => readReviewedProductImage(page.html, model, { ...candidate, url: candidate.url + "?other" }), /资源/);
  }
  if (candidate.appleTechSpecsCollection) {
    const model = database.devices.find(device => device.id === id);
    assert.throws(() => readReviewedProductImage(page.html, { ...model, releaseYear: 2025 }, candidate), /尺寸或芯片/);
    assert.throws(() => readReviewedProductImage(page.html, { ...model, modelName: "错误尺寸" }, candidate), /尺寸或芯片/);
    assert.throws(() => readReviewedProductImage(page.html, { ...model, specs: { ...model.specs, chip: { value: "Apple M4 芯片" } } }, candidate), /尺寸或芯片/);
    assert.throws(() => readReviewedProductImage(page.html, model, { ...candidate, caseColors: ["银色"] }), /deep-equal/);
    assert.throws(() => readReviewedProductImage(page.html, model, { ...candidate, sourceUrl: candidate.sourceUrl + "wrong" }));
    assert.throws(() => readReviewedProductImage(page.html, model, { ...candidate, url: candidate.url + "?other" }), /资源/);
    assert.equal(safeImageUrl(candidate.url + "?other"), null);
  }
  if (candidate.oppoFlipCollection) {
    const device = database.devices.find(row => row.id === id);
    assert.throws(() => readReviewedProductImage(page.html, { ...device, releaseYear: 2023 }, candidate));
    assert.throws(() => readReviewedProductImage(page.html, { ...device, modelName: "OPPO Find N2" }, candidate));
    assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, caseColors: ["慕紫", "流金"] }));
    assert.throws(() => readReviewedProductImage(page.html.replaceAll('data-gtm-label="流金"', 'data-gtm-label="其他"'), device, candidate));
    assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, url: candidate.replacedImageEvidence.url }));
  }
  if (candidate.appleMacSelectionCollection || candidate.vivoLaunchCollection) {
    const model = database.devices.find(device => device.id === id);
    assert.throws(() => readReviewedProductImage(page.html, { ...model, releaseYear: model.releaseYear - 1 }, candidate), /年份/);
    assert.throws(() => readReviewedProductImage(page.html, { ...model, modelName: "错误型号" }, candidate), /型号|尺寸/);
    assert.throws(() => readReviewedProductImage(page.html, model, { ...candidate, caseColors: ["银色"] }));
    assert.throws(() => readReviewedProductImage(page.html, model, { ...candidate, url: candidate.url + "?other" }), /资源/);
    if (candidate.appleMacSelectionCollection) {
      assert.throws(() => readReviewedProductImage(page.html, { ...model, specs: { ...model.specs, chip: { value: "Apple M4 芯片" } } }, candidate), /芯片/);
      assert.throws(() => readReviewedProductImage(page.html, model, { ...candidate, sourceUrl: candidate.sourceUrl.replace("-m5-", "-m4-") }), /SKU/);
    } else {
      assert.throws(() => readReviewedProductImage(page.html, { ...model, id: "vivo-x100-lpddr5t-limited-2023" }, candidate));
      assert.equal(safeImageUrl(candidate.url + "?other"), null);
    }
  }
  assert.equal(catalog[id].sourceName, candidate.sourceName, "国内报道图片不能冒充品牌官网");
  assert.equal(catalog[id].licenseStatus, "unknown");
  if (candidate.imageAttribute === "href") {
    const model = { id, modelName: catalog[id].modelName };
    assert.throws(() => readReviewedProductImage(page.html, { ...model, id: "wrong" }, candidate));
    assert.throws(() => readReviewedProductImage(page.html, model, { ...candidate, sourceUrl: "https://news.mydrivers.com/1/770/770742.htm" }));
    assert.throws(() => readReviewedProductImage(page.html, model, { ...candidate, modelAnchor: "wrong" }));
    assert.throws(() => readReviewedProductImage(page.html, model, { ...candidate, url: candidate.url + "?other" }));
  }
  assert.notEqual(catalog[id].url, "https://img.ithome.com/images/v2/t.png", "懒加载占位图不能当产品图");
}
const colorViews = JSON.parse(await fs.readFile("scripts/fixtures/reviewed-color-views.json", "utf8"));
const imageGalleries = JSON.parse(await fs.readFile("src/data/device-image-galleries.json", "utf8"));
const imageSources = JSON.parse(await fs.readFile("src/data/device-sources.json", "utf8"));
const magic5 = database.devices.find(device => device.id === "honor-magic5-2023");
for (const candidate of imageSources.devices.find(source => source.id === magic5.id).colorImageCandidates.filter(row => row.henanMobileColorBinding)) {
  const page = await getSourceSnapshot(candidate.sourceUrl, { offline: true });
  assert.equal(page.sha256, candidate.sourceSnapshotHash);
  assert.equal(readReviewedProductImage(page.html, magic5, candidate).url, candidate.url);
  assert.equal(imageGalleries[magic5.id].colors.find(color => color.name === candidate.color).image.url, candidate.url);
  assert.throws(() => readReviewedProductImage(page.html, { ...magic5, modelName: "荣耀 Magic5 Pro" }, candidate));
  assert.throws(() => readReviewedProductImage(page.html, { ...magic5, releaseYear: 2024 }, candidate));
  assert.throws(() => readReviewedProductImage(page.html, magic5, { ...candidate, color: "亮黑色" }));
  assert.throws(() => readReviewedProductImage(page.html, magic5, { ...candidate, url: candidate.url + "?other=1" }));
  assert.throws(() => readReviewedProductImage(page.html.replace('skuIds="67166"', 'skuIds="0"').replace('skuIds="67168"', 'skuIds="0"'), magic5, candidate));
  assert.throws(() => readReviewedProductImage(page.html.replace("<title>荣耀Magic5 12+256G</title>", "<title>荣耀Magic5 Pro 12+256G</title>"), magic5, candidate));
  assert.equal(safeImageUrl(candidate.url + "?other=1"), null);
  assert.equal(safeImageUrl(candidate.url.replace("www.ha.10086.cn", "evil.example")), null);
}
const expectedReviewedColor = (source, color, review) => {
  let rows = review?.colors[color] ? [{ name: color, image: { url: review.colors[color], sourceUrl: review.sourceUrl, sourceName: review.sourceName ?? "中关村在线", viewScope: "front_back" } }] : [];
  for (const candidate of source.colorImageCandidates ?? []) {
    if (candidate.color === color && candidate.status === "downloaded_and_visually_reviewed" && candidate.anchor)
      rows = mergeColorImages(rows, [{ name: color, image: candidate }]);
  }
  return rows[0]?.image;
};
const nova10zColors = imageGalleries["huawei-nova-10z-2022"].colors;
assert.ok(!nova10zColors.some(color => color.name === "翡翠冷"), "第三方错字配色不能与已核验同色重复生成");
assert.equal(nova10zColors.find(color => color.name === "翡冷翠")?.image?.viewScope, "front_back");
const magic7WhiteUrl = "https://doc-fd.zol-img.com.cn/t_s2000x2000/g7/M00/06/08/ChMkK2fcot6If6DsAAEqWvfmuEcAAqPWADIJukAASpy940.jpg";
for (const id of ["xiaomi-cc9e-2019", "redmi-k60-ultra-2023"]) {
  const url = catalog[id].url;
  assert.equal(safeImageUrl(url), url);
  assert.equal(safeImageUrl(url + "?other=1"), null);
  assert.equal(safeImageUrl(url.replace("_80Q_is", "_90Q_is")), null);
}
assert.equal(safeImageUrl(magic7WhiteUrl), magic7WhiteUrl);
assert.equal(safeImageUrl(magic7WhiteUrl + "?other=1"), null);
assert.equal(safeImageUrl(magic7WhiteUrl.replace("940", "941")), null);
const mitu6cPoster = "https://img.ithome.com/newsuploadfiles/2022/5/c44c8be9-d7f5-41d3-9d0d-790cff4fe6e1.jpg@s_2,w_820,h_1294";
assert.equal(safeImageUrl(mitu6cPoster), mitu6cPoster);
assert.equal(safeImageUrl(mitu6cPoster.replace("w_820", "w_900")), null, "只允许已审原页资源，不生成新版尺寸地址");
const band7Poster = "https://img.ithome.com/newsuploadfiles/2022/5/8d6358aa-96a3-4180-b335-a450b7223656.jpg@s_2,w_820,h_1093";
assert.equal(safeImageUrl(band7Poster), band7Poster);
assert.equal(safeImageUrl(band7Poster.replace("h_1093", "h_1200")), null);
const k80Poster = "https://img.ithome.com/newsuploadfiles/2024/11/1c195c21-84b5-4337-94f1-3716963b32ae.jpg?x-bce-process=image/watermark,image_aW1nL3dhdGVybWFyay9xdy9xdzEyNy5wbmc=,t_100,g_9,y_22,x_22,a_0/format,f_auto";
const huaweiBand7Poster = "https://img.ithome.com/newsuploadfiles/2022/4/a648baa2-c0cb-4832-89b3-106406484b83.jpg@s_2,w_820,h_372";
assert.equal(safeImageUrl(huaweiBand7Poster), huaweiBand7Poster);
assert.equal(safeImageUrl(huaweiBand7Poster.replace("h_372", "h_400")), null);
const huaweiSupportRender = "https://consumer-tkbdownload.huawei.com/ctkbfm/servlet/download/downloadServlet/H4sIAAAAAAAA_test%3D.png";
assert.equal(safeImageUrl(huaweiSupportRender), huaweiSupportRender);
assert.equal(safeImageUrl(huaweiSupportRender + "?width=4000"), null);
assert.equal(safeImageUrl(huaweiSupportRender.replace("https:", "http:")), null);
assert.equal(safeImageUrl(huaweiSupportRender.replace(".png", ".html")), null);
assert.equal(safeImageUrl(k80Poster), k80Poster);
assert.equal(safeImageUrl(k80Poster.replace("y_22", "y_23")), null);
assert.equal(safeImageUrl(k80Poster + "&other=1"), null);
assert.deepEqual(imageGalleries["huawei-enjoy-50-pro-2022"].colors.map(color => color.name).sort(), ["幻夜黑", "星海蓝", "翡冷翠", "雪域白"].sort(), "配色纠正后应保留尚未补图的真实颜色，不沿用参数页错字");
assert.equal(imageGalleries["huawei-enjoy-50-pro-2022"].colors.find(color => color.name === "星海蓝").image.viewScope, "front_back");
assert.deepEqual(imageGalleries["redmi-band-3-2024"].colors.map(color => color.name).sort(), ["黑色", "米色"].sort(), "红米手环3不得复用第一代的四种配色，也不把海报宣传腕带登记为当前在售版本");
for (const source of imageSources.devices) {
  for (const candidate of source.colorImageCandidates ?? []) {
    if (candidate.status !== "downloaded_and_visually_reviewed" || !candidate.anchor) continue;
    const device = database.devices.find(row => row.id === source.id);
    const recordedColors = source.colorEvidence?.value ?? device.specs.colors?.value ?? imageGalleries[source.id]?.colors.map(color => color.name) ?? "";
    const reviewedLaterColor = source.id === "xiaomi-11-lite-2021" && candidate.color === "夏日柠檬" && candidate.imageRendition === "suning_large";
    if (!(Array.isArray(recordedColors) ? recordedColors : recordedColors.replace(/\s*查看外观.*$/, "").split(/[,，]/).map(name => name.trim())).includes(candidate.color)
      && !(reviewedLaterColor && imageGalleries[source.id]?.colors.some(color => color.name === candidate.color))) continue;
    const page = await getSourceSnapshot(candidate.sourceUrl, { offline: true });
    assert.equal(page.sha256, candidate.sourceSnapshotHash);
    const image = readReviewedProductImage(page.html, device, candidate);
    if (candidate.samsungPressAltBinding) {
      assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, color: "悠柔白" }), /配色/);
      assert.throws(() => readReviewedProductImage(page.html, { ...device, modelName: "Samsung Galaxy S23" }, candidate));
      assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, url: candidate.url + "?other" }), /资源/);
      assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, anchor: candidate.anchor.replace('alt="Galaxy S23+"', 'alt="Galaxy S23"') }));
      assert.equal(safeImageUrl(candidate.url + "?other"), null);
    }
    if (candidate.samsungNewsColorBinding) {
      assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, color: "wrong" }), /配色/);
      assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, color: candidate.color === "钛银" ? "钛黑" : "钛银" }), /资源/);
      assert.throws(() => readReviewedProductImage(page.html, { ...device, modelName: "Samsung Galaxy S25" }, candidate));
      assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, sourceUrl: "https://www.samsung.com.cn/" }));
    }
    if (candidate.officialColorGalleryBinding) {
      assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, color: "wrong" }), /配色/);
      assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, url: candidate.url.replace(/\.png$/, "-other.png") }), /资源/);
      assert.throws(() => readReviewedProductImage(page.html, { ...device, modelName: "荣耀Magic V999" }, candidate), /型号/);
      assert.throws(() => readReviewedProductImage(page.html, { ...device, brand: "Huawei" }, candidate), /荣耀/);
    }
    if (candidate.samsungSingleSkuBinding) {
      if (device.category === "phone") {
        assert.throws(() => readReviewedProductImage(page.html, { ...device, modelName: "Samsung Galaxy S23+" }, candidate), /型号/);
        assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, color: "悠野绿" }), /配色/);
        assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, url: candidate.url.replace("sm-s9110lgdchc", "sm-s9160lgdchc") }), /SKU/);
      } else {
        assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, url: candidate.url.replace(/\/cn\/sm-/, "/cn\/wrong-sm-") }), /SKU/);
        assert.throws(() => readReviewedProductImage(page.html, { ...device, variant: device.variant === "5g" ? "wifi" : "5g" }, candidate), /网络版本/);
        assert.throws(() => readReviewedProductImage(page.html, { ...device, modelName: "Samsung Galaxy Tab S999 FE" }, candidate), /型号/);
      }
      assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, color: "wrong" }), /配色/);
    }
    if (/^https:\/\/static\.shihuocdn\.cn\/(?:admin|def)\//.test(candidate.url)) {
      assert.equal(safeImageUrl(candidate.url + "?other=1"), null);
      assert.equal(safeImageUrl(candidate.url.replace(/\.(png|jpe?g)$/, "-other.$1")), null);
    }
    if (candidate.zolProductId && candidate.color) {
      assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, color: "wrong" }));
    }
    if (candidate.editionColorBinding) {
      assert.throws(() => readReviewedProductImage(page.html, { ...device, id: "redmi-k80-2024" }, candidate));
      assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, color: "冠军版绿色" }));
      assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, sourceUrl: "https://www.ithome.com/0/813/724.htm" }));
      for (const key of ["edition", "sourceColor", "modelAnchor"])
        assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, editionColorBinding: { ...candidate.editionColorBinding, [key]: "wrong" } }));
      assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, url: candidate.url + "?other" }));
    }
    if (candidate.shihuoStyleBinding) {
      assert.throws(() => readReviewedProductImage(page.html, { ...device, id: "wrong" }, candidate));
      assert.throws(() => readReviewedProductImage(page.html, { ...device, modelName: "wrong" }, candidate));
      assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, color: "wrong" }));
      assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, url: candidate.url + "?other" }));
      assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, sourceUrl: candidate.sourceUrl.replace(/goodsId=\d+/, "goodsId=999999999") }));
      for (const field of ["title", "productName", "styleId", "styleImageAnchor", "chip", "screenSize", "releaseDate"])
        assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, shihuoStyleBinding: { ...candidate.shihuoStyleBinding, [field]: "wrong" } }));
    }
    if (candidate.appleRefurbishedImage) {
      const binding = candidate.appleRefurbishedImage;
      assert.throws(() => readReviewedProductImage(page.html, { ...device, id: "wrong-model" }, candidate));
      assert.throws(() => readReviewedProductImage(page.html, { ...device, modelName: "wrong-size-or-chip" }, candidate));
      assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, color: "wrong-color" }));
      assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, url: candidate.url + "&unreviewed=1" }));
      assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, sourceUrl: candidate.sourceUrl.replace("www.apple.com", "example.com") }));
      for (const field of ["productName", "sourceColor", "imageName", "alt"])
        assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, appleRefurbishedImage: { ...binding, [field]: "wrong" } }));
      for (const anchor of [candidate.anchor, binding.titleAnchor, binding.chipAnchor, binding.screenAnchor].filter(Boolean))
        assert.throws(() => readReviewedProductImage(page.html.replaceAll(anchor, ""), device, candidate));
      if (binding.chipAnchor) for (const field of ["chipAnchor", "screenAnchor"])
        assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, appleRefurbishedImage: { ...binding, [field]: "wrong" } }));
      if (["ipad-pro-11-1st-2018", "ipad-pro-12-9-3rd-2018"].includes(source.id)) {
        assert.throws(() => readReviewedProductImage(page.html, { ...device, releaseYear: 2019 }, candidate));
        assert.throws(() => readReviewedProductImage(page.html, { ...device, specs: { ...device.specs, screenSize: { value: source.id === "ipad-pro-11-1st-2018" ? 12.9 : 11 } } }, candidate));
        assert.throws(() => readReviewedProductImage(page.html, { ...device, specs: { ...device.specs, chip: { value: "Apple A12Z" } } }, candidate));
        assert.throws(() => readReviewedProductImage(page.html.replaceAll("Originally released October 2018", "Originally released March 2020"), device, candidate));
        assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, color: candidate.color === "银色" ? "深空灰色" : "银色" }));
      }
    }
    if (candidate.imageRendition === "suning_large") {
      assert.throws(() => readReviewedProductImage(page.html, { ...device, id: "samsung-galaxy-s21-2021" }, candidate), /版型|型号/);
      assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, sourceUrl: candidate.sourceUrl.replace("suning.com", "example.com") }));
      assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, url: candidate.url.replace("800w_800h", "60w_60h") }), /资源/);
      assert.equal(safeImageUrl(candidate.url + "?other=1"), null);
    }
    // 后续经原页重放的正反面审图可替代较早的单面图；下面逐条验证该审图清单。
    const review = colorViews[source.id];
    const override = review?.colors[candidate.color];
    const stored = imageGalleries[source.id]?.colors.find(row => row.name === candidate.color)?.image;
    const expected = expectedReviewedColor(source, candidate.color, review);
    assert.equal(stored?.url, expected?.url ?? image.url, "逐色审核图片必须按同视角来源优先级同步到对应颜色");
    const sourceName = expected?.sourceName ?? (override ? review.sourceName ?? "中关村在线" : candidate.sourceName);
    if (sourceName) assert.equal(stored?.sourceName, sourceName, "图片不能冒充其他来源");
    if (override) assert.equal(stored?.viewScope, "front_back", "覆盖单面图必须使用已审核正反面图");
  }
}
const samsungWatchReviews = JSON.parse(await fs.readFile("scripts/fixtures/reviewed-samsung-watch-colors.json", "utf8"));
for (const [id, review] of Object.entries(samsungWatchReviews)) {
  const device = database.devices.find(device => device.id === id);
  const page = await getSourceSnapshot(review.sourceUrl, { offline: true });
  assert.equal(page.sha256, review.sourceSnapshotHash);
  const photos = readReviewedSamsungWatchColors(page.html, device, review);
  assert.deepEqual(photos.map(photo => photo.name).sort(), [...review.allowedColors].sort());
  assert.deepEqual(device.specs.colors.value, review.allowedColors);
  assert.equal(device.specs.colors.sourceSnapshotHash, page.sha256);
  assert.throws(() => readReviewedSamsungWatchColors(page.html, { ...device, id: id + "-other" }, review));
  if (review.reader === "samsung_watch9_buying_options") {
    assert.ok(photos.every(photo => photo.viewScope === "front"));
    for (const photo of photos) {
      const stored = imageGalleries[id].colors.find(color => color.name === photo.name)?.image;
      assert.equal(stored?.url, photo.url);
      assert.equal(stored?.viewScope, "front", "手表单面不能冒充正反");
    }
    const first = review.bindings[0];
    for (const key of ["sku", "color", "bandCode", "url"]) assert.throws(() => readReviewedSamsungWatchColors(page.html, device,
      { ...review, bindings: review.bindings.map(row => row === first ? { ...row, [key]: row[key] + " altered" } : row) }));
    assert.throws(() => readReviewedSamsungWatchColors(page.html.replaceAll('"engName":"' + (id.includes("lte") ? "Bluetooth + 4G" : "Bluetooth") + '"', '"engName":"other-network"'), device, review));
    assert.throws(() => readReviewedSamsungWatchColors(page.html.replaceAll('"engName":"' + (id.includes("40") ? "40mm" : "44mm") + '"', '"engName":"other-size"'), device, review));
    assert.throws(() => readReviewedSamsungWatchColors(page.html + "var buyingOptions = {}", device, review));
    assert.throws(() => readReviewedSamsungWatchColors(page.html.replace("var buyingOptions = ", "var invalidOptions = "), device, review));
    const other = structuredClone(review); other.bindings[0].image.imgAltText += " altered";
    assert.throws(() => readReviewedSamsungWatchColors(page.html, device, other));
    assert.equal(safeImageUrl(first.url + "?other=1"), null);
    assert.equal(safeImageUrl(first.url.replace(/\d+$/, "999999999")), null);
    const object = JSON.parse(page.html.match(/var buyingOptions = (.*);/)[1]);
    object.products.reverse(); object.fullBuyingOptions.reverse();
    for (const product of object.products) { product.optionMappings.reverse(); product.buyingOptions.reverse(); for (const option of product.buyingOptions) option.optionItems.reverse(); }
    const reordered = page.html.replace(/var buyingOptions = .*;/, "var buyingOptions = " + JSON.stringify(object) + ";");
    assert.deepEqual(readReviewedSamsungWatchColors(reordered, device, review), photos, "顺序变化不能改变具名绑定");
  } else {
    assert.ok(photos.every(photo => !photo.url), "配色文字证据不能新增图片");
    assert.throws(() => readReviewedSamsungWatchColors(page.html.replace(review.anchor, ""), device, review));
    if (id.includes("lte")) assert.throws(() => readReviewedSamsungWatchColors(page.html.replace('data-colorname="哥特太空"', 'data-colorname="繁樱花园"'), device, review));
  }
}

for (const [id, review] of Object.entries(colorViews)) {
  const page = await getSourceSnapshot(review.sourceUrl, { offline: true });
  assert.equal(review.status, "downloaded_and_visually_reviewed");
  assert.equal(page.sha256, review.sourceSnapshotHash);
  const device = database.devices.find(device => device.id === id);
  const cssPage = review.cssUrl && await getSourceSnapshot(review.cssUrl, { offline: true });
  if (cssPage) assert.equal(cssPage.sha256, review.cssSnapshotHash);
  const labelPage = review.reader === "oppo_material_labels" && await getSourceSnapshot(review.linkedFromUrl, { offline: true });
  if (labelPage) assert.equal(labelPage.sha256, review.labelSnapshotHash);
  const photos = labelPage ? readReviewedOppoColorImages(page.html, labelPage.html, device, review) : review.reader === "shihuo" ? readShihuoColorImages(page.html, device.modelName, Object.keys(review.colors), device) : review.reader === "apple_selection_json" ? readReviewedAppleColorImages(page.html, device, review) : review.samsungPanelBindings ? readReviewedSamsungPanelColors(page.html, device, review) : cssPage ? readReviewedCssColorImages(page.html, cssPage.html, review) : review.productId ? readReviewedZolColorImages(page.html, review)
    : readOfficialColorGallery(page.html, device, page.url).colors;
  if (review.reader === "shihuo") {
    assert.throws(() => readShihuoColorImages(page.html, "iPad Pro 11 英寸 (2021)", Object.keys(review.colors), { ...device, releaseYear: 2021 }));
    assert.ok(readShihuoColorImages(page.html, device.modelName, ["不存在的配色"], device).every(photo => !photo.url));
  }
  if (id === "xiaomi-6-2017") {
    const binding = review.bindings[0];
    for (const field of ["sourceColorName", "color", "selector", "anchor", "htmlAnchor"]) assert.throws(() => readReviewedCssColorImages(page.html, cssPage.html,
      { ...review, bindings: [{ ...binding, [field]: binding[field] + " changed" }] }));
    assert.throws(() => readReviewedCssColorImages(page.html, cssPage.html, { ...review, modelName: "小米6X" }));
    assert.throws(() => readReviewedCssColorImages(page.html, cssPage.html, { ...review, sourceUrl: "https://www.mi.com/mi6x/specs" }));
    assert.throws(() => readReviewedCssColorImages(page.html.replace(binding.htmlAnchor, ""), cssPage.html, review));
    assert.equal(safeImageUrl(review.colors[binding.color] + "?other=1"), null);
    assert.equal(safeImageUrl(review.colors[binding.color].replace("s-black", "s-black2")), null);
  }
  if (review.samsungPanelBindings) {
    const binding = review.samsungPanelBindings[0];
    assert.throws(() => readReviewedSamsungPanelColors(page.html, { ...device, id: device.id.replace("ultra", "plus") }, review), /Ultra/);
    assert.throws(() => readReviewedSamsungPanelColors(page.html.replaceAll(binding.labelAnchor, ""), device, review), /锚点/);
    assert.throws(() => readReviewedSamsungPanelColors(page.html + binding.panelAnchor + "</div>", device, review), /唯一/);
    assert.throws(() => readReviewedSamsungPanelColors(page.html.replace(binding.imageAnchor, ""), device, review), /面板/);
    assert.throws(() => readReviewedSamsungPanelColors(page.html, device, { ...review, colors: { ...review.colors, [binding.color]: review.colors[binding.color] + "?other" } }), /资源/);
    assert.throws(() => readReviewedSamsungPanelColors(page.html, device, { ...review, samsungPanelBindings: [{ ...binding, color: "其他颜色" }] }), /颜色/);
    assert.ok(photos.every(photo => photo.name === photo.name.normalize("NFKC")), "颜色标签统一 NFKC，兼容康熙部首旧字形");
  }
  if (review.zolBindings) {
    const first = review.zolBindings[0];
    assert.throws(() => readReviewedZolColorImages(page.html.replace(first.anchor, ""), review), /锚点/);
    for (const key of ["sourceColor", "classId4", "picId", "hash", "url"]) assert.throws(() => readReviewedZolColorImages(page.html,
      { ...review, zolBindings: [{ ...first, [key]: String(first[key]) + " altered" }] }));
    assert.equal(photos.length, review.zolBindings.length, "未审图库候选不能一并导入");
  }
  if (review.reader === "apple_selection_json") {
    assert.throws(() => readReviewedAppleColorImages(page.html, { ...device, modelName: device.modelName + " Pro" }, review));
    const binding = review.bindings[0];
    for (const key of ["imageName", "alt"]) assert.throws(() => readReviewedAppleColorImages(page.html, device,
      { ...review, bindings: review.bindings.map(row => row === binding ? { ...row, [key]: row[key] + " altered" } : row) }));
    assert.throws(() => readReviewedAppleColorImages(page.html, device,
      { ...review, colors: { ...review.colors, [binding.color]: review.colors[binding.color] + "&changed=1" } }));
  }
  for (const [name, url] of Object.entries(review.colors)) {
    assert.ok(photos.some(photo => photo.name.normalize("NFKC") === name.normalize("NFKC") && photo.url === url), `${id}/${name}: 已审颜色与图片绑定必须可重放`);
    const stored = imageGalleries[id].colors.find(color => color.name === name)?.image;
    const source = imageSources.devices.find(source => source.id === id);
    const expected = expectedReviewedColor(source, name, review);
    assert.equal(stored?.url, expected?.url ?? url, "已核验官方同视角图优先于第三方旧图");
    assert.equal(stored?.viewScope, "front_back", "已核验正反面标记不能在同步时丢失");
    if (review.reader === "apple_selection_json") assert.equal(stored?.alt, review.bindings.find(binding => binding.color === name).alt);
  }
}
const registry = JSON.parse(await fs.readFile("src/data/device-sources.json", "utf8"));
const models = new Map(database.devices.map((device) => [device.id, device]));
const xiaomi15Colors = models.get("xiaomi-15-2024").specs.colors;
const xiaomi15ColorPage = await getSourceSnapshot(xiaomi15Colors.sourceUrl, { offline: true });
assert.equal(xiaomi15ColorPage.sha256, xiaomi15Colors.sourceSnapshotHash);
assert.ok(plainText(xiaomi15ColorPage.html).includes(xiaomi15Colors.rawText));
assert.deepEqual(xiaomi15Colors.value, ["丁香紫", "浅草绿", "黑色", "白色", "亮银版"]);
const sources = new Map(registry.devices.map((source) => [source.id, source]));
const xiaomiCameraTargets = JSON.parse(await fs.readFile("scripts/fixtures/xiaomi-camera-targets.json", "utf8"));
for (const id of xiaomiCameraTargets) {
  const device = models.get(id);
  const url = sources.get(id).referenceUrls.find((entry) => /^https:\/\/detail\.zol\.com\.cn\/.*(?:\/param\.shtml|\/param_\d+_0_1\.html)$/.test(entry));
  const page = await getSourceSnapshot(url, { offline: true });
  assertZolModel(page, device.modelName);
  for (const [key, field] of Object.entries(readZolCameraSpecs(page))) {
    if (device.specs[key]?.sourceType !== "official") assert.deepEqual(device.specs[key], field, `${id}.${key}: 镜头编号绑定可回放`);
    assert.equal(field.sourceType, "reference");
  }
  assert.throws(() => assertZolModel(page, "不匹配的设备"));
}
assert.match(models.get("xiaomi-17-2025").specs.telephoto.value, /Zoom EIS/);
assert.doesNotMatch(models.get("xiaomi-17-2025").specs.ultraWide.value, /OIS|EIS/);
assert.doesNotMatch(models.get("redmi-k80-pro-2024").specs.ultraWide.value, /f\/1\.6|OIS/, "未分镜头标注不能复制到超广角");
assert.match(models.get("redmi-note-14-pro-2024").specs.macroCamera.value, /微距/);
assert.doesNotMatch(models.get("redmi-note-14-pro-2024").specs.ultraWide.value, /1\/1\.4/, "可疑传感器尺寸不自动导入");
const untypedCamera = readZolCameraSpecs({ url: "https://detail.zol.com.cn/test/param.shtml", fetchedAt: "2026-10-09T00:00:00Z", sha256: "test",
  html: "<table><tr><th>摄像头名称</th><td>后置摄像头1：未知镜头</td></tr><tr><th>像素</th><td>后置摄像头1：5000万像素</td></tr></table>" });
assert.equal(untypedCamera.mainCamera, undefined, "不按第一枚摄像头猜主摄");
for (const device of database.devices.filter((entry) => /^Samsung Galaxy S2[456](?:\+| Ultra)?$/.test(entry.modelName))) {
  const model = device.modelName.replace(/^Samsung /, "");
  const url = device.specs.mainCamera.sourceUrl;
  const page = await getSourceSnapshot(url, { offline: true });
  for (const [key, field] of Object.entries(readSamsungCameraSpecs(page, model))) {
    assert.deepEqual(device.specs[key], field);
    assert.ok(plainText(page.html).includes(field.rawText));
  }
}
assert.match(models.get("samsung-galaxy-s26-2026").specs.mainCamera.value, /F1\.8/);
assert.doesNotMatch(models.get("samsung-galaxy-s26-2026").specs.mainCamera.value, /F1\.4|2亿/, "同页 Ultra 参数不混入标准版");
const cameraTargets = JSON.parse(await fs.readFile("scripts/fixtures/android-camera-targets.json", "utf8"));
for (const target of cameraTargets) {
  const device = models.get(target.id);
  const page = await getSourceSnapshot(target.sourceUrl, { offline: true });
  const fields = readOfficialCameraSpecs(device.brand, page);
  const text = plainText(page.html);
  for (const [key, field] of Object.entries(fields)) {
    assert.deepEqual(device.specs[key], field, `${target.id}.${key}: 官网影像快照必须可回放`);
    assert.ok(text.includes(field.rawText), `${target.id}.${key}: 原文必须是实际连续摘录`);
    assert.equal(field.sourceType, "official");
  }
  assert.equal(sources.get(target.id).cameraVerification.sourceSnapshotHash, page.sha256);
}
assert.match(models.get("huawei-pura-80-pro-plus-2025").specs.ultraWide.value, /4000 万像素/);
assert.match(models.get("huawei-pura-80-2025").specs.colorCamera.value, /150 万多光谱/);
assert.match(models.get("huawei-pura-80-ultra-2025").specs.telephoto.value, /传感器位移防抖/);
assert.match(models.get("huawei-pura-80-ultra-2025").specs.videoRecording.value, /基于 AI 插帧/);
assert.match(models.get("oppo-find-x8-ultra-2025").specs.colorCamera.value, /200 万像素丹霞/);
assert.match(models.get("oppo-find-x8-ultra-2025").specs.videoRecording.value, /4K 视频拍摄：30 fps，60 fps，120 fps/);
assert.match(models.get("oppo-find-x8-ultra-2025").specs.videoRecording.value, /支持 HDR 视频拍摄/);
assert.match(models.get("oppo-find-x8-pro-2024").specs.telephoto.value, /73 毫米.+135 毫米/);
assert.doesNotMatch(models.get("vivo-x200-pro-2024").specs.ultraWide.value, /OIS/);
assert.match(models.get("vivo-x200-ultra-2025").specs.ultraWide.value, /OIS/);
const vivoCameraPage = await getSourceSnapshot("https://www.vivo.com.cn/vivo/param/x200pro", { offline: true });
assert.throws(() => readOfficialCameraSpecs("vivo", { ...vivoCameraPage,
  html: vivoCameraPage.html.replaceAll("（超视野超广角）", "（未说明镜头）") }), /唯一绑定/,
  "没有明确镜头名称不能按光圈顺序猜测");
assert.throws(() => readOfficialCameraSpecs("Huawei", { ...vivoCameraPage,
  html: "<p>后置摄像头 后置摄像头 5000 万像素摄像头 *备注</p>" }), /未识别镜头/);
const palettes = JSON.parse(await fs.readFile("src/data/device-image-galleries.json", "utf8"));
const existingColors = [{ name: "黑色", image: { url: "verified-black" } }, { name: "白色", image: { url: "verified-white" } }];
assert.deepEqual(mergeColorImages(existingColors, [{ name: "黑色" }]), existingColors, "文字参数页和后续请求失败不能擦除已核验颜色图片");
assert.deepEqual(mergeColorImages(existingColors, [{ name: "黑色", image: { url: "new-verified-black" } }]),
  [{ name: "黑色", image: { url: "new-verified-black" } }, existingColors[1]], "官方单 SKU 一种颜色不能删除其他已核验配色");
assert.deepEqual(mergeColorImages(existingColors, []), existingColors, "空页面重放不能损失已核验配色");
const bothBlack = { name: "黑色", image: { url: "both-black", viewScope: "front_back" } };
assert.deepEqual(mergeColorImages([bothBlack], [{ name: "黑色", image: { url: "back-only" } }]), [bothBlack], "同颜色已核验正反同框图不被单面图覆盖");
assert.deepEqual(mergeColorImages(existingColors, [bothBlack]).find(color => color.name === "黑色"), bothBlack);
assert.equal(mergeColorImages([bothBlack], [{ name: "白色", image: { url: "both-white", viewScope: "front_back" } }]).length, 2, "图片优先级不能跨颜色混配");
const officialBlack = { name: "黑色", image: { url: "official-black", sourceUrl: "https://www.mi.com/product/test", viewScope: "front_back" } };
const retailerBlack = { name: "黑色", image: { url: "retailer-black", sourceUrl: "https://item.jd.com/test.html", viewScope: "front_back" } };
const mediaBlack = { name: "黑色", image: { url: "media-black", sourceUrl: "https://detail.zol.com.cn/test.html", viewScope: "front_back" } };
assert.deepEqual(mergeColorImages([officialBlack], [retailerBlack, mediaBlack]), [officialBlack]);
assert.deepEqual(mergeColorImages([mediaBlack], [retailerBlack]), [retailerBlack]);
assert.deepEqual(mergeColorImages([mediaBlack], [{ ...officialBlack, image: { ...officialBlack.image, viewScope: undefined } }]), [mediaBlack], "单面官网图不能替换符合视角要求的媒体图");
assert.deepEqual(mergeColorImages([{ ...bothBlack, name: "黑色 " }, { name: " 黑色" }], [{ name: "黑色", image: { url: "back-only" } }]), [bothBlack], "首尾空格不应制造重复配色，也不能擦除正反同框图");
assert.deepEqual(mergeColorImages([], [{ name: "   " }]), [], "空白不是配色");
assert.equal(safeImageUrl("https://cdn.cnbj1.fds.api.mi-img.com/product-images/redmiBooks/14-20248abe56/section-01.jpg?v2="), null, "已拒绝 CPU 广告冲突图不能进入补图名单");
const reviewedImage = { status: "downloaded_and_visually_reviewed", targetIds: ["own-standard"],
  anchor: '<img src="/content/dam/huawei-cbg-site/cn/own.png" alt="银色"/>',
  sourceUrl: "https://consumer.huawei.com/cn/tablets/own/specs/",
  url: "https://consumer.huawei.com/content/dam/huawei-cbg-site/cn/own.png" };
assert.equal(readReviewedProductImage(reviewedImage.anchor, { id: "own-standard", modelName: "本型号" }, reviewedImage).url, reviewedImage.url);
assert.throws(() => readReviewedProductImage(reviewedImage.anchor, { id: "own-yuexiang" }, reviewedImage), /版型/, "基型图不能擅自套悦享款");
assert.throws(() => readReviewedProductImage("<title>same</title>", { id: "own-standard" }, reviewedImage), /锚点/);
assert.throws(() => readReviewedProductImage(reviewedImage.anchor, { id: "own-standard" }, { ...reviewedImage, url: reviewedImage.url.replace("own.png", "other.png") }), /资源/);
const reviewedZolPoster = {
  status: "downloaded_and_visually_reviewed", targetIds: ["own-standard"],
  sourceUrl: "https://detail.zol.com.cn/picture_index_2497/index24965524_18260_p1814430.shtml",
  zolProductId: "1814430", zolPicId: 24965524, zolHash: "cezcXXCWM5XB6",
  anchor: JSON.stringify({ proId: 1814430, picId: 24965524, hash: "cezcXXCWM5XB6", picSrc: "https://2e.zol-img.com.cn/product/249_100x75/524/cezcXXCWM5XB6.jpg" }),
  url: "https://2e.zol-img.com.cn/product/249/524/cezcXXCWM5XB6.jpg",
};
assert.equal(readReviewedProductImage(reviewedZolPoster.anchor, { id: "own-standard" }, reviewedZolPoster).url, reviewedZolPoster.url);
assert.throws(() => readReviewedProductImage(reviewedZolPoster.anchor, { id: "own-standard" }, { ...reviewedZolPoster, zolProductId: "999", sourceUrl: reviewedZolPoster.sourceUrl.replace("1814430", "999") }), /本型号/);
assert.throws(() => readReviewedProductImage(reviewedZolPoster.anchor, { id: "own-standard" }, { ...reviewedZolPoster, zolPicId: 999 }), /编号/);
assert.throws(() => readReviewedProductImage(reviewedZolPoster.anchor, { id: "own-standard" }, { ...reviewedZolPoster, zolHash: "other" }), /资源/);
const colorAnchor = "<p><span>云</span><span>杉</span><span>绿</span></p>";
const namedColor = { ...reviewedImage, color: "云杉绿", colorAnchor };
assert.equal(readReviewedProductImage(reviewedImage.anchor + colorAnchor, { id: "own-standard" }, namedColor).url, reviewedImage.url);
assert.throws(() => readReviewedProductImage(reviewedImage.anchor, { id: "own-standard" }, namedColor), /配色锚点/);
assert.throws(() => readReviewedProductImage(reviewedImage.anchor + colorAnchor, { id: "own-standard" }, { ...namedColor, color: "其他颜色" }), /具名/);
const sourceSet = { ...reviewedImage, anchor: `<source data-srcset="${reviewedImage.url} 2x" />` };
assert.equal(readReviewedProductImage(sourceSet.anchor, { id: "own-standard" }, sourceSet).url, reviewedImage.url);
const desktopImage = { ...reviewedImage, anchor: `<img data-src-pc="${reviewedImage.url}" src="https://img.ithome.com/newsuploadfiles/mobile.png" />` };
assert.equal(readReviewedProductImage(desktopImage.anchor, { id: "own-standard" }, desktopImage).url, desktopImage.url, "三星响应式海报应重放已审核的桌面资源，不混用手机裁切图");
const responsiveImage = { ...reviewedImage, anchor: `<img src="${reviewedImage.url}" srcset="${reviewedImage.url}?large 2x" />` };
assert.equal(readReviewedProductImage(responsiveImage.anchor, { id: "own-standard" }, responsiveImage).url, reviewedImage.url, "有默认 src 的图片不得自动换成未经核验的 2x 资源");
const reviewedHighResolution = { ...responsiveImage, imageAttribute: "srcset", url: reviewedImage.url + "?large" };
assert.equal(readReviewedProductImage(responsiveImage.anchor, { id: "own-standard" }, reviewedHighResolution).url, reviewedHighResolution.url);
assert.throws(() => readReviewedProductImage(responsiveImage.anchor, { id: "own-standard" }, { ...reviewedHighResolution, imageAttribute: "src" }), /srcset/, "不可绕过审核指定任意图片属性");
assert.throws(() => readReviewedProductImage(reviewedImage.anchor, { id: "own-standard" }, { ...reviewedHighResolution, anchor: reviewedImage.anchor }), /资源/, "缺少已审核的高清属性时不得退回未经审核的默认图");
const retailImage = { status: "downloaded_and_visually_reviewed", targetIds: ["iphone-16-pro"],
  sourceUrl: "https://item.jd.com/product/own-sku.html", imageRendition: "jd_original",
  anchor: '<img id="spec-img" src="//img11.360buyimg.com/n4/s114x114_jfs/t1/own.png"/>',
  modelAnchor: '<title>Apple iPhone 16 Pro 沙漠色钛金属</title>', color: "沙漠色钛金属",
  colorAnchor: '<title>Apple iPhone 16 Pro 沙漠色钛金属</title>',
  url: "https://img11.360buyimg.com/n0/jfs/t1/own.png" };
const retailPage = retailImage.anchor + retailImage.modelAnchor;
const retailDevice = { id: "iphone-16-pro", modelName: "iPhone 16 Pro" };
assert.equal(readReviewedProductImage(retailPage, retailDevice, retailImage).url, retailImage.url);
for (const name of ["iPhone 13", "iPhone XS", "iPhone XR", "iPhone X"]) {
  const title = `<title>Apple ${name}/其他型号 沙漠色钛金属</title>`;
  const mixed = { ...retailImage, modelAnchor: title, colorAnchor: title };
  assert.throws(() => readReviewedProductImage(mixed.anchor + title, { ...retailDevice, modelName: name }, mixed), /具体型号/, "并列多型号商品标题不能绑定单一机型图片");
}
assert.throws(() => readReviewedProductImage(retailPage, { ...retailDevice, modelName: "iPhone 16 Pro Max" }, retailImage), /具体型号/);
assert.throws(() => readReviewedProductImage(retailPage, retailDevice, { ...retailImage, color: "黑色钛金属" }), /具名/);
assert.throws(() => readReviewedProductImage(retailPage, retailDevice, { ...retailImage, url: retailImage.url.replace("own", "other") }), /资源/);
assert.throws(() => readReviewedProductImage(retailPage, retailDevice, { ...retailImage, sourceUrl: "https://item.jd.com/" }), /match|匹配/);
const appleRetailSources = JSON.parse(await fs.readFile("src/data/apple-sources.json", "utf8")).phone;
for (const source of appleRetailSources) for (const candidate of (source.colorImageCandidates ?? []).filter(row => row.zolProductId)) {
  const model = database.devices.find(device => device.id === source.id);
  const page = await getSourceSnapshot(candidate.sourceUrl, { offline: true });
  assert.equal(page.sha256, candidate.sourceSnapshotHash);
  assert.equal(readReviewedProductImage(page.html, model, candidate).url, candidate.url);
  assert.equal(rejectedGalleries[source.id].colors.find(color => color.name === candidate.color).image.url, candidate.url);
  assert.throws(() => readReviewedProductImage(page.html, { ...model, id: "other-device" }, candidate));
  assert.throws(() => readReviewedProductImage(page.html, model, { ...candidate, color: "其他配色" }));
  assert.throws(() => readReviewedProductImage(page.html, model, { ...candidate, zolProductId: "1427000" }));
  assert.throws(() => readReviewedProductImage(page.html, model, { ...candidate, zolHash: "other" }));
  assert.throws(() => readReviewedProductImage(page.html, model, { ...candidate, url: candidate.url.replace("/268/", "/267/") }));
}
for (const [id, candidate] of appleRetailSources.flatMap(s => (s.colorImageCandidates ?? []).filter(c => c.jdGalleryOriginalBinding).map(c => [s.id, c]))) {
  const model = database.devices.find(device => device.id === id);
  assert.ok(model, "已审零售图片必须属于实际收录的设备");
  const page = await getSourceSnapshot(candidate.sourceUrl, { offline: true });
  assert.equal(candidate.sourceSnapshotHash, page.sha256);
  assert.equal(readReviewedProductImage(page.html, model, candidate).url, candidate.url);
  assert.throws(() => readReviewedProductImage(page.html, { ...model, releaseYear: 2023 }, candidate), /年份/);
  assert.throws(() => readReviewedProductImage(page.html, model, { ...candidate, color: "其他颜色" }), /型号/);
  assert.throws(() => readReviewedProductImage(page.html, model, { ...candidate, sourceUrl: candidate.sourceUrl.replace(/product\/[^/]+/, "product/other") }), /match|匹配/);
  assert.throws(() => readReviewedProductImage(page.html, model, { ...candidate, sourceUrl: candidate.sourceUrl.replace(/product\/[^/]+/, "product/other.html") }), /SKU/);
  assert.throws(() => readReviewedProductImage(page.html.replace('id="spec-list"', 'id="recommended-items"'), model, candidate), /图库/);
  const otherTitle = candidate.modelAnchor.replace(/iPhone\s*(?:苹果)?1[23](?:\s*Pro(?:\s*Max)?)?/i, "iPhone 14");
  assert.throws(() => readReviewedProductImage(page.html.replace(candidate.modelAnchor, otherTitle), model, { ...candidate, modelAnchor: otherTitle }), /具体型号/);
  assert.throws(() => readReviewedProductImage(page.html, model, { ...candidate, url: candidate.url.replace(/[^/]+\.(?:png|jpe?g)$/, "other.jpg") }), /资源/);
  assert.equal(candidate.imageReview.width, 800);
  assert.equal(candidate.imageReview.height, 800);
}
assert.throws(() => readReviewedProductImage(sourceSet.anchor, { id: "own-standard" }, { ...sourceSet, url: reviewedImage.url + "?other" }), /资源/);
const bandResource = reviewedPrimaries["xiaomi-band-10-2025"];
const galleryPrimary = reviewedPrimaries["huawei-matepad-pro-max-yuexiang-2026"];
const galleryPrimaryPage = await getSourceSnapshot(galleryPrimary.sourceUrl, { offline: true });
assert.equal(readReviewedProductImage(galleryPrimaryPage.html, { id: galleryPrimary.targetIds[0] }, galleryPrimary).url, galleryPrimary.url);
assert.throws(() => readReviewedProductImage(galleryPrimaryPage.html, { id: galleryPrimary.targetIds[0] }, { ...galleryPrimary, galleryProductId: "2173980" }), /match|匹配/, "图库 SKU 必须与来源路径一致");
assert.throws(() => readReviewedProductImage(galleryPrimaryPage.html, { id: galleryPrimary.targetIds[0] }, { ...galleryPrimary, url: galleryPrimary.url.replace("ceo1pPPwB3wQ", "other") }), /资源/, "图库不得替换任意缩略图资源");
const bandResourcePage = await getSourceSnapshot(bandResource.sourceUrl, { offline: true });
const note9Source = JSON.parse(await fs.readFile("src/data/samsung-history-sources.json", "utf8")).phone.find(source => source.id === "samsung-galaxy-note9-2018");
const note9Image = note9Source.colorImageCandidates.find(candidate => candidate.imageRendition === "suning_large");
const note9Page = await getSourceSnapshot(note9Image.sourceUrl, { offline: true });
assert.equal(readReviewedProductImage(note9Page.html, { id: "samsung-galaxy-note9-2018" }, note9Image).url, note9Image.url);
assert.throws(() => readReviewedProductImage(note9Page.html, { id: "samsung-galaxy-note9-2018" }, { ...note9Image, sourceUrl: note9Image.sourceUrl.replace("10583204066", "10583204067") }));
assert.throws(() => readReviewedProductImage(note9Page.html, { id: "samsung-galaxy-note9-2018" }, { ...note9Image, color: "其他颜色" }));
assert.throws(() => readReviewedProductImage(note9Page.html.replaceAll("SM-N9600", "SM-N960F"), { id: "samsung-galaxy-note9-2018" }, note9Image));
assert.throws(() => readReviewedProductImage(note9Page.html, { id: "samsung-galaxy-note9-2018" }, { ...note9Image, url: note9Image.url + "?other" }));
for (const id of ["xiaomi-watch-color-2-2021", "redmi-watch-2-2021"]) {
  const collection = reviewedPrimaries[id];
  const page = await getSourceSnapshot(collection.sourceUrl, { offline: true });
  assert.equal(page.sha256, collection.sourceSnapshotHash);
  assert.equal(readReviewedProductImage(page.html, { id }, collection).url, collection.url);
  for (const field of ["sourceUrl", "resourceBaseUrl", "resourcePath", "anchor"])
    assert.throws(() => readReviewedProductImage(page.html, { id }, { ...collection, [field]: "wrong" }));
  assert.throws(() => readReviewedProductImage(page.html, { id }, { ...collection, caseColors: ["另购表带"] }));
  assert.throws(() => readReviewedProductImage(page.html, { id }, { ...collection, colorScope: "single_color" }));
}
assert.throws(() => readReviewedProductImage(bandResourcePage.html, { id: "xiaomi-band-10-2025" }, { ...bandResource, resourceBaseUrl: bandResource.resourceBaseUrl.replace("band-10", "band-11") }));
assert.throws(() => readReviewedProductImage(bandResourcePage.html, { id: "xiaomi-band-10-2025" }, { ...bandResource, resourcePath: "/images/755.png" }), /equal/, "不能把另购表带图换成标准机身图");
assert.equal(safeImageUrl(bandResource.url.replace("739.png", "755.png")), null);
const shopImage = "https://msecfs.opposhop.cn/commons-media-picture/GOODS/20260101/standard.png";
const shopProduct = { goodsSpuName: "OPPO Pad Air5", goodsSkuId: "12", name: "OPPO Pad Air5 银色 8GB+256GB WIFI版", url: shopImage,
  baseAttributes: [{}], attributes: { skuItems: [{ skuId: "12", key1: "银色", key3: "WIFI版" }, { skuId: "13", key1: "银色 柔光版", key3: "WIFI版" }] },
  attributesColorParams: [{ color: "银色", colorUrl: shopImage }, { color: "银色 柔光版", colorUrl: shopImage.replace("standard", "soft") }] };
const shopHtml = `window.__NUXT__=(function(a){return {data:[{resData:a}]}}(${JSON.stringify(shopProduct)}));</script>`;
const shopDevice = { brand: "OPPO", modelName: "OPPO Pad Air5 Wi-Fi版", variant: "wifi" };
assert.deepEqual(readOppoShopData(shopHtml), shopProduct);
const shopStringAssignment = shopHtml.replace("{return", '{a.topText="到手价￥4299";return');
assert.equal(readOppoShopData(shopStringAssignment).topText, "到手价￥4299");
assert.throws(() => readOppoShopData(shopStringAssignment.replace('"到手价￥4299"', "fetch()")), "来源赋值不得执行函数");
assert.throws(() => readOppoShopData(shopStringAssignment.replace(".topText=", ".__proto__=")), "来源赋值不得修改原型");
assert.deepEqual(readOfficialColorGallery(shopHtml, shopDevice, "https://www.opposhop.cn/cn/web/products/12.html").colors, [{ name: "银色", url: shopImage }]);
assert.throws(() => readOfficialColorGallery(shopHtml, { ...shopDevice, variant: "wifi-soft-light", modelName: "OPPO Pad Air5 Wi-Fi柔光版" }, "https://www.opposhop.cn/cn/web/products/12.html"), /版型/);
assert.throws(() => readOfficialColorGallery(shopHtml, shopDevice, "https://www.opposhop.cn/cn/web/products/13.html"));
assert.throws(() => readOfficialColorGallery(shopHtml.replace('"WIFI版"', '"SIM版"'), shopDevice, "https://www.opposhop.cn/cn/web/products/12.html"), /网络/);
{
  const id = "oppo-pad5-2025", review = colorViews[id];
  const device = database.devices.find(row => row.id === id);
  const page = await getSourceSnapshot(review.sourceUrl, { offline: true });
  const colors = readOfficialColorGallery(page.html, device, page.url).colors;
  assert.deepEqual(colors.map(row => row.name).sort(), ["星河银", "深空灰"].sort(), "标准 Pad 5 不混入柔光版专属紫色");
  assert.equal(review.originalImageEvidence.length, 2);
  for (const entry of review.originalImageEvidence) {
    assert.equal(review.colors[entry.color], entry.url);
    assert.ok(colors.some(color => color.name === entry.color && color.url === entry.url));
    assert.equal(entry.width, 1440); assert.equal(entry.height, 1440);
    assert.match(entry.sha256, /^[a-f\d]{64}$/); assert.equal(entry.visuallyVerified, true);
    assert.equal(imageGalleries[id].colors.find(color => color.name === entry.color)?.image?.url, entry.url);
  }
  assert.throws(() => readOfficialColorGallery(page.html, { ...device, modelName: "OPPO Pad 5 Pro" }, page.url), /准确产品/);
  assert.throws(() => readOfficialColorGallery(page.html, { ...device, variant: "soft-light", modelName: "OPPO Pad 5 柔光版" }, page.url), /版型/);
}
assert.throws(() => readOppoShopData(shopHtml.replace("resData:a", "resData:fetch()")), /标识符/, "不得执行来源脚本或函数调用");
for (const id of ["oppo-find-x8-ultra-2025", "oppo-find-x9-2025", "oppo-find-x9-pro-2025", "oppo-find-x10-2026", "oppo-find-x10-pro-max-2026", "oppo-find-x10-e-2026"]) {
  const review = reviewedColorViews[id];
  const device = database.devices.find(row => row.id === id);
  const page = await getSourceSnapshot(review.sourceUrl, { offline: true });
  assert.equal(page.sha256, review.sourceSnapshotHash);
  const palette = readOfficialColorGallery(page.html, device, page.url).colors;
  for (const [color, url] of Object.entries(review.colors)) {
    assert.ok(palette.some(entry => entry.name === color && entry.url === url), `${id}/${color}: 原页具名颜色与原图绑定`);
    assert.ok(!palette.some(entry => entry.name === color && entry.url === url + "wrong"));
    assert.equal(review.imageReviews.find(entry => entry.color === color).width, 1440);
  }
  assert.throws(() => readOfficialColorGallery(page.html, { ...device, modelName: device.modelName + " Pro Plus" }, page.url), /准确产品/);
  assert.throws(() => readOfficialColorGallery(page.html, device, page.url.replace(/\d+\.html$/, "999999.html")), /equal/);
}
for (const id of ["oppo-k15-pro-2026", "oppo-find-x9-ultra-2026"]) {
  const review = reviewedColorViews[id], device = database.devices.find(row => row.id === id);
  const page = await getSourceSnapshot(review.sourceUrl, { offline: true });
  const labels = await getSourceSnapshot(review.linkedFromUrl, { offline: true });
  assert.equal(page.sha256, review.sourceSnapshotHash);
  assert.equal(labels.sha256, review.labelSnapshotHash);
  assert.deepEqual(readReviewedOppoColorImages(page.html, labels.html, device, review).map(row => [row.name, row.url]), Object.entries(review.colors));
  const name = Object.keys(review.colors)[0];
  assert.throws(() => readReviewedOppoColorImages(page.html, labels.html, device, { ...review, sourceColorNames: { ...review.sourceColorNames, [name]: "其他颜色" } }));
  assert.throws(() => readReviewedOppoColorImages(page.html, labels.html.replaceAll(name, "其他颜色"), device, review));
  assert.throws(() => readReviewedOppoColorImages(page.html, labels.html, { ...device, modelName: device.modelName + " Pro Plus" }, review));
  assert.throws(() => readReviewedOppoColorImages(page.html, labels.html, device, { ...review, colors: { ...review.colors, [name]: review.colors[name] + "wrong" } }));
}
const xiaomi12sDevice = database.devices.find(row => row.id === "xiaomi-12s-2022");
const xiaomi12sSource = JSON.parse(await fs.readFile("src/data/xiaomi-phone-expansion-sources.json", "utf8")).phone.find(row => row.id === xiaomi12sDevice.id);
assert.deepEqual(xiaomi12sSource.colorImageCandidates.map(row => row.color).sort(), ["原野绿", "白色", "紫色", "黑色"].sort());
for (const candidate of xiaomi12sSource.colorImageCandidates) {
  const page = await getSourceSnapshot(candidate.sourceUrl, { offline: true });
  assert.equal(page.sha256, candidate.sourceSnapshotHash);
  assert.equal(readReviewedProductImage(page.html, xiaomi12sDevice, candidate).url, candidate.url);
  assert.equal(rejectedGalleries[xiaomi12sDevice.id].colors.find(row => row.name === candidate.color).image.url, candidate.url);
  assert.equal(candidate.imageReview.width, 800);
  assert.throws(() => readReviewedProductImage(page.html, xiaomi12sDevice, { ...candidate, color: "其他颜色" }));
  assert.throws(() => readReviewedProductImage(page.html, xiaomi12sDevice, { ...candidate, color: candidate.color === "紫色" ? "原野绿" : "紫色" }));
  assert.throws(() => readReviewedProductImage(page.html.replace('var goods={"goods_id":1087750', 'var goods={"goods_id":1087751'), xiaomi12sDevice, candidate));
  assert.throws(() => readReviewedProductImage(page.html, { ...xiaomi12sDevice, modelName: "小米 12S Pro" }, candidate));
  assert.throws(() => readReviewedProductImage(page.html, { ...xiaomi12sDevice, releaseYear: 2023 }, candidate));
  assert.throws(() => readReviewedProductImage(page.html, xiaomi12sDevice, { ...candidate, url: candidate.url + "?other=1" }));
  assert.equal(safeImageUrl(candidate.url + "?other=1"), null);
}
const iphone12Device = database.devices.find(row => row.id === "iphone-12");
const ipad7 = database.devices.find(row => row.id === "ipad-7th-2019");
const ipad7Source = JSON.parse(await fs.readFile("src/data/apple-sources.json", "utf8")).tablet.find(row => row.id === ipad7.id);
for (const candidate of ipad7Source.colorImageCandidates.filter(row => row.appleRefurbishedImage)) {
  const page = await getSourceSnapshot(candidate.sourceUrl, { offline: true });
  assert.equal(page.sha256, candidate.sourceSnapshotHash);
  assert.equal(readReviewedProductImage(page.html, ipad7, candidate).url, candidate.url);
  assert.equal(rejectedGalleries[ipad7.id].colors.find(row => row.name === candidate.color).image.url, candidate.url);
  assert.equal(candidate.imageReview.width, 2300);
  assert.equal(candidate.imageReview.height, 2300);
  assert.throws(() => readReviewedProductImage(page.html, { ...ipad7, releaseYear: 2020 }, candidate));
  assert.throws(() => readReviewedProductImage(page.html, { ...ipad7, specs: { ...ipad7.specs, chip: { value: "A12 仿生芯片" } } }, candidate));
  assert.throws(() => readReviewedProductImage(page.html, { ...ipad7, specs: { ...ipad7.specs, screenSize: { value: 9.7 } } }, candidate));
  assert.throws(() => readReviewedProductImage(page.html.replaceAll("Originally released September 2019", "Originally released September 2020"), ipad7, candidate));
  assert.throws(() => readReviewedProductImage(page.html, ipad7, { ...candidate, color: candidate.color === "银色" ? "金色" : "银色" }));
}
for (const id of ["ipad-pro-m4-11-2024", "ipad-pro-m4-13-2024"]) {
const pro13M4 = database.devices.find(row => row.id === id);
const pro13M4Source = JSON.parse(await fs.readFile("src/data/apple-sources.json", "utf8")).tablet.find(row => row.id === pro13M4.id);
for (const candidate of pro13M4Source.colorImageCandidates.filter(row => row.appleRefurbishedImage)) {
  const page = await getSourceSnapshot(candidate.sourceUrl, { offline: true });
  assert.equal(page.sha256, candidate.sourceSnapshotHash);
  assert.equal(readReviewedProductImage(page.html, pro13M4, candidate).url, candidate.url);
  assert.equal(rejectedGalleries[pro13M4.id].colors.find(row => row.name === candidate.color).image.url, candidate.url);
  assert.equal(candidate.imageReview.width, 4004);
  assert.equal(candidate.imageReview.height, 4004);
  assert.throws(() => readReviewedProductImage(page.html, { ...pro13M4, releaseYear: 2025 }, candidate));
  assert.throws(() => readReviewedProductImage(page.html, { ...pro13M4, modelName: id.includes("-11-") ? "13 英寸 iPad Pro (M4)" : "11 英寸 iPad Pro (M4)" }, candidate));
  assert.throws(() => readReviewedProductImage(page.html, { ...pro13M4, specs: { ...pro13M4.specs, chip: { value: "Apple M5 芯片" } } }, candidate));
  assert.throws(() => readReviewedProductImage(page.html.replaceAll("Originally released May 2024", "Originally released May 2025"), pro13M4, candidate));
  assert.throws(() => readReviewedProductImage(page.html, pro13M4, { ...candidate, color: candidate.color === "银色" ? "深空黑色" : "银色" }));
  assert.throws(() => readReviewedProductImage(page.html, pro13M4, { ...candidate, url: candidate.url + "&other=1" }));
  assert.throws(() => readReviewedProductImage(page.html, pro13M4, { ...candidate, sourceUrl: candidate.sourceUrl.replace(/(\/product\/)[^/]+/, "$1wrongsku") }));
}
}
const iphone12Source = JSON.parse(await fs.readFile("src/data/apple-sources.json", "utf8")).phone.find(row => row.id === iphone12Device.id);
const iphone12Red = iphone12Source.colorImageCandidates.find(row => row.chinaMobileOriginalBinding);
const iphone12Retail = await getSourceSnapshot(iphone12Red.sourceUrl, { offline: true });
assert.equal(iphone12Retail.sha256, iphone12Red.sourceSnapshotHash);
assert.equal(readReviewedProductImage(iphone12Retail.html, iphone12Device, iphone12Red).url, iphone12Red.url);
assert.equal(rejectedGalleries[iphone12Device.id].colors.find(row => row.name === "红色").image.url, iphone12Red.url);
assert.equal(iphone12Red.imageReview.width, 800);
assert.equal(iphone12Red.imageReview.height, 800);
assert.throws(() => readReviewedProductImage(iphone12Retail.html, iphone12Device, { ...iphone12Red, color: "紫色" }));
assert.throws(() => readReviewedProductImage(iphone12Retail.html, { ...iphone12Device, id: "iphone-12-mini" }, iphone12Red));
assert.throws(() => readReviewedProductImage(iphone12Retail.html, { ...iphone12Device, modelName: "iPhone 12 Pro" }, iphone12Red));
assert.throws(() => readReviewedProductImage(iphone12Retail.html, { ...iphone12Device, releaseYear: 2021 }, iphone12Red));
assert.throws(() => readReviewedProductImage(iphone12Retail.html, iphone12Device, { ...iphone12Red, sourceUrl: iphone12Red.sourceUrl.replace("1084643", "1084644") }));
assert.throws(() => readReviewedProductImage(iphone12Retail.html.replace('var goods={"goods_id":1084643', 'var goods={"goods_id":1084644'), iphone12Device, iphone12Red));
assert.throws(() => readReviewedProductImage(iphone12Retail.html, iphone12Device, { ...iphone12Red, url: iphone12Red.url + "?other=1" }));
assert.equal(safeImageUrl(iphone12Red.url + "?other=1"), null);
assert.equal(safeImageUrl(iphone12Red.url.replace("img1.shop.10086.cn", "evil.example")), null);
const pad2Device = database.devices.find(row => row.id === "oppo-pad2-2023");
const pad2Source = JSON.parse(await fs.readFile("src/data/oppo-five-year-sources.json", "utf8")).tablet.find(row => row.id === pad2Device.id);
const pad2Color = pad2Source.colorImageCandidates.find(row => row.dixintongOriginalBinding);
const pad2RetailPage = await getSourceSnapshot(pad2Color.sourceUrl, { offline: true });
assert.equal(pad2RetailPage.sha256, pad2Color.sourceSnapshotHash);
assert.equal(readReviewedProductImage(pad2RetailPage.html, pad2Device, pad2Color).url, pad2Color.url);
assert.equal(safeImageUrl(pad2Color.url), pad2Color.url);
assert.equal(pad2Color.imageReview.width, 760);
assert.throws(() => readReviewedProductImage(pad2RetailPage.html, pad2Device, { ...pad2Color, color: "光羽金" }));
assert.throws(() => readReviewedProductImage(pad2RetailPage.html, { ...pad2Device, modelName: "OPPO Pad 3" }, pad2Color));
assert.throws(() => readReviewedProductImage(pad2RetailPage.html, { ...pad2Device, releaseYear: 2024 }, pad2Color));
assert.throws(() => readReviewedProductImage(pad2RetailPage.html, pad2Device, { ...pad2Color, sourceUrl: pad2Color.sourceUrl.replace("19498", "19499") }));
assert.throws(() => readReviewedProductImage(pad2RetailPage.html.replace('data-colorid="星云灰"', 'data-colorid="光羽金"'), pad2Device, pad2Color));
assert.throws(() => readReviewedProductImage(pad2RetailPage.html, pad2Device, { ...pad2Color, url: pad2Color.url + "?other=1" }));
assert.equal(safeImageUrl(pad2Color.url.replace("456413", "456414")), null);
assert.equal(safeImageUrl(pad2Color.url + "?other=1"), null);
assert.equal(safeImageUrl(pad2Color.url.replace("img.dixintong.com", "img.dixintong.com.evil.example")), null);
for (const id of ["iphone-14", "iphone-13", "oppo-find-x7-ultra-2024", "samsung-galaxy-note9-2018"]) {
  const device = database.devices.find(row => row.id === id);
  const candidates = imageSources.devices.find(row => row.id === id).colorImageCandidates.filter(row => row.dixintongOriginalBinding);
  assert.equal(candidates.length, id === "iphone-14" ? 2 : id === "oppo-find-x7-ultra-2024" ? 3 : 1);
  for (const candidate of candidates) {
    const page = await getSourceSnapshot(candidate.sourceUrl, { offline: true });
    assert.equal(page.sha256, candidate.sourceSnapshotHash);
    assert.equal(readReviewedProductImage(page.html, device, candidate).url, candidate.url);
    const imageSize = candidate.color === "大漠银月" ? 1280 : 800;
    assert.equal(candidate.imageReview.width, imageSize);
    assert.equal(candidate.imageReview.height, imageSize);
    assert.equal(rejectedGalleries[id].colors.find(row => row.name === candidate.color).image.url, candidate.url);
    if (candidate.color === "紫色") {
      assert.equal(candidate.sourceSnapshotHash, "0ff1b8ac961f5f1e9edf1cc6cbb9f51ae700e690470c82e1f5fa92aacc30f2ba");
      assert.equal(candidate.imageReview.sha256, "59d84fa44205e891666c4c1fc1f7aff730e15e80aacddeae2c99082c4fbd55b8");
      assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, color: "红色" }));
    }
    if (id === "iphone-13") {
      assert.equal(candidate.sourceSnapshotHash, "6c960a8173092da30a5a6846a489775e8ea435f173868868ad2f9e71f1bc586b");
      assert.equal(candidate.imageReview.sha256, "0d165e1a2e5f89de805f89cdae16c7de4453c54b4ee7b09a32cf987274b88985");
      assert.throws(() => readReviewedProductImage(page.html, { ...device, modelName: "iPhone 13 mini" }, candidate));
      assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, color: "星光色" }));
    }
    if (id === "oppo-find-x7-ultra-2024") {
      assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, color: candidate.color === "松影墨韵" ? "海阔天空" : "松影墨韵" }));
      assert.throws(() => readReviewedProductImage(page.html, { ...device, modelName: "OPPO Find X7" }, candidate));
    }
    assert.throws(() => readReviewedProductImage(page.html, { ...device, id: device.id + "-other" }, candidate));
    assert.throws(() => readReviewedProductImage(page.html, { ...device, releaseYear: 2025 }, candidate));
    assert.throws(() => readReviewedProductImage(page.html, { ...device, modelName: device.modelName + " Plus" }, candidate));
    assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, color: "其他颜色" }));
    assert.throws(() => readReviewedProductImage(page.html, device, { ...candidate, sourceUrl: candidate.sourceUrl + "&other=1" }));
    assert.throws(() => readReviewedProductImage(page.html.replaceAll(`data-colorid="${candidate.color}"`, 'data-colorid="其他颜色"'), device, candidate));
    assert.throws(() => readReviewedProductImage(page.html.replaceAll(candidate.anchor, ""), device, candidate));
    assert.equal(safeImageUrl(candidate.url + "?other=1"), null);
    assert.equal(safeImageUrl(candidate.url.replace("img.dixintong.com", "img.dixintong.com.evil.example")), null);
  }
}
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
  assert.deepEqual(readZolColorImages(colorHtml, { productId: "100", includeAlternates: true }),
    [{ name: "黑色", url: colorImages[0].url }], "审核可接受同颜色其他外观图，但不能包含别的产品");
  const namedColorHtml = colorHtml.replace('"className":"外观图"', '"curClassId":4,"className":"黑色"');
  assert.equal(readZolColorImages(namedColorHtml, { productId: "100" })[0].url, undefined, "具名颜色旧图仅可人工审核后导入");
  assert.equal(readZolColorImages(namedColorHtml, { productId: "100", includeAlternates: true })[0].url, colorImages[0].url);
  assert.deepEqual(readZolColorImages(namedColorHtml.replace('"curClassId":4', '"curClassId":3'), { productId: "100", includeAlternates: true }), []);
  assert.deepEqual(readZolColorImages(namedColorHtml.replace('"className":"黑色"', '"className":"白色"'), { productId: "100", includeAlternates: true }), []);
  assert.equal(readZolGalleryImage(colorHtml, "100")?.url, "https://2d.zol-img.com.cn/product/270/321/phone.png");
  assert.equal(readZolGalleryImage(colorHtml, "102"), null, "缺主图不能借用相关型号的图库照片");
  assert.equal(readZolGalleryImage(colorHtml.replace('"className":"外观图"', '"className":"评测图解"'), "100"), null);
  assert.deepEqual(colorImages[1], { name: "白色" }, "缺图不取其他型号或其他颜色的图片");
  assert.throws(() => readZolColorImages(colorHtml, { productId: "102" }), /型号/);
  assert.throws(() => readZolColorImages(colorHtml, { seriesId: "88", productId: "102" }), /型号/, "有明确产品 ID 时不能降级借用系列图片");
  assert.deepEqual(readZolColorImages(colorHtml.replace('"sid":"99"', '"sid":"88"'), { seriesId: "88", productId: "100" })[1],
    { name: "白色" }, "同系列其他产品也不能填补当前产品的缺色");
  assert.equal(readZolColorImages(colorHtml.replace('"className":"外观图"', '"className":"评测图解"'), { seriesId: "88" })[0].url, undefined);
  assert.equal(safeImageUrl("javascript:alert(1)"), null);
  assert.equal(safeImageUrl("https://c1.mifile.cn/f/i/16/chain/shouhuan3//atlas-4.jpg"), "https://c1.mifile.cn/f/i/16/chain/shouhuan3//atlas-4.jpg");
  assert.equal(safeImageUrl("https://c1.mifile.cn/f/i/16/chain/shouhuan3//atlas-5.jpg"), null, "未审原图不能由同目录自动获得准入");
  assert.equal(safeImageUrl("https://www.apple.com.cn/newsroom/images/product/iphone/standard/Apple_new-iphone-se-white_04152020_big.jpg.large.jpg"), "https://www.apple.com.cn/newsroom/images/product/iphone/standard/Apple_new-iphone-se-white_04152020_big.jpg.large.jpg");
  assert.equal(safeImageUrl("https://www.apple.com.cn.evil.example/newsroom/images/product/iphone/standard/Apple_new-iphone-se-white_04152020_big.jpg.large.jpg"), null);
  assert.equal(safeImageUrl("https://evil.example.com/product/270/321/phone.png"), null);
  assert.ok(safeImageUrl("https://img14.360buyimg.com/pop/jfs/t1/312918/24/12652/58432/685d04abFc3fdda33/055b38b17c67be80.jpg"));
  assert.equal(safeImageUrl("https://img14.360buyimg.com.evil.example/pop/jfs/t1/own.jpg"), null);
  assert.equal(safeImageUrl("https://img14.360buyimg.com/login.html"), null);
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
  const bothViewsHtml = '<script>window.PRODUCT_SELECTION_BOOTSTRAP = { productSelectionData: '
    + JSON.stringify({ imageDictionary: {
      back: { alt: "黑色 iPhone 16，背面外观", sources: [{ srcSet: "https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/back" }] },
      both: { alt: "黑色 iPhone 16，正面与背面外观", sources: [{ srcSet: "https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/both" }] },
      other: { alt: "黑色 iPhone 16 Plus，正面与背面外观", sources: [{ srcSet: "https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/other" }] },
    } }) + ' }</script>';
  const bothColor = readAppleColorImages(bothViewsHtml, "iPhone 16", ["黑色"])[0];
  assert.ok(bothColor.url.endsWith("/both") && bothColor.viewScope === "front_back", "具体颜色优先本型号正反同框，不按字典顺序选单面图");
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
