# Apple 官方来源管理

> 项目：数码观察站 DeviceScope
> 版本：v1.3 | 2026-07-23

## 当前口径

- 运行时默认数据必须来自 Apple 中国简体中文页面。
- 技术规格优先使用 `https://support.apple.com/zh-cn/...`。
- 中国大陆首发价使用 `https://www.apple.com.cn/newsroom/...` 发布时新闻稿。
- 不使用非 Apple 来源补齐缺失值，不把页面未声明的否定项或常见参数推断成官方事实。
- 英文官网数据只作为独立历史快照保留，不参与默认展示。

## 来源优先级

| 优先级 | 页面类型 | 用途 |
| --- | --- | --- |
| 1 | Apple Support 中国简体中文技术规格页 | 设备规格、尺寸、接口、影像、续航等 |
| 2 | Apple 中国 Newsroom 发布新闻稿 | 中国大陆首发价与发布背景 |
| 3 | Apple 中国当前产品页 | 仅用于补充仍在售产品信息，不替代发布时价格证据 |

## 数据文件

| 文件 | 角色 |
| --- | --- |
| `src/data/apple-devices-db.json` | 默认中文设备数据，运行时读取 |
| `src/data/apple-sources.json` | 默认中文来源登记 |
| `src/data/apple-devices-db.en-us.json` | 切换前英文设备数据原样快照 |
| `src/data/apple-sources.en-us.json` | 切换前英文来源登记原样快照 |
| `scripts/sync-apple-zh-cn-data.mjs` | 从中文官网重新生成默认数据与来源登记 |

设备级完整 URL 清单以 `src/data/apple-sources.json` 为唯一机器可读事实来源，本文件不再重复维护 63 行容易失效的人工表格。

## 当前质量状态

| 指标 | 结果 |
| --- | ---: |
| 设备 | 63 |
| 比较组 | 21 |
| 规格字段 | 2034 |
| Apple 一方字段 | 2034 |
| Apple Support `zh-cn` 字段 | 1974 |
| Apple 中国 Newsroom 首发价 | 60 / 63 |
| 非 Apple `reference` 字段 | 0 |
| `support.apple.com/en-us` 默认字段 | 0 |
| `needs_review` | 0 |

1962 条 `rawText` 包含中文。其余 72 条是中文官网原文中的纯技术记法，例如 `12GB`、`eSIM`、`Bluetooth 5.3`，不属于英文来源残留。

## 同步与验证

```bash
npm run sync:apple-zh-cn
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
5. 中文页面未明确声明的字段保持缺失，不从英文快照回填。

## 已知边界

- 30 个英文库曾有的推断字段在中文库中保持缺失，主要是未明确写出的 60Hz，以及“没有 HDMI / SDXC”等否定项。
- MacBook Pro 的 Pro / Max 已拆为独立记录。`macbook-pro-16-m2-max-2023`、`macbook-pro-14-m4-max-2024` 与 `macbook-pro-16-m4-2024` 的中国官网新闻稿未明确单列独立配置报价，首发价保持缺失，不使用推断价或第三方价格。
- `ipad-air-m4-2025` 暂时保留历史内部 ID 以避免路由变化，中文数据中的发布年份已修正为 2026。
- `currentPrice` 与 `usedPrice` 尚未采集，不能用当前商城价格冒充首发价。
