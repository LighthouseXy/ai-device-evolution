# Apple 主来源与补充来源管理

> 项目：数码观察站 DeviceScope
> 版本：v1.7 | 2026-08-31

## 当前口径

- 运行时默认展示中文数据；Apple 中国简体中文页面仍是规格与首发价的第一来源。
- 技术规格优先使用 `https://support.apple.com/zh-cn/...`。
- 中国大陆首发价使用 `https://www.apple.com.cn/newsroom/...` 发布时新闻稿。
- Apple 未公开的 iPhone / iPad 运行内存可由维护稳定、可逐项核对的 iOS Ref 补齐；当前价与二手价允许使用中国大陆公开商品页的静态快照。
- 第三方值必须标记为 `reference` 并通过字段、域名、置信度和快照元数据门禁；不把第三方值包装成 Apple 官方事实。
- 不把页面未声明的否定项或常见参数推断成已知事实。
- 英文官网数据只作为独立历史快照保留，不参与默认展示。

## 来源优先级

| 优先级 | 页面类型 | 用途 |
| --- | --- | --- |
| 1 | Apple Support 中国简体中文技术规格页 | 设备规格、尺寸、接口、影像、续航等 |
| 2 | Apple 中国 Newsroom 发布新闻稿 | 中国大陆首发价与发布背景 |
| 3 | Apple 中国当前产品页 | 仅用于补充仍在售产品信息，不替代发布时价格证据 |
| 4 | iOS Ref 内存表 | 仅补 Apple 未公开的 iPhone / iPad 运行内存 |
| 5 | 已登记的中国大陆商品页 | 当前价与二手价的单次公开快照 |

## 数据文件

| 文件 | 角色 |
| --- | --- |
| `src/data/apple-devices-db.json` | 默认中文设备数据，运行时读取 |
| `src/data/apple-sources.json` | 默认中文来源登记 |
| `src/data/apple-devices-db.en-us.json` | 切换前英文设备数据原样快照 |
| `src/data/apple-sources.en-us.json` | 切换前英文来源登记原样快照 |
| `src/data/price-observations.json` | 批次验证通过的新价格观察值 |
| `scripts/sync-apple-zh-cn-data.mjs` | 从中文官网重新生成默认数据与来源登记 |
| `scripts/price-snapshot-workflow.mjs` | 生成缺口、检查单页、验证并导入价格批次 |

设备级完整 URL 清单以 `src/data/apple-sources.json` 为唯一机器可读事实来源，本文件不重复维护容易失效的逐设备人工表格。

## 当前质量状态

| 指标 | 结果 |
| --- | ---: |
| 设备 | 129 |
| 比较组 | 28 |
| 规格字段 | 3834 |
| Apple 一方字段 | 3722 |
| Apple Support `zh-cn` 字段 | 3597 |
| Apple 中国页面字段 | 125 |
| `reference` 字段 | 112 |
| 首发价 / 当前价 / 二手价 | 116 / 24 / 38 |
| 运行内存 | 128 / 129 |
| `support.apple.com/en-us` 默认字段 | 0 |
| `needs_review` | 0 |

3721 条 `rawText` 包含中文；其余 113 条为 `12GB`、`eSIM` 等技术记法，不属于英文快照混入。59 个 iPhone / iPad 运行内存字段来自 [iOS Ref](https://iosref.com/memory-processor)，其公开维护源位于 [GitHub](https://github.com/ebelinski/iosref)。

## 同步与验证

```bash
npm run sync:apple-zh-cn
npm run prices -- plan --type current --limit 20
npm run test:price-workflow
npm run test:device-taxonomy
npm run test:device-data-quality
npm run check
npm run build
```

同步脚本执行以下约束：

1. 将已有 Apple Support 路径解析到对应 `zh-cn` 技术规格页。
2. 对 `/docs/...` 聚合页继续解析到实际中文技术规格文档。
3. 从中文页面原文生成 `value` 与 `rawText`，每个字段登记实际来源 URL。
4. 从 Apple 中国 Newsroom 刷新可明确对应的中国大陆首发价；未单列独立配置报价时保持缺失。
5. 仅按显式登记表补入运行内存及价格快照，保留实际来源、配置、成色和采集日期。
6. 对内容未变化的字段保留原 `verifiedAt`，避免同步日期造成无意义全库变更。
7. 中文页面未明确声明且没有受信补充来源的字段保持缺失，不从英文快照回填。

## 已知边界

- 30 个英文库曾有的推断字段在中文库中保持缺失，主要是未明确写出的 60Hz，以及“没有 HDMI / SDXC”等否定项。
- 13 台 MacBook 尚无可靠中国大陆首发价；1 台 MacBook 尚无可靠运行内存。缺失项保持为空，不以同系列或相近配置推断。
- `ipad-air-m4-2025` 暂时保留历史内部 ID 以避免路由变化，中文数据中的发布年份已修正为 2026。
- 当前价与二手价分别仅覆盖 24 / 38 台，都是特定配置、成色和日期的参考快照，不是实时行情；商城当前价也不能冒充首发价。
