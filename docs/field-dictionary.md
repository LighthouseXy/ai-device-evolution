# 数码观察站 DeviceScope — 字段字典

---

## 数据类型约定

| 类型 | 说明 | 示例 |
|------|------|------|
| `string` | 文本 | `"超视网膜 XDR 显示屏"` |
| `number` | 数值 | `6.1` |
| `boolean` | 布尔 | `true` |
| `string[]` | 字符串数组 | `["黑色","白色","蓝色"]` |
| `object` | 嵌套对象 | 见子字段 |
| `null` | 空值/未知 | `null` |

## 标记约定

| 标记 | 含义 |
|------|------|
| ✅ R | 必须字段 |
| ⬜ O | 可选字段 |
| 📊 T | 适合趋势图 |
| 🤖 AI | 适合 AI 预测 |
| 🧮 C | 计算字段 |
| 🍎 A | Apple 官方来源 |
| 🌐 N | 非官方来源 |

---

## iPhone 手机

### 1. 价格

| 中文名 | key | 类型 | 单位 | R/O | 来源 | T | AI | C | 备注 |
|--------|-----|------|------|-----|------|---|---|---|---|------|
| 首发价格 | `launchPrice` | `number` | 元 | ✅ | 🍎 | 📊 | 🤖 | | 中国大陆 Apple 官网首发价 |
| 实时价格 | `currentPrice` | `number` | 元 | ⬜ | 🌐 | 📊 | 🤖 | | 第三方渠道实时价格 |
| 二手价格 | `usedPrice` | `number` | 元 | ⬜ | 🌐 | 📊 | | | 二手市场参考价（9 成新） |
| 保值率 | `valueRetention` | `number` | % | ⬜ | 🌐 | | | 🧮 | 计算公式：二手价格 / 首发价格 × 100 |

### 2. 外观设计

| 中文名 | key | 类型 | 单位 | R/O | 来源 | T | AI | C | 备注 |
|--------|-----|------|------|-----|------|---|---|---|---|------|
| 颜色 | `colors` | `string[]` | — | ✅ | 🍎 | | | | 所有可选颜色列表 |
| 材料 | `material` | `string` | — | ✅ | 🍎 | | | | 如"铝金属设计"、"钛金属设计" |
| 重量 | `weight` | `number` | g | ✅ | 🍎 | 📊 | | | 无线局域网机型重量 |
| 机身尺寸 | `dimensions` | `string` | — | ✅ | 🍎 | | | | 格式如 `"146.7 x 71.5 x 7.4 mm"` |

### 3. 显示屏

| 中文名 | key | 类型 | 单位 | R/O | 来源 | T | AI | C | 备注 |
|--------|-----|------|------|-----|------|---|---|---|---|------|
| 屏幕尺寸 | `screenSize` | `number` | inch | ✅ | 🍎 | 📊 | 🤖 | | 对角线尺寸 |
| 分辨率 | `resolution` | `string` | — | ✅ | 🍎 | | | | 如 `"2556 x 1179 像素"` |
| 显示类型 | `displayType` | `string` | — | ✅ | 🍎 | | | | OLED / LCD / XDR 等 |
| 刷新率 | `refreshRate` | `number` | Hz | ✅ | 🍎 | 📊 | | | 60 / 120 |
| ProMotion | `hasPromotion` | `boolean` | — | ✅ | 🍎 | | | 🧮 | refreshRate >= 120 时为 true |
| 峰值亮度 | `peakBrightness` | `number` | nits | ⬜ | 🍎 | 📊 | | | HDR 峰值亮度 |
| 显示涂层 | `displayCoating` | `string` | — | ⬜ | 🍎 | | | | 防油渍防指纹涂层 / 纳米纹理玻璃 |

### 4. 性能与智能

