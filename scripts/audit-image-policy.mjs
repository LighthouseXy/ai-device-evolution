import fs from "node:fs/promises";
import { loadTsModule } from "./lib/load-ts-module.mjs";
import { getSourceSnapshot } from "./lib/source-snapshot.mjs";
import { readReviewedZolColorImages, readZolColorImages } from "./lib/device-images.mjs";

// 只检查证据登记，不把 HTTP/解码成功当作型号、配色或视角人工验收。
const { catalogDevicesFlat } = loadTsModule("@/lib/devices-db");
const { getDeviceImage, getDeviceImageGallery } = loadTsModule("@/lib/device-images");
const fields = {
  phone: ["chip", "screenSize", "resolution", "batteryCapacity", "mainCamera"],
  tablet: ["chip", "screenSize", "resolution", "storage"],
  laptop: ["chip", "screenSize", "resolution", "memory", "storage"],
  watch: ["screenSize", "batteryLife", "waterResistance"],
  band: ["screenSize", "batteryLife", "waterResistance"],
};
const rows = catalogDevicesFlat.map(device => {
  const primary = getDeviceImage(device.id);
  const colors = getDeviceImageGallery(device.id)?.colors ?? [];
  return {
    id: device.id, model: device.model, category: device.category,
    defaultCollection: primary?.colorScope === "all_colors" ? "recorded" : primary ? "unverified" : "missing",
    colors: colors.map(color => ({ name: color.name,
      frontBack: color.image?.viewScope === "front_back" ? "recorded" : color.image ? "unverified" : "missing" })),
    fieldsToReview: (fields[device.category] ?? []).filter(key => device.specs[key] == null),
  };
});
const summary = {
  models: rows.length,
  defaultCollectionsRecorded: rows.filter(row => row.defaultCollection === "recorded").length,
  missingDefaultImages: rows.filter(row => row.defaultCollection === "missing").length,
  colors: rows.reduce((sum, row) => sum + row.colors.length, 0),
  frontBackRecorded: rows.reduce((sum, row) => sum + row.colors.filter(color => color.frontBack === "recorded").length, 0),
  missingColorImages: rows.reduce((sum, row) => sum + row.colors.filter(color => color.frontBack === "missing").length, 0),
};
const stored = JSON.parse(await fs.readFile("src/data/device-image-galleries.json", "utf8"));
const reviewed = JSON.parse(await fs.readFile("scripts/fixtures/reviewed-color-views.json", "utf8"));
const bindingIssues = [], replay = new Map();
for (const [id, gallery] of Object.entries(stored)) {
  for (const color of gallery.colors) {
    const image = color.image;
    const productId = image?.sourceUrl.match(/^https:\/\/detail\.zol\.com\.cn\/picture_index_\d+\/index\d+_\d+_p(\d+)\.shtml$/)?.[1];
    if (!productId) continue;
    try {
      if (!replay.has(image.sourceUrl)) replay.set(image.sourceUrl, getSourceSnapshot(image.sourceUrl, { offline: true }));
      const page = await replay.get(image.sourceUrl);
      if (page.sha256 !== image.sourceSnapshotHash) throw new Error("stored_snapshot_not_current");
      const review = reviewed[id];
      const images = review?.zolBindings && review.sourceUrl === image.sourceUrl && review.colors[color.name]
        ? readReviewedZolColorImages(page.html, review)
        : readZolColorImages(page.html, { productId, includeAlternates: true });
      if (!images.some(photo => photo.name === color.name && photo.url === image.url)) {
        bindingIssues.push({ id, color: color.name, status: "requires_review", url: image.url, sourceUrl: image.sourceUrl });
      }
    } catch (error) {
      // 未缓存、历史快照与具体SKU缺失不能自动等同于错图，也不删除既有用户数据。
      bindingIssues.push({ id, color: color.name, status: "unverified", reason: error.message });
    }
  }
}
summary.colorBindingRequiresReview = bindingIssues.filter(issue => issue.status === "requires_review").length;
summary.colorBindingUnverified = bindingIssues.filter(issue => issue.status === "unverified").length;
const output = "/tmp/device-image-policy-audit.json";
await fs.writeFile(output, `${JSON.stringify({ summary,
  caveat: "recorded 表示已有视角证据；unverified 不代表图片一定错误。字段缺口仅待人工判断适用性，不自动填值。", rows, bindingIssues }, null, 2)}\n`);
console.log(JSON.stringify({ output, ...summary }));
