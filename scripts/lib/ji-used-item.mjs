export function selectedJiUsedItem(text, url) {
  if (new URL(url).hostname !== "m2.9ji.com") return null;
  const priceGrade = text.match(/¥\s*([0-9]{3,6})(?:\s*已优惠\s*\d+)?\s*(\d{1,2})\s*成新/);
  if (!priceGrade) return null;
  const ends = ["AI点评", "降价通知"].map((marker) => text.indexOf(marker, priceGrade.index)).filter((index) => index >= 0);
  if (!ends.length) return null;
  const end = Math.min(...ends);
  const productBlock = text.slice(priceGrade.index, end);
  const identity = productBlock.match(/((?:Apple|苹果|华为|HUAWEI|小米|Xiaomi|OPPO|vivo|荣耀|HONOR|三星|Samsung)\s*.*? 国行)(.*?)\s+(?:机况|参数)/i)
    ?? productBlock.match(/((?:Apple|苹果|华为|HUAWEI|小米|Xiaomi|OPPO|vivo|荣耀|HONOR|三星|Samsung)\s*.*?)\s+(?:机况|参数)/i);
  const reportStart = text.indexOf("验机报告 先验机再付款", priceGrade.index);
  const reportEnd = text.indexOf("二手良品需人工一机一验", reportStart);
  const reportBlock = reportStart >= 0 ? text.slice(reportStart, reportEnd >= 0 ? reportEnd : undefined) : "";
  const batteryHealth = reportBlock.match(/(\d{1,3}%(?:\s*-\s*\d{1,3}%)?(?:以上|以下)?)\s*电池寿命/)?.[1];
  return {
    price: Number(priceGrade[1]), grade: `${priceGrade[2]}成新`,
    product: identity?.[1] ?? null,
    purchaseNotice: identity?.[2]?.trim() || null,
    inventoryId: reportBlock.match(/库存编号：?\s*(\d+)/)?.[1] ?? null,
    batteryHealth: batteryHealth?.replaceAll(" ", "") ?? null,
    repairHistory: reportBlock.match(/(\S+)\s+维修历史/)?.[1] ?? null,
    modelNumber: reportBlock.match(/(A\d{4})\s*型号号码/)?.[1] ?? null,
    mainland: /国行\s*版本/.test(reportBlock),
    inspectionSummary: reportBlock.match(/经检测：(.*?)详细检测结果/)?.[1]?.trim() ?? null,
    functionalInspection: reportBlock.match(/功能检测\s*(.*?)(?:附件清单|$)/)?.[1]?.trim() || null,
    soldOut: /已售罄/.test(text.slice(reportStart >= 0 ? reportStart : priceGrade.index)),
    rawText: productBlock.trim(),
  };
}