| 中文名 | key | 类型 | 单位 | R/O | 来源 | T | AI | C | 备注 |
|--------|-----|------|------|-----|------|---|---|---|---|------|
| 芯片 | `chip` | `string` | — | ✅ | 🍎 | 📊 | 🤖 | | 如 `"A18 Pro"` |
| CPU | `cpu` | `string` | — | ✅ | 🍎 | | | | 如 `"6 核中央处理器"` |
| GPU | `gpu` | `string` | — | ✅ | 🍎 | | | | 如 `"6 核图形处理器"` |
| 神经网络引擎 | `neuralEngine` | `string` | — | ✅ | 🍎 | | 🤖 | | 如 `"16 核神经网络引擎"` |
| 内存 | `memory` | `string` | — | ⬜ | 🍎 | | | | 如 `"8GB"`，Apple 不常公布 |
| 存储容量 | `storage` | `string` | — | ✅ | 🍎 | | | | 如 `"128GB / 256GB / 512GB"` |
| AI 能力等级 | `aiFeatureLevel` | `number` | — | ⬜ | 🌐 | 📊 | 🤖 | 🧮 | 0-10 评分，内部计算 |
| 端侧智能基础 | `onDeviceAi` | `string` | — | ⬜ | 🌐 | | | 🧮 | aiFeatureLevel >= 7 → "适合" |

### 5. 影像与视频

| 中文名 | key | 类型 | 单位 | R/O | 来源 | T | AI | C | 备注 |
|--------|-----|------|------|-----|------|---|---|---|---|------|
| 后置摄像头 | `rearCamera` | `string` | — | ✅ | 🍎 | | | | 概述，如 `"4800 万像素双摄系统"` |
| 主摄规格 | `mainCamera` | `string` | — | ⬜ | 🍎 | | | | 如 `"4800 万像素，ƒ/1.6 光圈"` |
| 超广角 | `ultraWide` | `string` | — | ⬜ | 🍎 | | | | 如 `"1200 万像素，ƒ/2.2 光圈"` |
| 长焦 | `telephoto` | `string` | — | ⬜ | 🍎 | | | | 如 `"5x 光学变焦"` |
| 光学变焦 | `opticalZoom` | `string` | — | ⬜ | 🍎 | 📊 | | | 如 `"0.5x / 1x / 2x / 5x"` |
| 前置摄像头 | `frontCamera` | `string` | — | ✅ | 🍎 | | | | 如 `"1200 万像素原深感摄像头"` |
| 视频拍摄 | `videoRecording` | `string` | — | ✅ | 🍎 | | | | 如 `"4K 60fps Dolby Vision"` |

### 6. 续航与充电

| 中文名 | key | 类型 | 单位 | R/O | 来源 | T | AI | C | 备注 |
|--------|-----|------|------|-----|------|---|---|---|---|------|
| 电池续航 | `batteryLife` | `string` | — | ✅ | 🍎 | | | | 如 `"视频播放最长可达 30 小时"` |
| 视频播放 | `videoPlayback` | `string` | — | ✅ | 🍎 | 📊 | | | 如 `"最长可达 30 小时"` |
| 充电方式 | `chargingMethod` | `string` | — | ✅ | 🍎 | | | | 有线 / MagSafe / Qi2 |
| MagSafe | `hasMagSafe` | `boolean` | — | ⬜ | 🍎 | | | | 是否支持 MagSafe |
| 充电接口 | `chargingPort` | `string` | — | ✅ | 🍎 | | | | USB-C / Lightning |
| 快充支持 | `fastCharge` | `string` | — | ⬜ | 🍎 | | | | 如 `"30 分钟充至 50%"` |

### 7. 安全与防护

