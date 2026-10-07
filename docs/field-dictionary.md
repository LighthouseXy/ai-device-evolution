# 数码观察站运行时字段字典

> 版本：3.7 · 更新日期：2026-10-07
> 本文描述当前本地代码读取的 `src/data/devices-db.json` 及报价观察文件。旧版设计稿归档于 `docs/archive/field-dictionary-v2.1.md`。

## 数据边界

- `device-data-manifest.json` 登记分品牌数据，构建后合并为唯一运行时主库 `devices-db.json` 及来源登记 `device-sources.json`；`apple-devices-db.json` 是 Apple 分库，不是当前全项目主库。
- 当前保存 991 条来源记录、421 个原始严格比较组、19,267 个规格字段；公开目录为 970 个型号，八品牌、五品类。来源统计和展示统计不能混用。
- `device-model-groups.json` 保存人工确认的同款映射：38 条颜色/表带/材质记录归为 17 个型号。原始证据、报价和旧路由保留；尺寸、蜂窝/NFC、芯片及真实代际不同的设备不按颜色合并。
- `specs` 保存采集事实及来源；`computed` 保存派生结果，二者不得混用。
- 缺失值保留为 `null` 或缺少字段，展示层再转换为“待补充”。

## Device

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `string` | 全局唯一、稳定的设备标识 |
| `brand` | `string` | 当前 Apple、Xiaomi、Redmi、Samsung、Huawei、OPPO、vivo、HONOR；旧 Xiaomi 来源中的 Redmi 由目录适配识别，不反写原证据 |
| `market` | `string` | 市场版本；当前主库为中国大陆版本，不把海外配置/价格直接替代国行 |
| `category` | `phone \| tablet \| laptop \| watch \| band` | 设备大类 |
| `series` | `string` | 面向展示的宽泛系列名，不作为严格代际分组依据 |
| `family` | `string` | 产品族，如 iPhone、iPad Pro、MacBook Air |
| `variant` | `string` | 款式或关键尺寸，如 Pro、Pro Max、11-inch、13-inch |
| `tier` | `string?` | 笔记本的芯片档位，如 Pro / Max；具体合法值由分类门禁约束 |
| `modelName` | `string` | 完整设备名称 |
| `generation` | `string` | 面向展示的代际名称，不保证可转为数字 |
| `generationOrder` | `positive integer` | 严格比较组内从 1 开始的连续顺序 |
| `releaseYear` | `number` | 发布年份 |
| `releaseDate` | `string \| null?` | 可选发布日期 |
| `comparisonGroupId` | `string` | 严格比较组的稳定标识 |
| `configurations` | `DeviceConfiguration[]?` | 有证据的配置组合；不是内存与存储的任意笛卡尔积 |
| `benchmarks` | `DeviceBenchmark[]?` | 带评测机构、协议版本和来源的评测记录 |
| `specs` | `Record<string, SpecField>` | 带来源的规格字段 |
| `computed` | `Record<string, ComputedField>` | 派生字段 |

原始严格比较组包含品牌、地区、类别、产品族、款式及可选芯片档位，由 `comparisonGroupId` 标识。`generationOrder`、前代引用和派生评分以该组为边界，不跨品牌/地区混排。展示筛选用较宽的产品族；跨品牌自选对比是独立的选取关系，不改写严格分组或生成无依据的胜负分。

`catalogDevicesFlat` 是整理后的目录，`allDevicesFlat` 保留全部来源版型。目录对象可有 `editions: { label, device }[]`，仅供展示，不写入原始 Device。不同款式的价格、重量、材质逐款说明，公共数值只在各款一致时使用；缺失款式参数不由其他款补齐。

## SpecField

```ts
type SpecField<T> = {
  value: T | null;
  unit?: string | null;
  rawText?: string | null;
  summaryText?: string;
  note?: string;
  evidenceKind?: "excerpt" | "summary";
  fetchedAt?: string;
  sourceSnapshotHash?: string;
  sourceUrl: string;
  sourceType: "official" | "reference";
  confidence: number; // 0-1
  verifiedAt: string; // YYYY-MM-DD
};
```

`rawText` 与 `summaryText` 区分逐字证据和整理描述，历史未标注内容也不能默认当作原文快照。`verifiedAt` 是原核验日期，不因 JSON 重建刷新；`fetchedAt` 只在真实请求后记录。

