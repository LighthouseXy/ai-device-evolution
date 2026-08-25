import fs from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
const EN_DEVICES_PATH = new URL("src/data/apple-devices-db.en-us.json", ROOT);
const EN_SOURCES_PATH = new URL("src/data/apple-sources.en-us.json", ROOT);
const ZH_DEVICES_PATH = new URL("src/data/apple-devices-db.json", ROOT);
const ZH_SOURCES_PATH = new URL("src/data/apple-sources.json", ROOT);
const VERIFIED_AT = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai" }).format(new Date());

const ZH_LAUNCH_PRICES = {
  "iphone-7-2016": [5388, "https://www.apple.com.cn/newsroom/2016/09/07Apple-Introduces-iPhone-7-iPhone-7-Plus-The-Best-Most-Advanced-iPhone-Ever/"],
  "iphone-7-plus-2016": [6388, "https://www.apple.com.cn/newsroom/2016/09/07Apple-Introduces-iPhone-7-iPhone-7-Plus-The-Best-Most-Advanced-iPhone-Ever/"],
  "iphone-8-2017": [5888, "https://www.apple.com.cn/newsroom/2017/09/iphone-8-and-iphone-8-plus-a-new-generation-of-iphone/"],
  "iphone-x-2017": [8388, "https://www.apple.com.cn/newsroom/2017/09/the-future-is-here-iphone-x/"],
  "iphone-xr-2018": [6499, "https://www.apple.com.cn/newsroom/2018/09/apple-introduces-iphone-xr/"],
  "iphone-xs-2018": [8699, "https://www.apple.com.cn/newsroom/2018/09/iphone-xs-and-iphone-xs-max-bring-the-best-and-biggest-displays-to-iphone/"],
  "iphone-xs-max-2018": [9599, "https://www.apple.com.cn/newsroom/2018/09/iphone-xs-and-iphone-xs-max-bring-the-best-and-biggest-displays-to-iphone/"],
  "iphone-11-2019": [5499, "https://www.apple.com.cn/newsroom/2019/09/apple-introduces-dual-camera-iphone-11/"],
  "iphone-11-pro-2019": [8699, "https://www.apple.com.cn/newsroom/2019/09/iphone-11-pro-and-iphone-11-pro-max-the-most-powerful-and-advanced-smartphones/"],
  "iphone-11-pro-max-2019": [9599, "https://www.apple.com.cn/newsroom/2019/09/iphone-11-pro-and-iphone-11-pro-max-the-most-powerful-and-advanced-smartphones/"],
  "iphone-17e-2026": [4499, "https://www.apple.com.cn/newsroom/2026/03/apple-introduces-iphone-17e/"],
  "ipad-air-m4-2025": [4799, "https://www.apple.com.cn/newsroom/2026/03/apple-introduces-the-new-ipad-air-powered-by-m4/"],
  "ipad-pro-9-7-2016": [4388, "https://www.apple.com.cn/newsroom/2016/03/21Apple-Introduces-9-7-inch-iPad-Pro/"],
  "ipad-5th-2017": [2688, "https://www.apple.com.cn/newsroom/2017/03/21New-9-7-inch-iPad-Features-Stunning-Retina-Display-Incredible-Performance/"],
  "ipad-pro-10-5-2017": [5188, "https://www.apple.com.cn/newsroom/2017/06/ipad-pro-10-5-and-12-9-inch-models-introduces-worlds-most-advanced-display-breakthrough-performance/"],
  "ipad-pro-12-9-2nd-2017": [6388, "https://www.apple.com.cn/newsroom/2017/06/ipad-pro-10-5-and-12-9-inch-models-introduces-worlds-most-advanced-display-breakthrough-performance/"],
  "ipad-6th-2018": [2588, "https://www.apple.com.cn/newsroom/2018/03/apple-introduces-new-9-7-inch-ipad-with-apple-pencil-support/"],
  "ipad-pro-11-1st-2018": [6499, "https://www.apple.com.cn/newsroom/2018/10/new-ipad-pro-with-all-screen-design-is-most-advanced-powerful-ipad-ever/"],
  "ipad-pro-12-9-3rd-2018": [8099, "https://www.apple.com.cn/newsroom/2018/10/new-ipad-pro-with-all-screen-design-is-most-advanced-powerful-ipad-ever/"],
  "ipad-air-3rd-2019": [3999, "https://www.apple.com.cn/newsroom/2019/03/all-new-ipad-air-and-ipad-mini-deliver-dramatic-power-and-capability/"],
  "ipad-mini-5th-2019": [2999, "https://www.apple.com.cn/newsroom/2019/03/all-new-ipad-air-and-ipad-mini-deliver-dramatic-power-and-capability/"],
  "ipad-7th-2019": [2699, "https://www.apple.com.cn/newsroom/2019/09/apple-introduces-new-version-of-the-most-popular-ipad-starting-at-329/"],
  "ipad-pro-11-2nd-2020": [6229, "https://www.apple.com.cn/newsroom/2020/03/apple-unveils-new-ipad-pro-with-lidar-scanner-and-trackpad-support-in-ipados/"],
  "ipad-pro-12-9-4th-2020": [7899, "https://www.apple.com.cn/newsroom/2020/03/apple-unveils-new-ipad-pro-with-lidar-scanner-and-trackpad-support-in-ipados/"],
  "ipad-8th-2020": [2499, "https://www.apple.com.cn/newsroom/2020/09/apple-introduces-eighth-generation-ipad-with-a-huge-jump-in-performance/"],
  "ipad-air-4th-2020": [4799, "https://www.apple.com.cn/newsroom/2020/09/apple-unveils-all-new-ipad-air-with-a14-bionic-apples-most-advanced-chip/"],
  "ipad-pro-11-m1-2021": [6199, "https://www.apple.com.cn/newsroom/2021/04/apple-unveils-new-ipad-pro-with-m1-chip-and-stunning-liquid-retina-xdr-display/"],
  "ipad-pro-12-9-m1-2021": [8499, "https://www.apple.com.cn/newsroom/2021/04/apple-unveils-new-ipad-pro-with-m1-chip-and-stunning-liquid-retina-xdr-display/"],
  "ipad-air-m1-2022": [4399, "https://www.apple.com.cn/newsroom/2022/03/apple-introduces-the-most-powerful-and-versatile-ipad-air-ever/"],
  "ipad-air-13-m2-2024": [6499, "https://www.apple.com.cn/newsroom/2024/05/apple-unveils-the-redesigned-11-inch-and-all-new-13-inch-ipad-air-with-m2/"],
  "ipad-air-13-m3-2025": [6499, "https://www.apple.com.cn/newsroom/2025/03/apple-introduces-ipad-air-with-powerful-m3-chip-new-magic-keyboard/"],
  "ipad-air-13-m4-2026": [6499, "https://www.apple.com.cn/newsroom/2026/03/apple-introduces-the-new-ipad-air-powered-by-m4/"],
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
  "macbook-12-2016": [9288, "https://www.apple.com.cn/newsroom/2016/04/19Apple-Updates-MacBook-with-Latest-Processors-Longer-Battery-Life-New-Rose-Gold-Finish/"],
  "macbook-pro-13-2-port-2016": [11488, "https://www.apple.com.cn/newsroom/2016/10/apple-unveils-groundbreaking-new-macbook-pro/"],
  "macbook-pro-13-4-port-2016": [13888, "https://www.apple.com.cn/newsroom/2016/10/apple-unveils-groundbreaking-new-macbook-pro/"],
  "macbook-pro-15-2016": [18488, "https://www.apple.com.cn/newsroom/2016/10/apple-unveils-groundbreaking-new-macbook-pro/"],
  "macbook-pro-13-2-port-2017": [10288, "https://www.apple.com.cn/newsroom/2017/06/imac-receives-major-update-featuring-more-powerful-graphics-faster-processors-thunderbolt-3-brighter-displays/"],
  "macbook-air-13-2018": [9499, "https://www.apple.com.cn/newsroom/2018/10/all-new-macbook-air-takes-flight/"],
  "macbook-pro-13-4-port-2018": [14188, "https://www.apple.com.cn/newsroom/2018/07/apple-updates-macbook-pro-with-faster-performance-and-new-features-for-pros/"],
  "macbook-pro-15-2018": [18688, "https://www.apple.com.cn/newsroom/2018/07/apple-updates-macbook-pro-with-faster-performance-and-new-features-for-pros/"],
  "macbook-air-13-2019": [8899, "https://www.apple.com.cn/newsroom/2019/07/macbook-air-and-macbook-pro-updated-for-back-to-school-season/"],
  "macbook-pro-13-2-port-2019": [9999, "https://www.apple.com.cn/newsroom/2019/07/macbook-air-and-macbook-pro-updated-for-back-to-school-season/"],
  "macbook-pro-13-4-port-2019": [13899, "https://www.apple.com.cn/newsroom/2019/05/apple-introduces-first-8-core-macbook-pro-the-fastest-mac-notebook-ever/"],
  "macbook-pro-15-2019": [18199, "https://www.apple.com.cn/newsroom/2019/05/apple-introduces-first-8-core-macbook-pro-the-fastest-mac-notebook-ever/"],
  "macbook-pro-16-2019": [18999, "https://www.apple.com.cn/newsroom/2019/11/apple-introduces-16-inch-macbook-pro-the-worlds-best-pro-notebook/"],
  "macbook-air-13-intel-2020": [7999, "https://www.apple.com.cn/newsroom/2020/03/new-macbook-air-has-more-to-love-and-is-now-just-999/"],
  "macbook-pro-13-2-port-2020": [9999, "https://www.apple.com.cn/newsroom/2020/05/apple-updates-13-inch-macbook-pro-with-magic-keyboard-double-the-storage-and-faster-performance/"],
  "macbook-pro-14-m1-pro-2021": [14999, "https://www.apple.com.cn/newsroom/2021/10/apple-unveils-game-changing-macbook-pro/"],
  "macbook-pro-16-m1-pro-2021": [18999, "https://www.apple.com.cn/newsroom/2021/10/apple-unveils-game-changing-macbook-pro/"],
  "macbook-pro-14-m2-pro-2023": [15999, "https://www.apple.com.cn/newsroom/2023/01/apple-unveils-macbook-pro-featuring-m2-pro-and-m2-max/"],
  "macbook-air-15-m2-2023": [10499, "https://www.apple.com.cn/newsroom/2023/06/apple-introduces-the-15-inch-macbook-air/"],
  "macbook-pro-14-m3-2023": [12999, "https://www.apple.com.cn/newsroom/2023/10/apple-unveils-new-macbook-pro-featuring-m3-chips/"],
  "macbook-pro-14-m3-pro-2023": [16999, "https://www.apple.com.cn/newsroom/2023/10/apple-unveils-new-macbook-pro-featuring-m3-chips/"],
  "macbook-pro-16-m3-pro-2023": [19999, "https://www.apple.com.cn/newsroom/2023/10/apple-unveils-new-macbook-pro-featuring-m3-chips/"],
  "macbook-neo-13-2026": [4599, "https://www.apple.com.cn/newsroom/2026/03/say-hello-to-macbook-neo/"],
};

