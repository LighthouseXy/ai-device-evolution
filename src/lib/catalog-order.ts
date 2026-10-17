import type { DeviceCategory } from "@/lib/device-categories";

export const brandOrder = ["Apple", "Xiaomi", "Redmi", "Samsung", "Huawei", "OPPO", "vivo", "HONOR", "Google", "Other"];
export const brandLabels: Record<string, string> = {
  Apple: "苹果", Xiaomi: "小米", Redmi: "红米", Samsung: "三星", Huawei: "华为", OPPO: "OPPO", vivo: "vivo", HONOR: "荣耀",
  Google: "Google", Sony: "索尼", Meizu: "魅族", ZUK: "ZUK", Smartisan: "锤子", Nut: "坚果", Other: "其他",
};
// “其他”只是筛选组，设备、来源和严格对比组仍保留真实品牌。
export function getCatalogBrandFilter(brand: string) {
  return ["Sony", "Meizu", "ZUK", "Smartisan", "Nut"].includes(brand) ? "Other" : brand;
}
export function matchesCatalogBrand(brand: string, filter: string) {
  return filter === "all" || brand === filter || getCatalogBrandFilter(brand) === filter;
}
// 历史来源按小米集团归档；运行时按产品品牌展示，不改写来源或设备 ID。
export function getCatalogBrand(device: { brand: string; family: string }) {
  return device.brand === "Xiaomi" && /^REDMI\b/i.test(device.family) ? "Redmi" : device.brand;
}

