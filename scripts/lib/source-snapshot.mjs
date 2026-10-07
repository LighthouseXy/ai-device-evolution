import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fetchWithRetry, readHtmlResponse } from "./fetch-with-retry.mjs";

const hash = (text) => createHash("sha256").update(text).digest("hex");

export async function getSourceSnapshot(url, { directory = ".source-cache", offline = false, refresh = false, fetcher = fetchWithRetry, validate = () => {} } = {}) {
  if (offline && refresh) throw new Error("--offline 与 --refresh 不能同时使用");
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error("来源快照只接受 HTTPS");
  const indexPath = path.join(directory, `${hash(url)}.json`);
  if (!refresh) {
    try {
      const index = JSON.parse(await fs.readFile(indexPath, "utf8"));
      if (index.url !== url || !/^[a-f0-9]{64}$/.test(index.sha256)) throw new Error("快照索引无效");
      const html = await fs.readFile(path.join(directory, `${index.sha256}.html`), "utf8");
      if (hash(html) !== index.sha256) throw new Error("快照内容哈希不一致");
      await validate(html);
      return { ...index, html, cacheHit: true };
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      if (offline) throw new Error(`离线快照缺失: ${url}`);
    }
  }
  const response = await fetcher(url, { attempts: 1, headers: { "user-agent": "DeviceScope source snapshot" } });
  if (!response.ok) throw new Error(`${response.status} ${url}（保留旧快照）`);
  const html = await readHtmlResponse(response);
  if (!html.trim()) throw new Error(`${url}: 空页面，不覆盖旧快照`);
  // HTTP 200 也可能是目录页或验证页；调用方先检查页面身份和必要字段。
  await validate(html);
  const index = { url, fetchedAt: new Date().toISOString(), sha256: hash(html) };
  await fs.mkdir(directory, { recursive: true });
  // 内容寻址保留历史原文；只有下载完整后才切换 URL 的最新索引。
  await fs.writeFile(path.join(directory, `${index.sha256}.html`), html);
  const temporary = `${indexPath}.${process.pid}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(index, null, 2)}\n`);
  await fs.rename(temporary, indexPath);
  return { ...index, html, cacheHit: false };
}
