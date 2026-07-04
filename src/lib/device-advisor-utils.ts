export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeText(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  const text = value.trim().replace(/\s+/g, " ");
  return text.length > 0 ? text : fallback;
}

export function normalizeNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function collectUnique(target: string[], values: string[]) {
  for (const value of values) {
    const text = normalizeText(value);
    if (text && !target.includes(text)) target.push(text);
  }
}

export function formatNumber(value: number, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits }).format(value);
}