| 中文名 | key | 类型 | 单位 | R/O | 来源 | T | AI | C | 备注 |
|--------|-----|------|------|-----|------|---|---|---|---|------|
| 安全验证 | `security` | `string` | — | ✅ | 🍎 | | | | Face ID / Touch ID |
| 防水等级 | `waterResistance` | `string` | — | ✅ | 🍎 | | | | 如 `"IP68 (最深 6 米，最长 30 分钟)"` |
| 防尘等级 | `dustResistance` | `string` | — | ⬜ | 🍎 | | | | 通常包含在 IP 等级中 |
| SOS / 卫星通信 | `hasSOS` | `boolean` | — | ⬜ | 🍎 | | | | 是否支持卫星紧急联络 |
| 车祸检测 | `hasCrashDetection` | `boolean` | — | ⬜ | 🍎 | | | | 是否支持车祸检测 |

### 8. 连接与扩展

| 中文名 | key | 类型 | 单位 | R/O | 来源 | T | AI | C | 备注 |
|--------|-----|------|------|-----|------|---|---|---|---|------|
| 连接端口 | `port` | `string` | — | ✅ | 🍎 | | | | USB-C / Lightning |
| Wi-Fi | `wifi` | `string` | — | ✅ | 🍎 | | | | 如 `"802.11be (Wi-Fi 7)"` |
| 蓝牙 | `bluetooth` | `string` | — | ✅ | 🍎 | | | | 如 `"蓝牙 5.3"` |
| 蜂窝网络 | `cellular` | `string` | — | ✅ | 🍎 | | | | 如 `"5G (sub-6 GHz)"` |
| SIM 卡 | `sim` | `string` | — | ✅ | 🍎 | | | | nano-SIM / eSIM / 双 eSIM |
| UWB | `hasUWB` | `boolean` | — | ⬜ | 🍎 | | | | 超宽带芯片 |
| NFC | `hasNFC` | `boolean` | — | ✅ | 🍎 | | | | 近场通信（Apple Pay） |

---

## iPad 平板

### 1. 价格

| 中文名 | key | 类型 | 单位 | R/O | 来源 | T | AI | C |
|--------|-----|------|------|-----|------|---|---|---|---|
| 首发价格 | `launchPrice` | `number` | 元 | ✅ | 🍎 | 📊 | 🤖 | |
| 实时价格 | `currentPrice` | `number` | 元 | ⬜ | 🌐 | 📊 | 🤖 | |
| 二手价格 | `usedPrice` | `number` | 元 | ⬜ | 🌐 | 📊 | | |
| 保值率 | `valueRetention` | `number` | % | ⬜ | 🌐 | | | 🧮 |

### 2. 外观设计

| 中文名 | key | 类型 | 单位 | R/O | 来源 | T | AI | C |
|--------|-----|------|------|-----|------|---|---|---|---|
| 颜色 | `colors` | `string[]` | — | ✅ | 🍎 | | | |
| 材料 | `material` | `string` | — | ✅ | 🍎 | | | |
| 重量 | `weight` | `number` | g | ✅ | 🍎 | 📊 | | |
| 机身尺寸 | `dimensions` | `string` | — | ✅ | 🍎 | | | |

### 3. 显示屏

| 中文名 | key | 类型 | 单位 | R/O | 来源 | T | AI | C |
|--------|-----|------|------|-----|------|---|---|---|---|
| 屏幕尺寸 | `screenSize` | `number` | inch | ✅ | 🍎 | 📊 | 🤖 | |
| 显示类型 | `displayType` | `string` | — | ✅ | 🍎 | | | |
| 分辨率 | `resolution` | `string` | — | ✅ | 🍎 | | | |
| 刷新率 | `refreshRate` | `number` | Hz | ✅ | 🍎 | 📊 | | |
| ProMotion | `hasPromotion` | `boolean` | — | ✅ | 🍎 | | | 🧮 |
| 峰值亮度 | `peakBrightness` | `number` | nits | ⬜ | 🍎 | 📊 | | |
| 显示涂层 | `displayCoating` | `string` | — | ⬜ | 🍎 | | | |

### 4. 性能与智能

