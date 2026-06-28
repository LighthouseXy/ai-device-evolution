# 数码观察站 / DeviceScope

DeviceScope 是一个 Apple 设备代际演进分析平台，围绕 iPhone、iPad、MacBook 的结构化设备数据库，提供代际对比、趋势观察、AI 总结、规则推荐和设备顾问能力。

项目目标不是做一张静态参数表，而是把“官方来源数据 -> 结构化设备库 -> 前端可视化 -> AI 观察 / 设备顾问”串成一条可验证、可扩展的产品链路。

## 已实现功能

- **结构化设备数据库**：覆盖 iPhone / iPad / MacBook，共 58 台 Apple 设备，参数字段保留来源与置信度信息。
- **代际趋势观察**：支持按类别、系列、分析维度和对比范围筛选，展示芯片、屏幕、重量、价格等变化趋势。
- **详细参数对比**：对相邻代际变化做标记，缺失数据统一展示，便于横向扫描。
- **AI 观察引擎**：提供代际总结、趋势预测、购买建议、字段解释等分析模式；无模型 key 时使用 rules fallback 保证可用。
- **AI 设备顾问**：支持预算、设备类型、性能偏好、使用场景、成色偏好、续航优先级、接口/生态需求等输入，返回推荐、理由、注意事项和权衡点。
- **前端设备顾问面板**：包含预算校验、场景快捷输入、提交前摘要、加载/失败/无结果/成功四态展示和推荐结果分组展示。
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

`/api/device-advisor` 会先归一化输入，再选择 OpenAI / DeepSeek provider；失败时回退到本地规则推荐。新增偏好字段已经进入排序、理由、注意事项和 prompt 组装链路。

### 面向产品的前端状态

`DeviceAdvisorPanel` 不直接暴露技术字段，而是把用户输入、提交状态、错误提示、推荐结果和权衡点整理成可读的操作体验。

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
| 数据 | JSON 结构化数据库 + SpecField 来源追踪 |
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
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── DeviceWorkbench.tsx            # 设备观察工作台
│   └── DeviceAdvisorPanel.tsx         # 设备顾问面板
├── lib/
│   ├── ai-analysis.ts                 # AI 观察引擎与 fallback
│   ├── device-advisor.ts              # 设备顾问推荐逻辑
│   └── devices-db.ts                  # 设备数据库适配
└── data/
    ├── apple-devices-db.json          # 主数据库
    ├── apple-devices.json
    ├── apple-devices-computed.json
    ├── apple-sources.json
    └── archive/

scripts/
├── device-advisor-regression.mjs      # fallback 回归
└── device-advisor-api-regression.mjs  # API 错误路径回归
```

## 当前阶段

项目已完成结构化数据、前端观察工作台、AI 观察 API、设备顾问 MVP、规则 fallback、设备顾问前端体验和回归脚本。下一步重点是继续做真实模型联调、设备顾问推荐质量样例扩展、项目技术点沉淀和展示包装。

## 相关文档

- [PROJECT_PLAN.md](/Users/xyu/Job/Program/ai-device-evolution/PROJECT_PLAN.md)
- [PROJECT_BRIEF.md](/Users/xyu/Job/Program/ai-device-evolution/PROJECT_BRIEF.md)
- [THREAD_RULES.md](/Users/xyu/Job/Program/ai-device-evolution/THREAD_RULES.md)
