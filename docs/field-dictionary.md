# 数码观察站 DeviceScope — 字段字典 v2.1

---

## 版本说明

| 版本 | 日期 | 变更 |
|------|------|------|
| v1 | 2026-06 | 初稿 |
| v2 | 2026-06 | 修复表格列数；引入 SpecField / ComputedField；Device 改为联合类型；补充趋势数值字段；JSON 覆盖三品类 |
| v2.1 | 2026-06 | 修正 DeviceBase 共享字段、统一 port 命名、补充 ComputedField.sourceType、明确 JSON 完整化要求 |

---

## 数据类型约定

| 类型 | 说明 | 示例 |
|------|------|------|
| `string` | 文本 | `"超视网膜 XDR 显示屏"` |
| `number` | 数值 | `6.1` |
| `boolean` | 布尔 | `true` |
| `string[]` | 字符串数组 | `["黑色","白色","蓝色"]` |
| `SpecField<T>` | 带元数据的规格字段 | 见下文 |
| `ComputedField<T>` | 计算字段 | 见下文 |
| `null` | 空值/未知 | `null` |

### SpecField\<T\> — 带溯源的规格字段

```typescript
interface SpecField<T> {
  value: T;                    // 字段值
  unit?: string;               // 单位，如 "元"、"g"、"inch"、"Hz"、"nits"
  rawText?: string;            // 原始抓取文本，如 "146.7 x 71.5 x 7.4 mm"
  sourceUrl: string;           // 数据来源 URL
  sourceType: SourceType;      // 数据来源类型
  confidence?: number;         // 置信度 0-1
  verifiedAt?: string;         // 最后验证时间 ISO 8601
}

type SourceType =
  | "apple"         // Apple 官网
  | "third_party"   // 第三方渠道
  | "computed"      // 本系统规则计算
  | "internal"      // 内部评分
  | "user";         // 用户提交
```

### ComputedField\<T\> — 计算字段

```typescript
interface ComputedField<T> {
  value: T;                    // 计算结果
  sourceType: "computed" | "internal";  // 来源类型：computed=规则计算，internal=内部评分
  computedFrom: string[];      // 依赖的字段 key 列表
  formula: string;             // 计算公式描述
  confidence: number;          // 置信度 0-1
  updatedAt: string;           // 最后计算时间 ISO 8601
}
```

**sourceType 区分：**
- `computed`：纯规则计算，如 valueRetention、hasPromotion、memoryGB、maxStorageGB、maxOpticalZoom、videoPlaybackHours
- `internal`：内部评分，如 aiFeatureLevel、chipRank、portability、onDeviceAi

---

## 标记约定

| 标记 | 含义 |
|------|------|
| ✅ R | 必须字段 |
| ⬜ O | 可选字段 |
| 📊 T | 适合趋势图（数值型） |
| 🤖 AI | 适合 AI 预测 |
| 🧮 C | 计算字段（ComputedField） |
| 🍎 A | Apple 官方来源 |
| 🌐 N | 非官方 / 第三方来源 |

### 来源类型对照

| 数据来源 | SourceType | 示例 |
|----------|-----------|------|
| Apple 官网 | `apple` | 首发价格、芯片、屏幕尺寸 |
| 第三方渠道 | `third_party` | currentPrice、usedPrice |
| 规则计算 | `computed` | valueRetention、hasPromotion |
| 内部评分 | `internal` | aiFeatureLevel、portability、chipRank |
| 用户提交 | `user` | 用户补充数据 |

---

## 趋势图数值字段

以下字段为数值型，可直接用于折线图和趋势分析：

| 中文名 | key | 类型 | 单位 | 说明 | 适用品类 |
|--------|-----|------|------|------|----------|
| 芯片性能排名 | `chipRank` | `ComputedField<number>` | — | 内部性能指数 | 全部 |
| 视频播放时长 | `videoPlaybackHours` | `ComputedField<number>` | 小时 | 数值化续航 | 全部 |
| 内存容量 | `memoryGB` | `ComputedField<number>` | GB | 数值化内存 | 全部 |
| 最大存储容量 | `maxStorageGB` | `ComputedField<number>` | GB | 数值化存储 | 全部 |
| 最大光学变焦 | `maxOpticalZoom` | `ComputedField<number>` | x | 数值化变焦 | phone |
| 重量 | `weight` | `SpecField<number>` | g | 机身重量 | 全部 |
| 屏幕尺寸 | `screenSize` | `SpecField<number>` | inch | 对角线尺寸 | 全部 |
| 峰值亮度 | `peakBrightness` | `SpecField<number>` | nits | HDR 峰值亮度 | 全部 |
| 首发价格 | `launchPrice` | `SpecField<number>` | 元 | 中国大陆首发价 | 全部 |

> 这些字段在图表层可同时作为顶层 `number` 字段（用于绘图）和 `SpecField<number>` / `ComputedField<number>`（用于溯源）存在。

---

## iPhone 手机

### 1. 价格

| 中文名 | key | 类型 | 单位 | R/O | 来源 | 趋势 | AI | 计算 | 备注 |
|--------|-----|------|------|-----|------|------|----|------|------|
| 首发价格 | `launchPrice` | `SpecField<number>` | 元 | ✅ | 🍎 apple | 📊 | 🤖 | | 中国大陆 Apple 官网首发价 |
| 实时价格 | `currentPrice` | `SpecField<number>` | 元 | ⬜ | 🌐 third_party | 📊 | 🤖 | | 第三方渠道实时价格 |
| 二手价格 | `usedPrice` | `SpecField<number>` | 元 | ⬜ | 🌐 third_party | 📊 | | | 二手市场参考价（9 成新） |
| 保值率 | `valueRetention` | `ComputedField<number>` | % | ⬜ | 🧮 computed | | | 🧮 | usedPrice / launchPrice × 100 |

### 2. 外观设计

| 中文名 | key | 类型 | 单位 | R/O | 来源 | 趋势 | AI | 计算 | 备注 |
|--------|-----|------|------|-----|------|------|----|------|------|
| 颜色 | `colors` | `SpecField<string[]>` | — | ✅ | 🍎 apple | | | | 所有可选颜色列表 |
| 材料 | `material` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 如 `"铝金属设计"` |
| 重量 | `weight` | `SpecField<number>` | g | ✅ | 🍎 apple | 📊 | | | 无线局域网机型重量 |
| 机身尺寸 | `dimensions` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 如 `"146.7 x 71.5 x 7.4 mm"` |

