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
  const assignments = [...match[2].matchAll(/([\w$]+)\.([\w$]+)=([\w$]+|"(?:\\.|[^"\\])*");/g)];
  assert.equal(assignments.map(m => m[0]).join(""), match[2]);
  for (const [, object, key, value] of assignments) {
    assert.ok(aliases.has(object) && (value.startsWith('"') || aliases.has(value)) && !["constructor", "__proto__", "prototype"].includes(key));
    const target = aliases.get(object);
    assert.ok(target && typeof target === "object" && !Array.isArray(target), "商城赋值目标必须是数据对象");
    // 最新商城的展示文案可直接序列化为 JSON 字符串；仍不执行任何来源脚本。
    target[key] = value.startsWith('"') ? JSON.parse(value) : aliases.get(value);
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

export function readSamsungCameraSpecs(page, model) {
  assert.ok(/^Galaxy S2[456](?:\+| Ultra)?$/.test(model));
  assert.equal(new URL(page.url).hostname, "www.samsung.com.cn");
  const text = plainText(page.html);
  // S26 系列页同时含三个型号；先限定该型号区块，不能取页面第一组摄像头。
  const section = model.startsWith("Galaxy S26") && !model.endsWith("Ultra")
    ? text.split(`${model} 夜间拍摄清晰明亮 搭载超视觉引擎 `)[1]?.split(" Galaxy ")[0]
    : text.match(/后置摄像头 ((?:\d|,)[^]*?)(?= 前置摄像头| 比较摄像头)/)?.[1];
  assert.ok(section, `${model}: 无独立影像区块`);
  const lenses = section.split(/ (?=[\d,]+\s*(?:亿|万)像素)/);
  const specs = {};
  for (const lens of lenses) {
    const key = /超广角摄像头/.test(lens) ? "ultraWide" : /长焦摄像头|[35]倍光学变焦/.test(lens) ? "telephoto"
      : /广角摄像头/.test(lens) ? "mainCamera" : null;
    assert.ok(key && /^(?:[\d,]+\s*(?:亿|万)像素)/.test(lens), `${model}: 不能确定镜头归属：${lens}`);
    const previous = specs[key];
    const value = lens.replace(/(?<=\d),(?=\d{3})/g, "");
    specs[key] = { value: previous ? `${previous.value}；${value}` : value, rawText: section, evidenceKind: "excerpt",
      sourceUrl: page.url, sourceType: "official", confidence: 1, verifiedAt: page.fetchedAt.slice(0, 10),
      fetchedAt: page.fetchedAt, sourceSnapshotHash: page.sha256 };
  }
  assert.ok(specs.mainCamera && specs.ultraWide && specs.telephoto);
  specs.rearCamera = { ...specs.mainCamera, value: lenses.join("；").replace(/(?<=\d),(?=\d{3})/g, "") };
  return specs;
}

// 限于已核验的中文规格结构；镜头按名称绑定，不按编号或像素顺序猜测。
export function readOfficialCameraSpecs(brand, page) {
  const text = plainText(page.html);
  const specs = {};
  const put = (key, value, rawText = value) => {
    assert.ok(value && text.includes(rawText), `${key}: 影像原文不在快照中`);
    const previous = specs[key];
    specs[key] = { value: previous ? `${previous.value}；${value}` : value,
      rawText: previous ? text.slice(Math.min(text.indexOf(previous.rawText), text.indexOf(rawText)),
        Math.max(text.indexOf(previous.rawText) + previous.rawText.length, text.indexOf(rawText) + rawText.length)) : rawText, evidenceKind: "excerpt",
      sourceUrl: page.url, sourceType: "official", confidence: 1,
      verifiedAt: page.fetchedAt.slice(0, 10), fetchedAt: page.fetchedAt, sourceSnapshotHash: page.sha256 };
  };
  const role = (value) => /红枫|丹霞/.test(value) ? "colorCamera"
    : /超广角/.test(value) ? "ultraWide" : /长焦|哈苏人像/.test(value) ? "telephoto"
    : /主摄|一英寸|超聚光摄像头|大底广角|像素广角摄像头|35mm 蔡司人文纪实/.test(value) ? "mainCamera" : null;
  if (brand === "Huawei" || brand === "OPPO") {
    const rear = brand === "Huawei" ? text.match(/后置摄像头 后置摄像头 (.+?)(?= \*)/)?.[1]
      : text.match(/摄像头 后置 (.+?)(?= 照片拍摄| 支持：)/)?.[1];
    assert.ok(rear, "缺少已核验的后置镜头段");
    const lenses = rear.split(/ (?=\d+ 万(?:像素|多光谱))/);
    for (const lens of lenses) {
      const key = role(lens);
      assert.ok(key, `未识别镜头，保留旧数据：${lens}`);
      put(key, lens);
    }
    put("rearCamera", lenses.join("；"), rear);
    const front = brand === "Huawei" ? text.match(/前置摄像头 前置摄像头 (.+?)(?= \*)/)?.[1]
      : text.match(/ 前置 (\d+ 万像素摄像头.+?)(?= 支持：)/)?.[1];
    put("frontCamera", front);
    const zoom = brand === "Huawei" ? text.match(/后置摄像头变焦模式 (.+?)(?= 后置摄像头对焦方式)/)?.[1]
      : text.match(/照片拍摄(支持最高 .+?)(?= 支持：)/)?.[1];
    if (zoom) put("opticalZoom", zoom);
    const video = brand === "Huawei" ? text.match(/后置摄像头摄像分辨率 (.+?)(?= 后置闪光灯)/)?.[1]
      : text.match(/视频拍摄 后置 (.+?)(?= 前置| Log 还原)/)?.[1];
    if (video) put("videoRecording", `后置：${video.replace(/\s+\*+/g, "；")
      .replace(/ (?=1080P 视频|720P 视频|慢动作视频|电影模式|延时摄影|多景录像|支持|视频(?:拍摄|模式)支持)/g, "；")}`, video);
  } else if (brand === "vivo") {
    const rear = text.match(/后置摄像头像素 (.+?)(?= 后置摄像头光圈)/)?.[1];
    const apertures = text.match(/后置摄像头光圈 (.+?)(?= 后置闪光灯)/)?.[1];
    assert.ok(rear && apertures, "缺少镜头/光圈明确绑定段");
    const byRole = new Map();
    for (const match of apertures.matchAll(/f\/[\d.]+（([^）]+)）/g)) {
      const key = role(match[1]);
      assert.ok(key && !byRole.has(key), `光圈类型不能唯一绑定：${match[0]}`);
      byRole.set(key, match[0]);
    }
    for (const lens of rear.split(/ (?=\d+(?:万|亿)像素)/)) {
      const key = role(lens), aperture = byRole.get(key);
      assert.ok(key && aperture, `镜头没有明确光圈绑定：${lens}`);
      // 以镜头名称对应光圈，不依靠三个光圈的排列顺序。
      put(key, lens);
      specs[key].value += `；${aperture}`;
    }
    const front = text.match(/前置摄像头像素 (.+?) 前置摄像头光圈 (.+?)(?= 后置摄像头数量)/);
    assert.ok(front, "缺少前置参数");
    put("frontCamera", `${front[1]}；${front[2]}`, front[0]);
    const stabilization = text.match(/防抖类型 (.+?)(?= 自动对焦)/)?.[1];
    const focus = text.match(/自动对焦 (.+?)(?= 变焦模式)/)?.[1];
    assert.ok(stabilization && focus, "缺少防抖/对焦条件");
    for (const key of ["mainCamera", "telephoto", "ultraWide"]) {
      const ois = /后置摄像头均支持OIS/.test(stabilization) || key !== "ultraWide" && /主摄像头和长焦摄像头支持OIS/.test(stabilization);
      if (ois) specs[key].value += "；OIS 光学防抖";
      if (/后置摄像头均支持AF/.test(focus)) specs[key].value += "；AF 自动对焦";
      specs[key].rawText = text.match(/后置摄像头像素 .+?(?= 变焦模式)/)[0];
    }
    put("rearCamera", rear.split(/ (?=\d+(?:万|亿)像素)/).join("；"), rear);
    const zoom = text.match(/变焦模式 (.+?)(?= 拍摄模式)/)?.[1];
    if (zoom) put("opticalZoom", zoom);
    const video = text.match(/视频录制 (.+?)(?= 网络参数)/)?.[1];
    if (video) put("videoRecording", video);
  } else throw new Error(`未支持的影像规格来源：${brand}`);
  assert.ok(specs.mainCamera && specs.ultraWide && specs.telephoto, "本批必须有完整三类镜头，不能导入半成品");
  return specs;
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