const REFERENCE_LAUNCH_PRICES = {
  "iphone-se-1-2016": {
    value: 3288,
    sourceUrl: "https://tc.people.com.cn/n1/2016/0322/c183008-28216682.html",
    sourceName: "人民网",
    rawText: "苹果中国官网已将其上架，iPhone SE 3288 元起售。",
    configuration: "16GB，中国大陆版本",
    observedAt: "2016-03-22",
  },
  "iphone-8-plus-2017": {
    value: 6688,
    sourceUrl: "https://mobile.zol.com.cn/655/6559775.html",
    sourceName: "中关村在线",
    rawText: "中国官网 iPhone 8 售价 5888 元起，iPhone 8 Plus 售价 6688 元起。",
    configuration: "64GB，中国大陆版本",
    observedAt: "2017-09-15",
  },
};

const REFERENCE_CURRENT_PRICES = {
  "ipad-a16-2025": {
    value: 2830,
    sourceUrl: "https://www.shihuo.cn/page/pcGoodsDetail?goodsId=7124264&styleId=434762522",
    sourceName: "识货",
    rawText: "截至8月24日，识货为您实时监控全网14家正品放心店铺。当前同款同规格全网最低价为¥2830，来自百亿补贴店铺。",
    configuration: "银色，128GB，WLAN 版",
    observedAt: "2026-08-24",
  },
  "ipad-air-m4-2025": {
    value: 4540,
    sourceUrl: "https://www.shihuo.cn/page/pcGoodsDetail?goodsId=8785051&styleId=945737998",
    sourceName: "识货",
    rawText: "截至8月24日，识货为您实时监控全网9家正品放心店铺。当前同款同规格全网最低价为¥4540，来自百亿补贴店铺。",
    configuration: "紫色，128GB，WLAN 版，官方标配，中国大陆版本",
    observedAt: "2026-08-24",
  },
  "ipad-air-13-m4-2026": {
    value: 6100,
    sourceUrl: "https://www.shihuo.cn/page/pcGoodsDetail?goodsId=8785062&styleId=954518428&skuId=3531042632",
    sourceName: "识货",
    rawText: "截至8月24日，识货为您实时监控全网5家正品放心店铺。当前同款同规格全网最低价为¥6100，来自百亿补贴店铺。",
    configuration: "紫色，128GB，WLAN 版，官方标配，国行版",
    observedAt: "2026-08-24",
  },
  "ipad-pro-m5-11-2025": {
    value: 8590,
    sourceUrl: "https://www.shihuo.cn/page/pcGoodsDetail?goodsId=8212843&styleId=791957349&skuId=2833898713",
    sourceName: "识货",
    rawText: "截至8月24日，识货为您实时监控全网12家正品放心店铺。当前同款同规格全网最低价为¥8590，来自识货安心购店铺。",
    configuration: "深空黑色，256GB，WLAN 版，标准玻璃面板，国行版",
    condition: "全新，识货安心购店铺最低价；优惠资格与库存以来源页为准",
    observedAt: "2026-08-24",
  },
  "ipad-pro-m5-13-2025": {
    value: 8690,
    sourceUrl: "https://www.shihuo.cn/page/pcGoodsDetail?goodsId=8212854&styleId=791957856&skuId=2834135690",
    sourceName: "识货",
    rawText: "截至8月24日，识货为您实时监控全网5家正品放心店铺。当前同款同规格全网最低价为¥8690，来自识货安心购店铺。",
    configuration: "深空黑色，256GB，WLAN 版，标准玻璃面板，国行版",
    condition: "全新，识货安心购店铺最低价；优惠资格与库存以来源页为准",
    observedAt: "2026-08-24",
  },
  "ipad-mini-a17-pro-2024": {
    value: 4799,
    sourceUrl: "https://www.apple.com.cn/shop/buy-ipad/ipad-mini",
    sourceName: "Apple 中国大陆在线商店",
    rawText: "购买 iPad mini；128GB 紫色无线局域网机型当前价格 RMB 4,799。",
    configuration: "紫色，128GB，无线局域网机型，中国大陆版本",
    condition: "全新，Apple 中国大陆官方在售价",
    observedAt: "2026-08-24",
    sourceType: "apple",
  },
  "iphone-16": {
    value: 5399,
    sourceUrl: "https://www.apple.com.cn/shop/buy-iphone/iphone-16",
    sourceName: "Apple 中国大陆在线商店",
    rawText: "购买 iPhone 16；128GB 黑色解锁机当前价格 RMB 5,399。",
    configuration: "黑色，128GB，解锁机，中国大陆版本",
    condition: "全新，Apple 中国大陆官方在售价",
    observedAt: "2026-08-24",
    sourceType: "apple",
  },
  "iphone-16-plus": {
    value: 5999,
    sourceUrl: "https://www.apple.com.cn/shop/buy-iphone/iphone-16",
    sourceName: "Apple 中国大陆在线商店",
    rawText: "购买 iPhone 16 Plus；128GB 黑色解锁机当前价格 RMB 5,999。",
    configuration: "黑色，128GB，解锁机，中国大陆版本",
    condition: "全新，Apple 中国大陆官方在售价",
    observedAt: "2026-08-24",
    sourceType: "apple",
  },
  "iphone-17": {
    value: 5380,
    sourceUrl: "https://www.shihuo.cn/page/pcGoodsDetail?goodsId=7929787&styleId=713169122",
    sourceName: "识货",
    rawText: "截至8月24日，识货为您实时监控全网16家正品放心店铺。当前同款同规格全网最低价为¥5380，来自百亿补贴店铺。",
    configuration: "白色，256GB，中国大陆版本",
    observedAt: "2026-08-24",
  },
  "iphone-17-pro": {
    value: 7270,
    sourceUrl: "https://www.shihuo.cn/page/pcGoodsDetail?goodsId=7929848&styleId=754572635",
    sourceName: "识货",
    rawText: "截至8月24日，识货为您实时监控全网21家正品放心店铺。当前同款同规格全网最低价为¥7270，来自百亿补贴店铺。",
    configuration: "银色，256GB，中国大陆版本",
    observedAt: "2026-08-24",
  },
  "iphone-17-pro-max": {
    value: 8210,
    sourceUrl: "https://www.shihuo.cn/page/pcGoodsDetail?goodsId=7929864&styleId=713174603",
    sourceName: "识货",
    rawText: "截至8月24日，识货为您实时监控全网20家正品放心店铺。当前同款同规格全网最低价为¥8210，来自百亿补贴店铺。",
    configuration: "银色，256GB，中国大陆版本",
    observedAt: "2026-08-24",
  },
  "iphone-air": {
    value: 7999,
    sourceUrl: "https://www.apple.com.cn/shop/buy-iphone/iphone-air",
    sourceName: "Apple 中国大陆在线商店",
    rawText: "购买 iPhone Air；256GB 天蓝色解锁机当前价格 RMB 7,999。",
    configuration: "天蓝色，256GB，解锁机，中国大陆型号 A3518",
    condition: "全新，Apple 中国大陆官方在售价",
    observedAt: "2026-08-24",
    sourceType: "apple",
  },
  "iphone-17e-2026": {
    value: 4499,
    sourceUrl: "https://www.apple.com.cn/shop/buy-iphone/iphone-17e",
    sourceName: "Apple 中国大陆在线商店",
    rawText: "购买 iPhone 17e；256GB 浅粉色当前价格 RMB 4,499。",
    configuration: "浅粉色，256GB，中国大陆版本",
    condition: "全新，Apple 中国大陆官方在售价",
    observedAt: "2026-08-24",
    sourceType: "apple",
  },
  "macbook-air-13-m5-2026": {
    value: 8000,
    sourceUrl: "https://www.shihuo.cn/page/pcGoodsDetail?goodsId=8785010&styleId=945732557",
    sourceName: "识货",
    rawText: "截至8月24日，识货为您实时监控全网5家正品放心店铺。当前同款同规格全网最低价为¥8000，来自官方店铺。",
    configuration: "天蓝色，M5 10 核 CPU / 8 核 GPU，16GB 内存，512GB 存储",
    condition: "全新，识货聚合官方店铺最低价；优惠资格与库存以来源页为准",
    observedAt: "2026-08-24",
  },
  "macbook-air-15-m5-2026": {
    value: 11999,
    sourceUrl: "https://www.apple.com.cn/shop/buy-mac/macbook-air/15-inch-midnight-m5-chip-10-core-cpu-10-core-gpu-16gb-memory-512gb-storage",
    sourceName: "Apple 中国大陆在线商店",
    rawText: "购买 MacBook Air 15 英寸 (M5) - 午夜色 - 16GB/512GB；当前价格 RMB 11,999。",
    configuration: "午夜色，M5 10 核 CPU / 10 核 GPU，16GB 内存，512GB 存储，中国大陆版本",
    condition: "全新，Apple 中国大陆官方在售价",
    observedAt: "2026-08-24",
    sourceType: "apple",
  },
  "macbook-pro-14-m5-2025": {
    value: 13200,
    sourceUrl: "https://www.shihuo.cn/page/pcGoodsDetail?goodsId=8212827&styleId=797735436",
    sourceName: "识货",
    rawText: "截至8月24日，识货为您实时监控全网2家正品放心店铺。当前同款同规格全网最低价为¥1.32万，来自百亿补贴店铺。",
    configuration: "银色，M5 10 核 CPU / 10 核 GPU，16GB 内存，1TB 存储",
    observedAt: "2026-08-24",
  },
  "macbook-pro-14-m5-pro-2026": {
    value: 19999,
    sourceUrl: "https://www.apple.com.cn/shop/buy-mac/macbook-pro/14-inch-space-black-standard-display-apple-m5-pro-chip-15-core-cpu-16-core-gpu-24gb-memory-1tb-storage",
    sourceName: "Apple 中国大陆在线商店",
    rawText: "购买 MacBook Pro 14 英寸 (M5 Pro) - 深空黑色 - 24GB/1TB；当前价格 RMB 19,999。",
    configuration: "14 英寸，标准显示屏，M5 Pro 15 核 CPU / 16 核 GPU，24GB 内存，1TB 存储，中国大陆版本",
    condition: "全新，Apple 中国大陆官方在售价",
    observedAt: "2026-08-24",
    sourceType: "apple",
  },
  "macbook-pro-14-m5-max-2026": {
    value: 33999,
    sourceUrl: "https://www.apple.com.cn/shop/buy-mac/macbook-pro/14-inch-space-black-standard-display-apple-m5-max-chip-18-core-cpu-32-core-gpu-36gb-memory-2tb-storage",
    sourceName: "Apple 中国大陆在线商店",
    rawText: "购买 MacBook Pro 14 英寸 (M5 Max) - 深空黑色 - 36GB/2TB；当前价格 RMB 33,999。",
    configuration: "14 英寸，标准显示屏，M5 Max 18 核 CPU / 32 核 GPU，36GB 内存，2TB 存储，中国大陆版本",
    condition: "全新，Apple 中国大陆官方在售价",
    observedAt: "2026-08-24",
    sourceType: "apple",
  },
  "macbook-pro-16-m5-2026": {
    value: 24999,
    sourceUrl: "https://www.apple.com.cn/shop/buy-mac/macbook-pro/16-inch-space-black-standard-display-apple-m5-pro-chip-18-core-cpu-20-core-gpu-24gb-memory-1tb-storage",
    sourceName: "Apple 中国大陆在线商店",
    rawText: "购买 MacBook Pro 16 英寸 (M5 Pro) - 深空黑色 - 24GB/1TB；当前价格 RMB 24,999。",
    configuration: "16 英寸，标准显示屏，M5 Pro 18 核 CPU / 20 核 GPU，24GB 内存，1TB 存储，中国大陆版本",
    condition: "全新，Apple 中国大陆官方在售价",
    observedAt: "2026-08-24",
    sourceType: "apple",
  },
  "macbook-pro-16-m5-max-2026": {
    value: 35999,
    sourceUrl: "https://www.apple.com.cn/shop/buy-mac/macbook-pro/16-inch-space-black-standard-display-apple-m5-max-chip-18-core-cpu-32-core-gpu-36gb-memory-2tb-storage",
    sourceName: "Apple 中国大陆在线商店",
    rawText: "购买 MacBook Pro 16 英寸 (M5 Max) - 深空黑色 - 36GB/2TB；当前价格 RMB 35,999。",
    configuration: "16 英寸，标准显示屏，M5 Max 18 核 CPU / 32 核 GPU，36GB 内存，2TB 存储，中国大陆版本",
    condition: "全新，Apple 中国大陆官方在售价",
    observedAt: "2026-08-24",
    sourceType: "apple",
  },
  "macbook-neo-13-2026": {
    value: 5499,
    sourceUrl: "https://www.apple.com.cn/shop/buy-mac/macbook-neo",
    sourceName: "Apple 中国大陆在线商店",
    rawText: "购买 MacBook Neo；8GB 内存、256GB 存储版本当前价格 RMB 5,499。",
    configuration: "A18 Pro 6 核 CPU / 5 核 GPU，8GB 内存，256GB 存储，中国大陆版本",
    condition: "全新，Apple 中国大陆官方在售价",
    observedAt: "2026-08-24",
    sourceType: "apple",
  },
};

