# 数码观察站 / DeviceScope 技术说明

更新日期：2026-10-07。当前规模和发布证据见 [项目计划](PROJECT_PLAN.md) 与 [本次日志](logs/2026-10-07.md)。

## 产品能力

八品牌五品类设备库；同品牌/跨品牌统一产品对比；品牌、类别和产品族筛选；配色/款式图片切换与放大；完整参数分区；具体配置价格逐项列示；本地趋势观察；自然语言 AI 顾问与设备索引。

公开目录为 970 个型号（手机 477、平板 160、笔记本 115、手表 170、手环 48），源数据保留 991 条。小米与红米分开显示；17 个已确认同款组保留原款式参数和图片，但不重复占用设备卡片和 AI 候选席位。不同尺寸、NFC/蜂窝及芯片不随意合并。

## 数据链路

`device-data-manifest.json` 的 54 个数据集 → 构建合并 `devices-db.json` / `device-sources.json` → 来源型对象 `allDevices` → 展平来源 `allDevicesFlat` → 人工确认映射整理 `catalogDevicesFlat` → 首页、库、详情、对比与趋势。

JSON 是本地结构化数据源，不是 SQL 数据库。分类门禁、来源字段与原始快照分别承担配置合法性、证据归属与可复现性，不能把门禁通过宣称为所有参数完整正确。原英文 Apple 快照独立保留，不默认回填。

- `SpecField`：值、单位、原文/整理说明、实际 URL、official/reference、历史核验日期；可附真实采集时间和内容哈希。
- `DeviceConfiguration`：有证据的内存/存储和芯片/CPU/GPU 组合，不是各容量任意交叉。
- `PriceField`：中国大陆具体配置/款式、价格类型、成色、观察日期和来源；首发/当前/二手分别保存。
- `device-model-groups.json`：人工确认同款映射，展示层的 editions 保留原款式对象与报价；旧路径继续可用。
- `device-images.json` / `device-image-galleries.json`：实际型号主图与配色项；无图留空，来源不是许可证明。
- `computed`：与采集事实分离，40 条直接前代升级评分不表示全部历史代际已有评分。

完整契约见 [字段字典](field-dictionary.md)。八个缺失主图和其他规格/配色/历史型号缺口保留在目录审计中，覆盖仍 partial。

## 参数和对比

`device-spec-fields.ts` 按品牌/品类挑选适用字段并说明配置差异。价格置于性能前，首发/当前/二手逐配置显示；取消内存与存储的选择控件，不取消真实性约束。

同品牌/跨品牌都用 `ProductCompareTable`：卡片与参数列同容器同步横向滑动。跨品牌先选类别，再逐台选品牌/系列/型号，2–3 台；不生成无依据综合胜负分。系列筛选比原严格比较组宽，不改写原始代际关系。

详情 `DeviceSpecGrid` 使用 ResizeObserver 分配独立双列，固定首两张卡片、其余放入较短列，后续高度变化不跨列迁移。手机单列。短值保留标签/数值布局，长说明按原文条目完整显示、统一正文字重、不折叠；镜头分项已覆盖时消除重复总述展示。

`/compare`、`/trends` 当前文字洞察来自本地 rules，不是实时模型调用。`/api/ai-analysis` 有通用接口基础，真实产品对比 AI 未上线。

## AI 顾问

`/api/device-advisor` 归一化预算、类别、明确接口/配置下限和新旧偏好；新机仅用有效当前价，接受二手时比较当前价/二手价，首发价不参与预算。有限价位/品牌覆盖最多 12 候选，每机最多两笔代表报价；同款配色去重但原始报价归属保持。

按需求精简模型事实，不引入复杂多维权重。模型返回 `answer`、`recommendedDeviceIds`、对应 `recommendedQuoteIds` 和内部 confidence，最多 3 台。服务端补齐身份及报价真值；错误归属、超额或冲突选择拒绝整份结果。正文有有限型号/配置/价格一致性拦截，不能当作完整语义核验。

AI 完整输出与规则完整回退分层，不拼接残缺 AI。回退明确告知仅做基础排序，不分析完整体验。OpenAI/DeepSeek 输出上限 900 token、每次 15 秒；DeepSeek 显式 thinking disabled，最多一次重试，OpenAI 无该重试流程。含重试时整体请求可超过 15 秒。

当前阶段未新增真实模型调用；现版本准确性、Token/延迟/回退率应授权后实测，旧版样例和模拟 API 不替代事实验收。

## 数据更新与验证

```bash
npm install
npm run dev
npm run build:data
npm run check
npm run build
npm run test:wearable
node scripts/audit-catalog-coverage.mjs --output /tmp/catalog-audit.json
npm run prices -- plan --type current --limit 20
npm run eval:device-advisor -- --provider=offline
```

价格工具复用目标计划、搜索、精确商品页检查、缓存、批次校验和导入，不作无目标全库重复抓取。二手价为 P3 轻量参考。快照复用不刷新实际采集日期，刷新失败不编造新证据。

完整 check 包括类型、lint、分类/来源、价格与快照、配置、穿戴/同款、AI analysis、顾问与 20 个模拟 API 场景。2026-10-07 检查及构建通过，1002 个静态页面；桌面 1280px / 手机 390px 核验。穿戴 400 份参数/发布来源、239 份主图、51 份配色图快照离线回放通过，不代表在线刷新。

模型密钥使用环境配置，不入 Git/上传包；未配置时规则回退。真实评测需明确授权，仅指定 `--out` 才写本地文件。dev-only 评测页在生产不可访问。

## 发布

复用现有 GitHub 和 Vercel 项目。先预览、后按功能提交及推送、再生产发布。本机 localhost 只供当前电脑使用，手机远程使用 Vercel URL。`.vercelignore` 排除环境文件、来源缓存、评测结果及私有目录；用户既有无关改动不提交。

云端构建 READY、授权 curl 和真实手机匿名访问是不同证据；不为了预览擅自关闭访问保护。发布地址、Git 提交与验证结果见日志。图片许可未知与数据未全量覆盖保留为真实边界；3D 已取消。

## 文档

- [项目计划](PROJECT_PLAN.md)
- [字段字典](field-dictionary.md)
- [Apple 来源](apple-official-sources.md)
- [最新日志](logs/2026-10-07.md)
- [未来建议](FUTURE_FEATURES.md)
