import { getSourceSnapshot } from "./source-snapshot.mjs";

export async function verifyCameraScore(model, score, sourceUrl, options = {}) {
  const snapshot = await getSourceSnapshot(sourceUrl, {
    ...options,
    validate(html) {
      const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
      if (!title.toLowerCase().includes(`${model} Camera test`.toLowerCase())) throw new Error(`${model}: DXOMARK 型号或测试类型不一致`);
      // 页面还包含大量对照机型的分数，只读取该测试文章自己的总分徽章。
      const badges = [...html.matchAll(/class="scoreBadgeValue">(\d+)</g)].map((match) => Number(match[1]));
      if (!badges.length || badges.some((value) => value !== score)) throw new Error(`${model}: DXOMARK 总分变化或缺失，需人工复核`);
    },
  });
  const publishedAt = snapshot.html.match(/"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})T/)?.[1];
  if (!publishedAt) throw new Error(`${model}: 缺少测试文章发布日期`);
  return { rawText: String(score), publishedAt, verifiedAt: snapshot.fetchedAt.slice(0, 10),
    fetchedAt: snapshot.fetchedAt, sourceSnapshotHash: snapshot.sha256,
    notes: "相机综合测试分数，不等于单独拍照分；协议标签为大版本，具体小版本、测试固件及与国行配置的一致性未核验。" };
}