当前主库实际存储 75 个规格键（类型允许后续扩展，按品类和品牌展示）：

- 基础与外观：`colors`、`material`、`dimensions`、`weight`、`thickness`。
- 屏幕：`screenSize`、`displayType`、`resolution`、`refreshRate`、`peakBrightness`。
- 芯片与存储：`chip`、`cpu`、`gpu`、`neuralEngine`、`memory`、`storage`、`memoryType`、`storageType`、`operatingSystem`。
- 影像：`rearCamera`、`mainCamera`、`ultraWide`、`telephoto`、`opticalZoom`、`frontCamera`、`webcam`、`videoRecording`。
- 续航与充电：`batteryCapacity`、`batteryLife`、`videoPlayback`、`wirelessWebBrowsing`、`chargingMethod`、`powerAdapter`、`hasMagSafe`。
- 连接与接口：`port`、`usbC`、`thunderbolt`、`wifi`、`bluetooth`、`sim`、`externalDisplay`、`hasHDMI`、`hasSDXC`、`hasNFC`、`hasUWB`。
- 交互与音频：`keyboard`、`trackpad`、`pencilSupport`、`speakers`、`microphone`、`hasTouchId`。
- 安全与耐用：`security`、`waterResistance`、`hasSOS`、`hasCrashDetection`。
- 价格：`launchPrice`、`currentPrice`、`usedPrice`。
- 穿戴与版本细节：`caseSize`、`cellular`、`chargingTime`、`compatibility`、`connectivity`、`healthFeatures`、`onboardStorage`、`positioning`、`sensors`、`sportsModes`、`strapMaterial`、`wearableCamera`、`wearableChip`、`wearableFeatures`、`wearableWeight`、`batteryCapacityDetails`、`screenSizeDetails`。

字段并非每个类别都必须具备。禁止用占位字符串写入 `value`；缺失保持为空。`batteryCapacity` 为容量（mAh），不得当作续航时长；`magicKeyboard` 虽为类型可选字段，当前主库未存储，不计入上述 75 键。穿戴兼容性、独立通信与续航必须绑定真实网络版本；IPX8 不能改写成防尘等级。

价格字段可额外保存以下快照元数据：

```ts
type PriceField = SpecField<number> & {
  priceType?: "launch" | "current" | "used";
  market?: string;
  configuration?: string;
  condition?: string;
  observedAt?: string; // YYYY-MM-DD
  sourceName?: string;
  excludedReason?: string;
};
```

`currentPrice` 与 `usedPrice` 是特定日期、配置和成色的中国大陆公开价格快照，不代表实时全网最低价。`price-observations.json` 中同设备同价格类型允许保存多笔报价；运行时读取观察值及主库回退值，只有通过配置、地区、价格类型和状态校验的报价才参与正常展示/预算。`excludedReason` 保留被排除报价的证据，不能作为预算依据。

同配置以较新的采集日期为准，不能用旧的低价覆盖新报价。页面取消内存/存储选择器，各型号在价格字段逐项列出配置报价，并保留 CPU/GPU、网络版本、面板及成色等差异，不把同容量当作完全同配置。穿戴报价按具体尺寸、网络、材质及表带款式绑定。无法确认的价格留空，缺失不计为涨跌。首发价用于历史展示，不替代新机/二手预算；优惠券、积分、以旧换新等未核实资格的优惠不视为所有人可用。二手价仅作轻量参考，不要求全库实时或精确估价。

## 配置与评测

```ts
type DeviceConfiguration = {
  memory: string;
  storage: string;
  chip?: string;
  cpuCores?: number;
  gpuCores?: number;
  evidence?: SpecField<string>;
};

type DeviceBenchmark = {
  provider: string;
  metric: string;
  score: number;
  protocolVersion: string;
  sourceUrl: string;
  verifiedAt: string;
  publishedAt?: string;
  rawText?: string;
  fetchedAt?: string;
  sourceSnapshotHash?: string;
  notes?: string;
};
```

671 条来源设备记录存有配置矩阵，但不表示全部 SKU 完整核实；未知组合不能从各容量列表任意拼出。所有页面不再设置内存/存储配置选择器：组合及价格在字段中展示；芯片、CPU/GPU 等随配置变化时在具体参数说明。AI 顾问仍可解析明确配置下限并匹配有证据的报价，不因删除 UI 选择器放弃约束。

