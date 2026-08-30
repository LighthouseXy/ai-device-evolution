# 数码观察站 / DeviceScope

DeviceScope 是一个电子设备代际演进分析平台。当前第一阶段以 Apple 设备作为样本范围，围绕 iPhone、iPad、MacBook 的本地结构化数据模型，提供首页浏览、设备库、设备详情、代际对比、趋势观察、AI 顾问和评测闭环能力。

项目目标不是做一张静态参数表，而是把“官方来源数据 -> 结构化设备库 -> 前端可视化 -> AI 观察 / 设备顾问”串成一条可验证、可扩展的产品链路。

## 已实现功能

- **本地结构化 JSON 数据模型**：覆盖 2016 年以来的 iPhone / iPad / MacBook，共 129 台 Apple 设备、3835 个规格字段；默认读取中文主数据，英文官网数据以独立快照保留。
- **价格批处理**：可批量生成价格缺口和搜索词、检查单个商品页、验证 JSON 批次并导入观察文件；正式同步和数据门禁继续负责最终写入。
- **首页 / 设备库 / 设备详情**：已完成 v2 前端重构，统一了首页、设备库和设备详情页的导航、层级和展示风格。
- **代际趋势观察**：支持按类别、系列、分析维度和对比范围筛选，展示芯片、屏幕、重量、价格等变化趋势。
- **详细参数对比**：对相邻代际变化做标记，14 / 16 英寸 MacBook Pro 的 Pro、Max 芯片档位可独立比较；价格区位于性能之前，当前价与二手价按运行内存 + 存储组合匹配，避免跨配置误比。
- **AI 观察引擎**：提供代际总结、趋势预测、购买建议、字段解释等分析模式；无模型 key 时使用 rules fallback 保证可用。
- **AI 设备顾问**：支持预算、设备类型、性能偏好、使用场景、成色偏好、续航优先级、接口/生态需求等输入；本地只负责标准化、候选筛选、官方事实整理和简单 fallback，模型负责场景化推荐与权衡。
- **DeepSeek 接入**：DeepSeek V4 使用紧凑返回协议、显式关闭 thinking、900 token 输出上限和 15 秒超时；6 个真实样例已全部一次生成 AI 结果，但不把小样本复测表述为长期稳定承诺。
- **AI eval 闭环**：设备顾问评测结果可写入 `.eval-results/`，并由 dev-only 看板读取、切换和展示 KPI、样本明细与失败原因。
- **回归测试脚本**：覆盖设备顾问 fallback 场景、API 错误路径、`maxResults` 边界和脚本帮助输出。
- **本地预览修复**：开发服务使用 Webpack + polling，规避当前环境下的 `EMFILE: too many open files, watch` 问题。

## 技术亮点

### 可追溯数据结构

设备参数通过 `SpecField<T>` 保存来源 URL、来源类型、置信度和验证时间；计算字段使用 `sourceType: "computed"`，避免把推断数据混作采集事实。技术规格优先来自 Apple Support 中国简体中文页面，中国大陆首发价优先来自 Apple 中国 Newsroom；Apple 未公开的 iPhone / iPad 运行内存由 iOS Ref 补齐，当前价与二手价保存为带配置、成色和采集日期的静态参考快照。

```ts
type SpecField<T> = {
  value: T;
  unit?: string;
  rawText?: string;
  sourceUrl: string;
  sourceType: "apple" | "reference";
  confidence: number;
  verifiedAt: string;
};
```

### AI 与 rules fallback 分层

AI 分析与设备顾问都保留本地 rules fallback。设备顾问不再把 AI 部分结果与规则结果拼接：合法完整输出统一标记为 `ai`；模型不可用、15 秒超时，或重试后仍无法形成有效主推荐和备选时，完整回退为 `rules`。

设备顾问的 rules fallback 只按设备类型、预算和发布时间排序，并明确提示这是基础排序结果，不代表已分析性能、续航、屏幕、便携、存储或相机等完整需求。

### 设备顾问推荐链路

`/api/device-advisor` 先归一化输入并按品类过滤，再按预算内、预算接近度和发布时间稳定排序，最多整理 8 个带官方事实的候选。OpenAI / DeepSeek 只返回候选 `deviceId`、匹配分、理由与权衡等生成内容；型号、系列、类别、年份和价格由服务端候选真值补齐，未知 ID 会被过滤。DeepSeek 的紧凑输出上限为 900 token，并显式使用非思考模式；OpenAI 与 DeepSeek 都使用 15 秒超时及候选真值校验。