const REFERENCE_USED_PRICES = {
  "macbook-air-13-m1-2020": {
    value: 2709,
    sourceUrl: "https://item.m.jd.com/product/10084690426313.html",
    sourceName: "京东爱回收严选官方旗舰店",
    rawText: "Apple MacBook Air (M1) 2020 款 13 英寸二手笔记本，深空灰色，M1+8G+256G，8 成新，电池效率 80%-90%，购买渠道国行，页面价 2709 元。",
    configuration: "深空灰色，M1，8GB 内存，256GB 存储，购买渠道国行",
    condition: "二手，8 成新，电池效率 80%-90%，官方验；优惠与库存以来源页为准",
    observedAt: "2026-08-25",
  },
  "macbook-air-13-m2-2022": {
    value: 3979,
    sourceUrl: "https://item.m.jd.com/product/10073708140429.html",
    sourceName: "京东爱回收严选官方旗舰店",
    rawText: "Apple MacBook Air（M2）2022 款 13 英寸二手笔记本，午夜色，8G+256G，8 成新，电池效率 90% 以上，购买渠道国行，页面价 3979 元。",
    configuration: "午夜色，M2，8GB 内存，256GB 存储，购买渠道国行",
    condition: "二手，8 成新，电池效率 90% 以上，官方验；优惠与库存以来源页为准",
    observedAt: "2026-08-25",
  },
  "macbook-air-13-m3-2024": {
    value: 4799,
    sourceUrl: "https://m2.9ji.com/secondHand/detail/1151113",
    sourceName: "九机二手良品",
    rawText: "苹果 MacBook Air 2024 款 M3 版 13.6 英寸二手笔记本，午夜色，8G+256GB，9 成新，电池寿命 91%-95%，未检出维修痕迹，中国大陆昆明仓在售，页面价 4799 元。",
    configuration: "午夜色，M3，8GB 内存，256GB 存储，中国大陆昆明仓",
    condition: "二手，9 成新，电池寿命 91%-95%，未检出维修痕迹；库存与价格以来源页为准",
    observedAt: "2026-08-25",
  },
  "iphone-7-plus-2016": {
    value: 459,
    sourceUrl: "https://pro.m.jd.com/mall/active/4JRfHorUDXgL77E9YdNxSCNMKwkJ/index.html?bbtf=1&currSku=10087153553976&fromName=tongtianta&pageNum=1&preSrc=&queryType=1&rankId=3427468&rankType=19&transparent=1",
    sourceName: "京东 6英以下屏幕二手手机好评榜",
    rawText: "Apple iPhone 7 Plus 国行全网通二手手机，磨砂黑，128GB，95 新，已更换电池，页面标称电池效率 100%，页面价 459 元。",
    configuration: "磨砂黑，128GB，国行全网通",
    condition: "二手，95 新，已更换电池，页面标称电池效率 100%；优惠与库存以来源页为准",
    observedAt: "2026-08-25",
  },
  "iphone-x-2017": {
    value: 808,
    sourceUrl: "https://pro.m.jd.com/mall/active/4JRfHorUDXgL77E9YdNxSCNMKwkJ/index.html?bbtf=1&currSku=10087153553976&fromName=tongtianta&pageNum=1&preSrc=&queryType=1&rankId=3427468&rankType=19&transparent=1",
    sourceName: "京东 6英以下屏幕二手手机好评榜",
    rawText: "Apple iPhone X 国行全网通二手手机，银白色，256GB，95 新，原装屏幕，品牌电池效率 100%，页面价 808 元。",
    configuration: "银白色，256GB，国行全网通",
    condition: "二手，95 新，原装屏幕，品牌电池效率 100%；优惠与库存以来源页为准",
    observedAt: "2026-08-25",
  },
  "iphone-xs-max-2018": {
    value: 1136,
    sourceUrl: "https://pro.m.jd.com/mall/active/4JRfHorUDXgL77E9YdNxSCNMKwkJ/index.html?bbtf=1&currSku=10087153553976&fromName=tongtianta&pageNum=1&preSrc=&queryType=1&rankId=3427468&rankType=19&transparent=1",
    sourceName: "京东 6英以下屏幕二手手机好评榜",
    rawText: "Apple iPhone XS Max 国行全网通二手手机，颜色随机，256GB，95 新，原装屏幕，品牌电池效率 100%，页面价 1136 元。",
    configuration: "颜色随机，256GB，国行全网通",
    condition: "二手，95 新，原装屏幕，品牌电池效率 100%；优惠与库存以来源页为准",
    observedAt: "2026-08-25",
  },
  "iphone-13": {
    value: 1949,
    sourceUrl: "https://pro.m.jd.com/mall/active/4JRfHorUDXgL77E9YdNxSCNMKwkJ/index.html?bbtf=1&currSku=10101352914801&fromName=tongtianta&pageNum=1&queryType=1&rankId=3746997&rankType=10",
    sourceName: "京东苹果二手手机热卖榜",
    rawText: "苹果 iPhone 13 国行正品二手手机，白色，256GB，双卡双待 5G 全网通，99 新，原装屏，已更换电池，页面标称电池效率 100%，页面价 1949 元。",
    configuration: "白色，256GB，国行正品，双卡双待 5G 全网通",
    condition: "二手，99 新，原装屏，已更换电池，页面标称电池效率 100%；优惠与库存以来源页为准",
    observedAt: "2026-08-25",
  },
  "iphone-13-pro-max": {
    value: 2388,
    sourceUrl: "https://pro.m.jd.com/mall/active/4JRfHorUDXgL77E9YdNxSCNMKwkJ/index.html?bbtf=1&currSku=10140894875788&fromName=tongtianta&pageNum=1&queryType=1&rankId=3780739&rankType=10",
    sourceName: "京东 NFC 二手手机热卖榜",
    rawText: "苹果 iPhone 13 Pro Max 国行正品二手手机，石墨色，256GB，95 新，三方屏幕，页面标称电池效率 100%，页面价 2388 元。",
    configuration: "石墨色，256GB，国行正品",
    condition: "二手，95 新，三方屏幕，页面标称电池效率 100%；优惠与库存以来源页为准",
    observedAt: "2026-08-25",
  },
  "iphone-13-pro": {
    value: 2299,
    sourceUrl: "https://pro.m.jd.com/mall/active/4JRfHorUDXgL77E9YdNxSCNMKwkJ/index.html?bbtf=1&currSku=10210091790122&fromName=tongtianta&pageNum=1&queryType=1&rankId=4970910&rankType=19",
    sourceName: "京东二手手机好评榜",
    rawText: "Apple iPhone 13 Pro 二手手机，页面标注国行补贴，远峰蓝色，256GB，官方验，页面价 2299 元；排行榜未注明具体成色与电池状态。",
    configuration: "远峰蓝色，256GB，页面标注国行补贴",
    condition: "二手，官方验；排行榜未注明具体成色与电池状态，以商品质检报告为准",
    observedAt: "2026-08-25",
  },
  "iphone-13-mini": {
    value: 1239,
    sourceUrl: "https://pro.m.jd.com/mall/active/4JRfHorUDXgL77E9YdNxSCNMKwkJ/index.html?bbtf=1&currSku=10087153553976&fromName=tongtianta&pageNum=1&preSrc=&queryType=1&rankId=3427468&rankType=19&transparent=1",
    sourceName: "京东 6英以下屏幕二手手机好评榜",
    rawText: "Apple iPhone 13 mini 二手手机，页面标注国行补贴，粉色，128GB，官方验，页面价 1239 元；排行榜未注明具体成色与电池状态。",
    configuration: "粉色，128GB，页面标注国行补贴",
    condition: "二手，官方验；排行榜未注明具体成色与电池状态，以商品质检报告为准",
    observedAt: "2026-08-25",
  },
  "iphone-11-2019": {
    value: 873,
    sourceUrl: "https://pro.m.jd.com/mall/active/4JRfHorUDXgL77E9YdNxSCNMKwkJ/index.html?bbtf=1&currSku=10158659494757&fromName=tongtianta&pageNum=1&queryType=1&rankId=3780694&rankType=10",
    sourceName: "京东商务二手手机热卖榜",
    rawText: "苹果 iPhone 11 国行全网通 4G 双卡双待二手手机，黑色，128GB，9 成新，品牌电池效率 100%，页面价 873 元。",
    configuration: "黑色，128GB，国行全网通 4G，双卡双待",
    condition: "二手，9 成新，品牌电池效率 100%；优惠与库存以来源页为准",
    observedAt: "2026-08-25",
  },
  "iphone-12": {
    value: 788,
    sourceUrl: "https://pro.m.jd.com/mall/active/4JRfHorUDXgL77E9YdNxSCNMKwkJ/index.html?bbtf=1&currSku=10158659494757&fromName=tongtianta&pageNum=1&queryType=1&rankId=3780694&rankType=10",
    sourceName: "京东商务二手手机热卖榜",
    rawText: "苹果 iPhone 12 国行全网通 5G 二手手机，绿色，128GB，9 成新，三方屏幕，电池效率随机，页面价 788 元。",
    configuration: "绿色，128GB，国行全网通 5G",
    condition: "二手，9 成新，三方屏幕，电池效率随机；优惠与库存以来源页为准",
    observedAt: "2026-08-25",
  },
  "iphone-14": {
    value: 2449,
    sourceUrl: "https://pro.m.jd.com/mall/active/4JRfHorUDXgL77E9YdNxSCNMKwkJ/index.html?bbtf=1&currSku=10158659494757&fromName=tongtianta&pageNum=1&queryType=1&rankId=3780694&rankType=10",
    sourceName: "京东商务二手手机热卖榜",
    rawText: "Apple iPhone 14 国行 5G 全网通二手手机，星光色，99 新，256G，页面价 2449 元。",
    configuration: "星光色，256GB，国行 5G 全网通",
    condition: "二手，99 新；促销与库存以来源页为准",
    observedAt: "2026-08-25",
  },
  "iphone-14-pro": {
    value: 3749,
    sourceUrl: "https://pro.m.jd.com/mall/active/4JRfHorUDXgL77E9YdNxSCNMKwkJ/index.html?bbtf=1&currSku=10140894875788&fromName=tongtianta&pageNum=1&queryType=1&rankId=3780739&rankType=10",
    sourceName: "京东 NFC 二手手机热卖榜",
    rawText: "Apple iPhone 14 Pro 国行 5G 全网通二手手机，银色，99 新，256G，页面价 3749 元。",
    configuration: "银色，256GB，国行 5G 全网通",
    condition: "二手，99 新；促销与库存以来源页为准",
    observedAt: "2026-08-25",
  },
  "iphone-14-pro-max": {
    value: 3899,
    sourceUrl: "https://pro.m.jd.com/mall/active/4JRfHorUDXgL77E9YdNxSCNMKwkJ/index.html?bbtf=1&currSku=10140894875788&fromName=tongtianta&pageNum=1&queryType=1&rankId=3780739&rankType=10",
    sourceName: "京东 NFC 二手手机热卖榜",
    rawText: "Apple iPhone 14 Pro Max 国行 5G 全网通二手手机，暗夜紫色，99 新，256G，页面价 3899 元。",
    configuration: "暗夜紫色，256GB，国行 5G 全网通",
    condition: "二手，99 新；促销与库存以来源页为准",
    observedAt: "2026-08-25",
  },
  "iphone-15": {
    value: 3299,
    sourceUrl: "https://pro.m.jd.com/mall/active/4JRfHorUDXgL77E9YdNxSCNMKwkJ/index.html?bbtf=1&currSku=10101352914801&fromName=tongtianta&pageNum=1&queryType=1&rankId=3746997&rankType=10",
    sourceName: "京东苹果二手手机热卖榜",
    rawText: "苹果 iPhone 15 国行正品，全网通 5G，双卡双待，蓝色，99 新，256G，页面价 3299 元。",
    configuration: "蓝色，256GB，国行正品，全网通 5G，双卡双待",
    condition: "二手，99 新，支持验机；优惠与库存以来源页为准",
    observedAt: "2026-08-24",
  },
  "iphone-15-pro": {
    value: 4449,
    sourceUrl: "https://pro.m.jd.com/mall/active/4JRfHorUDXgL77E9YdNxSCNMKwkJ/index.html?bbtf=1&currSku=10140894875788&fromName=tongtianta&pageNum=1&queryType=1&rankId=3780739&rankType=10",
    sourceName: "京东 NFC 二手手机热卖榜",
    rawText: "Apple iPhone 15 Pro 国行 5G 全网通二手手机，原色钛金属，99 新，256G，页面价 4449 元。",
    configuration: "原色钛金属，256GB，国行 5G 全网通",
    condition: "二手，99 新；促销与库存以来源页为准",
    observedAt: "2026-08-25",
  },
  "ipad-a16-2025": {
    value: 2909,
    sourceUrl: "https://pro.m.jd.com/mall/active/262hj8JXjPNHbFPKvdQFWUeer8kw/index.html?bbtf=1&rankId=2670823&showhead=no&source=tongtiantah5",
    sourceName: "京东 99 成新二手平板电脑榜",
    rawText: "苹果 iPad 11 二手平板电脑，A16 处理器，128G，国行零售机，Wi-Fi 版，99 新，页面价 2909 元。",
    configuration: "iPad (A16)，128GB，国行零售机，Wi-Fi 版",
    condition: "二手，99 新；优惠与库存以来源页为准",
    observedAt: "2026-08-24",
  },
  "ipad-air-m4-2025": {
    value: 5229,
    sourceUrl: "https://pro.m.jd.com/mall/active/4JRfHorUDXgL77E9YdNxSCNMKwkJ/index.html?bbtf=1&currSku=10168796231033&fromName=tongtianta&pageNum=1&preSrc=&queryType=1&rankId=2670823&rankType=16&transparent=1",
    sourceName: "京东 99 成新二手平板电脑折扣榜",
    rawText: "苹果 iPad Air 8 (M4) 国行零售机二手平板电脑，11 英寸 256G，Wi-Fi 版，准新品，官方在保，页面标称充电次数个位数、基本全新，页面价 5229 元。",
    configuration: "11 英寸 iPad Air (M4)，256GB，国行零售机，Wi-Fi 版",
    condition: "二手准新品，官方在保，页面标称充电次数个位数、基本全新；优惠与库存以来源页为准",
    observedAt: "2026-08-25",
  },
  "ipad-mini-a17-pro-2024": {
    value: 2499,
    sourceUrl: "https://m2.9ji.com/secondHand/detail/1098117",
    sourceName: "九机二手良品",
    rawText: "Apple iPad mini 2024 款（第 7 代）国行二手平板电脑，星光色，128GB，Wi-Fi 版，8 成新，电池寿命 100%，未检出维修痕迹，页面价 2499 元。",
    configuration: "iPad mini (A17 Pro)，星光色，128GB，国行，Wi-Fi 版",
    condition: "二手，8 成新，电池寿命 100%，未检出维修痕迹；外壳有轻微划痕、磕碰或掉漆及细微印渍，屏幕有明显划痕；不含充电头和数据线；一机一价，以来源页库存为准",
    observedAt: "2026-08-25",
  },
  "ipad-pro-m5-11-2025": {
    value: 8089,
    sourceUrl: "https://pro.m.jd.com/mall/active/262hj8JXjPNHbFPKvdQFWUeer8kw/index.html?bbtf=1&rankId=2670823&showhead=no&source=tongtiantah5",
    sourceName: "京东 99 成新二手平板电脑榜",
    rawText: "苹果 iPad Pro (M5) 国行二手平板电脑，11 英寸 256G，99 新，国行零售机或官换机，非资源机，页面价 8089 元。",
    configuration: "11 英寸 iPad Pro (M5)，256GB，国行零售机或官换机，非资源机",
    condition: "二手，99 新，电池效率 100%；优惠与库存以来源页为准",
    observedAt: "2026-08-24",
  },
};

