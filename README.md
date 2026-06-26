# 数码观察站 / DeviceScope

Apple 设备代际演进分析平台。将 iPhone、iPad、MacBook 的历代配置结构化整理，提供代际对比、趋势图、关键变化摘要和 AI 分析。

## 核心功能

- **结构化设备数据库** — 58 台 Apple 设备，每条参数可追溯到官方来源
- **产品分类筛选** — iPhone / iPad / MacBook 三类，支持按系列和代际范围筛选
- **代际趋势对比** — 手写 SVG 折线图，支持芯片/价格/屏幕/重量等多维度切换
- **详细参数对比表** — 相邻代际变化标记，缺失数据统一展示
- **关键变化摘要** — 最近两代间变化的字段列表
- **AI 分析 MVP** — 配置升级预测、购买建议、代际变化总结（当前为前端规则分析，未接真实 AI API）
- **移动端适配** — 响应式布局，图表和表格独立横向滚动

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 + React 19 |
| 语言 | TypeScript |
| 样式 | Tailwind CSS 4 |
| 图表 | 手写 SVG |
| 数据 | JSON 结构化数据 + SpecField 来源追踪 |
| AI | 前端规则分析 MVP，计划接入真实 AI API |

## 数据设计

每台设备的每个参数字段都记录来源信息：

```ts
// 官方参数
{ value: "A18 Pro", sourceUrl: "https://...", sourceType: "apple", confidence: 1 }

// 计算分析字段
{ value: 5, sourceType: "computed", computedFrom: ["chip", "neuralEngine"], confidence: 0.85 }
```

- 58 台 Apple 设备主数据
- Apple 官方来源优先（apple.com / support.apple.com）
- 计算字段明确标注 `sourceType: "computed"`，不与官方参数混淆
- 历史批次文件归档在 `src/data/archive/`

## AI 使用说明

当前 AI 分析为**前端规则 MVP**，基于现有设备数据生成可控的分析文案（芯片型号正则推断、变化数量分级建议等）。不把 AI 推测当作官方参数。后续计划接入真实 AI API，基于结构化数据生成更灵活的分析报告。

## 本地运行

```bash
npm install
npm run dev      # 开发模式 → http://localhost:3000
npm run lint     # ESLint 检查
npm run build    # 生产构建
```

## 项目结构

```
src/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # 首页
│   ├── layout.tsx                # 根布局
│   └── globals.css               # 全局样式 + Tailwind
├── components/
│   └── DeviceWorkbench.tsx       # 核心工作台（单文件组件）
├── lib/
│   ├── devices-db.ts             # 新数据库加载模块（类型 + 查询 + 格式化）
│   └── devices.ts                # 旧数据模块（后续可废弃）
└── data/
    ├── apple-devices-db.json     # 主数据库（58 台设备，specs + computed）
    ├── apple-devices.json        # 设备 specs 字段
    ├── apple-devices-computed.json # 计算分析字段
    ├── apple-sources.json        # 61 条官方来源登记
    ├── devices.json              # 旧版数据文件
    ├── README.md                 # 数据文件说明
    └── archive/                  # 历史批次文件（16 个）
```

## 项目阶段

| 阶段 | 状态 |
|------|------|
| 数据基础建设（字段字典、来源库、批量抽取、一致性校验） | ✅ 已完成 |
| 前端展示（趋势图、对比表、筛选栏、移动端适配） | ✅ 已完成 |
| AI 分析 MVP（配置预测、购买建议、变化总结） | ✅ 已完成 |
| 真实 AI API 接入 | 🔜 计划中 |
| 项目展示与包装（截图、演示、简历描述） | 🔜 计划中 |