### 3. 显示屏

| 中文名 | key | 类型 | 单位 | R/O | 来源 | 趋势 | AI | 计算 | 备注 |
|--------|-----|------|------|-----|------|------|----|------|------|
| 屏幕尺寸 | `screenSize` | `SpecField<number>` | inch | ✅ | 🍎 apple | 📊 | 🤖 | | 对角线尺寸 |
| 分辨率 | `resolution` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 如 `"2556 x 1179 像素"` |
| 显示类型 | `displayType` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | OLED / LCD / XDR 等 |
| 刷新率 | `refreshRate` | `SpecField<number>` | Hz | ✅ | 🍎 apple | 📊 | | | 60 / 120 |
| ProMotion | `hasPromotion` | `ComputedField<boolean>` | — | ✅ | 🧮 computed | | | 🧮 | refreshRate.value >= 120 时为 true |
| 峰值亮度 | `peakBrightness` | `SpecField<number>` | nits | ⬜ | 🍎 apple | 📊 | | | HDR 峰值亮度 |
| 显示涂层 | `displayCoating` | `SpecField<string>` | — | ⬜ | 🍎 apple | | | | 防油渍防指纹涂层等 |

### 4. 性能与智能

| 中文名 | key | 类型 | 单位 | R/O | 来源 | 趋势 | AI | 计算 | 备注 |
|--------|-----|------|------|-----|------|------|----|------|------|
| 芯片 | `chip` | `SpecField<string>` | — | ✅ | 🍎 apple | 📊 | 🤖 | | 如 `"A18 Pro"` |
| 芯片性能排名 | `chipRank` | `ComputedField<number>` | — | ✅ | 🧮 internal | 📊 | 🤖 | 🧮 | 内部性能指数 |
| CPU | `cpu` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 如 `"6 核中央处理器"` |
| GPU | `gpu` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 如 `"6 核图形处理器"` |
| 神经网络引擎 | `neuralEngine` | `SpecField<string>` | — | ✅ | 🍎 apple | | 🤖 | | 如 `"16 核神经网络引擎"` |
| 内存 | `memory` | `SpecField<string>` | — | ⬜ | 🍎 apple | | | | 如 `"8GB"` |
| 内存容量(数值) | `memoryGB` | `ComputedField<number>` | GB | ⬜ | 🧮 computed | 📊 | 🤖 | 🧮 | 从 memory 解析数值 |
| 存储容量 | `storage` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 如 `"128GB / 256GB / 512GB"` |
| 最大存储(数值) | `maxStorageGB` | `ComputedField<number>` | GB | ⬜ | 🧮 computed | 📊 | 🤖 | 🧮 | 从 storage 解析最大值 |
| AI 能力等级 | `aiFeatureLevel` | `ComputedField<number>` | — | ⬜ | 🧮 internal | 📊 | 🤖 | 🧮 | 0-10 综合评分 |
| 端侧智能基础 | `onDeviceAi` | `ComputedField<string>` | — | ⬜ | 🧮 internal | | | 🧮 | aiFeatureLevel >= 7 → "适合" |

### 5. 影像与视频

| 中文名 | key | 类型 | 单位 | R/O | 来源 | 趋势 | AI | 计算 | 备注 |
|--------|-----|------|------|-----|------|------|----|------|------|
| 后置摄像头 | `rearCamera` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 概述，如 `"4800 万像素双摄系统"` |
| 主摄规格 | `mainCamera` | `SpecField<string>` | — | ⬜ | 🍎 apple | | | | 如 `"4800 万像素，ƒ/1.6"` |
| 超广角 | `ultraWide` | `SpecField<string>` | — | ⬜ | 🍎 apple | | | | 如 `"1200 万像素，ƒ/2.2"` |
| 长焦 | `telephoto` | `SpecField<string>` | — | ⬜ | 🍎 apple | | | | 如 `"5x 光学变焦"` |
| 光学变焦 | `opticalZoom` | `SpecField<string>` | — | ⬜ | 🍎 apple | 📊 | | | 如 `"0.5x / 1x / 2x / 5x"` |
| 最大光学变焦(数值) | `maxOpticalZoom` | `ComputedField<number>` | x | ⬜ | 🧮 computed | 📊 | 🤖 | 🧮 | 从 opticalZoom 解析最大值 |
| 前置摄像头 | `frontCamera` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 如 `"1200 万像素原深感摄像头"` |
| 视频拍摄 | `videoRecording` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 如 `"4K 60fps Dolby Vision"` |

### 6. 续航与充电

| 中文名 | key | 类型 | 单位 | R/O | 来源 | 趋势 | AI | 计算 | 备注 |
|--------|-----|------|------|-----|------|------|----|------|------|
| 电池续航 | `batteryLife` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 如 `"视频播放最长可达 30 小时"` |
| 视频播放 | `videoPlayback` | `SpecField<string>` | — | ✅ | 🍎 apple | 📊 | | | 如 `"最长可达 30 小时"` |
| 视频播放时长(数值) | `videoPlaybackHours` | `ComputedField<number>` | 小时 | ⬜ | 🧮 computed | 📊 | 🤖 | 🧮 | 从 videoPlayback 解析数值 |
| 充电方式 | `chargingMethod` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 有线 / MagSafe / Qi2 |
| MagSafe | `hasMagSafe` | `SpecField<boolean>` | — | ⬜ | 🍎 apple | | | | 是否支持 MagSafe |
| 充电接口 | `port` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | USB-C / Lightning，连接和充电接口 |
| 快充支持 | `fastCharge` | `SpecField<string>` | — | ⬜ | 🍎 apple | | | | 如 `"30 分钟充至 50%"` |

### 7. 安全与防护

| 中文名 | key | 类型 | 单位 | R/O | 来源 | 趋势 | AI | 计算 | 备注 |
|--------|-----|------|------|-----|------|------|----|------|------|
| 安全验证 | `security` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | Face ID / Touch ID |
| 防水等级 | `waterResistance` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 如 `"IP68"` |
| 防尘等级 | `dustResistance` | `SpecField<string>` | — | ⬜ | 🍎 apple | | | | 通常包含在 IP 等级中 |
| SOS/卫星通信 | `hasSOS` | `SpecField<boolean>` | — | ⬜ | 🍎 apple | | | | 是否支持卫星紧急联络 |
| 车祸检测 | `hasCrashDetection` | `SpecField<boolean>` | — | ⬜ | 🍎 apple | | | | 是否支持车祸检测 |