// 浏览时合并尺寸、Pro/Ultra、网络制式和特别版；比较仍使用原始严格分组。
const catalogRoots: Record<string, [RegExp, string, string][]> = {
  Google: [
    [/^Pixel$/i, "pixel", "Pixel 系列"],
    [/^Pixel Fold$/i, "pixel-fold", "Pixel Fold 系列"],
    [/^Pixel Tablet$/i, "pixel-tablet", "Pixel Tablet 系列"],
    [/^Pixel Slate$/i, "pixel-slate", "Pixel Slate 系列"],
    [/^Pixelbook(?: Go)?$/i, "pixelbook", "Pixelbook 系列"],
  ],
  Sony: [[/^Xperia/i, "xperia", "索尼 Xperia 系列"]],
  Meizu: [[/^魅族$/i, "number", "魅族数字系列"], [/^魅蓝/i, "meilan", "魅蓝系列"]],
  Smartisan: [[/^坚果/i, "nut", "坚果系列"], [/^锤子/i, "smartisan", "锤子系列"]],
  Nut: [[/^坚果/i, "nut", "坚果系列"]],
  Apple: [
    [/^iPhone$/i, "iphone", "iPhone 系列"],
    [/^iPad Pro$/i, "ipad-pro", "iPad Pro 系列"],
    [/^iPad Air$/i, "ipad-air", "iPad Air 系列"],
    [/^iPad mini$/i, "ipad-mini", "iPad mini 系列"],
    [/^iPad$/i, "ipad", "iPad 系列"],
    [/^MacBook Pro$/i, "macbook-pro", "MacBook Pro 系列"],
    [/^MacBook Air$/i, "macbook-air", "MacBook Air 系列"],
    [/^MacBook Neo$/i, "macbook-neo", "MacBook Neo 系列"],
    [/^MacBook$/i, "macbook", "MacBook 系列"],
  ],
  Samsung: [
    [/^Samsung Galaxy S(?:\s|$)/i, "galaxy-s", "Galaxy S 系列"],
    [/^Samsung Galaxy Z(?:\s|$)/i, "galaxy-z", "Galaxy Z 系列"],
    [/^Samsung W(?:\s|$)/i, "w", "三星 W 系列"],
    [/^Samsung Galaxy Note(?:\s|$)/i, "galaxy-note", "Galaxy Note 系列"],
    [/^Samsung Galaxy A(?:\d|\s|$)/i, "galaxy-a", "Galaxy A 系列"],
    [/^Samsung Galaxy F(?:\s|$)/i, "galaxy-f", "Galaxy F 系列"],
    [/^Samsung Galaxy C(?:\s|$)/i, "galaxy-c", "Galaxy C 系列"],
    [/^Samsung Galaxy J(?:\s|$)/i, "galaxy-j", "Galaxy J 系列"],
    [/^Samsung 领世旗舰(?:\s|$)/, "leadership", "领世旗舰系列"],
    [/^Samsung Galaxy Tab S(?:\s|$)/i, "galaxy-tab-s", "Galaxy Tab S 系列"],
    [/^Samsung Galaxy Tab A(?:\s|$)/i, "galaxy-tab-a", "Galaxy Tab A 系列"],
  ],
  Huawei: [
    [/^HUAWEI Mate X(?:s|t)?(?:\s|$)/i, "mate-x", "Mate X 系列"],
    [/^HUAWEI Mate(?:\s|$)/i, "mate", "Mate 系列"],
    [/^HUAWEI Pura X(?:\s|$)/i, "pura-x", "Pura X 系列"],
    [/^HUAWEI (?:Pura|P\s*\/\s*Pura)(?:\s|$)/i, "pura", "P / Pura 系列"],
    [/^HUAWEI Pocket(?:\s|$)/i, "pocket", "Pocket 系列"],
    [/^HUAWEI nova(?:\s|$)/i, "nova", "nova 系列"],
    [/^HUAWEI Enjoy(?:\s|$)/i, "enjoy", "畅享系列"],
    [/^HUAWEI MatePad Pro(?:\s|$)/i, "matepad-pro", "MatePad Pro 系列"],
    [/^HUAWEI MatePad Air(?:\s|$)/i, "matepad-air", "MatePad Air 系列"],
    [/^HUAWEI MatePad Mini(?:\s|$)/i, "matepad-mini", "MatePad mini 系列"],
    [/^HUAWEI MatePad SE(?:\s|$)/i, "matepad-se", "MatePad SE 系列"],
    [/^HUAWEI MatePad(?:\s|$)/i, "matepad", "MatePad 系列"],
    [/^HUAWEI MateBook X(?:\s|$)/i, "matebook-x", "MateBook X 系列"],
    [/^HUAWEI MateBook D(?:\d|\s|$)/i, "matebook-d", "MateBook D 系列"],
    [/^HUAWEI MateBook E(?:\s|$)/i, "matebook-e", "MateBook E 系列"],
    [/^HUAWEI MateBook(?:\s|$)/i, "matebook", "MateBook 系列"],
  ],
  OPPO: [
    [/^Find X(?:\s|$)/i, "find-x", "Find X 系列"],
    [/^Find N(?:\s|$)/i, "find-n", "Find N 系列"],
    [/^Reno(?:\s|$)/i, "reno", "Reno 系列"],
    [/^K(?:\s|$)/i, "k", "OPPO K 系列"],
    [/^OPPO Pad(?:\s|$)/i, "pad", "OPPO Pad 系列"],
  ],
  vivo: [
    [/^vivo X(?:\s|$)/i, "x", "vivo X 系列"],
    [/^iQOO Neo(?:\s|$)/i, "iqoo-neo", "iQOO Neo 系列"],
    [/^iQOO$/i, "iqoo", "iQOO 数字系列"],
    [/^vivo S(?:\s|$)/i, "s", "vivo S 系列"],
    [/^vivo Y(?:\s|$)/i, "y", "vivo Y 系列"],
    [/^vivo Pad(?:\s|$)/i, "pad", "vivo Pad 系列"],
    [/^iQOO Pad(?:\s|$)/i, "iqoo-pad", "iQOO Pad 系列"],
  ],
  HONOR: [
    [/^荣耀 Magic Vs?(?:\s|$)/i, "magic-v", "Magic V 系列"],
    [/^荣耀 Magic(?:\s|$)/i, "magic", "Magic 系列"],
    [/^荣耀数字(?:\s|$)/, "number", "荣耀数字系列"],
    [/^荣耀 X(?:\s|$)/i, "x", "荣耀 X 系列"],
    [/^荣耀 MagicPad(?:\s|$)/i, "magicpad", "MagicPad 系列"],
    [/^荣耀平板 V(?:\s|$)/i, "pad-v", "荣耀平板 V 系列"],
    [/^荣耀平板 X(?:\s|$)/i, "pad-x", "荣耀平板 X 系列"],
    [/^荣耀平板$/, "pad", "荣耀平板系列"],
    [/^荣耀 MagicBook(?:\s|$)/i, "magicbook", "MagicBook 系列"],
  ],
};

