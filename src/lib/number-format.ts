const zhNumberFormatterCache = new Map<string, Intl.NumberFormat>();

const currencyFormatter = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  maximumFractionDigits: 0,
});
const compactCurrencyFormatter = new Intl.NumberFormat("zh-CN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export const formatCurrency = (value: number) => currencyFormatter.format(value);
export const formatCompactCurrency = (value: number) => compactCurrencyFormatter.format(value);
export const formatMaybeCurrency = (value?: number) =>
  typeof value === "number" ? formatCurrency(value) : "待补充";

export function parseDisplayNumber(value: string) {
  return Number(value.replaceAll(",", "").match(/-?\d+(?:\.\d+)?/)?.[0] ?? NaN);
}

function getZhNumberFormatter(fractionDigits: number) {
  const key = String(fractionDigits);
  const cached = zhNumberFormatterCache.get(key);
  if (cached) return cached;

  const formatter = new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  zhNumberFormatterCache.set(key, formatter);
  return formatter;
}

export function formatZhNumber(value: number, fractionDigits = 1) {
  return getZhNumberFormatter(fractionDigits).format(value);
}

export function formatSignedZhNumber(value: number, fractionDigits = 1) {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatZhNumber(Math.abs(value), fractionDigits)}`;
}

export function formatSignedZhCurrency(value: number, fractionDigits = 0) {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}¥${formatZhNumber(Math.abs(value), fractionDigits)}`;
}