| 中文名 | key | 类型 | 单位 | R/O | 来源 | T | AI | C |
|--------|-----|------|------|-----|------|---|---|---|---|
| 芯片 | `chip` | `string` | — | ✅ | 🍎 | 📊 | 🤖 | |
| CPU | `cpu` | `string` | — | ✅ | 🍎 | | | |
| GPU | `gpu` | `string` | — | ✅ | 🍎 | | | |
| 神经网络引擎 | `neuralEngine` | `string` | — | ✅ | 🍎 | | 🤖 | |
| 内存 | `memory` | `string` | — | ⬜ | 🍎 | | | |
| 存储容量 | `storage` | `string` | — | ✅ | 🍎 | | | |
| AI 能力等级 | `aiFeatureLevel` | `number` | — | ⬜ | 🌐 | 📊 | 🤖 | 🧮 |

### 5. 影像与音频

| 中文名 | key | 类型 | 单位 | R/O | 来源 | T | AI | C |
|--------|-----|------|------|-----|------|---|---|---|---|
| 后置摄像头 | `rearCamera` | `string` | — | ✅ | 🍎 | | | |
| 前置摄像头 | `frontCamera` | `string` | — | ✅ | 🍎 | | | |
| 视频拍摄 | `videoRecording` | `string` | — | ✅ | 🍎 | | | |
| 扬声器 | `speakers` | `string` | — | ✅ | 🍎 | | | |
| 麦克风 | `microphone` | `string` | — | ✅ | 🍎 | | | |

### 6. 续航与充电

| 中文名 | key | 类型 | 单位 | R/O | 来源 | T | AI | C |
|--------|-----|------|------|-----|------|---|---|---|---|
| 电池续航 | `batteryLife` | `string` | — | ✅ | 🍎 | | | |
| 视频播放 | `videoPlayback` | `string` | — | ✅ | 🍎 | 📊 | | |
| 充电方式 | `chargingMethod` | `string` | — | ✅ | 🍎 | | | |
| 连接接口 | `port` | `string` | — | ✅ | 🍎 | | | USB-C / Lightning |

### 7. 安全与防护

| 中文名 | key | 类型 | 单位 | R/O | 来源 | T | AI | C |
|--------|-----|------|------|-----|------|---|---|---|---|
| 安全验证 | `security` | `string` | — | ✅ | 🍎 | | | Face ID / Touch ID |
| 防水等级 | `waterResistance` | `string` | — | ⬜ | 🍎 | | | iPad 通常不具备 |
| 隐私芯片/安全能力 | `secureEnclave` | `boolean` | — | ⬜ | 🍎 | | | 安全隔区处理器 |

### 8. 连接与配件

| 中文名 | key | 类型 | 单位 | R/O | 来源 | T | AI | C |
|--------|-----|------|------|-----|------|---|---|---|---|
| 连接端口 | `port` | `string` | — | ✅ | 🍎 | | | |
| Wi-Fi | `wifi` | `string` | — | ✅ | 🍎 | | | |
| 蓝牙 | `bluetooth` | `string` | — | ✅ | 🍎 | | | |
| 蜂窝网络 | `cellular` | `string` | — | ✅ | 🍎 | | | |
| Apple Pencil 支持 | `pencilSupport` | `string` | — | ⬜ | 🍎 | | | 如 `"Apple Pencil Pro"` |
| 妙控键盘支持 | `magicKeyboard` | `boolean` | — | ⬜ | 🍎 | | | |
| 外接显示器支持 | `externalDisplay` | `boolean` | — | ⬜ | 🍎 | | | Stage Manager 功能 |

---

## MacBook 笔记本

### 1. 价格

| 中文名 | key | 类型 | 单位 | R/O | 来源 | T | AI | C |
|--------|-----|------|------|-----|------|---|---|---|---|
| 首发价格 | `launchPrice` | `number` | 元 | ✅ | 🍎 | 📊 | 🤖 | |
| 实时价格 | `currentPrice` | `number` | 元 | ⬜ | 🌐 | 📊 | 🤖 | |
| 二手价格 | `usedPrice` | `number` | 元 | ⬜ | 🌐 | 📊 | | |
| 保值率 | `valueRetention` | `number` | % | ⬜ | 🌐 | | | 🧮 |

