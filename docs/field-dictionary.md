# 数码观察站运行时字段字典

> 版本：3.5 · 更新日期：2026-08-31
> 本文只描述当前代码实际读取的 `src/data/apple-devices-db.json`。旧版设计稿归档于 `docs/archive/field-dictionary-v2.1.md`。

## 数据边界

- `apple-devices-db.json` 是唯一设备主数据。
- 当前样本共 129 台 Apple 设备、28 个严格比较组，类别为 `phone`、`tablet`、`laptop`。
- `specs` 保存采集事实及来源；`computed` 保存派生结果，二者不得混用。
- 缺失值保留为 `null` 或缺少字段，展示层再转换为“待补充”。

## Device

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `string` | 全局唯一、稳定的设备标识 |
| `brand` | `string` | 当前均为 Apple |
| `category` | `phone \| tablet \| laptop` | 设备大类 |
| `series` | `string` | 面向展示的宽泛系列名，不作为严格代际分组依据 |
| `family` | `string` | 产品族，如 iPhone、iPad Pro、MacBook Air |
| `variant` | `string` | 款式或关键尺寸，如 Pro、Pro Max、11-inch、13-inch |
| `tier` | `base \| pro-max` | 仅笔记本使用的芯片档位；其他类别不得设置 |
| `modelName` | `string` | 完整设备名称 |
| `generation` | `string` | 面向展示的代际名称，不保证可转为数字 |
| `generationOrder` | `positive integer` | 严格比较组内从 1 开始的连续顺序 |
| `releaseYear` | `number` | 发布年份 |
| `specs` | `Record<string, SpecField>` | 带来源的规格字段 |
| `computed` | `Record<string, ComputedField>` | 派生字段 |

严格比较组键为 `family + variant + 可选 tier`。`generationOrder`、前代引用、趋势图和代际对比均以该组为边界。

## SpecField

```ts
type SpecField<T> = {
  value: T | null;
  unit?: string | null;
  rawText?: string | null;
  sourceUrl: string;
  sourceType: "apple" | "reference";
  confidence: number; // 0-1
  verifiedAt: string; // YYYY-MM-DD
};
```

当前共有 54 个规格键：

- 基础与外观：`colors`、`material`、`dimensions`、`weight`、`thickness`。
- 屏幕：`screenSize`、`displayType`、`resolution`、`refreshRate`、`peakBrightness`。
- 芯片与存储：`chip`、`cpu`、`gpu`、`neuralEngine`、`memory`、`storage`。
- 影像：`rearCamera`、`mainCamera`、`ultraWide`、`telephoto`、`opticalZoom`、`frontCamera`、`webcam`、`videoRecording`。
- 续航与充电：`batteryLife`、`videoPlayback`、`wirelessWebBrowsing`、`chargingMethod`、`powerAdapter`、`hasMagSafe`。
- 连接与接口：`port`、`usbC`、`thunderbolt`、`wifi`、`bluetooth`、`sim`、`externalDisplay`、`hasHDMI`、`hasSDXC`、`hasNFC`、`hasUWB`。
- 交互与音频：`keyboard`、`trackpad`、`pencilSupport`、`magicKeyboard`、`speakers`、`microphone`、`hasTouchId`。
- 安全与耐用：`security`、`waterResistance`、`hasSOS`、`hasCrashDetection`。
- 价格：`launchPrice`、`currentPrice`、`usedPrice`。

字段并非每个类别都必须具备。禁止用占位字符串写入 `value`；缺失数据保持为空。

价格字段可额外保存以下快照元数据：

```ts
type PriceField = SpecField<number> & {
  priceType?: "launch" | "current" | "used";
  market?: string;
  configuration?: string;
  condition?: string;
  observedAt?: string; // YYYY-MM-DD
  sourceName?: string;
};
```

`currentPrice` 与 `usedPrice` 是特定日期、配置和成色的中国大陆公开价格快照，不代表实时全网最低价。代际对比按“运行内存 + 存储”组合匹配可比价格；没有相同配置时保持缺失，不跨配置硬比较。

## ComputedField

```ts
type ComputedField = {
  value: number | null;
  scoreBreakdown: string;
  comparedTo?: string | null;
  changeSummary?: string | null;
  confidence: number; // 0-1
  computedAt: string; // YYYY-MM-DD
  sourceType: "computed";
  verifiedAt: string; // YYYY-MM-DD
};
```

| 字段 | 说明 |
|---|---|
| `aiCapabilityLevel` | 当前内部 AI 能力等级 |
| `generationUpgradeMagnitude` | 相对同一严格比较组直接前代的升级幅度 |
| `recommendationLevel` | 当前内部推荐等级 |

比较组第一代的升级幅度和 `comparedTo` 必须为空。后续代际必须引用直接前代；尚无可靠评分时允许 `value: null`，但必须保留直接前代、`confidence: 0` 和“尚未重新计算”说明。

当前运行时的 13 条后续代际均已完成 1–10 分评分，不存在待计算项；`value: null` 仅保留为未来缺少可靠评分口径时的诚实缺失表达。

## 校验

运行完整数据校验：

```bash
npm run test:device-taxonomy
npm run test:device-data-quality
```

分类校验覆盖设备数量与唯一性、字段元数据、布尔字段类型、严格比较组、连续代际顺序、computed 来源以及直接前代引用。

数据质量校验覆盖：

- 主数据与 `apple-sources.json` 一一对应；
- 每个规格字段的 URL 已登记且属于允许的 Apple 或受信第三方域名；
- `reference` 仅用于已登记的价格快照、缺少 Apple 直接证据的少量首发价，以及 Apple 未公开的运行内存；
- 页面核心字段不得从当前完整覆盖状态回退；
- 输出各品类关键字段覆盖率、来源地区分布和待复核设备清单。

当前质量基线为 129 台设备、3905 个规格字段：`apple=3723`、`reference=182`、`needsReview=[]`。首发价覆盖 129 台，当前价快照覆盖 49 台，二手价快照覆盖 70 台；运行内存覆盖 129 台，其中 59 个 iPhone / iPad 字段由 iOS Ref 补齐，2016 款 12 英寸 MacBook 的 8GB 内存来自 Apple 官方繁体中文技术规格页。13 条 Apple 新闻稿未单列的 MacBook 国行首发价使用已登记的同期主流第三方页面，并保存明确芯片、内存与存储配置。新增当前价和二手价先进入 `price-observations.json`，通过批次验证后再由中文同步脚本写入主库。中文官网未明确写出的刷新率及 HDMI / SDXC 否定项继续保持缺失；不得为提高覆盖率写入推断值。
