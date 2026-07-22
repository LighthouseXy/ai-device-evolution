import fs from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
const EN_DEVICES_PATH = new URL("src/data/apple-devices-db.en-us.json", ROOT);
const EN_SOURCES_PATH = new URL("src/data/apple-sources.en-us.json", ROOT);
const ZH_DEVICES_PATH = new URL("src/data/apple-devices-db.json", ROOT);
const ZH_SOURCES_PATH = new URL("src/data/apple-sources.json", ROOT);
const VERIFIED_AT = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai" }).format(new Date());

const ZH_LAUNCH_PRICES = {
  "ipad-air-m4-2025": [4799, "https://www.apple.com.cn/newsroom/2026/03/apple-introduces-the-new-ipad-air-powered-by-m4/"],
  "ipad-air-m3-2025": [4799, "https://www.apple.com.cn/newsroom/2025/03/apple-introduces-ipad-air-with-powerful-m3-chip-new-magic-keyboard/"],
  "ipad-pro-m4-11-2024": [8999, "https://www.apple.com.cn/newsroom/2024/05/apple-unveils-stunning-new-ipad-pro-with-m4-chip-and-apple-pencil-pro/"],
  "ipad-pro-m4-13-2024": [11499, "https://www.apple.com.cn/newsroom/2024/05/apple-unveils-stunning-new-ipad-pro-with-m4-chip-and-apple-pencil-pro/"],
  "ipad-9th-2021": [2499, "https://www.apple.com.cn/newsroom/2021/09/apples-most-popular-ipad-delivers-even-more-performance-and-advanced-features/"],
  "ipad-mini-6th-2021": [3799, "https://www.apple.com.cn/newsroom/2021/09/apple-unveils-new-ipad-mini-with-breakthrough-performance-in-stunning-new-design/"],
  "ipad-pro-m2-2022": [6799, "https://www.apple.com.cn/newsroom/2022/10/apple-introduces-next-generation-ipad-pro-supercharged-by-the-m2-chip/"],
  "ipad-air-m2-2024": [4799, "https://www.apple.com.cn/newsroom/2024/05/apple-unveils-the-redesigned-11-inch-and-all-new-13-inch-ipad-air-with-m2/"],
  "ipad-pro-m2-13-2022": [9299, "https://www.apple.com.cn/newsroom/2022/10/apple-introduces-next-generation-ipad-pro-supercharged-by-the-m2-chip/"],
  "ipad-10th-2022": [3599, "https://www.apple.com.cn/newsroom/2022/10/apple-unveils-completely-redesigned-ipad-in-four-vibrant-colors/"],
  "ipad-mini-a17-pro-2024": [3999, "https://www.apple.com.cn/newsroom/2024/10/apple-introduces-powerful-new-ipad-mini-with-a17-pro/"],
  "ipad-pro-m5-11-2025": [8999, "https://www.apple.com.cn/newsroom/2025/10/apple-introduces-ipad-pro-with-m5/"],
  "ipad-pro-m5-13-2025": [11499, "https://www.apple.com.cn/newsroom/2025/10/apple-introduces-ipad-pro-with-m5/"],
  "ipad-a16-2025": [2999, "https://www.apple.com.cn/newsroom/2025/03/apple-introduces-ipad-air-with-powerful-m3-chip-new-magic-keyboard/"],
  "macbook-air-13-m1-2020": [7999, "https://www.apple.com.cn/newsroom/2020/11/introducing-the-next-generation-of-mac/"],
  "macbook-pro-13-m1-2020": [9999, "https://www.apple.com.cn/newsroom/2020/11/introducing-the-next-generation-of-mac/"],
  "macbook-air-13-m2-2022": [9499, "https://www.apple.com.cn/newsroom/2022/06/apple-unveils-all-new-macbook-air-supercharged-by-the-new-m2-chip/"],
  "macbook-pro-13-m2-2022": [9999, "https://www.apple.com.cn/newsroom/2022/06/apple-unveils-all-new-macbook-air-supercharged-by-the-new-m2-chip/"],
  "macbook-pro-16-m2-2023": [19999, "https://www.apple.com.cn/newsroom/2023/01/apple-unveils-macbook-pro-featuring-m2-pro-and-m2-max/"],
  "macbook-air-13-m3-2024": [8999, "https://www.apple.com.cn/newsroom/2024/03/apple-unveils-the-new-13-and-15-inch-macbook-air-with-the-powerful-m3-chip/"],
  "macbook-air-15-m3-2024": [10499, "https://www.apple.com.cn/newsroom/2024/03/apple-unveils-the-new-13-and-15-inch-macbook-air-with-the-powerful-m3-chip/"],
  "macbook-air-13-m4-2025": [7999, "https://www.apple.com.cn/newsroom/2025/03/apple-introduces-the-new-macbook-air-with-m4-and-a-gorgeous-new-sky-blue-color/"],
  "macbook-air-15-m4-2025": [9999, "https://www.apple.com.cn/newsroom/2025/03/apple-introduces-the-new-macbook-air-with-m4-and-a-gorgeous-new-sky-blue-color/"],
  "macbook-pro-14-m4-2024": [12999, "https://www.apple.com.cn/newsroom/2024/10/apples-new-macbook-pro-features-the-incredibly-powerful-m4-family-of-chips/"],
  "macbook-pro-14-m4-pro-2024": [16999, "https://www.apple.com.cn/newsroom/2024/10/apples-new-macbook-pro-features-the-incredibly-powerful-m4-family-of-chips/"],
  "macbook-pro-14-m5-2025": [12999, "https://www.apple.com.cn/newsroom/2025/10/apple-unveils-new-14-inch-macbook-pro-with-the-m5-chip/"],
  "macbook-air-13-m5-2026": [8499, "https://www.apple.com.cn/newsroom/2026/03/apple-introduces-the-new-macbook-air-with-m5/"],
  "macbook-air-15-m5-2026": [9999, "https://www.apple.com.cn/newsroom/2026/03/apple-introduces-the-new-macbook-air-with-m5/"],
  "macbook-pro-14-m5-pro-2026": [17999, "https://www.apple.com.cn/newsroom/2026/03/apple-introduces-macbook-pro-with-all-new-m5-pro-and-m5-max/"],
  "macbook-pro-16-m5-2026": [21999, "https://www.apple.com.cn/newsroom/2026/03/apple-introduces-macbook-pro-with-all-new-m5-pro-and-m5-max/"],
  "macbook-pro-14-m5-max-2026": [29999, "https://www.apple.com.cn/newsroom/2026/03/apple-introduces-macbook-pro-with-all-new-m5-pro-and-m5-max/"],
  "macbook-pro-16-m5-max-2026": [31999, "https://www.apple.com.cn/newsroom/2026/03/apple-introduces-macbook-pro-with-all-new-m5-pro-and-m5-max/"],
  "macbook-pro-16-m4-max-2024": [27999, "https://www.apple.com.cn/newsroom/2024/10/apples-new-macbook-pro-features-the-incredibly-powerful-m4-family-of-chips/"],
};

