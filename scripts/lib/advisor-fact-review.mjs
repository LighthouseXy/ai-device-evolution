// Triage only: absence of flags never certifies natural-language accuracy.
export function reviewAdvisorFacts(data, modelInput) {
  if (data?.source !== "ai") return { status: "not_applicable", flags: [] };
  const quotes = (data.devices ?? []).flatMap((device) => {
    const candidate = modelInput.candidateShortlist.find((item) => item.deviceId === device.deviceId);
    return candidate?.quotes.filter((quote) => quote.quoteId === device.quoteId) ?? [];
  });
  const allowedAmounts = new Set([
    modelInput.userProfile.budget?.min, modelInput.userProfile.budget?.max,
    ...quotes.map((quote) => quote.referencePrice),
  ].filter((amount) => typeof amount === "number"));
  const text = (data.answer ?? "").normalize("NFKC");
  const flags = new Set();
  for (const match of text.matchAll(/[¥￥]\s*(\d[\d,]*(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)\s*元/g)) {
    const amount = Number((match[1] ?? match[2]).replaceAll(",", ""));
    if (!allowedAmounts.has(amount)) flags.add(`unverified_amount:${amount}`);
  }
  const capacity = (value, unit) => Number(value) * (unit.toUpperCase().startsWith("T") ? 1024 : 1);
  const pairs = quotes.map((quote) => [quote.facts.memory, quote.facts.storage].map((value) => {
    const match = String(value ?? "").match(/^(\d+(?:\.\d+)?)\s*(GB|TB)$/i);
    return match ? capacity(match[1], match[2]) : null;
  }).join("+"));
  for (const match of text.matchAll(/(\d+)\s*(GB|G)\s*(?:运行内存|运存|内存)?\s*[+/]\s*(\d+(?:\.\d+)?)\s*(TB|GB|T|G)/gi)) {
    const pair = `${capacity(match[1], match[2])}+${capacity(match[3], match[4])}`;
    if (!pairs.includes(pair)) flags.add(`unverified_configuration:${pair}`);
  }
  return { status: "pending_manual_review", flags: [...flags] };
}