### 2. 外观设计

| 中文名 | key | 类型 | 单位 | R/O | 来源 | T | AI | C |
|--------|-----|------|------|-----|------|---|---|---|---|
| 颜色 | `colors` | `string[]` | — | ✅ | 🍎 | | | |
| 材料 | `material` | `string` | — | ✅ | 🍎 | | | 铝金属一体成型 |
| 重量 | `weight` | `number` | g | ✅ | 🍎 | 📊 | | 统一为克，内部换算 |
| 机身尺寸 | `dimensions` | `string` | — | ✅ | 🍎 | | | |
| 厚度 | `thickness` | `number` | mm | ⬜ | 🍎 | 📊 | | 如 `1.55`（cm 统一转 mm） |
| 便携性 | `portability` | `number` | — | ⬜ | 🌐 | | | 🧮 | 0-10 内部评分 |

### 3. 显示屏

| 中文名 | key | 类型 | 单位 | R/O | 来源 | T | AI | C |
|--------|-----|------|------|-----|------|---|---|---|---|
| 屏幕尺寸 | `screenSize` | `number` | inch | ✅ | 🍎 | 📊 | 🤖 | |
| 显示类型 | `displayType` | `string` | — | ✅ | 🍎 | | | Liquid 视网膜 / XDR |
| 分辨率 | `resolution` | `string` | — | ✅ | 🍎 | | | |
| 刷新率 | `refreshRate` | `number` | Hz | ✅ | 🍎 | 📊 | | |
| ProMotion | `hasPromotion` | `boolean` | — | ✅ | 🍎 | | | 🧮 |
| 峰值亮度 | `peakBrightness` | `number` | nits | ⬜ | 🍎 | 📊 | | |
| XDR | `hasXDR` | `boolean` | — | ⬜ | 🍎 | | | Liquid 视网膜 XDR |
| 纳米纹理玻璃 | `hasNanoTexture` | `boolean` | — | ⬜ | 🍎 | | | 可选配置 |

### 4. 性能与智能

| 中文名 | key | 类型 | 单位 | R/O | 来源 | T | AI | C |
|--------|-----|------|------|-----|------|---|---|---|---|
| 芯片 | `chip` | `string` | — | ✅ | 🍎 | 📊 | 🤖 | |
| CPU | `cpu` | `string` | — | ✅ | 🍎 | | | |
| GPU | `gpu` | `string` | — | ✅ | 🍎 | | | |
| 神经网络引擎 | `neuralEngine` | `string` | — | ✅ | 🍎 | | 🤖 | |
| 内存 | `memory` | `string` | — | ✅ | 🍎 | | | 统一内存，如 `"16GB"` |
| 存储容量 | `storage` | `string` | — | ✅ | 🍎 | | | |
| 内存带宽 | `memoryBandwidth` | `string` | — | ⬜ | 🍎 | | | 如 `"100GB/s"` |
| 散热方式 | `cooling` | `string` | — | ⬜ | 🍎 | | | 无风扇 / 主动散热 |
| AI 能力等级 | `aiFeatureLevel` | `number` | — | ⬜ | 🌐 | 📊 | 🤖 | 🧮 |

### 5. 摄像头与音频

| 中文名 | key | 类型 | 单位 | R/O | 来源 | T | AI | C |
|--------|-----|------|------|-----|------|---|---|---|---|
| 摄像头 | `webcam` | `string` | — | ✅ | 🍎 | | | 如 `"1200 万像素 Center Stage"` |
| 麦克风 | `microphone` | `string` | — | ✅ | 🍎 | | | 如 `"录音棚级三麦克风阵列"` |
| 扬声器 | `speakers` | `string` | — | ✅ | 🍎 | | | 如 `"高保真六扬声器系统"` |
| 空间音频 | `hasSpatialAudio` | `boolean` | — | ⬜ | 🍎 | | | |
| 视频通话能力 | `videoCall` | `string` | — | ⬜ | 🍎 | | | 如 `"1080p FaceTime 高清"` |