const ZH_ONLY_IPHONES = [
  ["iphone-7-2016", "standard", "iPhone 7", "7", 2016, "https://support.apple.com/zh-cn/111943"],
  ["iphone-7-plus-2016", "Plus", "iPhone 7 Plus", "7 Plus", 2016, "https://support.apple.com/zh-cn/111953"],
  ["iphone-se-1-2016", "SE", "iPhone SE (第 1 代)", "SE 1", 2016, "https://support.apple.com/zh-cn/112005"],
  ["iphone-8-2017", "standard", "iPhone 8", "8", 2017, "https://support.apple.com/zh-cn/111976"],
  ["iphone-8-plus-2017", "Plus", "iPhone 8 Plus", "8 Plus", 2017, "https://support.apple.com/zh-cn/111950"],
  ["iphone-x-2017", "Pro", "iPhone X", "X", 2017, "https://support.apple.com/zh-cn/111864"],
  ["iphone-xr-2018", "standard", "iPhone XR", "XR", 2018, "https://support.apple.com/zh-cn/111868"],
  ["iphone-xs-2018", "Pro", "iPhone XS", "XS", 2018, "https://support.apple.com/zh-cn/111881"],
  ["iphone-xs-max-2018", "Pro Max", "iPhone XS Max", "XS Max", 2018, "https://support.apple.com/zh-cn/111880"],
  ["iphone-11-2019", "standard", "iPhone 11", "11", 2019, "https://support.apple.com/zh-cn/111865"],
  ["iphone-11-pro-2019", "Pro", "iPhone 11 Pro", "11 Pro", 2019, "https://support.apple.com/zh-cn/111879"],
  ["iphone-11-pro-max-2019", "Pro Max", "iPhone 11 Pro Max", "11 Pro Max", 2019, "https://support.apple.com/zh-cn/111878"],
  ["iphone-17e-2026", "e", "iPhone 17e", "17e", 2026, "https://support.apple.com/zh-cn/126470"],
].map(([id, variant, modelName, generation, releaseYear, supportUrl]) => ({
  device: {
    id,
    brand: "Apple",
    category: "phone",
    series: "iPhone",
    family: "iPhone",
    variant,
    modelName,
    generation,
    generationOrder: 1,
    releaseYear,
    specs: {},
    computed: {},
  },
  source: {
    id,
    category: "phone",
    series: "iPhone",
    modelName,
    generation,
    releaseYear,
    sourcePageType: "apple_support_docs",
    officialSpecUrl: null,
    supportUrl,
    newsroomUrl: ZH_LAUNCH_PRICES[id]?.[1] ?? null,
    referenceUrls: REFERENCE_LAUNCH_PRICES[id] ? [REFERENCE_LAUNCH_PRICES[id].sourceUrl] : [],
    sourceStatus: "verified",
    notes: "Apple Support 中国简体中文技术规格页",
  },
}));