### 8. 连接与扩展

| 中文名 | key | 类型 | 单位 | R/O | 来源 | 趋势 | AI | 计算 | 备注 |
|--------|-----|------|------|-----|------|------|----|------|------|
| 连接端口 | `port` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | USB-C / Lightning |
| Wi-Fi | `wifi` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 如 `"802.11be (Wi-Fi 7)"` |
| 蓝牙 | `bluetooth` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 如 `"蓝牙 5.3"` |
| 蜂窝网络 | `cellular` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 如 `"5G (sub-6 GHz)"` |
| SIM 卡 | `sim` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | nano-SIM / eSIM / 双 eSIM |
| UWB | `hasUWB` | `SpecField<boolean>` | — | ⬜ | 🍎 apple | | | | 超宽带芯片 |
| NFC | `hasNFC` | `SpecField<boolean>` | — | ✅ | 🍎 apple | | | | 近场通信（Apple Pay） |

---

## iPad 平板

### 1. 价格

| 中文名 | key | 类型 | 单位 | R/O | 来源 | 趋势 | AI | 计算 | 备注 |
|--------|-----|------|------|-----|------|------|----|------|------|
| 首发价格 | `launchPrice` | `SpecField<number>` | 元 | ✅ | 🍎 apple | 📊 | 🤖 | | 中国大陆首发价 |
| 实时价格 | `currentPrice` | `SpecField<number>` | 元 | ⬜ | 🌐 third_party | 📊 | 🤖 | | 第三方渠道实时价格 |
| 二手价格 | `usedPrice` | `SpecField<number>` | 元 | ⬜ | 🌐 third_party | 📊 | | | 二手市场参考价 |
| 保值率 | `valueRetention` | `ComputedField<number>` | % | ⬜ | 🧮 computed | | | 🧮 | usedPrice / launchPrice × 100 |

### 2. 外观设计

| 中文名 | key | 类型 | 单位 | R/O | 来源 | 趋势 | AI | 计算 | 备注 |
|--------|-----|------|------|-----|------|------|----|------|------|
| 颜色 | `colors` | `SpecField<string[]>` | — | ✅ | 🍎 apple | | | | 所有可选颜色列表 |
| 材料 | `material` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 如 `"铝金属一体成型"` |
| 重量 | `weight` | `SpecField<number>` | g | ✅ | 🍎 apple | 📊 | | | 无线局域网机型重量 |
| 机身尺寸 | `dimensions` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 如 `"249.7 x 177.5 x 5.3 mm"` |

### 3. 显示屏

| 中文名 | key | 类型 | 单位 | R/O | 来源 | 趋势 | AI | 计算 | 备注 |
|--------|-----|------|------|-----|------|------|----|------|------|
| 屏幕尺寸 | `screenSize` | `SpecField<number>` | inch | ✅ | 🍎 apple | 📊 | 🤖 | | 对角线尺寸 |
| 显示类型 | `displayType` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | Liquid 视网膜 / XDR |
| 分辨率 | `resolution` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 如 `"2388 x 1668 像素"` |
| 刷新率 | `refreshRate` | `SpecField<number>` | Hz | ✅ | 🍎 apple | 📊 | | | 60 / 120 |
| ProMotion | `hasPromotion` | `ComputedField<boolean>` | — | ✅ | 🧮 computed | | | 🧮 | refreshRate.value >= 120 时为 true |
| 峰值亮度 | `peakBrightness` | `SpecField<number>` | nits | ⬜ | 🍎 apple | 📊 | | | HDR 峰值亮度 |
| 显示涂层 | `displayCoating` | `SpecField<string>` | — | ⬜ | 🍎 apple | | | | 抗反射涂层等 |

### 4. 性能与智能

| 中文名 | key | 类型 | 单位 | R/O | 来源 | 趋势 | AI | 计算 | 备注 |
|--------|-----|------|------|-----|------|------|----|------|------|
| 芯片 | `chip` | `SpecField<string>` | — | ✅ | 🍎 apple | 📊 | 🤖 | | 如 `"Apple M4"` |
| 芯片性能排名 | `chipRank` | `ComputedField<number>` | — | ✅ | 🧮 internal | 📊 | 🤖 | 🧮 | 内部性能指数 |
| CPU | `cpu` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 如 `"10 核中央处理器"` |
| GPU | `gpu` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 如 `"10 核图形处理器"` |
| 神经网络引擎 | `neuralEngine` | `SpecField<string>` | — | ✅ | 🍎 apple | | 🤖 | | 如 `"16 核神经网络引擎"` |
| 内存 | `memory` | `SpecField<string>` | — | ⬜ | 🍎 apple | | | | 如 `"8GB 或 16GB 统一内存"` |
| 内存容量(数值) | `memoryGB` | `ComputedField<number>` | GB | ⬜ | 🧮 computed | 📊 | 🤖 | 🧮 | 从 memory 解析数值 |
| 存储容量 | `storage` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 如 `"128GB / 256GB"` |
| 最大存储(数值) | `maxStorageGB` | `ComputedField<number>` | GB | ⬜ | 🧮 computed | 📊 | 🤖 | 🧮 | 从 storage 解析最大值 |
| AI 能力等级 | `aiFeatureLevel` | `ComputedField<number>` | — | ⬜ | 🧮 internal | 📊 | 🤖 | 🧮 | 0-10 综合评分 |

### 5. 影像与音频

| 中文名 | key | 类型 | 单位 | R/O | 来源 | 趋势 | AI | 计算 | 备注 |
|--------|-----|------|------|-----|------|------|----|------|------|
| 后置摄像头 | `rearCamera` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 概述 |
| 前置摄像头 | `frontCamera` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 如 `"1200 万像素 Center Stage"` |
| 视频拍摄 | `videoRecording` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 如 `"4K 60fps"` |
| 扬声器 | `speakers` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 如 `"四扬声器系统"` |
| 麦克风 | `microphone` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 如 `"五个录音棚级麦克风"` |

### 6. 续航与充电

| 中文名 | key | 类型 | 单位 | R/O | 来源 | 趋势 | AI | 计算 | 备注 |
|--------|-----|------|------|-----|------|------|----|------|------|
| 电池续航 | `batteryLife` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 如 `"浏览网页最长可达 10 小时"` |
| 视频播放 | `videoPlayback` | `SpecField<string>` | — | ✅ | 🍎 apple | 📊 | | | 如 `"最长可达 10 小时"` |
| 视频播放时长(数值) | `videoPlaybackHours` | `ComputedField<number>` | 小时 | ⬜ | 🧮 computed | 📊 | 🤖 | 🧮 | 从 videoPlayback 解析数值 |
| 充电方式 | `chargingMethod` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | USB-C |
| 连接接口 | `port` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | USB-C / Lightning |

