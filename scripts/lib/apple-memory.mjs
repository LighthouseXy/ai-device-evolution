// Apple 把同一组容量的芯片限制放在括号末尾，不能逐个容量截断上下文。
export function parseAppleMemory(blocks, tier) {
  const values = new Set();
  const evidence = [];
  let activeTier;
  for (const block of blocks) {
    const heading = block.match(/^(?:Apple\s+)?M\d+\s+(Pro|Max)\s+芯片$/i);
    if (heading) activeTier = heading[1].toLowerCase();
    if (/内存带宽/.test(block)) continue;
    for (const match of block.matchAll(/((?:\d+(?:\.\d+)?GB(?:\s*(?:、|,|，|或)\s*)?)+)\s*(?:[（(]([^）)]*)[）)])?/g)) {
      const qualifiers = [...(match[2] ?? "").matchAll(/M\d+\s+(Pro|Max)/gi)].map((item) => item[1].toLowerCase());
      if (["pro", "max"].includes(tier)
        && (qualifiers.length ? !qualifiers.includes(tier) : activeTier && activeTier !== tier)) continue;
      for (const capacity of match[1].matchAll(/\d+(?:\.\d+)?GB/g)) values.add(capacity[0]);
      evidence.push(block);
    }
  }
  return {
    value: [...values].sort((a, b) => parseFloat(a) - parseFloat(b)).join(" / ") || null,
    raw: [...new Set(evidence)].join("；"),
  };
}