export function getCatalogProductSeries(group: { key: string; label: string; brand: string; category: DeviceCategory; family: string }) {
  if (group.category === "watch" || group.category === "band") {
    return { key: `${group.brand.toLowerCase()}.${group.category}.catalog-${group.family.toLowerCase().replace(/\s+/g, "-")}`, label: group.family };
  }
  if (group.brand !== "Xiaomi" && group.brand !== "Redmi") {
    const root = catalogRoots[group.brand]?.find(([pattern]) => pattern.test(group.family));
    // 未识别的产品线保留原名，不用宽泛兜底将其并入另一个系列。
    return root ? { key: `${group.brand.toLowerCase()}.${group.category}.catalog-${root[1]}`, label: root[2] }
      : { key: group.key, label: group.label };
  }
  const name = group.family.replace(/^(?:Xiaomi|REDMI)\s*/i, "");
  let family: string;
  if (group.category === "phone") {
    const roots = group.brand === "Redmi" ? ["K", "Turbo", "Note", "X"] : ["MIX", "Civi", "Note", "Max", "CC", "Play"];
    family = roots.find((root) => name.toUpperCase() === root.toUpperCase()
      || name.toUpperCase().startsWith(`${root.toUpperCase()} `)) ?? "数字";
  } else if (group.category === "tablet") {
    family = /^K Pad\b/i.test(name) ? "K Pad" : "Pad";
  } else {
    family = /^Gaming\b/i.test(name) ? "游戏本" : "Book";
  }
  const label = family === "数字" || family === "游戏本" ? `${brandLabels[group.brand]}${family}系列`
    : family === "Pad" ? `${brandLabels[group.brand]}平板系列` : `${brandLabels[group.brand]} ${family} 系列`;
  return { key: `${group.brand.toLowerCase()}.${group.category}.catalog-${family.toLowerCase().replace(/\s+/g, "-")}`, label };
}
const rank = (values: string[], value: string) => {
  const index = values.indexOf(value);
  return index < 0 ? values.length : index;
};
export const sortBrands = (brands: string[]) => [...new Set(brands)].sort((a, b) =>
  rank(brandOrder, a) - rank(brandOrder, b) || a.localeCompare(b, "zh-CN"));