const MACBOOK_CHIP_SPLITS = {
  "macbook-pro-16-m2-2023": [
    { id: "macbook-pro-16-m2-2023", tier: "pro", chip: "M2 Pro", comparedTo: null },
    { id: "macbook-pro-16-m2-max-2023", tier: "max", chip: "M2 Max", comparedTo: null },
  ],
  "macbook-pro-14-m4-pro-2024": [
    { id: "macbook-pro-14-m4-pro-2024", tier: "pro", chip: "M4 Pro", comparedTo: null },
    { id: "macbook-pro-14-m4-max-2024", tier: "max", chip: "M4 Max", comparedTo: null },
  ],
  "macbook-pro-16-m4-2024": [
    { id: "macbook-pro-16-m4-2024", tier: "pro", chip: "M4 Pro", comparedTo: "macbook-pro-16-m2-2023" },
    { id: "macbook-pro-16-m4-max-2024", tier: "max", chip: "M4 Max", comparedTo: "macbook-pro-16-m2-max-2023" },
  ],
  "macbook-pro-14-m5-pro-2026": [
    { id: "macbook-pro-14-m5-pro-2026", tier: "pro", chip: "M5 Pro", comparedTo: "macbook-pro-14-m4-pro-2024" },
    { id: "macbook-pro-14-m5-max-2026", tier: "max", chip: "M5 Max", comparedTo: "macbook-pro-14-m4-max-2024" },
  ],
  "macbook-pro-16-m5-2026": [
    { id: "macbook-pro-16-m5-2026", tier: "pro", chip: "M5 Pro", comparedTo: "macbook-pro-16-m4-2024" },
    { id: "macbook-pro-16-m5-max-2026", tier: "max", chip: "M5 Max", comparedTo: "macbook-pro-16-m4-max-2024" },
  ],
};

const EXPECTED_MISSING_LAUNCH_PRICES = new Set([
  "macbook-pro-16-m2-max-2023",
  "macbook-pro-14-m4-max-2024",
  "macbook-pro-16-m4-2024",
]);

function localizeModelName(name) {
  return name
    .replace(/^iPad (Air|Pro) ([\d.]+)-inch (\(.+\))$/, "$2 英寸 iPad $1 $3")
    .replace(/^(MacBook (?:Air|Pro)) ([\d.]+)-inch (\(.+\))$/, "$2 英寸 $1 $3")
    .replace(/^iPad \(9th generation\)$/, "iPad (第 9 代)")
    .replace(/^iPad \(10th generation\)$/, "iPad (第 10 代)")
    .replace(/^iPad mini \(6th generation\)$/, "iPad mini (第 6 代)")
    .replace(/^iPhone SE \(2nd generation\)$/, "iPhone SE (第 2 代)")
    .replace(/^iPhone SE \(3rd generation\)$/, "iPhone SE (第 3 代)");
}

