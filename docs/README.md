# 数码观察站 / DeviceScope

DeviceScope 是一个电子设备代际演进分析平台。当前第一阶段以 Apple 设备作为样本范围，围绕 iPhone、iPad、MacBook 的本地结构化数据模型，提供首页浏览、设备库、设备详情、代际对比、趋势观察、AI 顾问和评测闭环能力。

项目目标不是做一张静态参数表，而是把“官方来源数据 -> 结构化设备库 -> 前端可视化 -> AI 观察 / 设备顾问”串成一条可验证、可扩展的产品链路。

## 已实现功能

- **本地结构化 JSON 数据模型**：第一阶段覆盖 iPhone / iPad / MacBook，共 58 台 Apple 设备，参数字段保留来源与置信度信息；当前不是数据库系统。
- **首页 / 设备库 / 设备详情**：已完成 v2 前端重构，统一了首页、设备库和设备详情页的导航、层级和展示风格。
- **代际趋势观察**：支持按类别、系列、分析维度和对比范围筛选，展示芯片、屏幕、重量、价格等变化趋势。
- **详细参数对比**：对相邻代际变化做标记，缺失数据统一展示，便于横向扫描。
- **AI 观察引擎**：提供代际总结、趋势预测、购买建议、字段解释等分析模式；无模型 key 时使用 rules fallback 保证可用。
- **AI 设备顾问**：支持预算、设备类型、性能偏好、使用场景、成色偏好、续航优先级、接口/生态需求等输入，返回推荐、理由、注意事项和权衡点。
- **DeepSeek 接入**：`/api/device-advisor` 已完成 DeepSeek provider 真实复测，可作为可选接入路径；当前不把它表述为长期稳定承诺。
- **AI eval 闭环**：设备顾问评测结果可写入 `.eval-results/`，并由 dev-only 看板读取、切换和展示 KPI、样本明细与失败原因。
- **回归测试脚本**：覆盖设备顾问 fallback 场景、API 错误路径、`maxResults` 边界和脚本帮助输出。
- **本地预览修复**：开发服务使用 Webpack + polling，规避当前环境下的 `EMFILE: too many open files, watch` 问题。

## 技术亮点

### 可追溯数据结构

设备参数通过 `SpecField<T>` 保存来源 URL、来源类型、置信度和验证时间；计算字段使用 `sourceType: "computed"`，避免把推断数据混作官方事实。

```ts
type SpecField<T> = {
  value: T;
  unit?: string;
  rawText?: string;
  sourceUrl: string;
  sourceType: "apple";
  confidence: number;
  verifiedAt: string;
};
```

### AI 与规则 fallback 分层

AI 分析与设备顾问都保留本地 rules fallback。模型不可用、返回异常或输出不合规时，系统仍能给出稳定结果，降低外部 API 对核心体验的影响。

### 设备顾问推荐链路

`/api/device-advisor` 会先归一化输入，再选择 OpenAI / DeepSeek provider；失败时回退到本地规则推荐。DeepSeek 已做真实复测，但不应写成长期稳定承诺。

### 面向产品的前端状态

`DeviceAdvisorPanel` 不直接暴露技术字段，而是把用户输入、提交状态、错误提示、推荐结果和权衡点整理成可读的操作体验。

### 趋势与对比边界

`/compare` 和 `/trends` 页面展示的洞察来自本地 `rules fallback`，用于稳定输出代际对比和趋势观察，不代表真实模型在线调用。

### 评测看板

`/dev/device-advisor-eval` 是 dev-only 的 AI eval 看板，用于查看 `.eval-results/*.json` 中的评测闭环结果，不会在生产环境开放。

### 轻量回归保护

项目使用脚本级回归覆盖关键路径：

- `npm run test:device-advisor`：设备顾问 rules fallback 场景。
- `npm run test:device-advisor-api`：API 请求解析、400 错误路径和 `maxResults` 边界。

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
    ├── apple-devices-db.json          # 主结构化数据源
    ├── apple-sources.json             # 来源审计登记
    └── archive/                       # 历史批次与旧版快照，运行时不读取

scripts/
├── device-advisor-regression.mjs      # fallback 回归
└── device-advisor-api-regression.mjs  # API 错误路径回归
```

## 当前阶段

项目已完成本地结构化 JSON 数据模型、首页 / 设备库 / 设备详情、代际对比、趋势观察、AI 顾问、DeepSeek 接入、AI eval 闭环、dev-only 评测看板和 v2 前端重构。下一步重点是继续做真实模型联调、样例补充和项目展示包装。

## 相关文档

- [项目计划](PROJECT_PLAN.md)
- [开发日志](logs/2026-07-13.md)