type Series = { brand: string; category: DeviceCategory; family: string; variant: string; tier?: string; label: string };
const families: Record<string, RegExp[]> = {
  Apple: [/iPhone|iPad Pro|MacBook Pro/i, /iPad Air|MacBook Air/i, /iPad mini/i, /iPad|MacBook Neo/i],
  Xiaomi: [/^Xiaomi(?: Ultra| Pro| S|$)/i, /^Xiaomi MIX/i, /Civi/i,
    /^Xiaomi Pad (?:Ultra|S Pro|Max|Pro)|^Xiaomi Book Pro/i, /^Xiaomi Pad|^Xiaomi Book/i,
    /^Xiaomi CC|^Xiaomi Note|^Xiaomi Max|^Xiaomi Play/i],
  Redmi: [/^REDMI K(?:\s|$)/i, /^REDMI Turbo/i, /^REDMI Note/i, /^REDMI X/i, /^REDMI K Pad/i, /^REDMI Pad|^REDMI Book/i],
  Samsung: [/Galaxy S(?! FE)/i, /Galaxy Z Fold|^Samsung W$/i, /Galaxy Z Flip|W Flip/i,
    /Galaxy S FE/i, /Galaxy Tab S|Galaxy Book/i, /Galaxy Note/i, /Galaxy A|Galaxy Tab A/i, /Galaxy M|Galaxy F/i],
  Huawei: [/Mate(?!Pad|Book)/i, /Pura|\bP(?:\d|\s*\/)/i, /Pocket/i, /MatePad Pro|MateBook X/i, /MatePad Air|MateBook/i, /nova/i, /MatePad/i, /畅享/i],
  OPPO: [/Find X/i, /Find N/i, /Reno/i, /Pad/i, /^OPPO K/i, /^OPPO A/i],
  vivo: [/^vivo X/i, /iQOO(?: \d| Neo)/i, /^vivo S/i, /Pad/i, /^vivo Y/i],
  HONOR: [/Magic/i, /数字|Number/i, /Pad|Tablet|Book/i, /X|Play|畅玩/i],
};
function seriesRank(series: Series) {
  if (series.category === "watch") {
    const watchFamilies = series.brand === "Apple" ? ["Apple Watch Ultra", "Apple Watch", "Apple Watch SE"]
      : series.brand === "Xiaomi" ? ["小米 Watch S", "小米 Watch", "小米 Watch Color", "小米腕部记录仪", "米兔儿童手表"]
      : series.brand === "Samsung" ? ["Galaxy Watch Ultra", "Galaxy Watch Classic", "Galaxy Watch Pro", "Galaxy Watch", "Galaxy Watch Active", "Gear Sport"]
      : series.brand === "Huawei" ? ["华为 WATCH Ultimate", "华为 WATCH GT", "华为 WATCH", "华为 WATCH FIT", "华为 WATCH D", "华为 WATCH Buds", "华为儿童手表"]
      : series.brand === "OPPO" ? ["OPPO Watch X", "OPPO Watch", "OPPO Watch S", "OPPO Watch SE"]
      : series.brand === "vivo" ? ["vivo WATCH", "vivo WATCH GT"]
      : series.brand === "HONOR" ? ["荣耀手表", "荣耀手表 GS", "荣耀手表 Fit", "荣耀手表 X"] : ["Redmi Watch"];
    return rank(watchFamilies, series.family);
  }
  if (series.brand === "Apple" && series.category === "phone") {
    const name = `${series.family} ${series.variant} ${series.label}`;
    return /pro[\s_-]*max/i.test(name) ? 0 : /\bpro\b/i.test(name) ? 1
      : /plus/i.test(name) ? 3 : /SE|mini|\be\b|air/i.test(name) ? 4 : 2;
  }
  const patterns = families[series.brand] ?? [];
  const family = patterns.findIndex((pattern) => pattern.test(series.family));
  const name = `${series.family} ${series.variant} ${series.tier ?? ""}`;
  // 这是展示顺序，不是销量或热度评分；同档位按名称稳定排序。
  const tier = /Ultra|至尊|Pro Max|Pro\+|Max 芯片/i.test(name) ? 0 : /Pro|\bmax\b|Plus/i.test(name) ? 1
    : /SE|\bFE\b|mini|\be\b|Lite|青春/i.test(name) ? 3 : 2;
  return (family < 0 ? patterns.length : family) * 10 + tier;
}
export function compareCatalogSeries(a: Series, b: Series) {
  return rank(brandOrder, a.brand) - rank(brandOrder, b.brand)
    || rank(["phone", "tablet", "laptop", "watch", "band"], a.category) - rank(["phone", "tablet", "laptop", "watch", "band"], b.category)
    || seriesRank(a) - seriesRank(b) || a.label.localeCompare(b.label, "zh-CN");
}
