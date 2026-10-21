import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const name = ".demo-app";
if (process.argv.length !== 2) throw new Error("Usage: node scripts/export-demo.mjs");
const dest = path.join(root, name);
if (fs.existsSync(dest)) throw new Error("Destination exists; refusing to overwrite");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (!packageJson.dependencies?.next || !fs.existsSync(path.join(root, "LICENSE"))) throw new Error("Expected this application's licensed repository root");
const hashes = [];
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const write = (relative, content) => {
  const target = path.join(dest, relative); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, content);
};
const copy = relative => {
  const source = path.join(root, relative);
  if (fs.lstatSync(source).isSymbolicLink()) throw new Error(`Refusing symlink: ${relative}`);
  const data = fs.readFileSync(source); write(relative, data);
  hashes.push({ path: relative, sourceSha256: sha(data), exportedSha256: sha(data) });
};
const copySource = relative => {
  for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
    if (entry.name === "data" && relative === "src") continue;
    const child = `${relative}/${entry.name}`;
    if (entry.isSymbolicLink()) throw new Error(`Refusing symlink: ${child}`);
    if (entry.isDirectory()) copySource(child);
    else if (/\.(?:ts|tsx|css)$/.test(entry.name) || child === "src/app/icon.svg") copy(child);
  }
};
copySource("src");
for (const relative of ["package.json", "package-lock.json", "next.config.ts", "tsconfig.json", "postcss.config.mjs", "eslint.config.mjs", "LICENSE", "scripts/lib/load-ts-module.mjs", "scripts/lib/price-date.mjs", "scripts/lib/validate-device-records.mjs", "scripts/validate-data.mjs", "scripts/prepare-demo-data.mjs", "scripts/run-demo.mjs", "scripts/demo-data-regression.mjs", "scripts/demo-http-regression.mjs", "examples/demo-devices.json", "examples/demo-prices.json"]) copy(relative);
// Apply compatibility edits only inside the new demo copy; production source is untouched.
const edit = (relative, transform) => {
  const file = path.join(dest, relative);
  if (!fs.existsSync(file)) return;
  const before = fs.readFileSync(file, "utf8"), after = transform(before);
  if (before !== after) { write(relative, after); hashes.find(row => row.path === relative).exportedSha256 = sha(after); }
};
edit("src/app/globals.css", s => s.replace(/^@import url\("https:\/\/fonts\.googleapis\.com\/[^\n]+\n/, ""));
edit("src/lib/catalog-order.ts", s => s.replace('export const brandOrder = [', 'export const brandOrder = ["Example", "Demo", ').replace('export const brandLabels: Record<string, string> = {', 'export const brandLabels: Record<string, string> = {\n  Example: "Example（合成演示）", Demo: "Demo（合成演示）",'));
for (const [file, variable] of [["src/app/compare/page.tsx", "seriesOptions"], ["src/app/trends/page.tsx", "catalogGroups"]]) edit(file, s => s.replace('?.brand ?? "Apple"', `?.brand ?? ${variable}[0]?.brand ?? "Apple"`));
edit("src/app/page.tsx", s => s.replace('基于真实本地数据库，串联设备库、产品对比、趋势观察和 AI 顾问；现已接入苹果、小米、红米、三星、华为、OPPO、vivo 与荣耀中国大陆设备数据。', '此发行演示使用自建 Example / Demo 合成设备、参数和报价，串联设备库、对比、趋势与离线规则顾问；不代表真实产品或线上数据。').replaceAll('真实样本', '合成样本').replaceAll('真实设备', '演示设备'));
edit("src/lib/device-display-images.ts", s => s.replace('references.filter(', '(references as { modelId: string; scope: string; image: DeviceProductImage }[]).filter('));
edit("src/lib/device-image-byte-cache.ts", s => s.replace('cached.map(', '(cached as { modelName: string; sourceUrl: string; originalUrl: string; localUrl: string }[]).map('));
edit("next.config.ts", s => s.replace('modelIdentity.groups.flatMap(', '(modelIdentity.groups as { id: string; editions: Record<string, string> }[]).flatMap('));
edit("src/app/icon.svg", () => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#163d32"/><rect x="20" y="10" width="24" height="44" rx="4" fill="none" stroke="#fff" stroke-width="3"/><circle cx="32" cy="47" r="2" fill="#fff"/></svg>\n');
packageJson.scripts = { "build:data": "node scripts/prepare-demo-data.mjs", predev: "npm run build:data", dev: "node scripts/run-demo.mjs dev --webpack", prebuild: "npm run build:data", build: "node scripts/run-demo.mjs build --webpack", start: "node scripts/run-demo.mjs start", typecheck: "tsc --noEmit --incremental false", lint: "eslint", "validate:data": "node scripts/validate-data.mjs", "test:data": "node scripts/demo-data-regression.mjs", "test:http": "node scripts/demo-http-regression.mjs" };
write("package.json", JSON.stringify(packageJson, null, 2) + "\n");
hashes.find(row => row.path === "package.json").exportedSha256 = sha(fs.readFileSync(path.join(dest, "package.json")));
write(".sample-distribution.json", JSON.stringify({ kind: "devicescope-full-app-synthetic-demo", productionDataIncluded: false, originalCodeAndFixturesLicense: "MIT" }, null, 2) + "\n");
write(".gitignore", "node_modules/\n.next/\n.env*\n!.env.example\n.DS_Store\ntsconfig.tsbuildinfo\n");
write(".env.example", "# No credentials are needed by the synthetic demo.\nOPENAI_API_KEY=\nDEEPSEEK_API_KEY=\n");
write("README.md", "# DeviceScope synthetic application demo\n\nThis is the original app with 30 fictional Example/Demo records across five categories. Prices/specifications are invented; it is different from production data. The UI remains primarily Chinese. The home-series known issue remains deferred.\n\nWith Node 24 and npm 11: `npm ci --ignore-scripts --no-audit --no-fund`, `npm run build:data`, `npm run validate:data`, `npm run test:data`, `npm run typecheck`, `npm run lint`, `npm run build`, then `npm run test:http` or `npm start -- --hostname 127.0.0.1`. A populated cache supports `npm ci --offline`; an empty offline cache cannot install dependencies.\n\nOnly original software, documentation, fictional fixtures and the generated geometric icon are MIT. Dependencies retain upstream licenses, including their installed LICENSE/NOTICE files; package-lock.json records declarations. No production JSON, product media, source extracts or screenshots were copied. Normal demo launch scripts clear model keys, reject real environment files and use rules fallback. No API credentials are needed. SOURCE_MANIFEST.json records copied-source hashes and export-only changes.\n");
write("SOURCE_MANIFEST.json", JSON.stringify(hashes, null, 2) + "\n");
const result = spawnSync(process.execPath, ["scripts/prepare-demo-data.mjs"], { cwd: dest, stdio: "inherit" });
if (result.error) throw result.error;
if (result.status !== 0) throw new Error("Demo preparation failed; inspect the new directory before retrying");
console.log(`Exported full application to ${name}; production data and scripts unchanged`);
