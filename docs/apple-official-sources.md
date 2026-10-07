# Apple 主来源与补充来源管理

> 项目：数码观察站 DeviceScope
> 版本：v2.1 | 2026-10-07

## 当前口径

- 本文仅管理 Apple 子集；全项目现为八品牌、五品类、多品牌合并主库，覆盖与字段契约见 [字段字典](field-dictionary.md)。运行时默认展示中文数据，Apple 中国页面优先用于 Apple 规格与国行首发价。
- Apple 增加 19 条手表技术规格来源，保存为独立穿戴分库；不因手机字段已有值而给手表推断运行内存、首发价或防护等级。
- 技术规格优先使用 `https://support.apple.com/zh-cn/...`。
- 中国大陆首发价优先使用 `https://www.apple.com.cn/newsroom/...` 发布时新闻稿；新闻稿没有分档报价时，允许同期主流科技媒体或产品库中可精确对应配置的国行价格。
- Apple 未公开的 iPhone / iPad 运行内存可由已登记的 iOS Ref 与 iFixit 原文补齐；中文简体规格不足时使用可核验的中文繁体官方证据。当前价与二手价允许使用中国大陆公开商品页的静态快照。
- 第三方值必须标记为 `reference` 并通过字段、域名、置信度和快照元数据门禁；不把第三方值包装成 Apple 官方事实。
- 不把页面未声明的否定项或常见参数推断成已知事实。
- 英文官网数据只作为独立历史快照保留，不参与默认展示。

## Apple 子集的来源分工

以下是已采用的来源用途，不要求每个字段先穷尽其他地区官网才使用受信第三方，也不把官方来源顺序扩展为所有品牌的强制层级。国行地区、具体配置与证据质量比单纯的站点身份更重要。

| 类别 | 页面类型 | 用途 |
| --- | --- | --- |
| 1 | Apple Support 中国简体中文技术规格页 | 设备规格、尺寸、接口、影像、续航等 |
| 2 | Apple 中国 Newsroom 发布新闻稿 | 中国大陆首发价与发布背景 |
| 3 | Apple 中国当前产品页 | 仅用于补充仍在售产品信息，不替代发布时价格证据 |
| 4 | iOS Ref 内存表、iFixit 原文 | 补 Apple 未公开的运行内存，保留各自来源 |
| 5 | 已登记的主流科技媒体、产品库与中国大陆商品页 | Apple 未单列配置的历史国行首发价，以及当前价与二手价的单次公开快照 |

## 数据文件

| 文件 | 角色 |
| --- | --- |
| `src/data/devices-db.json` | 分品牌合并后的唯一运行时设备主库 |
| `src/data/device-sources.json` | 合并来源登记 |
| `src/data/device-data-manifest.json` | 分品牌构建清单 |
| `src/data/apple-devices-db.json` | Apple 中文分库，构建时合并 |
| `src/data/apple-sources.json` | 默认中文来源登记 |
| `src/data/apple-wearable-devices-db.json` / `apple-wearable-sources.json` | Apple 手表原始规格与独立来源登记 |
| `src/data/apple-devices-db.en-us.json` | 切换前英文设备数据原样快照 |
| `src/data/apple-sources.en-us.json` | 切换前英文来源登记原样快照 |
| `src/data/price-observations.json` | 批次验证通过的新价格观察值 |
| `scripts/sync-apple-zh-cn-data.mjs` | 从中文官网重新生成默认数据与来源登记 |
| `scripts/build-device-database.mjs` | 合并各品牌分库与来源登记 |
| `scripts/price-snapshot-workflow.mjs` | 生成缺口、检查单页、验证并导入价格批次 |

Apple 设备级 URL 清单以手机/平板/笔记本及穿戴各自来源文件为机器可读登记，构建时合并到 `device-sources.json`；本文件不重复维护逐设备人工表格。穿戴同步由 `scripts/sync-wearable-devices.mjs` 管理，不由原 Apple 非穿戴同步重写。公开页面采集缓存位于忽略的 `.source-cache/`，保留原始内容、采集时间及哈希，不纳入发布包。

## 当前质量状态

