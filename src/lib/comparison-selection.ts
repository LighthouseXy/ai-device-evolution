export const MAX_COMPARISON_DEVICES = 10;
type Query = Record<string, string | string[] | undefined>;

export function normalizeComparisonCount(value: string, fallback = 2) {
  const count = /^\d+$/.test(value) ? Number(value) : NaN;
  return Number.isInteger(count) && count >= 2 && count <= MAX_COMPARISON_DEVICES ? count : fallback;
}

export function getComparisonCount(query: Query) {
  // 兼容旧的三栏链接；新页面默认两栏，不再预留一个空设备栏。
  const legacyCount = Array.from({ length: MAX_COMPARISON_DEVICES }, (_, index) => index + 1)
    .filter(index => `device${index}` in query).at(-1) ?? 2;
  return normalizeComparisonCount(typeof query.count === "string" ? query.count : "", Math.max(2, legacyCount));
}

export function resizeComparisonSelection(ids: string[], count: number) {
  const size = normalizeComparisonCount(String(count));
  return Array.from({ length: size }, (_, index) => ids[index] ?? "");
}