const ZH_ONLY_IPADS = [
  ["ipad-pro-9-7-2016", "iPad Pro", "11-inch", "iPad Pro（9.7 英寸）", "第 1 代 9.7 英寸", 2016, "https://support.apple.com/zh-cn/111965"],
  ["ipad-5th-2017", "iPad", "standard", "iPad（第 5 代）", "第 5 代", 2017, "https://support.apple.com/zh-cn/111960"],
  ["ipad-pro-10-5-2017", "iPad Pro", "11-inch", "iPad Pro（10.5 英寸）", "第 1 代 10.5 英寸", 2017, "https://support.apple.com/zh-cn/111927"],
  ["ipad-pro-12-9-2nd-2017", "iPad Pro", "13-inch", "12.9 英寸 iPad Pro（第 2 代）", "第 2 代 12.9 英寸", 2017, "https://support.apple.com/zh-cn/111964"],
  ["ipad-6th-2018", "iPad", "standard", "iPad（第 6 代）", "第 6 代", 2018, "https://support.apple.com/zh-cn/111957"],
  ["ipad-pro-11-1st-2018", "iPad Pro", "11-inch", "11 英寸 iPad Pro（第 1 代）", "第 1 代 11 英寸", 2018, "https://support.apple.com/zh-cn/111974"],
  ["ipad-pro-12-9-3rd-2018", "iPad Pro", "13-inch", "12.9 英寸 iPad Pro（第 3 代）", "第 3 代 12.9 英寸", 2018, "https://support.apple.com/zh-cn/111979"],
  ["ipad-air-3rd-2019", "iPad Air", "11-inch", "iPad Air（第 3 代）", "第 3 代", 2019, "https://support.apple.com/zh-cn/111939"],
  ["ipad-mini-5th-2019", "iPad mini", "standard", "iPad mini（第 5 代）", "第 5 代", 2019, "https://support.apple.com/zh-cn/111904"],
  ["ipad-7th-2019", "iPad", "standard", "iPad（第 7 代）", "第 7 代", 2019, "https://support.apple.com/zh-cn/111911"],
  ["ipad-pro-11-2nd-2020", "iPad Pro", "11-inch", "11 英寸 iPad Pro（第 2 代）", "第 2 代 11 英寸", 2020, "https://support.apple.com/zh-cn/118452"],
  ["ipad-pro-12-9-4th-2020", "iPad Pro", "13-inch", "12.9 英寸 iPad Pro（第 4 代）", "第 4 代 12.9 英寸", 2020, "https://support.apple.com/zh-cn/111977"],
  ["ipad-8th-2020", "iPad", "standard", "iPad（第 8 代）", "第 8 代", 2020, "https://support.apple.com/zh-cn/118451"],
  ["ipad-air-4th-2020", "iPad Air", "11-inch", "iPad Air（第 4 代）", "第 4 代", 2020, "https://support.apple.com/zh-cn/111905"],
  ["ipad-pro-11-m1-2021", "iPad Pro", "11-inch", "11 英寸 iPad Pro（第 3 代，M1）", "M1 11 英寸", 2021, "https://support.apple.com/zh-cn/111897"],
  ["ipad-pro-12-9-m1-2021", "iPad Pro", "13-inch", "12.9 英寸 iPad Pro（第 5 代，M1）", "M1 12.9 英寸", 2021, "https://support.apple.com/zh-cn/111896"],
  ["ipad-air-m1-2022", "iPad Air", "11-inch", "iPad Air（第 5 代，M1）", "M1", 2022, "https://support.apple.com/zh-cn/111887"],
  ["ipad-air-13-m2-2024", "iPad Air", "13-inch", "13 英寸 iPad Air (M2)", "M2 13 英寸", 2024, "https://support.apple.com/zh-cn/119893"],
  ["ipad-air-13-m3-2025", "iPad Air", "13-inch", "13 英寸 iPad Air (M3)", "M3 13 英寸", 2025, "https://support.apple.com/zh-cn/122242"],
  ["ipad-air-13-m4-2026", "iPad Air", "13-inch", "13 英寸 iPad Air (M4)", "M4 13 英寸", 2026, "https://support.apple.com/zh-cn/126472"],
].map(([id, family, variant, modelName, generation, releaseYear, supportUrl]) => ({
  device: {
    id,
    brand: "Apple",
    category: "tablet",
    series: family,
    family,
    variant,
    modelName,
    generation,
    generationOrder: 1,
    releaseYear,
    specs: {},
    computed: {},
  },
  source: {
    id,
    category: "tablet",
    series: family,
    modelName,
    generation,
    releaseYear,
    sourcePageType: "apple_support_docs",
    officialSpecUrl: null,
    supportUrl,
    newsroomUrl: ZH_LAUNCH_PRICES[id][1],
    referenceUrls: [],
    sourceStatus: "verified",
    notes: "Apple Support 中国简体中文技术规格页",
  },
}));

