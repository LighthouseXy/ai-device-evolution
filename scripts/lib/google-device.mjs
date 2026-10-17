import assert from "node:assert/strict";
import { plainText } from "./zol-device.mjs";

export const googleText = html => plainText(html.replace(/<sup\b[^>]*>[^]*?<\/sup>/gi, "")
  .replace(/<\/?(?:span|strong|b|em)\b[^>]*>/gi, "")
  .replace(/<\/(?:li|p)>/gi, "; "));
export function googleArticle(html) {
  const start = html.indexOf("<h1");
  assert.ok(start >= 0, "Google 页面缺少正文标题");
  return html.slice(start, html.indexOf("<script", start)).split('class="feedback')[0];
}
export function googleRows(table) {
  const rows = new Map();
  for (const [, row] of table.matchAll(/<tr\b[^>]*>([^]*?)<\/tr>/gi)) {
    const cells = [...row.matchAll(/<(?:th|td)\b[^>]*>([^]*?)<\/(?:th|td)>/gi)].map(m => m[1]);
    if (cells.length === 2) rows.set(googleText(cells[0]).replace(/;\s*$/, ""), cells[1]);
  }
  return rows;
}
export const googleEvidence = (page, value, rawText, unit) => ({ value, ...(unit ? { unit } : {}), rawText,
  evidenceKind: "excerpt", sourceUrl: page.url, sourceType: "official", confidence: 1,
  verifiedAt: page.fetchedAt.slice(0, 10), fetchedAt: page.fetchedAt, sourceSnapshotHash: page.sha256 });
const capacities = text => [...new Set([...text.matchAll(/(\d+(?:\.\d+)?)\s*(GB|TB)/gi)].map(m => m[1] + m[2].toUpperCase()))];
const firstMatch = (text, pattern) => text?.match(pattern)?.[0];

// 单一 RAM 可以绑定该型号明确列出的存储；多 RAM 必须逐项读取官方对应关系。
export function googlePhoneConfigurations(html, page) {
  const raw = googleText(html), pairs = [];
  const memoryPattern = /(\d+)\s*GB\s*(?:LPDDR\w*(?:\s*RAM)?|RAM)/gi;
  const memoryMatches = [...raw.matchAll(memoryPattern)];
  assert.ok(memoryMatches.length, `Google 配置行没有明确 RAM：${raw}`);
  const memories = [...new Set(memoryMatches.map(m => `${m[1]}GB`))];
  if (memories.length === 1) {
    const withoutRam = raw.replace(memoryPattern, "");
    for (const storage of capacities(withoutRam)) pairs.push({ memory: memories[0], storage });
  } else {
    // Pixel 11 Pro：256GB 对应 12GB RAM，512GB/1TB 对应 16GB RAM。
    let previousEnd = raw.indexOf("内存") + 2;
    for (const match of memoryMatches) {
      const storageText = raw.slice(previousEnd, match.index);
      for (const storage of capacities(storageText)) pairs.push({ memory: `${match[1]}GB`, storage });
      previousEnd = match.index + match[0].length;
    }
  }
  assert.ok(pairs.length && new Set(pairs.map(p => p.storage)).size === pairs.length,
    "Google 多内存配置无法唯一绑定，不能交叉相乘");
  return pairs.map(pair => ({ ...pair, evidence: googleEvidence(page, `${pair.memory} + ${pair.storage}`, raw) }));
}