截至 2026-10-07，Apple 合计 150 条记录、31 个原始比较组、4284 个规格字段（official=4087、reference=197）。新增 19 条手表贡献 300 个官方规格字段，未公开的价格与内存保持缺失。下面表格为仍保留的手机/平板/笔记本 131 条子集，不是 Apple 全品类数量。

| 指标 | 结果 |
| --- | ---: |
| 设备 | 131 |
| 比较组 | 28 |
| 规格字段 | 3984 |
| Apple 一方字段（`official`） | 3787 |
| Apple Support 中文字段 | 3658 |
| Apple 中国页面字段 | 129 |
| `reference` 字段 | 197 |
| 首发价 / 有效当前价 / 有效二手价 | 131 / 34 / 75 |
| 运行内存 | 131 / 131 |
| `support.apple.com/en-us` 默认字段 | 0 |
| `needs_review` | 0 |

3867 条 `rawText` 包含中文；其余 117 条为技术记法，不属于英文快照混入。Apple Support 中文字段中 3649 条来自 `zh-cn`、9 条来自 `zh-tw`。59 个 iPhone / iPad 运行内存字段来自已登记的 iOS Ref，2 个 iPhone 内存字段来自 iFixit 原文；MacBook 内存使用 Apple 中文规格。13 条 MacBook 及 2 条历史 iPhone 国行首发价使用已登记的受信第三方证据，保留对应配置，不包装成 Apple 官方报价。

当前价 / 二手价的 34 / 75 按现行配置、地区、价格类型和状态校验统计，覆盖表示设备至少有一笔有效报价，不代表全配置价格齐全；新增手表尚无有效当前/二手报价。旧文档的 53 / 78 属于旧口径，不能直接当作同口径增减对比。

## 同步与验证

```bash
npm run sync:apple-zh-cn
npm run sync:wearable
npm run build:data
npm run prices -- plan --type current --limit 20
npm run prices -- inspect 'https://m2.9ji.com/secondHand/detail/...' --render
npm run test:price-workflow
npm run test:device-taxonomy
npm run test:device-data-quality
npm run test:wearable
npm run check
npm run build
```

同步脚本执行以下约束：

1. 将已有 Apple Support 路径解析到对应 `zh-cn` 技术规格页。
2. 对 `/docs/...` 聚合页继续解析到实际中文技术规格文档。
3. 从中文页面原文生成 `value` 与 `rawText`，每个字段登记实际来源 URL。
4. 从 Apple 中国 Newsroom 刷新可明确对应的中国大陆首发价；未单列独立配置报价时，仅使用已登记且能精确对应配置的同期受信第三方证据。
5. 仅按显式登记表补入运行内存及价格快照，保留实际来源、配置、成色和采集日期。
6. 对内容未变化的字段保留原 `verifiedAt`，避免同步日期造成无意义全库变更。
7. 中文页面未明确声明且没有受信补充来源的字段保持缺失，不从英文快照回填。
8. 原文与整理描述区分记录；真实采集记录 `fetchedAt` / 内容哈希，缓存复用及失败刷新不伪造新采集日期，不覆盖已有可靠证据。

报价批次校验具体设备、国行地区、内存/存储及芯片配置、价格类型、成色和日期。海外版、配置冲突、非正常新机状态等报价不能作为正常国行当前价；排除原因可保留在 `excludedReason`。同配置按较新观察日期选择，不用旧低价覆盖新价。

## 已知边界

- 30 个英文库曾有的推断字段在中文库中保持缺失，主要是未明确写出的 60Hz，以及“没有 HDMI / SDXC”等否定项。
- MacBook 首发价已覆盖 55 / 55；第三方补录值均对应明确标准销售配置，不把同系列起售价或自行加减选配价格当作证据。
- `ipad-air-m4-2025` 暂时保留历史内部 ID 以避免路由变化，中文数据中的发布年份已修正为 2026。
- 当前有效报价为新机 34 / 131、二手 75 / 131；特定配置、成色和日期的参考快照不是实时行情，商城当前价不能冒充首发价，首发价也不作为顾问预算依据。
- Apple 50 台设备存有配置矩阵，不代表所有历史 SKU 完整核实；运行内存字段覆盖 131/131 不能证明内存与存储可任意组合。高价值 MacBook 配置缺口仍按具体设备核验。