## 产品图与展示

`device-images.json` 登记主图 URL、准确型号、来源、采集时间及快照哈希；`device-image-galleries.json` 登记颜色/款式与可选图片。无准确配色图保持为空；共享主图需标明范围，不给通用图猜颜色。983 条来源记录有主图、8 条缺主图；720 份配色记录、2370 个颜色/款式项，其中 1972 项有图，URL 重用不算独立授权素材。图片许可目前未知，来源可追溯不是商业使用许可。

同款归并后图库合并款式与准确图片，旧 ID 仍指向整理后的型号。详情按类别分区、统一正文字重、短值保留标签/数值布局，长文本按原文条目正常显示，无“详情”折叠；镜头分项完整覆盖后置总述时仅去重展示，不删除原证据。

当前有 20 条 DXOMARK 相机评测记录，包含不同协议版本，不直接跨版本排序或宣称分数等价。新评科技、小白测评等仍是候选补充来源，当前不宣称已接入其结构化测评数据。

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

当前已存储 40 条带直接前代引用的升级幅度评分，40/40 非空、待计算项为 0；不表示全库所有相邻代际都已建评分。P8 的 13/13 是历史阶段数量。`value: null` 仍用于缺少可靠评分口径的诚实缺失表达。

## AI 顾问绑定协议

- 输入可带 `minMemoryGb`、`minStorageGb`；文本仅识别部分明确的独立容量表达，不能宣称任意自然语言都可解析。新机只用有效当前价，接受二手时比较当前价和二手价，首发价不参与预算。
- 模型最多收到 12 台候选、每机最多两笔代表报价，返回 `answer`、`recommendedDeviceIds`、逐项对应的 `recommendedQuoteIds` 和内部 `confidence`，最多推荐 3 台。
- `quoteId` 是本次候选请求内的标识（形如 `<deviceId>:q<index>`），不是跨请求稳定的商城 SKU；设备/报价绑定失败、超额或冲突选择拒绝整份结果。
- 服务端补齐型号、年份和选中报价，页面显示推荐文字及设备索引；`confidence` 不是已核验的准确率。绑定校验和有限正文一致性检查不能代替完整自然语言事实核验。

## 校验

运行完整数据校验：

```bash
npm run test:device-taxonomy
npm run test:device-data-quality
npm run test:price-workflow
npm run test:compare-configuration
npm run test:wearable
node scripts/audit-catalog-coverage.mjs --output /tmp/catalog-audit.json
```

分类校验覆盖设备数量与唯一性、字段元数据、布尔字段类型、严格比较组、连续代际顺序、computed 来源以及直接前代引用。

数据质量校验覆盖：

- 多品牌主数据与 `device-sources.json` 一一对应，分品牌保留独立登记；
- 每个规格字段的 URL 已登记且属于允许的品牌官方或受信第三方域名；
- `reference` 如实标注已登记第三方参数、历史首发价、价格快照和评测证据，不包装成官方事实；
- 页面核心字段不得从当前完整覆盖状态回退；
- 输出各品类关键字段覆盖率、来源地区分布和待复核设备清单。

截至 2026-10-07，原始记录为 991 条 / 421 组 / 19,267 字段：`official=5931`、`reference=13336`、`needsReview=[]`；公开目录 970 个型号。有效当前价覆盖 68 个型号、二手价 97 个，不是全配置覆盖。新增报价先验证后进入 `price-observations.json`，分品牌同步与构建合并主库。扩容后字段缺口仍存在，目录审计保持 partial。

Apple 子集增加 19 条手表，现为 150 条 / 31 组 / 4284 字段：`official=4087`、`reference=197`。原手机/平板/笔记本子集仍为 131 条 / 28 组 / 3984 字段，有效当前价 34 台、二手价 75 台。内存中 59 条来自 iOS Ref、2 条来自 iFixit；13 条 MacBook 和 2 条历史 iPhone 首发价使用已登记第三方证据。手表没有公开运行内存或首发价时不套用手机字段补齐；未明确写出的刷新率及 HDMI / SDXC 否定项保持缺失。