const FIELD_TARGETS = {
  phone: [
    "colors", "material", "weight", "dimensions", "screenSize", "displayType", "resolution",
    "refreshRate", "peakBrightness", "chip", "cpu", "gpu", "neuralEngine", "storage",
    "rearCamera", "mainCamera", "ultraWide", "telephoto", "opticalZoom", "frontCamera",
    "videoRecording", "videoPlayback", "batteryLife", "port", "chargingMethod", "security",
    "waterResistance", "wifi", "bluetooth", "sim", "hasNFC", "hasMagSafe", "hasSOS",
    "hasCrashDetection", "hasUWB",
  ],
  tablet: [
    "colors", "material", "weight", "dimensions", "screenSize", "displayType", "resolution",
    "refreshRate", "peakBrightness", "chip", "cpu", "gpu", "neuralEngine", "memory", "storage",
    "rearCamera", "frontCamera", "videoRecording", "batteryLife", "port", "chargingMethod",
    "security", "wifi", "bluetooth", "sim", "speakers", "microphone", "pencilSupport",
    "externalDisplay", "magicKeyboard",
  ],
  laptop: [
    "colors", "material", "weight", "dimensions", "thickness", "screenSize", "displayType",
    "resolution", "refreshRate", "peakBrightness", "chip", "cpu", "gpu", "neuralEngine",
    "memory", "storage", "webcam", "speakers", "microphone", "keyboard", "trackpad",
    "thunderbolt", "usbC", "port", "chargingMethod", "powerAdapter", "hasMagSafe", "hasTouchId",
    "hasHDMI", "hasSDXC", "wifi", "bluetooth", "externalDisplay", "batteryLife",
    "wirelessWebBrowsing",
  ],
};

const SECTION_NAMES = {
  finish: /^(外观|颜色)$/,
  capacity: /^(容量|存储容量|存储设备)$/,
  size: /^尺寸(与|和)?重量$/,
  display: /^(显示屏|显示器)$/,
  water: /防溅|抗水|防尘/,
  chip: /^芯片$/,
  memory: /^内存$/,
  camera: /^(摄像头|相机)$/,
  frontCamera: /原深感摄像头|前置摄像头|超广角摄像头/,
  video: /^视频拍摄$/,
  security: /^(面容 ID|触控 ID|Touch ID)$/i,
  safety: /^安全功能$/,
  wireless: /^(蜂窝网络和\s*无线连接|无线连接)$/,
  externalButtons: /外部按键和\s*连接端口|按键和连接端口/,
  charging: /^充电和外设扩展$/,
  power: /^(电源和电池|电池和电源)$/,
  magsafe: /^MagSafe$/i,
  sim: /^SIM 卡$/i,
  speakers: /^扬声器$/,
  microphone: /^麦克风$/,
  displaySupport: /^(显示屏支持|显示器支持|外接显示器支持)$/,
  keyboard: /^键盘和触控板$/,
  cameraLaptop: /^摄像头$/,
  audio: /^音频$/,
};

