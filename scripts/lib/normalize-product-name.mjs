export function normalizeProductName(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}
