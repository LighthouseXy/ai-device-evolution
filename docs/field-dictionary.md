# 数码观察站运行时字段字典

> 版本：3.0 · 更新日期：2026-07-20
> 本文只描述当前代码实际读取的 `src/data/apple-devices-db.json`。旧版设计稿归档于 `docs/archive/field-dictionary-v2.1.md`。

## 数据边界

- `apple-devices-db.json` 是唯一设备主数据。
- 当前样本共 58 台 Apple 设备，类别为 `phone`、`tablet`、`laptop`。
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

当前共有 53 个规格键：

- 基础与外观：`colors`、`material`、`dimensions`、`weight`、`thickness`。
- 屏幕：`screenSize`、`displayType`、`resolution`、`refreshRate`、`peakBrightness`。
- 芯片与存储：`chip`、`cpu`、`gpu`、`neuralEngine`、`memory`、`storage`。
- 影像：`rearCamera`、`mainCamera`、`ultraWide`、`telephoto`、`opticalZoom`、`frontCamera`、`webcam`、`videoRecording`。
- 续航与充电：`batteryLife`、`videoPlayback`、`wirelessWebBrowsing`、`chargingMethod`、`powerAdapter`、`hasMagSafe`。
- 连接与接口：`port`、`usbC`、`thunderbolt`、`wifi`、`bluetooth`、`sim`、`externalDisplay`、`hasHDMI`、`hasSDXC`、`hasNFC`、`hasUWB`。
- 交互与音频：`keyboard`、`trackpad`、`pencilSupport`、`magicKeyboard`、`speakers`、`microphone`、`hasTouchId`。
- 安全与耐用：`security`、`waterResistance`、`hasSOS`、`hasCrashDetection`。
- 价格：`launchPrice`。

字段并非每个类别都必须具备。禁止用占位字符串写入 `value`；缺失数据保持为空。

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

## 校验

运行：

```bash
npm run test:device-taxonomy
```

校验覆盖设备数量与唯一性、字段元数据、布尔字段类型、严格比较组、连续代际顺序、computed 来源以及直接前代引用。