### 7. 安全与防护

| 中文名 | key | 类型 | 单位 | R/O | 来源 | 趋势 | AI | 计算 | 备注 |
|--------|-----|------|------|-----|------|------|----|------|------|
| 安全验证 | `security` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | Face ID / Touch ID |
| 防水等级 | `waterResistance` | `SpecField<string>` | — | ⬜ | 🍎 apple | | | | iPad 通常不支持防水 |
| 安全隔区 | `secureEnclave` | `SpecField<boolean>` | — | ⬜ | 🍎 apple | | | | 安全隔区处理器 |

### 8. 连接与配件

| 中文名 | key | 类型 | 单位 | R/O | 来源 | 趋势 | AI | 计算 | 备注 |
|--------|-----|------|------|-----|------|------|----|------|------|
| 连接端口 | `port` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | USB-C / Lightning |
| Wi-Fi | `wifi` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 如 `"802.11ax"` |
| 蓝牙 | `bluetooth` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 如 `"蓝牙 5.3"` |
| 蜂窝网络 | `cellular` | `SpecField<string>` | — | ⬜ | 🍎 apple | | | | 如 `"5G (可选)"` |
| Apple Pencil | `pencilSupport` | `SpecField<string>` | — | ⬜ | 🍎 apple | | | | 如 `"Apple Pencil Pro"` |
| 妙控键盘 | `magicKeyboard` | `SpecField<boolean>` | — | ⬜ | 🍎 apple | | | | 是否支持妙控键盘 |
| 外接显示器 | `externalDisplay` | `SpecField<boolean>` | — | ⬜ | 🍎 apple | | | | Stage Manager 功能 |

---

## MacBook 笔记本

### 1. 价格

| 中文名 | key | 类型 | 单位 | R/O | 来源 | 趋势 | AI | 计算 | 备注 |
|--------|-----|------|------|-----|------|------|----|------|------|
| 首发价格 | `launchPrice` | `SpecField<number>` | 元 | ✅ | 🍎 apple | 📊 | 🤖 | | 中国大陆首发价 |
| 实时价格 | `currentPrice` | `SpecField<number>` | 元 | ⬜ | 🌐 third_party | 📊 | 🤖 | | 第三方渠道实时价格 |
| 二手价格 | `usedPrice` | `SpecField<number>` | 元 | ⬜ | 🌐 third_party | 📊 | | | 二手市场参考价 |
| 保值率 | `valueRetention` | `ComputedField<number>` | % | ⬜ | 🧮 computed | | | 🧮 | usedPrice / launchPrice × 100 |

### 2. 外观设计

| 中文名 | key | 类型 | 单位 | R/O | 来源 | 趋势 | AI | 计算 | 备注 |
|--------|-----|------|------|-----|------|------|----|------|------|
| 颜色 | `colors` | `SpecField<string[]>` | — | ✅ | 🍎 apple | | | | 所有可选颜色列表 |
| 材料 | `material` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 铝金属一体成型 |
| 重量 | `weight` | `SpecField<number>` | g | ✅ | 🍎 apple | 📊 | | | 统一为克 |
| 机身尺寸 | `dimensions` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 如 `"312.6 x 221.2 x 15.5 mm"` |
| 厚度 | `thickness` | `SpecField<number>` | mm | ⬜ | 🍎 apple | 📊 | | | 如 `15.5` |
| 便携性 | `portability` | `ComputedField<number>` | — | ⬜ | 🧮 internal | | | 🧮 | 0-10 内部评分 |

### 3. 显示屏

| 中文名 | key | 类型 | 单位 | R/O | 来源 | 趋势 | AI | 计算 | 备注 |
|--------|-----|------|------|-----|------|------|----|------|------|
| 屏幕尺寸 | `screenSize` | `SpecField<number>` | inch | ✅ | 🍎 apple | 📊 | 🤖 | | 对角线尺寸 |
| 显示类型 | `displayType` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | Liquid 视网膜 / XDR |
| 分辨率 | `resolution` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 如 `"3024 x 1964 像素"` |
| 刷新率 | `refreshRate` | `SpecField<number>` | Hz | ✅ | 🍎 apple | 📊 | | | 60 / 120 |
| ProMotion | `hasPromotion` | `ComputedField<boolean>` | — | ✅ | 🧮 computed | | | 🧮 | refreshRate.value >= 120 时为 true |
| 峰值亮度 | `peakBrightness` | `SpecField<number>` | nits | ⬜ | 🍎 apple | 📊 | | | HDR 峰值亮度 |
| XDR 显示 | `hasXDR` | `SpecField<boolean>` | — | ⬜ | 🍎 apple | | | | Liquid 视网膜 XDR |
| 纳米纹理玻璃 | `hasNanoTexture` | `SpecField<boolean>` | — | ⬜ | 🍎 apple | | | | 可选配置 |

### 4. 性能与智能

| 中文名 | key | 类型 | 单位 | R/O | 来源 | 趋势 | AI | 计算 | 备注 |
|--------|-----|------|------|-----|------|------|----|------|------|
| 芯片 | `chip` | `SpecField<string>` | — | ✅ | 🍎 apple | 📊 | 🤖 | | 如 `"Apple M4 Pro"` |
| 芯片性能排名 | `chipRank` | `ComputedField<number>` | — | ✅ | 🧮 internal | 📊 | 🤖 | 🧮 | 内部性能指数 |
| CPU | `cpu` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 如 `"12 核中央处理器"` |
| GPU | `gpu` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 如 `"18 核图形处理器"` |
| 神经网络引擎 | `neuralEngine` | `SpecField<string>` | — | ✅ | 🍎 apple | | 🤖 | | 如 `"16 核神经网络引擎"` |
| 内存 | `memory` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 统一内存，如 `"16GB"` |
| 内存容量(数值) | `memoryGB` | `ComputedField<number>` | GB | ✅ | 🧮 computed | 📊 | 🤖 | 🧮 | 从 memory 解析数值 |
| 存储容量 | `storage` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 如 `"512GB / 1TB"` |
| 最大存储(数值) | `maxStorageGB` | `ComputedField<number>` | GB | ⬜ | 🧮 computed | 📊 | 🤖 | 🧮 | 从 storage 解析最大值 |
| 内存带宽 | `memoryBandwidth` | `SpecField<string>` | — | ⬜ | 🍎 apple | | | | 如 `"200GB/s"` |
| 散热方式 | `cooling` | `SpecField<string>` | — | ⬜ | 🍎 apple | | | | 无风扇 / 主动散热 |
| AI 能力等级 | `aiFeatureLevel` | `ComputedField<number>` | — | ⬜ | 🧮 internal | 📊 | 🤖 | 🧮 | 0-10 综合评分 |