const ZH_ONLY_MACBOOKS = [
  ["macbook-12-2016", "MacBook", "12-inch", "base", "12 英寸 MacBook（2016 年初）", "2016", 2016, "https://support.apple.com/zh-tw/112033"],
  ["macbook-pro-13-2-port-2016", "MacBook Pro", "13-inch-2-port", "base", "13 英寸 MacBook Pro（2016 年，两个雷雳 3 端口）", "2016 13 英寸双端口", 2016, "https://support.apple.com/zh-cn/111999"],
  ["macbook-pro-13-4-port-2016", "MacBook Pro", "13-inch-4-port", "base", "13 英寸 MacBook Pro（2016 年，四个雷雳 3 端口）", "2016 13 英寸四端口", 2016, "https://support.apple.com/zh-cn/112003"],
  ["macbook-pro-15-2016", "MacBook Pro", "15-inch", "base", "15 英寸 MacBook Pro（2016 年）", "2016 15 英寸", 2016, "https://support.apple.com/zh-cn/111975"],
  ["macbook-12-2017", "MacBook", "12-inch", "base", "12 英寸 MacBook（2017 年）", "2017", 2017, "https://support.apple.com/zh-cn/111986"],
  ["macbook-air-13-2017", "MacBook Air", "13-inch", "base", "13 英寸 MacBook Air（2017 年）", "2017 Intel", 2017, "https://support.apple.com/zh-cn/111924"],
  ["macbook-pro-13-2-port-2017", "MacBook Pro", "13-inch-2-port", "base", "13 英寸 MacBook Pro（2017 年，两个雷雳 3 端口）", "2017 13 英寸双端口", 2017, "https://support.apple.com/zh-cn/111951"],
  ["macbook-pro-13-4-port-2017", "MacBook Pro", "13-inch-4-port", "base", "13 英寸 MacBook Pro（2017 年，四个雷雳 3 端口）", "2017 13 英寸四端口", 2017, "https://support.apple.com/zh-cn/111972"],
  ["macbook-pro-15-2017", "MacBook Pro", "15-inch", "base", "15 英寸 MacBook Pro（2017 年）", "2017 15 英寸", 2017, "https://support.apple.com/zh-cn/111947"],
  ["macbook-air-13-2018", "MacBook Air", "13-inch", "base", "13 英寸 MacBook Air（视网膜显示屏，2018 年）", "2018 Intel", 2018, "https://support.apple.com/zh-cn/111933"],
  ["macbook-pro-13-4-port-2018", "MacBook Pro", "13-inch-4-port", "base", "13 英寸 MacBook Pro（2018 年，四个雷雳 3 端口）", "2018 13 英寸四端口", 2018, "https://support.apple.com/zh-cn/111925"],
  ["macbook-pro-15-2018", "MacBook Pro", "15-inch", "base", "15 英寸 MacBook Pro（2018 年）", "2018 15 英寸", 2018, "https://support.apple.com/zh-cn/111949"],
  ["macbook-air-13-2019", "MacBook Air", "13-inch", "base", "13 英寸 MacBook Air（视网膜显示屏，2019 年）", "2019 Intel", 2019, "https://support.apple.com/zh-cn/111948"],
  ["macbook-pro-13-2-port-2019", "MacBook Pro", "13-inch-2-port", "base", "13 英寸 MacBook Pro（2019 年，两个雷雳 3 端口）", "2019 13 英寸双端口", 2019, "https://support.apple.com/zh-cn/111945"],
  ["macbook-pro-13-4-port-2019", "MacBook Pro", "13-inch-4-port", "base", "13 英寸 MacBook Pro（2019 年，四个雷雳 3 端口）", "2019 13 英寸四端口", 2019, "https://support.apple.com/zh-cn/111997"],
  ["macbook-pro-15-2019", "MacBook Pro", "15-inch", "base", "15 英寸 MacBook Pro（2019 年）", "2019 15 英寸", 2019, "https://support.apple.com/zh-cn/111941"],
  ["macbook-pro-16-2019", "MacBook Pro", "16-inch", "base", "16 英寸 MacBook Pro（2019 年）", "2019 16 英寸", 2019, "https://support.apple.com/zh-cn/111932"],
  ["macbook-air-13-intel-2020", "MacBook Air", "13-inch", "base", "13 英寸 MacBook Air（视网膜显示屏，2020 年）", "2020 Intel", 2020, "https://support.apple.com/zh-cn/111991"],
  ["macbook-pro-13-2-port-2020", "MacBook Pro", "13-inch-2-port", "base", "13 英寸 MacBook Pro（2020 年，两个雷雳 3 端口）", "2020 13 英寸双端口", 2020, "https://support.apple.com/zh-cn/111981"],
  ["macbook-pro-13-4-port-2020", "MacBook Pro", "13-inch-4-port", "base", "13 英寸 MacBook Pro（2020 年，四个雷雳 3 端口）", "2020 13 英寸四端口", 2020, "https://support.apple.com/zh-cn/111339"],
  ["macbook-pro-14-m1-pro-2021", "MacBook Pro", "14-inch", "pro", "14 英寸 MacBook Pro (M1 Pro)", "M1 Pro 14 英寸", 2021, "https://support.apple.com/zh-cn/111902"],
  ["macbook-pro-14-m1-max-2021", "MacBook Pro", "14-inch", "max", "14 英寸 MacBook Pro (M1 Max)", "M1 Max 14 英寸", 2021, "https://support.apple.com/zh-cn/111902"],
  ["macbook-pro-16-m1-pro-2021", "MacBook Pro", "16-inch", "pro", "16 英寸 MacBook Pro (M1 Pro)", "M1 Pro 16 英寸", 2021, "https://support.apple.com/zh-cn/111901"],
  ["macbook-pro-16-m1-max-2021", "MacBook Pro", "16-inch", "max", "16 英寸 MacBook Pro (M1 Max)", "M1 Max 16 英寸", 2021, "https://support.apple.com/zh-cn/111901"],
  ["macbook-pro-14-m2-pro-2023", "MacBook Pro", "14-inch", "pro", "14 英寸 MacBook Pro (M2 Pro)", "M2 Pro 14 英寸", 2023, "https://support.apple.com/zh-cn/111340"],
  ["macbook-pro-14-m2-max-2023", "MacBook Pro", "14-inch", "max", "14 英寸 MacBook Pro (M2 Max)", "M2 Max 14 英寸", 2023, "https://support.apple.com/zh-cn/111340"],
  ["macbook-air-15-m2-2023", "MacBook Air", "15-inch", "base", "15 英寸 MacBook Air (M2)", "M2 15 英寸", 2023, "https://support.apple.com/zh-cn/111346"],
  ["macbook-pro-14-m3-2023", "MacBook Pro", "14-inch", "base", "14 英寸 MacBook Pro (M3)", "M3 14 英寸", 2023, "https://support.apple.com/zh-cn/117735"],
  ["macbook-pro-14-m3-pro-2023", "MacBook Pro", "14-inch", "pro", "14 英寸 MacBook Pro (M3 Pro)", "M3 Pro 14 英寸", 2023, "https://support.apple.com/zh-cn/117736"],
  ["macbook-pro-14-m3-max-2023", "MacBook Pro", "14-inch", "max", "14 英寸 MacBook Pro (M3 Max)", "M3 Max 14 英寸", 2023, "https://support.apple.com/zh-cn/117736"],
  ["macbook-pro-16-m3-pro-2023", "MacBook Pro", "16-inch", "pro", "16 英寸 MacBook Pro (M3 Pro)", "M3 Pro 16 英寸", 2023, "https://support.apple.com/zh-cn/117737"],
  ["macbook-pro-16-m3-max-2023", "MacBook Pro", "16-inch", "max", "16 英寸 MacBook Pro (M3 Max)", "M3 Max 16 英寸", 2023, "https://support.apple.com/zh-cn/117737"],
  ["macbook-neo-13-2026", "MacBook Neo", "13-inch", "base", "MacBook Neo", "2026", 2026, "https://support.apple.com/zh-cn/126322"],
].map(([id, family, variant, tier, modelName, generation, releaseYear, supportUrl]) => ({
  device: {
    id,
    brand: "Apple",
    category: "laptop",
    series: family,
    family,
    variant,
    tier,
    modelName,
    generation,
    generationOrder: 1,
    releaseYear,
    specs: {},
    computed: {},
  },
  source: {
    id,
    category: "laptop",
    series: family,
    modelName,
    generation,
    releaseYear,
    sourcePageType: "apple_support_docs",
    officialSpecUrl: null,
    supportUrl,
    newsroomUrl: ZH_LAUNCH_PRICES[id]?.[1] ?? null,
    referenceUrls: [],
    sourceStatus: "verified",
    notes: "Apple Support 中国简体中文技术规格页",
  },
}));