### 面向产品的前端状态

`DeviceAdvisorPanel` 不直接暴露技术字段，而是把用户输入、提交状态、错误提示、推荐结果和权衡点整理成可读的操作体验。

### 趋势与对比边界

`/compare` 和 `/trends` 页面展示的洞察来自本地 `rules fallback`，用于稳定输出代际对比和趋势观察，不代表真实模型在线调用。

### 评测看板

`/dev/device-advisor-eval` 是 dev-only 的 AI eval 看板，用于查看 `.eval-results/*.json` 中的评测闭环结果，不会在生产环境开放。

### 轻量回归保护

项目使用脚本级回归覆盖关键路径：

- `npm run test:device-advisor`：25 个候选排序、价格快照与 rules fallback 场景。
- `npm run test:device-advisor-api`：13 个 API 协议、候选真值、重试和 fallback 边界场景。

## 技术栈

| 类别 | 技术 |
| --- | --- |
| 框架 | Next.js 16 + React 19 |
| 语言 | TypeScript |
| 样式 | Tailwind CSS 4 |
| 路由 | Next.js App Router |
| 数据 | 本地结构化 JSON 数据源 + SpecField 来源追踪 |
| AI | OpenAI / DeepSeek 调用框架 + rules fallback |
| 测试 | Node 脚本回归测试 |

## 本地运行

```bash
npm install
npm run dev
```

默认访问：

```text
http://localhost:3000
```

常用检查：

```bash
npm run lint
./node_modules/.bin/tsc --noEmit --incremental false
npm run sync:apple-zh-cn
npm run prices -- plan --type current --limit 20
npm run prices -- inspect 'https://商品页'
npm run test:price-workflow
npm run check
npm run build
npm run test:device-advisor
npm run test:device-advisor-api
```

## 环境变量

未配置模型 key 时，系统会使用本地 rules fallback。

```bash
OPENAI_API_KEY=...
DEEPSEEK_API_KEY=...
AI_PROVIDER=openai # 或 deepseek
```

## 项目结构

```text
src/
├── app/
│   ├── api/
│   │   ├── ai-analysis/route.ts       # AI 观察 API
│   │   └── device-advisor/route.ts    # 设备顾问 API
│   ├── advisor/page.tsx               # AI 顾问
│   ├── compare/page.tsx               # 代际对比
│   ├── dev/device-advisor-eval/page.tsx # dev-only 评测看板
│   ├── layout.tsx
│   ├── devices/[id]/page.tsx          # 设备详情
│   ├── devices/page.tsx               # 设备库
│   ├── page.tsx
│   ├── trends/page.tsx                # 趋势观察
│   └── globals.css
├── components/
│   ├── DeviceAdvisorPanel.tsx         # 设备顾问面板
│   ├── DeviceSeriesTrendExplorer.tsx  # 同系列趋势图
│   └── DeviceAdvisorEvalDashboard.tsx # dev-only 评测看板
├── lib/
│   ├── ai-analysis.ts                 # AI 观察引擎与 fallback
│   ├── device-advisor.ts              # 设备顾问推荐逻辑
│   └── devices-db.ts                  # 设备数据适配
└── data/
    ├── apple-devices-db.json          # 主结构化中文数据源
    ├── apple-sources.json             # 中文来源审计登记
    ├── price-observations.json        # 经批处理审核的新增价格快照
    ├── apple-devices-db.en-us.json    # 英文官网原始快照
    ├── apple-sources.en-us.json       # 英文来源原始快照
    └── archive/                       # 历史批次与旧版快照，运行时不读取

scripts/
├── sync-apple-zh-cn-data.mjs          # 中文官网数据同步
├── price-snapshot-workflow.mjs        # 价格缺口、检查、验证与导入
├── device-advisor-regression.mjs      # fallback 回归
└── device-advisor-api-regression.mjs  # API 错误路径回归
```

## 当前阶段

项目已完成中文官网数据切换、2016 年以来 129 台设备扩容、MacBook Pro Pro / Max 独立配置拆分、配置化价格对比、首页 / 设备库 / 设备详情、代际对比、趋势观察、AI 顾问、DeepSeek 接入、AI eval 闭环、dev-only 评测看板和 v2 前端重构。设备顾问已收敛为轻量候选层、候选真值校验与完整 AI / rules 分层；数据主线下一步是在统一配置口径下继续扩充中国大陆当前价与二手价快照。

## 相关文档

- [项目计划](PROJECT_PLAN.md)
- [最新开发日志](logs/2026-08-31.md)
