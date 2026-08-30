# 数码观察站 / DeviceScope

DeviceScope 是一个电子设备代际演进分析平台，用可追溯的结构化设备资料、可视化观察和 AI 辅助建议，帮助用户理解设备规格变化、代际差异与选购权衡。

第一阶段以 Apple 设备作为样本范围，覆盖 iPhone、iPad 和 MacBook；这不代表项目已支持多品牌。

- 在线演示：[ai-device-evolution.vercel.app](https://ai-device-evolution.vercel.app/)
- GitHub 代码：[LighthouseXy/ai-device-evolution](https://github.com/LighthouseXy/ai-device-evolution)

## 核心能力

- 首页、设备库和设备详情：基于真实本地结构化数据模型展示设备信息与来源追踪。
- 趋势观察：按类别、系列和指标查看 SVG 折线趋势。
- 代际对比：横向对比参数变化，突出相邻代际差异与缺失状态。
- AI 顾问：本地先按品类、预算接近度和发布时间整理最多 8 个候选，模型基于候选官方事实生成推荐与权衡。
- AI eval：设备顾问评测结果可由 dev-only 看板查看，形成可复查的评测闭环。

## 技术栈

| 类别 | 技术 |
| --- | --- |
| 应用 | Next.js 16、React 19、TypeScript、Tailwind CSS 4 |
| 数据 | 结构化 JSON 数据源、本地结构化数据模型、SpecField 来源追踪 |
| AI | OpenAI / DeepSeek provider、rules fallback |
| 验证 | TypeScript、ESLint、Node 脚本回归测试 |

## 数据与 AI 边界

- 当前数据层是 129 台 Apple 设备的结构化 JSON 数据源，不是已建成的数据库系统；Apple 中国页面为规格与首发价第一来源，受信第三方补充 Apple 未公开的运行内存、可精确对应配置的历史首发价及特定日期的中国大陆价格快照。
- 当前价与二手价按具体运行内存、存储、成色和采集日期保存，仅供参考，不代表实时全网最低价。
- `/compare` 和 `/trends` 使用本地规则分析真实结构化数据，不是实时模型调用。
- AI 顾问只接受候选集中的设备 ID，型号、系列、年份和价格由服务端本地真值补齐；模型不可用、超时或完整输出不合规时使用 rules fallback。
- rules fallback 仅按设备类型、预算和发布时间排序，不代表完整需求分析；DeepSeek 有真实复测证据，但不承诺长期稳定。
- 缺失字段按实际缺失状态展示，不伪造参数或把推断包装成官方事实。

## 快速开始

```bash
npm install
npm run dev
```

本地访问 `http://localhost:3000`。常用验证命令：

```bash
npm run typecheck
npm run lint
npm run prices -- plan --type current --limit 20
npm run prices -- search 'iPad Air 2025' --limit 20
npm run prices -- inspect 'https://www.shihuo.cn/...&skuId=明确规格ID'
npm run prices -- inspect 'https://m2.9ji.com/secondHand/detail/...' --render
npm run test:price-workflow
npm run build
npm run test:device-advisor
npm run test:device-advisor-api
```

## 文档

- [详细项目计划](docs/PROJECT_PLAN.md)
- [文档索引与技术说明](docs/README.md)
- [最新开发日志](docs/logs/2026-08-31.md)