### 5. 摄像头与音频

| 中文名 | key | 类型 | 单位 | R/O | 来源 | 趋势 | AI | 计算 | 备注 |
|--------|-----|------|------|-----|------|------|----|------|------|
| 摄像头 | `webcam` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 如 `"1200 万像素 Center Stage"` |
| 麦克风 | `microphone` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 如 `"录音棚级三麦克风阵列"` |
| 扬声器 | `speakers` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 如 `"高保真六扬声器系统"` |
| 空间音频 | `hasSpatialAudio` | `SpecField<boolean>` | — | ⬜ | 🍎 apple | | | | 是否支持空间音频 |
| 视频通话 | `videoCall` | `SpecField<string>` | — | ⬜ | 🍎 apple | | | | 如 `"1080p FaceTime"` |

### 6. 续航与充电

| 中文名 | key | 类型 | 单位 | R/O | 来源 | 趋势 | AI | 计算 | 备注 |
|--------|-----|------|------|-----|------|------|----|------|------|
| 电池续航 | `batteryLife` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 如 `"无线上网最长可达 15 小时"` |
| 视频播放 | `videoPlayback` | `SpecField<string>` | — | ✅ | 🍎 apple | 📊 | | | 如 `"最长可达 22 小时"` |
| 视频播放时长(数值) | `videoPlaybackHours` | `ComputedField<number>` | 小时 | ⬜ | 🧮 computed | 📊 | 🤖 | 🧮 | 从 videoPlayback 解析数值 |
| 无线上网 | `wirelessWebBrowsing` | `SpecField<string>` | — | ✅ | 🍎 apple | 📊 | | | MacBook 特色字段 |
| 充电方式 | `chargingMethod` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | MagSafe / USB-C |
| 快充支持 | `fastCharge` | `SpecField<string>` | — | ⬜ | 🍎 apple | | | | 如 `"30 分钟充至 50%"` |
| 电源适配器 | `powerAdapter` | `SpecField<string>` | — | ⬜ | 🍎 apple | | | | 如 `"70W USB-C"` |

### 7. 安全与交互

| 中文名 | key | 类型 | 单位 | R/O | 来源 | 趋势 | AI | 计算 | 备注 |
|--------|-----|------|------|-----|------|------|----|------|------|
| Touch ID | `hasTouchId` | `SpecField<boolean>` | — | ✅ | 🍎 apple | | | | 是否支持触控 ID |
| 安全验证 | `security` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 触控 ID / 面容 ID |
| 键盘 | `keyboard` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 如 `"背光妙控键盘"` |
| 触控板 | `trackpad` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 如 `"力度触控板"` |
| 触控栏 | `hasTouchBar` | `SpecField<boolean>` | — | ⬜ | 🍎 apple | | | | 已停产，旧款保留 |

### 8. 连接与扩展

| 中文名 | key | 类型 | 单位 | R/O | 来源 | 趋势 | AI | 计算 | 备注 |
|--------|-----|------|------|-----|------|------|----|------|------|
| Thunderbolt | `thunderbolt` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 如 `"Thunderbolt 5"` |
| USB-C | `usbC` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 如 `"3 个 USB-C"` |
| HDMI | `hasHDMI` | `SpecField<boolean>` | — | ⬜ | 🍎 apple | | | | 是否有 HDMI |
| SDXC | `hasSDXC` | `SpecField<boolean>` | — | ⬜ | 🍎 apple | | | | 是否有 SDXC 卡槽 |
| MagSafe | `hasMagSafe` | `SpecField<boolean>` | — | ✅ | 🍎 apple | | | | 充电端口 |
| Wi-Fi | `wifi` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 如 `"802.11ax"` |
| 蓝牙 | `bluetooth` | `SpecField<string>` | — | ✅ | 🍎 apple | | | | 如 `"蓝牙 5.3"` |
| 外接显示器 | `externalDisplay` | `SpecField<string>` | — | ⬜ | 🍎 apple | | | | 如 `"支持最多 2 台外接显示器"` |

---

## 跨品类公共字段

以下字段在三类设备中含义一致，可共用：

```
id, brand, category, series, tier, model, generation, releaseYear,
launchPrice, currentPrice, usedPrice, valueRetention,
colors, material, weight, dimensions,
screenSize, displayType, resolution, refreshRate, hasPromotion, peakBrightness, displayCoating,
chip, chipRank, cpu, gpu, neuralEngine, memory, memoryGB, storage, maxStorageGB, aiFeatureLevel,
batteryLife, videoPlayback, videoPlaybackHours, chargingMethod, port,
security, waterResistance,
wifi, bluetooth
```

---

## TypeScript Interface v2.1

