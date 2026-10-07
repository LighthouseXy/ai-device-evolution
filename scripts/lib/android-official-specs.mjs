import assert from "node:assert/strict";
import { plainText } from "./zol-device.mjs";

export function readOppoShopData(html) {
  const raw = html.match(/window\.__NUXT__=([^]*?)<\/script>/)?.[1];
  // Only deserialize literal arguments and aliases; never execute remote JS.
  const match = raw?.match(/^\(function\(([\w,$]+)\)\{([^]*?)return (\{[^]*\})\}\(([^]*)\)\);?\s*$/);
  assert.ok(match, "商城预载数据不符合已核验序列化结构");
  const names = match[1].split(","), values = JSON.parse("[" + match[4] + "]");
  assert.equal(names.length, values.length);
  const aliases = new Map(names.map((name, i) => [name, values[i]]));
  const assignments = [...match[2].matchAll(/([\w$]+)\.([\w$]+)=([\w$]+);/g)];
  assert.equal(assignments.map(m => m[0]).join(""), match[2]);
  for (const [, object, key, value] of assignments) {
    assert.ok(aliases.has(object) && aliases.has(value) && !["constructor", "__proto__", "prototype"].includes(key));
    aliases.get(object)[key] = aliases.get(value);
  }
  const body = match[3].replace(/"(?:\\.|[^"\\])*"|[A-Za-z_$][\w$]*/g, (token, offset, text) => {
    if (token.startsWith('"') || ["null", "true", "false"].includes(token)) return token;
    if (text.slice(offset + token.length).match(/^\s*:/)) return JSON.stringify(token);
    assert.ok(aliases.has(token), "商城数据包含非别名标识符：" + token);
    return JSON.stringify(aliases.get(token));
  });
  const data = JSON.parse(body).data[0].resData;
  assert.ok(data.goodsSpuName && data.attributes?.skuItems && data.baseAttributes?.length, "商城无实际规格/SKU数据");
  return data;
}

export function samsungProductRows(html) {
  const rows = new Map();
  for (const [, body] of html.matchAll(/<li\b[^>]*class="pdd32-product-spec__content-item"[^>]*>([^]*?)<\/li>/g)) {
    const name = plainText(body.match(/class="pdd32-product-spec__content-item-title"[^>]*>([^]*?)<\/p>/)?.[1] ?? "");
    const value = plainText(body.match(/class="pdd32-product-spec__content-item-desc"[^>]*>([^]*?)<\/p>/)?.[1] ?? "");
    if (name && value) rows.set(name, value);
  }
  for (const [, body] of html.matchAll(/<li\b[^>]*class="spec-highlight__item"[^>]*>([^]*?)<\/li>/g)) {
    const name = plainText(body.match(/class="spec-highlight__title"[^>]*>([^]*?)<\/strong>/)?.[1] ?? "");
    const value = plainText(body.match(/class="spec-highlight__value"[^>]*>([^]*?)<\/span>/)?.[1] ?? "");
    if (name && value) rows.set(name, value);
  }
  return rows;
}

// 只读官网明确标注的规格段，不从宣传词猜快充功率、内存制式或系统版本。
export function readOfficialAndroidSpecs(brand, page) {
  const text = plainText(page.html);
  const patterns = brand === "OPPO" ? {
    memoryType: /RAM 规格 (.+?)(?= ROM 规格)/,
    storageType: /ROM 规格 (.+?)(?= 扩展存储| OTG 数据传输| 显示)/,
    operatingSystem: /操作系统 (?:\d+ )?(ColorOS [\d.]+)/,
    chargingMethod: /快速充电 (.+?)(?= 生物识别)/,
    security: /生物识别 (.+?)(?= 传感器)/,
    wifi: /WLAN 功能 (.+?)(?= 蓝牙)/,
    bluetooth: /蓝牙 (?:蓝牙 )?([\d.]+)/,
    port: /数据接口 (USB Type-C)(?= 音频接口)/,
    hasNFC: /NFC (支持[^]*?)(?= 操作系统)/,
    peakBrightness: /亮度 (\d+) 尼特峰值亮度/,
  } : brand === "vivo" ? {
    memoryType: /RAM类型 (.+?)(?= ROM类型)/,
    storageType: /ROM类型 (UFS[\d.]+)/,
    chargingMethod: /充电规格 (.+?)(?= 电池类型)/,
    operatingSystem: /操作系统 操作系统 (.+?)(?= Jovi| 数据连接)/,
    security: /指纹识别 (.+?)(?= 操作系统)/,
    wifi: /数据连接 WLAN (.+?)(?= WLAN热点)/,
    bluetooth: /蓝牙传输 (支持蓝牙[\d.]+)/,
    port: /USB接口类型 (.+?)(?= 耳机接口标准)/,
    hasNFC: /NFC (支持|不支持)(?= 云服务| 传感器| )/,
  } : {};
  return Object.fromEntries(Object.entries(patterns).flatMap(([key, pattern]) => {
    const match = text.match(pattern);
    if (!match) return [];
    const value = key === "hasNFC" ? match[1].startsWith("支持") : key === "peakBrightness" ? Number(match[1]) : match[1].trim();
    return [[key, { value, ...(key === "peakBrightness" ? { unit: "nit" } : {}), rawText: match[0], evidenceKind: "excerpt",
      sourceUrl: page.url, sourceType: "official", confidence: 1,
      verifiedAt: page.fetchedAt.slice(0, 10), fetchedAt: page.fetchedAt, sourceSnapshotHash: page.sha256 }]];
  }));
}