const IPHONE_GENERATION_GROUPS = [
  ["iphone-7-2016", "iphone-8-2017", "iphone-xr-2018", "iphone-11-2019", "iphone-12", "iphone-13", "iphone-14", "iphone-15", "iphone-16", "iphone-17"],
  ["iphone-7-plus-2016", "iphone-8-plus-2017", "iphone-14-plus", "iphone-15-plus", "iphone-16-plus"],
  ["iphone-x-2017", "iphone-xs-2018", "iphone-11-pro-2019", "iphone-12-pro", "iphone-13-pro", "iphone-14-pro", "iphone-15-pro", "iphone-16-pro", "iphone-17-pro"],
  ["iphone-xs-max-2018", "iphone-11-pro-max-2019", "iphone-12-pro-max", "iphone-13-pro-max", "iphone-14-pro-max", "iphone-15-pro-max", "iphone-16-pro-max", "iphone-17-pro-max"],
  ["iphone-se-1-2016", "iphone-se-2-2020", "iphone-se-3-2022"],
  ["iphone-16e-2025", "iphone-17e-2026"],
];

const IPAD_GENERATION_GROUPS = [
  ["ipad-5th-2017", "ipad-6th-2018", "ipad-7th-2019", "ipad-8th-2020", "ipad-9th-2021", "ipad-10th-2022", "ipad-a16-2025"],
  ["ipad-mini-5th-2019", "ipad-mini-6th-2021", "ipad-mini-a17-pro-2024"],
  ["ipad-air-3rd-2019", "ipad-air-4th-2020", "ipad-air-m1-2022", "ipad-air-m2-2024", "ipad-air-m3-2025", "ipad-air-m4-2025"],
  ["ipad-air-13-m2-2024", "ipad-air-13-m3-2025", "ipad-air-13-m4-2026"],
  ["ipad-pro-9-7-2016", "ipad-pro-10-5-2017", "ipad-pro-11-1st-2018", "ipad-pro-11-2nd-2020", "ipad-pro-11-m1-2021", "ipad-pro-m2-2022", "ipad-pro-m4-11-2024", "ipad-pro-m5-11-2025"],
  ["ipad-pro-12-9-2nd-2017", "ipad-pro-12-9-3rd-2018", "ipad-pro-12-9-4th-2020", "ipad-pro-12-9-m1-2021", "ipad-pro-m2-13-2022", "ipad-pro-m4-13-2024", "ipad-pro-m5-13-2025"],
];

const MACBOOK_GENERATION_GROUPS = [
  ["macbook-12-2016", "macbook-12-2017"],
  ["macbook-air-13-2017", "macbook-air-13-2018", "macbook-air-13-2019", "macbook-air-13-intel-2020", "macbook-air-13-m1-2020", "macbook-air-13-m2-2022", "macbook-air-13-m3-2024", "macbook-air-13-m4-2025", "macbook-air-13-m5-2026"],
  ["macbook-air-15-m2-2023", "macbook-air-15-m3-2024", "macbook-air-15-m4-2025", "macbook-air-15-m5-2026"],
  ["macbook-pro-13-m1-2020", "macbook-pro-13-m2-2022"],
  ["macbook-pro-13-2-port-2016", "macbook-pro-13-2-port-2017", "macbook-pro-13-2-port-2019", "macbook-pro-13-2-port-2020"],
  ["macbook-pro-13-4-port-2016", "macbook-pro-13-4-port-2017", "macbook-pro-13-4-port-2018", "macbook-pro-13-4-port-2019", "macbook-pro-13-4-port-2020"],
  ["macbook-pro-15-2016", "macbook-pro-15-2017", "macbook-pro-15-2018", "macbook-pro-15-2019"],
  ["macbook-pro-16-2019"],
  ["macbook-pro-14-m3-2023", "macbook-pro-14-m4-2024", "macbook-pro-14-m5-2025"],
  ["macbook-pro-14-m1-pro-2021", "macbook-pro-14-m2-pro-2023", "macbook-pro-14-m3-pro-2023", "macbook-pro-14-m4-pro-2024", "macbook-pro-14-m5-pro-2026"],
  ["macbook-pro-14-m1-max-2021", "macbook-pro-14-m2-max-2023", "macbook-pro-14-m3-max-2023", "macbook-pro-14-m4-max-2024", "macbook-pro-14-m5-max-2026"],
  ["macbook-pro-16-m1-pro-2021", "macbook-pro-16-m2-2023", "macbook-pro-16-m3-pro-2023", "macbook-pro-16-m4-2024", "macbook-pro-16-m5-2026"],
  ["macbook-pro-16-m1-max-2021", "macbook-pro-16-m2-max-2023", "macbook-pro-16-m3-max-2023", "macbook-pro-16-m4-max-2024", "macbook-pro-16-m5-max-2026"],
  ["macbook-neo-13-2026"],
];

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
  "macbook-12-2017",
  "macbook-air-13-2017",
  "macbook-pro-13-4-port-2017",
  "macbook-pro-13-4-port-2020",
  "macbook-pro-14-m1-max-2021",
  "macbook-pro-14-m2-max-2023",
  "macbook-pro-14-m3-max-2023",
  "macbook-pro-16-m2-max-2023",
  "macbook-pro-14-m4-max-2024",
  "macbook-pro-16-m4-2024",
  "macbook-pro-15-2017",
  "macbook-pro-16-m1-max-2021",
  "macbook-pro-16-m3-max-2023",
]);