```typescript
// ==================== 元数据类型 ====================

type SourceType = "apple" | "third_party" | "computed" | "internal" | "user";

interface SpecField<T> {
  value: T;
  unit?: string;
  rawText?: string;
  sourceUrl: string;
  sourceType: SourceType;
  confidence?: number;
  verifiedAt?: string;
}

interface ComputedField<T> {
  value: T;
  sourceType: "computed" | "internal";
  computedFrom: string[];
  formula: string;
  confidence: number;
  updatedAt: string;
}

// ==================== 设备品类 ====================

type DeviceCategory = "phone" | "tablet" | "laptop";

type DeviceTier =
  | "base" | "mini" | "air" | "pro" | "pro_max"
  | "m" | "m_pro" | "m_max" | "m_ultra";

// ==================== 三品类共享基础字段 ====================

interface DeviceBase {
  // ---- 元标识 ----
  id: string;
  brand: string;
  category: DeviceCategory;
  series: string;
  tier: DeviceTier;
  model: string;
  generation: number;
  releaseYear: number;

  // ---- 价格 ----
  launchPrice: SpecField<number>;
  currentPrice?: SpecField<number>;        // third_party
  usedPrice?: SpecField<number>;           // third_party
  valueRetention?: ComputedField<number>;   // sourceType: "computed", usedPrice / launchPrice × 100

  // ---- 外观设计 ----
  colors: SpecField<string[]>;
  material: SpecField<string>;
  weight: SpecField<number>;               // 📊 趋势字段 (g)
  dimensions: SpecField<string>;

  // ---- 显示屏 ----
  screenSize: SpecField<number>;           // 📊 趋势字段 (inch)
  displayType: SpecField<string>;
  resolution: SpecField<string>;
  refreshRate: SpecField<number>;          // 📊 趋势字段 (Hz)
  hasPromotion: ComputedField<boolean>;     // sourceType: "computed", refreshRate >= 120
  peakBrightness?: SpecField<number>;      // 📊 趋势字段 (nits)
  displayCoating?: SpecField<string>;

  // ---- 性能与智能 ----
  chip: SpecField<string>;
  chipRank: ComputedField<number>;         // sourceType: "internal", 📊 趋势字段 (内部性能指数)
  cpu: SpecField<string>;
  gpu: SpecField<string>;
  neuralEngine: SpecField<string>;
  memory?: SpecField<string>;
  memoryGB?: ComputedField<number>;        // sourceType: "computed", 📊 趋势字段 (GB)
  storage: SpecField<string>;
  maxStorageGB?: ComputedField<number>;    // sourceType: "computed", 📊 趋势字段 (GB)
  aiFeatureLevel?: ComputedField<number>;  // sourceType: "internal", 📊 趋势字段 (0-10)

  // ---- 续航与充电 ----
  batteryLife: SpecField<string>;
  videoPlayback: SpecField<string>;
  videoPlaybackHours?: ComputedField<number>;  // sourceType: "computed", 📊 趋势字段 (小时)
  chargingMethod: SpecField<string>;
  port: SpecField<string>;

  // ---- 安全 ----
  security: SpecField<string>;
  waterResistance?: SpecField<string>;

  // ---- 连接 ----
  wifi: SpecField<string>;
  bluetooth: SpecField<string>;
}

// ==================== iPhone 专属字段 ====================

interface IPhoneSpecific {
  // 影像（iPhone 专属）
  rearCamera: SpecField<string>;
  frontCamera: SpecField<string>;
  videoRecording: SpecField<string>;
  mainCamera?: SpecField<string>;
  ultraWide?: SpecField<string>;
  telephoto?: SpecField<string>;
  opticalZoom?: SpecField<string>;
  maxOpticalZoom?: ComputedField<number>;  // sourceType: "computed", 📊 趋势字段 (x)

  // 安全（iPhone 专属）
  dustResistance?: SpecField<string>;
  hasSOS?: SpecField<boolean>;
  hasCrashDetection?: SpecField<boolean>;

  // 连接（iPhone 专属）
  cellular: SpecField<string>;
  sim?: SpecField<string>;
  hasUWB?: SpecField<boolean>;
  hasNFC?: SpecField<boolean>;
  hasMagSafe?: SpecField<boolean>;
  fastCharge?: SpecField<string>;

  // 智能（iPhone 专属）
  onDeviceAi?: ComputedField<string>;      // sourceType: "internal"
}

// ==================== iPad 专属字段 ====================

interface IPadSpecific {
  // 影像（iPad 专属）
  rearCamera: SpecField<string>;
  frontCamera: SpecField<string>;
  videoRecording: SpecField<string>;
  cellular?: SpecField<string>;

  // 音频（iPad 专属）
  speakers: SpecField<string>;
  microphone: SpecField<string>;

  // 安全（iPad 专属）
  secureEnclave?: SpecField<boolean>;

  // 配件（iPad 专属）
  pencilSupport?: SpecField<string>;
  magicKeyboard?: SpecField<boolean>;
  externalDisplay?: SpecField<boolean>;
}

// ==================== MacBook 专属字段 ====================

interface MacBookSpecific {
  // 外观（MacBook 专属）
  thickness?: SpecField<number>;           // 📊 趋势字段 (mm)
  portability?: ComputedField<number>;     // sourceType: "internal", 0-10 内部评分

  // 显示（MacBook 专属）
  hasXDR?: SpecField<boolean>;
  hasNanoTexture?: SpecField<boolean>;

  // 性能（MacBook 专属）
  memoryBandwidth?: SpecField<string>;
  cooling?: SpecField<string>;

  // 音频（MacBook 专属）
  webcam: SpecField<string>;
  microphone: SpecField<string>;
  speakers: SpecField<string>;
  hasSpatialAudio?: SpecField<boolean>;
  videoCall?: SpecField<string>;

  // 续航（MacBook 专属）
  wirelessWebBrowsing?: SpecField<string>;
  fastCharge?: SpecField<string>;
  powerAdapter?: SpecField<string>;

  // 交互（MacBook 专属）
  hasTouchId?: SpecField<boolean>;
  keyboard: SpecField<string>;
  trackpad: SpecField<string>;
  hasTouchBar?: SpecField<boolean>;

  // 连接（MacBook 专属）
  thunderbolt?: SpecField<string>;
  usbC?: SpecField<string>;
  hasHDMI?: SpecField<boolean>;
  hasSDXC?: SpecField<boolean>;
  hasMagSafe?: SpecField<boolean>;
  externalDisplay?: SpecField<string>;
}

// ==================== 联合类型 ====================

interface IPhoneDevice extends DeviceBase, IPhoneSpecific {}
interface IPadDevice extends DeviceBase, IPadSpecific {}
interface MacBookDevice extends DeviceBase, MacBookSpecific {}

type Device = IPhoneDevice | IPadDevice | MacBookDevice;

// ==================== 字段字典类型 ====================

interface FieldDictionaryItem {
  label: string;               // 中文标签
  key: string;                 // 字段 key
  category: string;            // 功能分类，如 "价格"、"显示屏"
  type: string;                // 类型标识，如 "SpecField<number>"
  unit: string | null;         // 单位
  required: boolean;           // 是否必须
  sourceType: SourceType;      // 数据来源类型
  trendable: boolean;          // 是否适合趋势图
  predictable: boolean;        // 是否适合 AI 预测
  computed: boolean;           // 是否为计算字段
  computedFrom?: string[];     // 计算字段的依赖字段
  formula?: string;            // 计算公式
  note?: string;               // 备注
}

type FieldDictionary = Record<DeviceCategory, Record<string, FieldDictionaryItem>>;
```

---

## 字段字典 JSON 示例

