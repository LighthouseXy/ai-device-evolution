const zhNumberFormatterCache = new Map<string, Intl.NumberFormat>();

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