const GENERATION_UPGRADE_RECALCULATIONS = {
  "macbook-air-13-m4-2025": [4, ["芯片+3 (Apple M3 芯片→Apple M4 芯片)", "外观+1"]],
  "iphone-14": [5, ["主摄+2", "新增SOS+1", "新增车祸检测+1", "外观+1"]],
  "iphone-14-pro": [9, ["芯片+3 (A15 仿生芯片→A16 仿生芯片)", "分辨率+1", "主摄+2", "新增SOS+1", "新增车祸检测+1", "外观+1"]],
  "ipad-air-m3-2025": [3, ["芯片+3 (Apple M2 芯片→Apple M3 芯片)"]],
  "ipad-pro-m4-11-2024": [8, ["芯片+3 (Apple M2 芯片→Apple M4 芯片)", "屏幕+1 (11→11.1英寸)", "分辨率+1", "主摄+2", "外观+1"]],
  "ipad-pro-m4-13-2024": [8, ["芯片+3 (Apple M2 芯片→Apple M4 芯片)", "屏幕+1 (12.9→13英寸)", "分辨率+1", "主摄+2", "外观+1"]],
  "macbook-air-15-m4-2025": [4, ["芯片+3 (Apple M3 芯片→Apple M4 芯片)", "外观+1"]],
  "macbook-pro-14-m5-pro-2026": [3, ["芯片+3 (Apple M4 Pro 芯片→Apple M5 Pro 芯片)"]],
  "macbook-pro-14-m5-max-2026": [3, ["芯片+3 (Apple M4 Max 芯片→Apple M5 Max 芯片)"]],
  "macbook-pro-16-m5-2026": [3, ["芯片+3 (Apple M4 Pro 芯片→Apple M5 Pro 芯片)"]],
  "macbook-pro-16-m5-max-2026": [3, ["芯片+3 (Apple M4 Max 芯片→Apple M5 Max 芯片)"]],
  "macbook-pro-16-m4-2024": [4, ["芯片+3 (Apple M2 Pro 芯片→Apple M4 Pro 芯片)", "外观+1"]],
  "macbook-pro-16-m4-max-2024": [4, ["芯片+3 (Apple M2 Max 芯片→Apple M4 Max 芯片)", "外观+1"]],
};

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
  capacity: /^(容量|存储容量|存储设备|儲存設備)$/,
  size: /^尺寸(与|和|與)?重量$/,
  display: /^(显示屏|显示器|顯示器)$/,
  water: /防溅|抗水|防尘/,
  chip: /^(芯片|处理器|處理器)$/,
  memory: /^内存$/,
  camera: /^(摄像头|相机)$/,
  frontCamera: /原深感摄像头|前置摄像头|超广角摄像头|FaceTime.*摄像头/i,
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
  const blocks = allBlocks(sections);
  if (device.category === "tablet" && /^(11|13)-inch$/.test(device.variant)) {
    const marketed = device.variant.startsWith("11") ? "11" : "13";
    const family = device.family.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`${marketed} 英寸 ${family}[^。；]*?为\\s*([\\d.]+)\\s*英寸`);
    const raw = first(blocks, pattern);
    const match = raw?.match(pattern);
    if (match) return { value: Number(match[1]), raw };
  }

  const direct = first(display, /([\d.]+)\s*(?:英寸|吋).*(?:对角线|對角線|显示屏|顯示器)/);
  const directMatch = direct?.match(/([\d.]+)\s*(?:英寸|吋)/);
  if (directMatch) return { value: Number(directMatch[1]), raw: direct };

  const simple = first(blocks, /(?:屏幕|机型)为\s*([\d.]+)\s*英寸/);
  const simpleMatch = simple?.match(/(?:屏幕|机型)为\s*([\d.]+)\s*英寸/);
  if (simpleMatch) return { value: Number(simpleMatch[1]), raw: simple };
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
      first(display, /视网膜.*显示屏|Retina.*(?:显示屏|顯示器)/i),
      first(display, /OLED|mini-LED|IPS (?:技术|技術)/),
      first(display, /ProMotion/),
      first(display, /全天候显示/),
    ]);
    if (!selected.length) selected.push(first(display, /显示屏|显示器|顯示器/));
    return spec(selected.join("；"), selected.join("；"), oldField, sourceUrl);
  }
  if (fieldName === "resolution") {
    const raw = first(display, /(?:\d+\s*x\s*\d+.*(?:分辨率|解析度)|(?:分辨率|解析度)[^。；]{0,180}\d+\s*x\s*\d+)/);
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
    const raw = first(chip, /芯片|Apple\s+[AM]\d+|A\d+(?:\s*仿生)?|Intel Core/i)
      ?? first(blocks, /Intel Core/i);
    const intelModels = raw
      ? unique([...raw.matchAll(/Intel Core\s+([a-z]\d)/gi)].map((match) => match[1]))
      : [];
    const value = intelModels.length ? `Intel Core ${intelModels[0]}` : raw;
    return spec(value, raw, oldField, sourceUrl);
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
  const reference = REFERENCE_LAUNCH_PRICES[device.id];
  if (reference) {
    return {
      value: reference.value,
      unit: "CNY",
      rawText: reference.rawText,
      sourceUrl: reference.sourceUrl,
      sourceType: "reference",
      confidence: 0.7,
      verifiedAt: VERIFIED_AT,
      priceType: "launch",
      market: "中国大陆",
      configuration: reference.configuration,
      condition: "全新首发定价",
      observedAt: reference.observedAt,
      sourceName: reference.sourceName,
    };
  }
  const configured = ZH_LAUNCH_PRICES[device.id];
  const value = configured?.[0] ?? device.specs.launchPrice?.value;
  const sourceUrl = configured?.[1] ?? device.specs.launchPrice?.sourceUrl;
  if (!value || !sourceUrl?.startsWith("https://www.apple.com.cn/newsroom/")) return null;
  const html = await fetchHtml(sourceUrl);
  const sections = parseSections(html);
  const formatted = Number(value).toLocaleString("en-US");
  const pricePattern = new RegExp(`(?:RMB|人民币|¥|起售价)[^；。]{0,240}${formatted.replace(",", "[,]?")}|${formatted.replace(",", "[,]?")}[^；。]{0,240}(?:起售价|人民币|RMB)`);
  const pageText = decodeHtml(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ""));
  const raw = first(allBlocks(sections), pricePattern)
    ?? pageText.match(new RegExp(`.{0,180}(?:${pricePattern.source}).{0,180}`))?.[0];
  if (!raw) throw new Error(`${device.id}: 中文首发价原文缺失 (${sourceUrl})`);
  return spec(value, raw, device.specs.launchPrice ?? { unit: "CNY" }, sourceUrl);
}

function marketPriceSnapshot(reference, priceType) {
  if (!reference) return null;
  return {
    value: reference.value,
    unit: "CNY",
    rawText: reference.rawText,
    sourceUrl: reference.sourceUrl,
    sourceType: reference.sourceType ?? "reference",
    confidence: reference.sourceType === "apple" ? 1 : 0.7,
    verifiedAt: reference.observedAt,
    priceType,
    market: "中国大陆",
    configuration: reference.configuration,
    condition: reference.condition ?? "全新，识货聚合百亿补贴店铺最低价；优惠资格与库存以来源页为准",
    observedAt: reference.observedAt,
    sourceName: reference.sourceName,
  };
}

function currentPriceSnapshot(device) {
  return marketPriceSnapshot(REFERENCE_CURRENT_PRICES[device.id], "current");
}

function usedPriceSnapshot(device) {
  return marketPriceSnapshot(REFERENCE_USED_PRICES[device.id], "used");
}

const [englishDatabase, englishSources] = await Promise.all([
  fs.readFile(EN_DEVICES_PATH, "utf8").then(JSON.parse),
  fs.readFile(EN_SOURCES_PATH, "utf8").then(JSON.parse),
]);
const { devices: englishDevices } = englishDatabase;
const zhOnlyDevices = [...ZH_ONLY_IPHONES, ...ZH_ONLY_IPADS, ...ZH_ONLY_MACBOOKS];
const sourceDevices = [...englishDevices, ...zhOnlyDevices.map(({ device }) => device)];
const sourceById = new Map([
  ...Object.values(englishSources).flat().map((row) => [row.id, row]),
  ...zhOnlyDevices.map(({ source }) => [source.id, source]),
]);
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

function recalculateGenerationUpgrade(device) {
  const calculation = GENERATION_UPGRADE_RECALCULATIONS[device.id];
  if (!calculation) return device;
  const [value, components] = calculation;
  return {
    ...device,
    computed: {
      ...device.computed,
      generationUpgradeMagnitude: {
        ...device.computed.generationUpgradeMagnitude,
        value,
        changeSummary: components.join(", "),
        scoreBreakdown: `${components.join(" + ")} → ${value}`,
        confidence: 0.9,
        computedAt: VERIFIED_AT,
        verifiedAt: VERIFIED_AT,
      },
    },
  };
}

for (const sourceDevice of sourceDevices) {
  const oldSource = sourceById.get(sourceDevice.id);
  const supportUrl = await resolveTechSpecUrl(oldSource.supportUrl);
  const html = await fetchHtml(supportUrl);
  const sections = parseSections(html);
  const title = sections[0]?.heading ?? "";
  if (!/[\u4e00-\u9fff]/.test(html) || !/技(?:术规格|術規格)/.test(title)) {
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
    const currentPrice = currentPriceSnapshot(device);
    if (currentPrice) specs.currentPrice = currentPrice;
    const usedPrice = usedPriceSnapshot(device);
    if (usedPrice) specs.usedPrice = usedPrice;

    const modelName = localizeModelName(device.modelName);
    const releaseYear = device.id === "ipad-air-m4-2025" ? 2026 : device.releaseYear;
    zhDevices.push(recalculateGenerationUpgrade({ ...device, modelName, releaseYear, specs }));
    const referenceUrls = new Set(oldSource.referenceUrls ?? []);
    if (REFERENCE_CURRENT_PRICES[device.id]) referenceUrls.add(REFERENCE_CURRENT_PRICES[device.id].sourceUrl);
    if (REFERENCE_USED_PRICES[device.id]) referenceUrls.add(REFERENCE_USED_PRICES[device.id].sourceUrl);
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
      ...(referenceUrls.size ? { referenceUrls: [...referenceUrls] } : {}),
      sourceStatus: "verified",
      notes: "Apple Support 中国简体中文技术规格页",
    });
    console.log(`${device.id}: ${Object.keys(specs).length} fields <- ${supportUrl}`);
  }
}

const devicesById = new Map(zhDevices.map((device) => [device.id, device]));
for (const ids of [...IPHONE_GENERATION_GROUPS, ...IPAD_GENERATION_GROUPS, ...MACBOOK_GENERATION_GROUPS]) {
  ids.forEach((id, index) => {
    const device = devicesById.get(id);
    if (!device) throw new Error(`代际设备缺失: ${id}`);
    device.generationOrder = index + 1;
    const magnitude = device.computed?.generationUpgradeMagnitude;
    if (index > 0 && magnitude?.comparedTo == null) delete device.computed.generationUpgradeMagnitude;
    if (index > 0 && magnitude?.comparedTo && magnitude.comparedTo !== ids[index - 1]) {
      delete device.computed.generationUpgradeMagnitude;
    }
    if (index === 0 && !magnitude) {
      device.computed.generationUpgradeMagnitude = {
        value: null,
        comparedTo: null,
        changeSummary: "该设备为该比较组第一代，无可对比前代",
        scoreBreakdown: "无对比前代",
        confidence: 0,
        computedAt: VERIFIED_AT,
        sourceType: "computed",
        verifiedAt: VERIFIED_AT,
      };
    }
  });
}

await Promise.all([
  fs.writeFile(ZH_DEVICES_PATH, `${JSON.stringify({ metadata: { ...englishDatabase.metadata, totalDevices: zhDevices.length, generatedAt: VERIFIED_AT }, devices: zhDevices }, null, 2)}\n`),
  fs.writeFile(ZH_SOURCES_PATH, `${JSON.stringify(zhSources, null, 2)}\n`),
]);
console.log(`wrote ${zhDevices.length} devices; unresolved previous fields: ${missing.length}`);
if (missing.length) console.log(missing.join("\n"));