> **落地说明：** 当前文档中的 JSON 是字段字典格式示例。真正接入项目时，需要单独生成完整的 `src/data/field-dictionary.json`；该 JSON 必须覆盖 phone / tablet / laptop 三类的全部字段；字段结构必须与本文档中的 `FieldDictionaryItem` 保持一致。

### phone 示例（部分字段）

```json
{
  "phone": {
    "launchPrice": {
      "label": "首发价格",
      "key": "launchPrice",
      "category": "价格",
      "type": "SpecField<number>",
      "unit": "元",
      "required": true,
      "sourceType": "apple",
      "trendable": true,
      "predictable": true,
      "computed": false,
      "note": "中国大陆 Apple 官网首发价"
    },
    "currentPrice": {
      "label": "实时价格",
      "key": "currentPrice",
      "category": "价格",
      "type": "SpecField<number>",
      "unit": "元",
      "required": false,
      "sourceType": "third_party",
      "trendable": true,
      "predictable": true,
      "computed": false,
      "note": "第三方渠道实时价格"
    },
    "usedPrice": {
      "label": "二手价格",
      "key": "usedPrice",
      "category": "价格",
      "type": "SpecField<number>",
      "unit": "元",
      "required": false,
      "sourceType": "third_party",
      "trendable": true,
      "predictable": false,
      "computed": false,
      "note": "二手市场参考价（9 成新）"
    },
    "valueRetention": {
      "label": "保值率",
      "key": "valueRetention",
      "category": "价格",
      "type": "ComputedField<number>",
      "unit": "%",
      "required": false,
      "sourceType": "computed",
      "trendable": false,
      "predictable": false,
      "computed": true,
      "computedFrom": ["usedPrice", "launchPrice"],
      "formula": "usedPrice.value / launchPrice.value × 100",
      "note": "计算字段"
    },
    "chip": {
      "label": "芯片",
      "key": "chip",
      "category": "性能与智能",
      "type": "SpecField<string>",
      "unit": null,
      "required": true,
      "sourceType": "apple",
      "trendable": true,
      "predictable": true,
      "computed": false,
      "note": "如 A19 Pro"
    },
    "chipRank": {
      "label": "芯片性能排名",
      "key": "chipRank",
      "category": "性能与智能",
      "type": "ComputedField<number>",
      "unit": null,
      "required": true,
      "sourceType": "internal",
      "trendable": true,
      "predictable": true,
      "computed": true,
      "computedFrom": ["chip"],
      "formula": "内部芯片性能映射表",
      "note": "内部性能指数，用于趋势对比"
    },
    "aiFeatureLevel": {
      "label": "AI 能力等级",
      "key": "aiFeatureLevel",
      "category": "性能与智能",
      "type": "ComputedField<number>",
      "unit": null,
      "required": false,
      "sourceType": "internal",
      "trendable": true,
      "predictable": true,
      "computed": true,
      "computedFrom": ["chip", "neuralEngine", "memory"],
      "formula": "基于芯片+神经网络引擎+内存综合评分",
      "note": "0-10 综合评分"
    },
    "hasPromotion": {
      "label": "ProMotion",
      "key": "hasPromotion",
      "category": "显示屏",
      "type": "ComputedField<boolean>",
      "unit": null,
      "required": true,
      "sourceType": "computed",
      "trendable": false,
      "predictable": false,
      "computed": true,
      "computedFrom": ["refreshRate"],
      "formula": "refreshRate.value >= 120",
      "note": "计算字段"
    },
    "maxOpticalZoom": {
      "label": "最大光学变焦",
      "key": "maxOpticalZoom",
      "category": "影像",
      "type": "ComputedField<number>",
      "unit": "x",
      "required": false,
      "sourceType": "computed",
      "trendable": true,
      "predictable": true,
      "computed": true,
      "computedFrom": ["opticalZoom"],
      "formula": "从 opticalZoom.value 解析最大数值",
      "note": "iPhone 专属趋势字段"
    },
    "videoPlaybackHours": {
      "label": "视频播放时长",
      "key": "videoPlaybackHours",
      "category": "续航",
      "type": "ComputedField<number>",
      "unit": "小时",
      "required": false,
      "sourceType": "computed",
      "trendable": true,
      "predictable": true,
      "computed": true,
      "computedFrom": ["videoPlayback"],
      "formula": "从 videoPlayback.value 解析数值",
      "note": "数值化续航，便于趋势图"
    }
  }
}
```

### tablet 示例（部分字段）

```json
{
  "tablet": {
    "launchPrice": {
      "label": "首发价格",
      "key": "launchPrice",
      "category": "价格",
      "type": "SpecField<number>",
      "unit": "元",
      "required": true,
      "sourceType": "apple",
      "trendable": true,
      "predictable": true,
      "computed": false,
      "note": "中国大陆 Apple 官网首发价"
    },
    "currentPrice": {
      "label": "实时价格",
      "key": "currentPrice",
      "category": "价格",
      "type": "SpecField<number>",
      "unit": "元",
      "required": false,
      "sourceType": "third_party",
      "trendable": true,
      "predictable": true,
      "computed": false,
      "note": "第三方渠道实时价格"
    },
    "valueRetention": {
      "label": "保值率",
      "key": "valueRetention",
      "category": "价格",
      "type": "ComputedField<number>",
      "unit": "%",
      "required": false,
      "sourceType": "computed",
      "trendable": false,
      "predictable": false,
      "computed": true,
      "computedFrom": ["usedPrice", "launchPrice"],
      "formula": "usedPrice.value / launchPrice.value × 100",
      "note": "计算字段"
    },
    "chip": {
      "label": "芯片",
      "key": "chip",
      "category": "性能与智能",
      "type": "SpecField<string>",
      "unit": null,
      "required": true,
      "sourceType": "apple",
      "trendable": true,
      "predictable": true,
      "computed": false,
      "note": "如 Apple M5"
    },
    "chipRank": {
      "label": "芯片性能排名",
      "key": "chipRank",
      "category": "性能与智能",
      "type": "ComputedField<number>",
      "unit": null,
      "required": true,
      "sourceType": "internal",
      "trendable": true,
      "predictable": true,
      "computed": true,
      "computedFrom": ["chip"],
      "formula": "内部芯片性能映射表",
      "note": "内部性能指数"
    },
    "aiFeatureLevel": {
      "label": "AI 能力等级",
      "key": "aiFeatureLevel",
      "category": "性能与智能",
      "type": "ComputedField<number>",
      "unit": null,
      "required": false,
      "sourceType": "internal",
      "trendable": true,
      "predictable": true,
      "computed": true,
      "computedFrom": ["chip", "neuralEngine", "memory"],
      "formula": "基于芯片+神经网络引擎+内存综合评分",
      "note": "0-10 综合评分"
    },
    "hasPromotion": {
      "label": "ProMotion",
      "key": "hasPromotion",
      "category": "显示屏",
      "type": "ComputedField<boolean>",
      "unit": null,
      "required": true,
      "sourceType": "computed",
      "trendable": false,
      "predictable": false,
      "computed": true,
      "computedFrom": ["refreshRate"],
      "formula": "refreshRate.value >= 120",
      "note": "计算字段"
    },
    "videoPlaybackHours": {
      "label": "视频播放时长",
      "key": "videoPlaybackHours",
      "category": "续航",
      "type": "ComputedField<number>",
      "unit": "小时",
      "required": false,
      "sourceType": "computed",
      "trendable": true,
      "predictable": true,
      "computed": true,
      "computedFrom": ["videoPlayback"],
      "formula": "从 videoPlayback.value 解析数值",
      "note": "数值化续航"
    },
    "pencilSupport": {
      "label": "Apple Pencil 支持",
      "key": "pencilSupport",
      "category": "配件",
      "type": "SpecField<string>",
      "unit": null,
      "required": false,
      "sourceType": "apple",
      "trendable": false,
      "predictable": false,
      "computed": false,
      "note": "iPad 专属，如 'Apple Pencil Pro'"
    }
  }
}
```

