import fs from "node:fs/promises";
import { getSourceSnapshot } from "./lib/source-snapshot.mjs";

// 小批次人工核对字段映射，下载、原文匹配和重放由脚本完成；不推导未出售的组合。
const urls = {
  spec60: "https://www.ithome.com/0/715/482.htm",
  price60: "https://www.ithome.com/0/716/940.htm",
  chip60: "https://ku.ithome.com/item/22284/canshu.html",
  port60: "https://detail.zol.com.cn/1428/1427338/param.shtml",
  spec70: "https://consumer.huawei.com/cn/phones/mate70-pro/specs/",
  chip70: "https://ku.ithome.com/item/46018/canshu.html",
  price70: "https://m.ithome.com/html/813323.htm",
  config70: "https://m.ithome.com/html/883505.htm",
  spec80: "https://consumer.huawei.com/cn/phones/mate80-pro/specs/",
  price80: "https://www.ithome.com/0/900/075.htm",
};
const textOf = (html) => html.replace(/<script\b[\s\S]*?<\/script>/gi, " ")
  .replace(/<style\b[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;|&#160;/g, " ").replace(/\s+/g, " ").trim();
const pages = {};
for (const [key, url] of Object.entries(urls)) {
  const model = `Mate ${key.match(/\d+/)[0]} Pro`;
  pages[key] = await getSourceSnapshot(url, {
    offline: process.argv.includes("--offline"), refresh: process.argv.includes("--refresh"),
    validate(html) {
      const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
      if (html.includes("\uFFFD")) throw new Error(`${url}: 页面编码损坏，需 --refresh 重采`);
      if (!title.replace(/\s+/g, "").includes(model.replace(/\s+/g, ""))
          && !["price60", "price70", "price80", "config70"].includes(key)) {
        throw new Error(`${url}: 页面身份不符，拒绝目录页、登录页或其他型号`);
      }
    },
  });
  pages[key].text = textOf(pages[key].html);
  // 同页有标准版、Pro、Pro+，配置和价格只在目标型号段落内匹配。
  const bounds = { price70: ["华为 Mate70 Pro：", "华为 Mate70 Pro+："], price80: ["HUAWEI Mate 80 Pro （SGT", "外观方面"], price60: ["华为 Mate 60 Pro 12GB+256GB", "7、消息称"] }[key];
  if (bounds) {
    const start = pages[key].text.indexOf(bounds[0]);
    const end = pages[key].text.indexOf(bounds[1], start);
    if (start < 0 || end <= start) throw new Error(`${key}: 目标型号价格段缺失`);
    pages[key].text = pages[key].text.slice(start, end);
  }
}

function field(value, key, pattern, unit) {
  const page = pages[key];
  const rawText = page.text.match(pattern)?.[0];
  if (!rawText) throw new Error(`${key}: 找不到 ${pattern}，整批不写入`);
  const official = new URL(urls[key]).hostname === "consumer.huawei.com";
  return { value, ...(unit ? { unit } : {}), rawText, evidenceKind: "excerpt",
    sourceUrl: urls[key], sourceType: official ? "official" : "reference",
    confidence: official ? 1 : 0.8, verifiedAt: page.fetchedAt.slice(0, 10),
    fetchedAt: page.fetchedAt, sourceSnapshotHash: page.sha256 };
}
function configuration(memory, storage, key, pattern, chip) {
  return { memory, storage, ...(chip ? { chip } : {}), evidence: field(`${memory} + ${storage}`, key, pattern) };
}
const devices = [60, 70, 80].map((generation, index) => {
  const key = `spec${generation}`;
  const year = [2023, 2024, 2025][index];
  const configurations = generation === 60
    ? ["256GB", "512GB", "1TB"].map((storage) => configuration("12GB", storage, "price60", new RegExp(`12GB\\+${storage} 版 \\d+ 元`)))
    : generation === 70
      ? ["256GB", "512GB", "1TB"].map((storage) => configuration("12GB", storage, "price70", new RegExp(`12GB \\+ ${storage} 定价 \\d+ 元`)))
        .concat(configuration("16GB", "512GB", "config70", /16GB\+512GB 6799 元 6799 元/))
      : [["12GB", "256GB"], ["12GB", "512GB"], ["16GB", "512GB"], ["16GB", "1TB"]]
        .map(([memory, storage]) => configuration(memory, storage, "price80", new RegExp(`${memory}\\+${storage} 版本：\\d+ 元`), memory === "12GB" ? "麒麟 9030" : "麒麟 9030 Pro"));
  const memory = generation === 60 ? "12GB" : "12GB / 16GB";
  const specs = generation === 60 ? {
    chip: field("麒麟 9000S", "chip60", /华为海思 麒麟9000S 5G/),
    screenSize: field(6.82, key, /6.82 英寸/, "inch"),
    displayType: field("LTPO OLED", key, /OLED 屏幕[^。]+LTPO 自适应刷新率/),
    resolution: field("2720x1260", key, /2720 × 1260 像素/),
    refreshRate: field(120, key, /1-120Hz LTPO 自适应刷新率/, "Hz"),
    memory: field(memory, key, /运行内存（RAM）为 12GB/),
    storage: field("256GB / 512GB / 1TB", key, /256GB \/ 512GB \/ 1TB 三种版本/),
    weight: field(225, key, /机身重量约 225 克（含电池）/, "g"),
    rearCamera: field("5000 万像素主摄 + 1200 万像素超广角 + 4800 万像素长焦", key, /5000 万像素超光变摄像头[^。]+4800 万像素超微距长焦摄像头（[^）]+）/),
    frontCamera: field("1300 万像素超广角 + 3D 深感摄像头", key, /前置摄像头为 1300 万像素[^。]+/),
    batteryCapacity: field(5000, key, /5000mAh（典型值）/, "mAh"),
    port: field("USB Type-C", "port60", /USB Type-C接口/),
  } : {
    chip: generation === 70 ? field("麒麟 9020", "chip70", /华为海思 麒麟9020/)
      : field("麒麟 9030（12GB）；麒麟 9030 Pro（16GB）", key, /麒麟\s?9030 Pro（16 GB RAM 版本） 麒麟\s?9030（12 GB RAM 版本）/),
    screenSize: field(generation === 70 ? 6.9 : 6.75, key, generation === 70 ? /6.9 英寸/ : /6.75 英寸/, "inch"),
    displayType: field("LTPO OLED", key, /OLED，支持 1-120 Hz LTPO 自适应刷新率/),
    resolution: field(generation === 70 ? "2832x1316" : "2832x1280", key, /2832 × (?:1316|1280) 像素/),
    refreshRate: field(120, key, /1-120 Hz LTPO 自适应刷新率/, "Hz"),
    memory: field(memory, key, /12 GB \/ 16 GB RAM/),
    storage: field("256GB / 512GB / 1TB", key, /256 GB \/ 512 GB \/ 1 TB ROM/),
    weight: field(generation === 70 ? 221 : 219, key, /约 (?:221|219) g（含电池）/, "g"),
    rearCamera: field("5000 万像素主摄 + 4000 万像素超广角 + 4800 万像素长焦 + 红枫原色摄像头", key, /5000 万像素超聚光摄像头[\s\S]+?红枫原色摄像头/),
    frontCamera: field("1300 万像素超广角 + 3D 深感摄像头", key, /1300 万像素超广角摄像头[^）]+） 3D 深感摄像头/),
    batteryCapacity: field(generation === 70 ? 5500 : 5750, key, /(?:5500|5750) mAh（典型值）/, "mAh"),
    port: field("USB Type-C（USB 3.1 Gen 1）", key, /USB Type-C，USB 3.1 Gen 1/),
  };
  if (generation === 60) {
    specs.mainCamera = field("5000 万像素超光变主摄（OIS）", key, /5000 万像素超光变摄像头（[^）]+）/);
    specs.ultraWide = field("1200 万像素超广角", key, /1200 万像素超广角摄像头（[^）]+）/);
    specs.telephoto = field("4800 万像素长焦（OIS）", key, /4800 万像素超微距长焦摄像头（[^）]+）/);
    specs.opticalZoom = field("3.5 倍光学变焦", key, /3.5 倍光学变焦/);
    specs.chargingMethod = field("最高 88W 有线 / 50W 无线", key, /最大 88W 的有线超级快充和 50W 的无线超级快充/);
    specs.wifi = field("Wi-Fi 6", key, /Wi-Fi 6/);
    specs.bluetooth = field("蓝牙 5.2", key, /蓝牙 5.2/);
    specs.waterResistance = field("IP68（防护性能并非永久有效）", key, /IP68 级别的防溅、抗水、防尘功能/);
  } else {
    specs.mainCamera = field("5000 万像素超聚光主摄（OIS）", key, /5000 万像素超聚光摄像头（[^）]+）/);
    specs.ultraWide = field("4000 万像素超广角", key, /4000 万像素超广角摄像头（[^）]+）/);
    specs.telephoto = field("4800 万像素微距长焦（OIS）", key, /4800 万像素超聚光微距长焦摄像头（[^）]+）/);
    specs.opticalZoom = field("4 倍光学变焦", key, /支持 4 倍光学变焦/);
    specs.chargingMethod = field("最高 100W 有线 / 80W 无线；需兼容充电器", key, /手机支持最大超级快充 100 W[\s\S]+?80 W 华为无线超级快充/);
    specs.waterResistance = field("IP68 / IP69（实验室条件，防护性能并非永久有效）", key, /IP68 级 6 米抗水，IP69 级抗高温高压喷水/);
    specs.hasNFC = field(true, key, /NFC 支持读卡器模式/);
  }
  // 首发价按最低配该 SKU 的首发定价，不拿旧新闻的促销价冒充当前价。
  const launchPattern = generation === 60 ? /华为 Mate 60 Pro 12GB\+256GB 版 6499 元/
    : generation === 70 ? /华为 Mate70 Pro： 12GB \+ 256GB 定价 6499 元/
      : /HUAWEI Mate 80 Pro （SGT-AL00\/50） 12GB\+256GB 版本：5999 元/;
  specs.launchPrice = { ...field(generation === 80 ? 5999 : 6499, `price${generation}`, launchPattern, "CNY"),
    priceType: "launch", market: "中国大陆", configuration: "12GB 运行内存 + 256GB 存储，中国大陆版本",
    condition: generation === 60 ? "最低配首发定价；最初先锋计划先售 512GB，非当日唯一开售配置" : "中国大陆最低配首发定价" };
  return { id: `huawei-mate-${generation}-pro-${year}`, brand: "Huawei", market: "CN", category: "phone",
    series: "HUAWEI Mate Pro", family: "HUAWEI Mate Pro", variant: "standard",
    modelName: `HUAWEI Mate ${generation} Pro`, generation: `Mate ${generation} Pro`, generationOrder: index + 1,
    releaseYear: year, releaseDate: ["2023-08-29", "2024-11-26", "2025-11-25"][index],
    comparisonGroupId: "huawei.phone.mate-pro.standard", configurations, specs, computed: {} };
});

const sources = { phone: devices.map((device) => ({
  id: device.id, modelName: device.modelName, generation: device.generation, releaseYear: device.releaseYear,
  sourcePageType: "official_and_reference_snapshots", sourceStatus: "verified",
  officialSpecUrl: device.releaseYear > 2023 ? urls[`spec${[60, 70, 80][device.generationOrder - 1]}`] : undefined,
  referenceUrls: [...new Set([...Object.values(device.specs), ...device.configurations.map((item) => item.evidence)].map((item) => item.sourceUrl))],
  notes: "国行规格批次；每个字段与配置均匹配已缓存网页原文。此脚本不写当前价、二手价或专业评分；行情独立由价格快照管理。Mate 60 Pro 旧中文规格页已跳转，不作为参数来源。",
})) };
// 全部来源和必需字段核验成功才替换批次；离线重放沿用真实抓取时间。
const generatedAt = Object.values(pages).map((page) => page.fetchedAt.slice(0, 10)).sort().at(-1);
await fs.writeFile("src/data/huawei-mate-devices-db.json", `${JSON.stringify({ metadata: { version: "1.0", totalDevices: devices.length, generatedAt }, devices }, null, 2)}\n`);
await fs.writeFile("src/data/huawei-mate-sources.json", `${JSON.stringify(sources, null, 2)}\n`);
console.log(JSON.stringify({ devices: devices.length, uniqueUrls: Object.keys(pages).length,
  networkRequests: Object.values(pages).filter((page) => !page.cacheHit).length }));