### 6. 续航与充电

| 中文名 | key | 类型 | 单位 | R/O | 来源 | T | AI | C |
|--------|-----|------|------|-----|------|---|---|---|---|
| 电池续航 | `batteryLife` | `string` | — | ✅ | 🍎 | | | |
| 视频播放 | `videoPlayback` | `string` | — | ✅ | 🍎 | 📊 | | |
| 无线上网 | `wirelessWebBrowsing` | `string` | — | ✅ | 🍎 | 📊 | | MacBook 特色字段 |
| 充电方式 | `chargingMethod` | `string` | — | ✅ | 🍎 | | | MagSafe / USB-C |
| 快充支持 | `fastCharge` | `string` | — | ⬜ | 🍎 | | | |
| 电源适配器 | `powerAdapter` | `string` | — | ⬜ | 🍎 | | | 如 `"35W 双 USB-C"` |

### 7. 安全与交互

| 中文名 | key | 类型 | 单位 | R/O | 来源 | T | AI | C |
|--------|-----|------|------|-----|------|---|---|---|---|
| Touch ID | `hasTouchId` | `boolean` | — | ✅ | 🍎 | | | |
| 安全验证 | `security` | `string` | — | ✅ | 🍎 | | | 触控 ID / 面容 ID |
| 键盘 | `keyboard` | `string` | — | ✅ | 🍎 | | | 如 `"背光妙控键盘"` |
| 触控板 | `trackpad` | `string` | — | ✅ | 🍎 | | | 如 `"力度触控板"` |
| 触控栏 | `hasTouchBar` | `boolean` | — | ⬜ | 🍎 | | | 已停产，旧款保留 |

### 8. 连接与扩展

| 中文名 | key | 类型 | 单位 | R/O | 来源 | T | AI | C |
|--------|-----|------|------|-----|------|---|---|---|---|
| Thunderbolt | `thunderbolt` | `string` | — | ✅ | 🍎 | | | 如 `"Thunderbolt 5"` |
| USB-C | `usbC` | `string` | — | ✅ | 🍎 | | | 如 `"3 个 USB-C"` |
| HDMI | `hasHDMI` | `boolean` | — | ⬜ | 🍎 | | | |
| SDXC | `hasSDXC` | `boolean` | — | ⬜ | 🍎 | | | |
| MagSafe | `hasMagSafe` | `boolean` | — | ✅ | 🍎 | | | 充电端口 |
| Wi-Fi | `wifi` | `string` | — | ✅ | 🍎 | | | |
| 蓝牙 | `bluetooth` | `string` | — | ✅ | 🍎 | | | |
| 外接显示器支持 | `externalDisplay` | `string` | — | ⬜ | 🍎 | | | 如 `"支持最多 4 台外接显示器"` |

---

## 跨品类公共字段

以下字段在三类设备中含义一致，可共用：

```
id, brand, category, series, tier, model, generation, releaseYear,
launchPrice, currentPrice, usedPrice, valueRetention,
colors, material, weight, dimensions,
screenSize, displayType, resolution, refreshRate, hasPromotion, peakBrightness, displayCoating,
chip, cpu, gpu, neuralEngine, memory, storage, aiFeatureLevel,
rearCamera, frontCamera, videoRecording,
batteryLife, videoPlayback, chargingMethod, port,
security, waterResistance,
wifi, bluetooth, cellular
```

---

## TypeScript Interface 草案

