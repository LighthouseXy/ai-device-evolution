import assert from "node:assert/strict";
import fs from "node:fs/promises";
import sharp from "sharp";
import { safeImageUrl } from "./lib/device-images.mjs";

// 复用 Next.js 已安装的 sharp；图片只在内存中解码，不另存素材、不刷新参数来源。
const value = (flag, fallback) => { const at = process.argv.indexOf(flag); return at < 0 ? fallback : process.argv[at + 1]; };
const output = value("--output", "/tmp/device-image-availability-2026-10-06.json");
const limit = Number(value("--limit", "30"));
assert.ok(output.startsWith("/tmp/") && output.endsWith(".json"));
assert.ok(Number.isInteger(limit) && limit > 0 && limit <= 5000);
const read = async (file) => JSON.parse(await fs.readFile(file, "utf8"));
const images = await read("src/data/device-images.json");
const galleries = await read("src/data/device-image-galleries.json");
const category = value("--category", "");
const ids = category ? new Set((await read("src/data/devices-db.json")).devices
  .filter(device => category.split(",").includes(device.category)).map(device => device.id)) : null;
const urls = new Map();
for (const image of [...Object.entries(images).filter(([id]) => !ids || ids.has(id)).map(([, image]) => image),
  ...Object.entries(galleries).filter(([id]) => !ids || ids.has(id)).flatMap(([, gallery]) => gallery.colors.map((color) => color.image).filter(Boolean))]) {
  assert.equal(safeImageUrl(image.url), image.url);
  const entry = urls.get(image.url) ?? { url: image.url, models: [] };
  if (!entry.models.includes(image.modelName)) entry.models.push(image.modelName);
  urls.set(image.url, entry);
}
let prior;
try { prior = await read(output); } catch (error) { if (error.code !== "ENOENT") throw error; }
const results = new Map((prior?.results ?? []).filter((entry) => urls.has(entry.url)).map((entry) => [entry.url, entry]));
const pending = [...urls.values()].filter((entry) => !results.has(entry.url)
  || (process.argv.includes("--retry-unverified") && results.get(entry.url).status === "unverified")).slice(0, limit);
for (let i = 0; i < pending.length; i += 3) {
  await Promise.all(pending.slice(i, i + 3).map(async (entry) => {
    const result = { ...entry, checkedAt: new Date().toISOString() };
    try {
      const response = await fetch(entry.url, { signal: AbortSignal.timeout(10000), redirect: "error" });
      result.httpStatus = response.status; result.contentType = response.headers.get("content-type");
      assert.ok(response.ok, `HTTP ${response.status}`);
      // 部分官网 AVIF 使用通用二进制 MIME；是否为图片仍由实际解码确认。
      assert.ok(/^(?:image\/|application\/octet-stream(?:;|$))/.test(result.contentType ?? ""), "响应不是图片或二进制素材");
      const chunks = [];
      let size = 0;
      for await (const chunk of response.body) {
        size += chunk.length; assert.ok(size <= 15 * 1024 * 1024, "图片超过15MiB验收上限"); chunks.push(chunk);
      }
      const bytes = Buffer.concat(chunks), image = sharp(bytes, { failOn: "error", limitInputPixels: 40_000_000 });
      const metadata = await image.metadata();
      await image.resize(1, 1).png().toBuffer();
      assert.ok(metadata.width > 0 && metadata.height > 0);
      Object.assign(result, { status: "decoded", bytes: size, width: metadata.width, height: metadata.height, format: metadata.format });
    } catch (error) { Object.assign(result, { status: "unverified", error: error.message }); }
    results.set(entry.url, result);
  }));
  if (i % 30 === 0) console.log(`图片实际加载 ${Math.min(i + 3, pending.length)}/${pending.length}`);
}
const rows = [...results.values()];
const summary = { totalUniqueUrls: urls.size, checked: rows.length, decoded: rows.filter((row) => row.status === "decoded").length,
  unverified: rows.filter((row) => row.status !== "decoded").length, unchecked: urls.size - rows.length };
await fs.writeFile(output, `${JSON.stringify({ asOf: new Date().toISOString(), summary,
  caveat: "HTTP与解码通过不等于型号/配色人工核实，也不等于获得图片使用许可；未验证和超时不能计为可用。", results: rows }, null, 2)}\n`);
console.log(JSON.stringify({ output, ...summary }));