function decodeHtml(value) {
  return value
    .replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, "")
    .replace(/<br\s*\/?>/gi, "；")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;|\u00a0/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&deg;/g, "°")
    .replace(/&fnof;/g, "ƒ")
    .replace(/&loz;/g, "◊")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&lsquo;|&rsquo;/g, "'")
    .replace(/&reg;/g, "®")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function parseSections(html) {
  const start = html.search(/<h1\b/i);
  const footer = html.search(/<footer\b/i);
  const body = html
    .slice(Math.max(0, start), footer > start ? footer : undefined)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  const sections = [];
  let current = null;
  for (const match of body.matchAll(/<(h[1-4]|li|p)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const tag = match[1].toLowerCase();
    const text = decodeHtml(match[2]);
    if (!text) continue;
    if (tag === "h4") {
      if (current && !current.blocks.includes(text)) current.blocks.push(text);
    } else if (tag.startsWith("h")) {
      current = { heading: text, blocks: [] };
      sections.push(current);
    } else if (current) {
      const inMaxTier = current.blocks.some((block) => /^(?:Apple )?M\d+ Max (?:芯片|机型)$/.test(block));
      if (inMaxTier || !current.blocks.includes(text)) current.blocks.push(text);
    }
  }
  return sections;
}

function section(sections, name) {
  const pattern = SECTION_NAMES[name];
  return sections.find((item) => pattern.test(item.heading))?.blocks ?? [];
}

function tierBlocks(blocks, tier, label = "Apple") {
  if (!["pro", "max"].includes(tier)) return blocks;
  const prefix = label === "Apple" ? "Apple " : "";
  const suffix = label === "Apple" ? " 芯片" : " 机型";
  const proIndex = blocks.findIndex((block) => new RegExp(`^${prefix}M\\d+ Pro${suffix}$`).test(block));
  const maxIndex = blocks.findIndex((block) => new RegExp(`^${prefix}M\\d+ Max${suffix}$`).test(block));
  if (proIndex < 0 || maxIndex < 0) return blocks;
  return tier === "pro" ? blocks.slice(proIndex, maxIndex) : blocks.slice(maxIndex);
}

function allBlocks(sections) {
  return sections.flatMap((item) => item.blocks);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function matching(blocks, pattern) {
  return blocks.filter((block) => block.length <= 600 && pattern.test(block));
}

function first(blocks, pattern) {
  return matching(blocks, pattern)[0];
}

function joined(blocks, pattern, limit = Infinity) {
  return matching(blocks, pattern).slice(0, limit).join("；");
}

function numbers(text, pattern) {
  return [...text.matchAll(pattern)].map((match) => Number(match[1]));
}

function spec(value, rawText, oldField, sourceUrl) {
  if (value === undefined || value === null || value === "" || !rawText) return null;
  return {
    value,
    ...(oldField?.unit ? { unit: oldField.unit } : {}),
    rawText,
    sourceUrl,
    sourceType: "apple",
    confidence: 1,
    verifiedAt: VERIFIED_AT,
  };
}

function parseStorage(blocks) {
  const values = [];
  for (const block of blocks) {
    for (const match of block.matchAll(/\b(\d+(?:GB|TB))\b/g)) values.push(match[1]);
  }
  const normalized = unique(values);
  return normalized.length ? normalized.join(" / ") : null;
}

function parseTieredStorage(blocks, tier) {
  if (!["pro", "max"].includes(tier)) {
    const value = parseStorage(blocks);
    return { value, raw: blocks.join("；") };
  }
  const values = [];
  const evidence = [];
  for (const block of blocks) {
    const matches = [...block.matchAll(/\b(\d+(?:GB|TB))\b/g)];
    for (let index = 0; index < matches.length; index += 1) {
      const match = matches[index];
      const chunk = block.slice(match.index, matches[index + 1]?.index ?? block.length).trim();
      const mentionsPro = /M\d+ Pro/.test(chunk);
      const mentionsMax = /M\d+ Max/.test(chunk);
      if (tier === "pro" && mentionsMax && !mentionsPro) continue;
      if (tier === "max" && mentionsPro && !mentionsMax) continue;
      values.push(match[1]);
      evidence.push(chunk);
    }
  }
  return { value: unique(values).join(" / ") || null, raw: unique(evidence).join("；") };
}

function parseWeight(blocks, tier) {
  const tierName = tier === "pro" ? "Pro" : tier === "max" ? "Max" : null;
  const raw = (tierName ? first(blocks, new RegExp(`重量.*M\\d+ ${tierName} 机型`)) : null)
    ?? first(blocks, /重量(?:\s*\([^)]*\))?\s*[：:]?/);
  if (!raw) return null;
  const grams = raw.match(/重量(?:\s*\([^)]*\))?\s*[：:]?\s*([\d.]+)\s*克/);
  if (grams) return { value: Number(grams[1]), raw };
  const kilograms = raw.match(/重量(?:\s*\([^)]*\))?\s*[：:]?\s*([\d.]+)\s*千克/);
  if (kilograms) return { value: Math.round(Number(kilograms[1]) * 1000), raw };
  return null;
}

function parseDimensions(blocks) {
  const labels = ["宽度", "深度", "高度", "厚度"];
  const found = new Map();
  for (const label of labels) {
    const raw = first(blocks, new RegExp(`${label}\\s*[：:]?`));
    if (!raw) continue;
    const mm = raw.match(new RegExp(`${label}\\s*[：:]?\\s*([\\d.]+)\\s*毫米`));
    const cm = raw.match(new RegExp(`${label}\\s*[：:]?\\s*([\\d.]+)\\s*厘米`));
    if (mm) found.set(label, { value: Number(mm[1]), raw });
    else if (cm) found.set(label, { value: Number((Number(cm[1]) * 10).toFixed(2)), raw });
  }
  const width = found.get("宽度")?.value;
  const height = found.get("高度")?.value;
  const depth = found.get("深度")?.value;
  const thickness = found.get("厚度")?.value ?? (depth !== undefined ? height : undefined);
  const standard = [width, height, thickness].every(Number.isFinite) || [width, depth, thickness].every(Number.isFinite);
  const mislabeledTablet = [height, depth, found.get("厚度")?.value].every(Number.isFinite);
  if (!standard && !mislabeledTablet) return null;
  const raw = unique([...found.values()].map((item) => item.raw)).join("；");
  return { width, height, depth, thickness, raw };
}