```typescript
// ==================== 通用基础字段 ====================
interface DeviceBase {
  id: string;
  brand: string;                    // Apple
  category: DeviceCategory;         // "phone" | "tablet" | "laptop"
  series: string;                   // "iPhone" | "iPad Pro" | "MacBook Pro" ...
  tier: DeviceTier;                 // "base" | "mini" | "air" | "pro" | "pro_max" | "m" | "m_pro" | "m_max"
  model: string;                    // 完整型号名
  generation: number;               // 代际数
  releaseYear: number;              // 发布年份
  sourceUrl: string;                // 数据来源 URL
}

// ==================== 价格 ====================
interface PriceInfo {
  launchPrice: number;              // 首发价格（元）
  currentPrice?: number;            // 实时价格（元），非官方
  usedPrice?: number;               // 二手价格（元），非官方
  valueRetention?: number;          // 保值率（%），计算字段
}

// ==================== 外观设计 ====================
interface DesignInfo {
  colors: string[];                 // 颜色列表
  material: string;                 // 机身材料
  weight: number;                   // 重量（g）
  dimensions: string;               // 机身尺寸
  thickness?: number;               // 厚度（mm），MacBook 专用
  portability?: number;             // 便携性 0-10，MacBook 计算字段
}

// ==================== 显示屏 ====================
interface DisplayInfo {
  screenSize: number;               // 屏幕尺寸（inch）
  resolution: string;               // 分辨率
  displayType: string;              // 显示类型
  refreshRate: number;              // 刷新率（Hz）
  hasPromotion: boolean;            // ProMotion，计算字段
  peakBrightness?: number;          // 峰值亮度（nits）
  displayCoating?: string;          // 显示涂层
  hasXDR?: boolean;                 // XDR 显示屏，MacBook
  hasNanoTexture?: boolean;         // 纳米纹理玻璃，MacBook
}

// ==================== 性能与智能 ====================
interface PerformanceInfo {
  chip: string;                     // 芯片名
  cpu: string;                      // CPU 描述
  gpu: string;                      // GPU 描述
  neuralEngine: string;             // 神经网络引擎描述
  memory?: string;                  // 内存
  storage: string;                  // 存储容量
  memoryBandwidth?: string;         // 内存带宽，MacBook
  cooling?: string;                 // 散热方式，MacBook
  aiFeatureLevel?: number;          // AI 能力等级 0-10，计算字段
  onDeviceAi?: string;              // 端侧智能基础，iPhone 计算字段
}

// ==================== 影像 ====================
interface CameraInfo {
  rearCamera: string;               // 后置摄像头概述
  mainCamera?: string;              // 主摄规格，iPhone
  ultraWide?: string;               // 超广角，iPhone
  telephoto?: string;               // 长焦，iPhone
  opticalZoom?: string;             // 光学变焦，iPhone
  frontCamera: string;              // 前置摄像头
  videoRecording: string;           // 视频拍摄
}

// ==================== 音频（iPad/MacBook） ====================
interface AudioInfo {
  speakers: string;                 // 扬声器
  microphone: string;               // 麦克风
  hasSpatialAudio?: boolean;        // 空间音频，MacBook
}

// ==================== 续航与充电 ====================
interface BatteryInfo {
  batteryLife: string;              // 电池续航
  videoPlayback: string;            // 视频播放续航
  wirelessWebBrowsing?: string;     // 无线上网续航，MacBook
  chargingMethod: string;           // 充电方式
  chargingPort: string;             // 充电接口
  hasMagSafe?: boolean;             // MagSafe 支持
  fastCharge?: string;              // 快充支持
  powerAdapter?: string;            // 电源适配器，MacBook
}

// ==================== 安全与防护 ====================
interface SecurityInfo {
  security: string;                 // 安全验证方式
  waterResistance: string;          // 防水等级
  dustResistance?: string;          // 防尘等级
  hasSOS?: boolean;                 // 卫星通信，iPhone
  hasCrashDetection?: boolean;      // 车祸检测，iPhone
  hasTouchId?: boolean;             // Touch ID，MacBook
  secureEnclave?: boolean;          // 隐私芯片，iPad
}

// ==================== 连接与扩展 ====================
interface ConnectivityInfo {
  port: string;                     // 连接端口
  wifi: string;                     // Wi-Fi 规格
  bluetooth: string;                // 蓝牙版本
  cellular: string;                 // 蜂窝网络
  sim?: string;                     // SIM 卡类型，iPhone
  hasUWB?: boolean;                 // UWB 芯片，iPhone
  hasNFC?: boolean;                 // NFC，iPhone
  hasHDMI?: boolean;                // HDMI，MacBook
  hasSDXC?: boolean;                // SDXC，MacBook
  thunderbolt?: string;             // Thunderbolt，MacBook
  usbC?: string;                    // USB-C 端口，MacBook
  externalDisplay?: string;         // 外接显示器支持
}

// ==================== 配件 ====================
interface AccessoryInfo {
  pencilSupport?: string;           // Apple Pencil，iPad
  magicKeyboard?: boolean;          // 妙控键盘，iPad
  keyboard?: string;                // 键盘描述，MacBook
  trackpad?: string;                // 触控板描述，MacBook
  hasTouchBar?: boolean;            // Touch Bar，MacBook
}

// ==================== 完整 Device 类型 ====================
interface Device extends DeviceBase,
  PriceInfo,
  DesignInfo,
  DisplayInfo,
  PerformanceInfo,
  CameraInfo,
  Partial<AudioInfo>,
  BatteryInfo,
  SecurityInfo,
  ConnectivityInfo,
  Partial<AccessoryInfo> {
  specs?: Record<string, string | number | boolean>;
}

type DeviceCategory = "phone" | "tablet" | "laptop";

type DeviceTier = "base" | "mini" | "air" | "pro" | "pro_max"
  | "m" | "m_pro" | "m_max" | "m_ultra";
```