### laptop 示例（部分字段）

```json
{
  "laptop": {
    "launchPrice": {
      "label": "首发价格",
      "key": "launchPrice",
      "category": "价格",
      "type": "SpecField<number>",
      "unit": "元",
      "required": true,
      "sourceType": "apple",
      "trendable": true,
      "predictable": true,
      "computed": false,
      "note": "中国大陆 Apple 官网首发价"
    },
    "currentPrice": {
      "label": "实时价格",
      "key": "currentPrice",
      "category": "价格",
      "type": "SpecField<number>",
      "unit": "元",
      "required": false,
      "sourceType": "third_party",
      "trendable": true,
      "predictable": true,
      "computed": false,
      "note": "第三方渠道实时价格"
    },
    "valueRetention": {
      "label": "保值率",
      "key": "valueRetention",
      "category": "价格",
      "type": "ComputedField<number>",
      "unit": "%",
      "required": false,
      "sourceType": "computed",
      "trendable": false,
      "predictable": false,
      "computed": true,
      "computedFrom": ["usedPrice", "launchPrice"],
      "formula": "usedPrice.value / launchPrice.value × 100",
      "note": "计算字段"
    },
    "chip": {
      "label": "芯片",
      "key": "chip",
      "category": "性能与智能",
      "type": "SpecField<string>",
      "unit": null,
      "required": true,
      "sourceType": "apple",
      "trendable": true,
      "predictable": true,
      "computed": false,
      "note": "如 Apple M4 Pro"
    },
    "chipRank": {
      "label": "芯片性能排名",
      "key": "chipRank",
      "category": "性能与智能",
      "type": "ComputedField<number>",
      "unit": null,
      "required": true,
      "sourceType": "internal",
      "trendable": true,
      "predictable": true,
      "computed": true,
      "computedFrom": ["chip"],
      "formula": "内部芯片性能映射表",
      "note": "内部性能指数"
    },
    "memoryGB": {
      "label": "内存容量",
      "key": "memoryGB",
      "category": "性能与智能",
      "type": "ComputedField<number>",
      "unit": "GB",
      "required": true,
      "sourceType": "computed",
      "trendable": true,
      "predictable": true,
      "computed": true,
      "computedFrom": ["memory"],
      "formula": "从 memory.value 解析数值",
      "note": "数值化内存"
    },
    "maxStorageGB": {
      "label": "最大存储容量",
      "key": "maxStorageGB",
      "category": "性能与智能",
      "type": "ComputedField<number>",
      "unit": "GB",
      "required": false,
      "sourceType": "computed",
      "trendable": true,
      "predictable": true,
      "computed": true,
      "computedFrom": ["storage"],
      "formula": "从 storage.value 解析最大值",
      "note": "数值化存储"
    },
    "aiFeatureLevel": {
      "label": "AI 能力等级",
      "key": "aiFeatureLevel",
      "category": "性能与智能",
      "type": "ComputedField<number>",
      "unit": null,
      "required": false,
      "sourceType": "internal",
      "trendable": true,
      "predictable": true,
      "computed": true,
      "computedFrom": ["chip", "neuralEngine", "memory"],
      "formula": "基于芯片+神经网络引擎+内存综合评分",
      "note": "0-10 综合评分"
    },
    "hasPromotion": {
      "label": "ProMotion",
      "key": "hasPromotion",
      "category": "显示屏",
      "type": "ComputedField<boolean>",
      "unit": null,
      "required": true,
      "sourceType": "computed",
      "trendable": false,
      "predictable": false,
      "computed": true,
      "computedFrom": ["refreshRate"],
      "formula": "refreshRate.value >= 120",
      "note": "计算字段"
    },
    "videoPlaybackHours": {
      "label": "视频播放时长",
      "key": "videoPlaybackHours",
      "category": "续航",
      "type": "ComputedField<number>",
      "unit": "小时",
      "required": false,
      "sourceType": "computed",
      "trendable": true,
      "predictable": true,
      "computed": true,
      "computedFrom": ["videoPlayback"],
      "formula": "从 videoPlayback.value 解析数值",
      "note": "数值化续航"
    },
    "portability": {
      "label": "便携性",
      "key": "portability",
      "category": "外观设计",
      "type": "ComputedField<number>",
      "unit": null,
      "required": false,
      "sourceType": "internal",
      "trendable": false,
      "predictable": false,
      "computed": true,
      "computedFrom": ["weight", "thickness", "screenSize"],
      "formula": "基于重量+厚度+屏幕尺寸综合评分",
      "note": "MacBook 专属，0-10 评分"
    }
  }
}
```

> **落地说明：** 当前文档中的 JSON 是字段字典格式示例。真正接入项目时，需要单独生成完整的 `src/data/field-dictionary.json`；该 JSON 必须覆盖 phone / tablet / laptop 三类的全部字段；字段结构必须与本文档中的 `FieldDictionaryItem` 保持一致。