function parseScreenSize(device, sections, display) {
  const direct = first(display, /([\d.]+)\s*英寸.*(?:对角线|显示屏)/);
  const directMatch = direct?.match(/([\d.]+)\s*英寸/);
  if (directMatch) return { value: Number(directMatch[1]), raw: direct };

  const blocks = allBlocks(sections);
  const simple = first(blocks, /(?:屏幕|机型)为\s*([\d.]+)\s*英寸/);
  const simpleMatch = simple?.match(/(?:屏幕|机型)为\s*([\d.]+)\s*英寸/);
  if (simpleMatch) return { value: Number(simpleMatch[1]), raw: simple };

  if (device.category === "tablet" && /^(11|13)-inch$/.test(device.variant)) {
    const marketed = device.variant.startsWith("11") ? "11" : "13";
    const family = device.family.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`${marketed} 英寸 ${family}[^。；]*?为\\s*([\\d.]+)\\s*英寸`);
    const raw = first(blocks, pattern);
    const match = raw?.match(pattern);
    if (match) return { value: Number(match[1]), raw };
  }
  return null;
}

function extractField(device, fieldName, sections, oldField, sourceUrl) {
  const finish = section(sections, "finish");
  const capacity = tierBlocks(section(sections, "capacity"), device.tier);
  const size = section(sections, "size");
  const display = section(sections, "display");
  const allChipBlocks = section(sections, "chip");
  const chip = tierBlocks(allChipBlocks, device.tier)
    .filter((block) => device.tier !== "pro" || (!/^可选配/.test(block) && !/M\d+ Max/.test(block)));
  const memory = tierBlocks(section(sections, "memory"), device.tier);
  const camera = section(sections, device.category === "laptop" ? "cameraLaptop" : "camera");
  const frontCamera = section(sections, "frontCamera");
  const video = section(sections, "video");
  const wireless = section(sections, "wireless");
  const charging = section(sections, "charging");
  const power = tierBlocks(section(sections, "power"), device.tier, "model");
  const sim = section(sections, "sim");
  const keyboard = section(sections, "keyboard");
  const audio = section(sections, "audio");
  const blocks = allBlocks(sections);

  if (fieldName === "colors") {
    const values = finish.filter((block) => !/设计|面板|背板|机身|外壳|玻璃|铝金属|钛金属设计/.test(block));
    return spec(values.length ? values : null, values.join("、"), oldField, sourceUrl);
  }
  if (fieldName === "material") {
    const raw = first(finish, /设计|面板|背板|机身|外壳|玻璃|铝金属/)
      ?? first(blocks, /机身[^。；]{0,100}采用.*铝金属/);
    return spec(raw, raw, oldField, sourceUrl);
  }
  if (fieldName === "weight") {
    const parsed = parseWeight(size, device.tier);
    return parsed ? spec(parsed.value, parsed.raw, oldField, sourceUrl) : null;
  }
  if (fieldName === "dimensions" || fieldName === "thickness") {
    const parsed = parseDimensions(size);
    if (!parsed) return null;
    const value = device.id === "ipad-a16-2025" && parsed.width === undefined
      ? `${parsed.height} x ${parsed.thickness} x ${parsed.depth} 毫米`
      : device.category === "laptop"
      ? `${parsed.width} x ${parsed.depth} x ${parsed.thickness} 毫米`
      : `${parsed.height} x ${parsed.width} x ${parsed.thickness} 毫米`;
    return fieldName === "thickness"
      ? spec(parsed.thickness, parsed.raw, oldField, sourceUrl)
      : spec(value, parsed.raw, oldField, sourceUrl);
  }
  if (fieldName === "screenSize") {
    const parsed = parseScreenSize(device, sections, display);
    return parsed ? spec(parsed.value, parsed.raw, oldField, sourceUrl) : null;
  }
  if (fieldName === "displayType") {
    const selected = unique([
      first(display, /视网膜.*显示屏|Retina.*显示屏/i),
      first(display, /OLED|mini-LED|IPS 技术/),
      first(display, /ProMotion/),
      first(display, /全天候显示/),
    ]);
    return spec(selected.join("；"), selected.join("；"), oldField, sourceUrl);
  }
  if (fieldName === "resolution") {
    const raw = first(display, /(?:\d+\s*x\s*\d+.*分辨率|分辨率\s*\d+\s*x\s*\d+)/);
    return spec(raw, raw, oldField, sourceUrl);
  }
  if (fieldName === "refreshRate") {
    const raw = first(display, /(?:ProMotion|刷新率).*\d+(?:\.\d+)?\s*Hz/);
    const rates = raw ? numbers(raw, /(\d+)\s*Hz/g) : [];
    return rates.length ? spec(Math.max(...rates), raw, oldField, sourceUrl) : null;
  }
  if (fieldName === "peakBrightness") {
    const raw = joined(display, /峰值亮度/, 2);
    const values = numbers(raw, /(\d+)\s*尼特/g);
    return values.length ? spec(Math.max(...values), raw, oldField, sourceUrl) : null;
  }
  if (fieldName === "chip") {
    const raw = first(chip, /芯片|Apple\s+[AM]\d+|A\d+\s*仿生/i);
    return spec(raw, raw, oldField, sourceUrl);
  }
  if (fieldName === "cpu") {
    const raw = ["pro", "max"].includes(device.tier)
      ? joined(chip, device.tier === "max" ? /^(?:\d+ 核中央处理器|M\d+ Max \()/ : /^\d+ 核中央处理器/, 3)
        || joined(allChipBlocks, /^\d+ 核中央处理器/, 1)
      : joined(chip, /中央处理器/, 2);
    return spec(raw, raw, oldField, sourceUrl);
  }
  if (fieldName === "gpu") {
    const raw = ["pro", "max"].includes(device.tier)
      ? joined(chip, device.tier === "max" ? /^(?:\d+ 核图形处理器|M\d+ Max \()/ : /^\d+ 核图形处理器/, 3)
        || joined(allChipBlocks, /^\d+ 核图形处理器/, 1)
      : joined(chip, /图形处理器/, 2);
    return spec(raw, raw, oldField, sourceUrl);
  }
  if (fieldName === "neuralEngine") {
    const raw = first(chip, /神经网络引擎/) ?? first(allChipBlocks, /神经网络引擎/);
    return spec(raw, raw, oldField, sourceUrl);
  }
  if (fieldName === "memory") {
    const source = memory.length ? memory : chip;
    const selected = ["pro", "max"].includes(device.tier)
      ? source.filter((block) => block.length <= 600 && !/内存带宽/.test(block) && /\b\d+GB\b/.test(block))
      : source.filter((block) => block.length <= 300 && !/内存带宽/.test(block) && (/^\d+GB.*(?:统一)?内存/.test(block) || /可选配/.test(block)));
    const parsed = parseTieredStorage(selected, device.tier);
    return spec(parsed.value, parsed.raw, oldField, sourceUrl);
  }
  if (fieldName === "storage") {
    const parsed = parseTieredStorage(capacity, device.tier);
    return spec(parsed.value, parsed.raw, oldField, sourceUrl);
  }
  if (fieldName === "rearCamera") {
    const selected = camera.filter((block) => /摄像头|摄像系统|摄系统|主摄|广角|超广角|长焦/.test(block)).slice(0, 5);
    return spec(selected.join("；"), selected.join("；"), oldField, sourceUrl);
  }
  if (fieldName === "mainCamera") {
    const raw = first(camera, /主摄|融合式|^(?!.*超广角).*广角摄像头/);
    return spec(raw, raw, oldField, sourceUrl);
  }
  if (fieldName === "ultraWide") {
    const raw = first(camera, /超广角/);
    return spec(raw, raw, oldField, sourceUrl);
  }
  if (fieldName === "telephoto") {
    const raw = first(camera, /长焦/);
    return spec(raw, raw, oldField, sourceUrl);
  }
  if (fieldName === "opticalZoom") {
    const raw = joined(camera, /光学变焦/, 2);
    return spec(raw, raw, oldField, sourceUrl);
  }
  if (fieldName === "frontCamera") {
    const selected = frontCamera.slice(0, 3);
    return spec(selected.join("；"), selected.join("；"), oldField, sourceUrl);
  }
  if (fieldName === "webcam") {
    const raw = first(camera, /摄像头|相机/);
    return spec(raw, raw, oldField, sourceUrl);
  }
  if (fieldName === "videoRecording") {
    const selected = unique([video[0], video[1], first(video, /ProRes/), first(video, /电影效果|影院/)]);
    return spec(selected.join("；"), selected.join("；"), oldField, sourceUrl);
  }
  if (fieldName === "videoPlayback") {
    const raw = first(power, /^视频播放/);
    return spec(raw, raw, oldField, sourceUrl);
  }
  if (fieldName === "batteryLife") {
    const selected = power.filter((block) => /视频播放|无线上网|浏览网页|观看视频|音频播放/.test(block)).slice(0, 4);
    return spec(selected.join("；"), selected.join("；"), oldField, sourceUrl);
  }
  if (fieldName === "wirelessWebBrowsing") {
    const raw = first(power, /无线上网|浏览网页/);
    return spec(raw, raw, oldField, sourceUrl);
  }
  if (fieldName === "port") {
    const source = charging.length ? charging : section(sections, "externalButtons");
    const selected = source.filter((block) => block.length <= 600 && /接口|端口|雷雳|闪电|USB\s*[234]|DisplayPort|耳机/.test(block)).slice(0, 7);
    return spec(selected.join("；"), selected.join("；"), oldField, sourceUrl);
  }
  if (fieldName === "thunderbolt") {
    const raw = joined(charging, /雷雳/, 3);
    return spec(raw, raw, oldField, sourceUrl);
  }
  if (fieldName === "usbC") {
    const raw = first(charging, /USB-C.*端口|雷雳.*\(USB-C\).*端口|雷雳\s*\/\s*USB 4 端口/);
    return spec(raw, raw, oldField, sourceUrl);
  }
  if (fieldName === "chargingMethod") {
    const selected = unique([
      ...matching(power, /MagSafe|Qi2|Qi 无线充电|USB-C/),
      ...matching(charging, /MagSafe|USB-C.*充电|充电端口/),
    ]).slice(0, 5);
    return spec(selected.join("；"), selected.join("；"), oldField, sourceUrl);
  }
  if (fieldName === "powerAdapter") {
    const selected = matching(power, /电源适配器/);
    return spec(selected.join("；"), selected.join("；"), oldField, sourceUrl);
  }
  if (fieldName === "security") {
    const securitySection = sections.find((item) => SECTION_NAMES.security.test(item.heading));
    const raw = securitySection ? [securitySection.heading, ...securitySection.blocks.slice(0, 1)].join("：") : null;
    return spec(raw, raw, oldField, sourceUrl);
  }
  if (fieldName === "waterResistance") {
    const raw = section(sections, "water")[0];
    return spec(raw, raw, oldField, sourceUrl);
  }
  if (fieldName === "wifi") {
    const raw = first(wireless, /802\.11|无线局域网|Wi-Fi\s*\d/i);
    return spec(raw, raw, oldField, sourceUrl);
  }
  if (fieldName === "bluetooth") {
    const raw = first(wireless, /(?:蓝牙|Bluetooth)\s*\d/i);
    return spec(raw, raw, oldField, sourceUrl);
  }
  if (fieldName === "sim") {
    const raw = sim.find((block) => /SIM|eSIM/i.test(block));
    return spec(raw, raw, oldField, sourceUrl);
  }
  if (fieldName === "speakers") {
    const source = section(sections, "speakers").length ? section(sections, "speakers") : audio;
    const raw = joined(source, /扬声器|音响系统|空间音频/, 3);
    return spec(raw, raw, oldField, sourceUrl);
  }
  if (fieldName === "microphone") {
    const source = section(sections, "microphone").length ? section(sections, "microphone") : audio;
    const raw = joined(source, /麦克风|波束成形|语音突显|宽谱/, 3);
    return spec(raw, raw, oldField, sourceUrl);
  }
  if (fieldName === "pencilSupport") {
    const raw = joined(blocks, /支持 Apple Pencil|Apple Pencil Pro|Apple Pencil \(USB-C\)/, 4);
    return spec(raw, raw, oldField, sourceUrl);
  }
  if (fieldName === "externalDisplay") {
    const source = tierBlocks(section(sections, "displaySupport"), device.tier, "model");
    const raw = joined(source, /外接显示|显示器|6K|8K/, 4);
    return spec(raw, raw, oldField, sourceUrl);
  }
  if (fieldName === "keyboard") {
    const raw = first(keyboard, /妙控键盘|Magic Keyboard/i);
    return spec(raw, raw, oldField, sourceUrl);
  }
  if (fieldName === "trackpad") {
    const raw = first(keyboard, /力度触控板|触控板|Force Touch/i);
    return spec(raw, raw, oldField, sourceUrl);
  }
  if (["hasNFC", "hasMagSafe", "hasSOS", "hasCrashDetection", "hasUWB", "magicKeyboard", "hasTouchId", "hasHDMI", "hasSDXC"].includes(fieldName)) {
    const patterns = {
      hasNFC: /NFC/,
      hasMagSafe: /MagSafe/,
      hasSOS: /SOS 紧急联络/,
      hasCrashDetection: /车祸检测/,
      hasUWB: /超宽带/,
      magicKeyboard: /妙控键盘|Magic Keyboard/i,
      hasTouchId: /触控 ID|Touch ID/i,
      hasHDMI: /HDMI/,
      hasSDXC: /SDXC/,
    };
    const raw = first(blocks, patterns[fieldName]);
    return raw ? spec(true, raw, oldField, sourceUrl) : null;
  }
  return null;
}

async function fetchHtml(url) {
  const response = await fetch(url, { headers: { "user-agent": "DeviceScope official-source audit" } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

async function resolveTechSpecUrl(supportUrl) {
  const zhUrl = supportUrl.replace("/en-us/", "/zh-cn/");
  if (!zhUrl.includes("/docs/")) return zhUrl;
  const html = await fetchHtml(zhUrl);
  const match = html.match(/data-ss-analytics-link-url="(https:\/\/support\.apple\.com\/zh-cn\/\d+)"\s+data-ss-analytics-link-text="tech specs"/);
  if (!match) throw new Error(`中文技术规格链接缺失: ${zhUrl}`);
  return match[1];
}

async function refreshLaunchPrice(device) {
  const configured = ZH_LAUNCH_PRICES[device.id];
  const value = configured?.[0] ?? device.specs.launchPrice?.value;
  const sourceUrl = configured?.[1] ?? device.specs.launchPrice?.sourceUrl;
  if (!value || !sourceUrl?.startsWith("https://www.apple.com.cn/newsroom/")) return null;
  const html = await fetchHtml(sourceUrl);
  const sections = parseSections(html);
  const formatted = Number(value).toLocaleString("en-US");
  const raw = first(allBlocks(sections), new RegExp(`(?:RMB|人民币|¥|起售价)[^；。]{0,240}${formatted.replace(",", "[,]?")}|${formatted.replace(",", "[,]?")}[^；。]{0,240}(?:起售价|人民币|RMB)`));
  if (!raw) throw new Error(`${device.id}: 中文首发价原文缺失 (${sourceUrl})`);
  return spec(value, raw, device.specs.launchPrice, sourceUrl);
}

const [englishDatabase, englishSources] = await Promise.all([
  fs.readFile(EN_DEVICES_PATH, "utf8").then(JSON.parse),
  fs.readFile(EN_SOURCES_PATH, "utf8").then(JSON.parse),
]);
const { devices: englishDevices } = englishDatabase;
const sourceById = new Map(Object.values(englishSources).flat().map((row) => [row.id, row]));
const zhSources = Object.fromEntries(Object.keys(englishSources).map((category) => [category, []]));
const zhDevices = [];
const missing = [];

function splitDevice(device, split) {
  if (!split) return device;
  const computed = structuredClone(device.computed);
  if (computed.aiCapabilityLevel?.scoreBreakdown) {
    computed.aiCapabilityLevel.scoreBreakdown = computed.aiCapabilityLevel.scoreBreakdown
      .replace(/M\d+ Pro or M\d+ Max/g, split.chip);
  }
  if (computed.generationUpgradeMagnitude) {
    computed.generationUpgradeMagnitude = {
      ...computed.generationUpgradeMagnitude,
      value: null,
      comparedTo: split.comparedTo,
      changeSummary: split.comparedTo ? "该代升级幅度尚未重新计算" : "该设备为该比较组第一代",
      scoreBreakdown: split.comparedTo ? "待重新计算" : "无对比前代",
      confidence: 0,
      computedAt: VERIFIED_AT,
      verifiedAt: VERIFIED_AT,
    };
  }
  return {
    ...device,
    id: split.id,
    modelName: `${device.variant.replace("-inch", " 英寸")} MacBook Pro (${split.chip})`,
    generation: `${split.chip} ${device.variant}`,
    tier: split.tier,
    computed,
  };
}

for (const sourceDevice of englishDevices) {
  const oldSource = sourceById.get(sourceDevice.id);
  const supportUrl = await resolveTechSpecUrl(oldSource.supportUrl);
  const html = await fetchHtml(supportUrl);
  const sections = parseSections(html);
  const title = sections[0]?.heading ?? "";
  if (!/[\u4e00-\u9fff]/.test(html) || !/技术规格/.test(title)) {
    throw new Error(`${sourceDevice.id}: 不是简体中文技术规格页 (${supportUrl})`);
  }

  const splits = MACBOOK_CHIP_SPLITS[sourceDevice.id] ?? [null];
  for (const split of splits) {
    const device = splitDevice(sourceDevice, split);
    const specs = {};
    for (const fieldName of FIELD_TARGETS[device.category]) {
      const field = extractField(device, fieldName, sections, device.specs[fieldName], supportUrl);
      if (field) specs[fieldName] = field;
      else if (device.specs[fieldName]?.value !== null && device.specs[fieldName]?.value !== undefined) missing.push(`${device.id}.${fieldName}`);
    }
    const launchPrice = await refreshLaunchPrice(device);
    if (launchPrice) specs.launchPrice = launchPrice;
    else if (device.specs.launchPrice?.value != null && !EXPECTED_MISSING_LAUNCH_PRICES.has(device.id)) missing.push(`${device.id}.launchPrice`);

    const modelName = localizeModelName(device.modelName);
    const releaseYear = device.id === "ipad-air-m4-2025" ? 2026 : device.releaseYear;
    zhDevices.push({ ...device, modelName, releaseYear, specs });
    zhSources[device.category].push({
      ...oldSource,
      id: device.id,
      modelName,
      generation: device.generation,
      releaseYear,
      sourcePageType: "apple_support_docs",
      officialSpecUrl: null,
      supportUrl,
      newsroomUrl: ZH_LAUNCH_PRICES[device.id]?.[1] ?? oldSource.newsroomUrl,
      sourceStatus: "verified",
      notes: "Apple Support 中国简体中文技术规格页",
    });
    console.log(`${device.id}: ${Object.keys(specs).length} fields <- ${supportUrl}`);
  }
}

await Promise.all([
  fs.writeFile(ZH_DEVICES_PATH, `${JSON.stringify({ metadata: { ...englishDatabase.metadata, totalDevices: zhDevices.length, generatedAt: VERIFIED_AT }, devices: zhDevices }, null, 2)}\n`),
  fs.writeFile(ZH_SOURCES_PATH, `${JSON.stringify(zhSources, null, 2)}\n`),
]);
console.log(`wrote ${zhDevices.length} devices; unresolved previous fields: ${missing.length}`);
if (missing.length) console.log(missing.join("\n"));