---

## 字段字典 JSON 示例

```json
{
  "phone": {
    "launchPrice": {
      "label": "首发价格",
      "key": "launchPrice",
      "category": "价格",
      "type": "number",
      "unit": "元",
      "required": true,
      "source": "apple",
      "trendable": true,
      "predictable": true,
      "computed": false,
      "note": "中国大陆 Apple 官网首发价"
    },
    "currentPrice": {
      "label": "实时价格",
      "key": "currentPrice",
      "category": "价格",
      "type": "number",
      "unit": "元",
      "required": false,
      "source": "third_party",
      "trendable": true,
      "predictable": true,
      "computed": false,
      "note": "第三方渠道实时价格"
    },
    "usedPrice": {
      "label": "二手价格",
      "key": "usedPrice",
      "category": "价格",
      "type": "number",
      "unit": "元",
      "required": false,
      "source": "third_party",
      "trendable": true,
      "predictable": false,
      "computed": false,
      "note": "二手市场参考价（9 成新）"
    },
    "valueRetention": {
      "label": "保值率",
      "key": "valueRetention",
      "category": "价格",
      "type": "number",
      "unit": "%",
      "required": false,
      "source": "third_party",
      "trendable": false,
      "predictable": false,
      "computed": true,
      "note": "usedPrice / launchPrice × 100"
    },
    "chip": {
      "label": "芯片",
      "key": "chip",
      "category": "性能与智能",
      "type": "string",
      "unit": null,
      "required": true,
      "source": "apple",
      "trendable": true,
      "predictable": true,
      "computed": false,
      "note": "如 A19 Pro / Apple M5"
    },
    "aiFeatureLevel": {
      "label": "AI 能力等级",
      "key": "aiFeatureLevel",
      "category": "性能与智能",
      "type": "number",
      "unit": null,
      "required": false,
      "source": "internal",
      "trendable": true,
      "predictable": true,
      "computed": true,
      "note": "0-10 综合评分，基于芯片+神经网络引擎+内存计算"
    }
  }
}
```

> 仅展示部分字段作为格式示例，完整 JSON 应覆盖三类设备所有字段。