export function readGooglePhone(page, table, name, year) {
  assert.ok(year >= 2017 && year <= 2026);
  assert.match(name, /^Pixel (?:\d+(?:a)?(?: \(5G\))?(?: Pro)?(?: XL| Fold)?|Fold)$/);
  const rows = googleRows(table), specs = {};
  const get = pattern => [...rows].filter(([key]) => pattern.test(key));
  const read = (key, pattern, convert = value => value, unit) => {
    const entries = get(pattern);
    if (!entries.length) return;
    const raw = entries.map(([label, html]) => `${label} ${googleText(html)}`).join("; ");
    const value = convert(entries.map(([, html]) => googleText(html)).join("; "));
    if (value !== undefined && value !== null && value !== "") specs[key] = googleEvidence(page, value, raw, unit);
  };
  const memoryRow = get(/内存和存储/)[0];
  assert.ok(memoryRow, `${name}: 内存存储行缺失`);
  const configurations = googlePhoneConfigurations(memoryRow[1], page);
  for (const key of ["memory", "storage"]) specs[key] = googleEvidence(page,
    [...new Set(configurations.map(c => c[key]))].join(" / "), `${memoryRow[0]} ${googleText(memoryRow[1])}`);
  read("chip", /^处理器$/, text => firstMatch(text, /Google Tensor G\d+|Qualcomm[^;]*?Snapdragon[^;]+/));
  read("displayType", /^显示屏/, text => text);
  read("screenSize", /^显示屏/, text => {
    const values = [...text.matchAll(/(\d+(?:\.\d+)?)\s*英寸/g)].map(m => Number(m[1]));
    return values.length === 1 ? values[0] : undefined;
  }, "inch");
  if (get(/^显示屏/).some(([, html]) => (googleText(html).match(/英寸/g) ?? []).length > 1) || get(/^显示屏/).length > 1)
    read("screenSizeDetails", /^显示屏/);
  read("resolution", /^显示屏/, text => [...new Set([...text.matchAll(/\d{3,4}\s*[x×]\s*\d{3,4}/gi)].map(m => m[0]))].join(" / "));
  read("refreshRate", /^显示屏/, text => {
    const hz = [...text.matchAll(/(\d+)\s*Hz/gi)].map(m => Number(m[1]));
    return hz.length ? Math.max(...hz) : undefined;
  }, "Hz");
  read("dimensions", /^尺寸和重量/);
  read("weight", /^尺寸和重量/, text => Number(text.match(/(\d+(?:\.\d+)?)\s*克/)?.[1]) || undefined, "g");
  read("batteryCapacity", /^电池/, text => Number(text.match(/(?:常规电池容量为|典型容量为|典型容量|典型)[：:]?\s*(\d+)\s*毫安时/)?.[1]
    ?? text.match(/(\d+)\s*毫安时[^;]*典型/)?.[1]) || undefined, "mAh");
  read("chargingMethod", /^电池与充电|^充电$/);
  read("batteryLife", /^电池/, text => text.split(/;\s*/).filter(part => /续航时间|电池续航/.test(part) && /小时/.test(part) && !/充电/.test(part)).join("；"));
  read("port", /^(?:按钮和端口|端口)$/);
  read("operatingSystem", /^操作系统$/);
  read("material", /^材料/);
  read("waterResistance", /^材料|^防水/, text => firstMatch(text, /IP\d{2}[^;]*/));
  read("security", /^身份验证$/);
  read("sim", /^SIM 卡$/);
  read("wifi", /^连接|^无线|^网络/, text => text.split(/;\s*/).filter(part => /Wi-?Fi|WLAN|无线局域网|802\.11/i.test(part)).join("；"));
  read("bluetooth", /^连接|^无线|^媒体和音频/, text => firstMatch(text, /蓝牙[^;]+|Bluetooth[^;]+/i));
  const color = get(/^颜色$/)[0];
  if (color) {
    const list = [...color[1].matchAll(/<li\b[^>]*>([^]*?)<\/li>/g)].map(m => googleText(m[1]).replace(/;\s*$/, ""));
    if (list.length) specs.colors = googleEvidence(page, list, `颜色 ${googleText(color[1])}`);
  }
  // 独立镜头说明优先；不能将未标明归属的防抖/传感器套到任意镜头。
  read("rearCamera", /^后置摄像头$/);
  read("frontCamera", /^前置摄像头/);
  read("videoRecording", /^视频和音频|^视频$/);
  const combinedCamera = get(/^摄像头$/)[0];
  if (combinedCamera) {
    const text = googleText(combinedCamera[1]);
    const rear = text.match(/后置摄像头\s*([^]*?)(?=前置摄像头|$)/)?.[1];
    const front = text.match(/前置摄像头\s*([^]*?)(?=前置摄像头视频|$)/)?.[1];
    if (rear) specs.rearCamera = googleEvidence(page, rear.trim(), `摄像头 ${text}`);
    if (front) specs.frontCamera = googleEvidence(page, front.trim(), `摄像头 ${text}`);
  }
  const variant = /Fold/.test(name) ? "fold" : /Pro XL/.test(name) ? "pro-xl" : /Pro/.test(name) ? "pro"
    : /XL/.test(name) ? "xl" : name === "Pixel 4a (5G)" ? "a-5g" : /\da/.test(name) ? "a" : "standard";
  const family = variant === "fold" ? "Pixel Fold" : "Pixel";
  const id = `google-${name.toLowerCase().replace(/[^a-z\d]+/g, "-").replace(/-$/, "")}-${year}`;
  const device = { id, brand: "Google", market: "GLOBAL", category: "phone", series: family, family, variant,
    modelName: `Google ${name}`, generation: name, generationOrder: year, releaseYear: year,
    comparisonGroupId: `google.global.phone.${family === "Pixel" ? "pixel" : "pixel-fold"}.${variant}`,
    configurations, specs, computed: {} };
  const source = { id, modelName: device.modelName, generation: name, releaseYear: year, officialSpecUrl: page.url,
    referenceUrls: [page.url], sourceStatus: "verified", sourcePageType: "expanded_core_spec_snapshots",
    releaseEvidence: googleEvidence(page, String(year), `${year}`),
    fieldGaps: ["chip", "memory", "storage", "launchPrice", "displayType", "port", "rearCamera", "frontCamera"]
      .filter(key => !specs[key]).map(field => ({ field, reason: field === "launchPrice"
        ? "Google 海外型号，未采集该版本中国大陆人民币首发价，不将美元或汇率换算当国行价"
        : "该型号官方规格正文尚未读取到可明确绑定的此字段，留空" })),
    notes: "Google 官方型号表；年份来自所属标题，GLOBAL 为海外产品规格，非国行。地区可选存储汇总仅用于规格，地区差异保留配置原文；没有国行报价。图片另行逐张核验，不从混合型号海报借图。" };
  return { device, source };
}

export function readGooglePhones(page) {
  const article = googleArticle(page.html), result = [];
  let year, name;
  for (const match of article.matchAll(/<h2\b[^>]*>([^]*?)<\/h2>|<a\b[^>]*class="zippy"[^>]*>([^]*?)<\/a>|<table\b[^>]*>([^]*?)<\/table>/gi)) {
    if (match[1]) {
      const headingYear = googleText(match[1]).match(/20\d{2}/)?.[0];
      if (headingYear) year = Number(headingYear);
    } else if (match[2]) name = googleText(match[2]);
    else if (year >= 2017 && year <= 2026) {
      const caption = googleText(match[3].match(/<caption\b[^>]*>([^]*?)<\/caption>/i)?.[1] ?? "");
      const model = caption ? caption.replace(/ 技术规格$/, "") : name;
      assert.ok(model?.startsWith("Pixel "), "型号表必须有独立 caption 或展开项标题");
      result.push(readGooglePhone(page, match[3], model, year));
    }
  }
  assert.equal(new Set(result.map(row => row.device.id)).size, result.length, "Google 型号表重复");
  assert.ok(result.length, "Google 官方型号表为空");
  return result;
}
