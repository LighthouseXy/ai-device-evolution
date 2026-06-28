# DeviceScope 快速项目说明

## 一句话

DeviceScope 是一个 Apple 设备代际演进分析平台，当前已形成“结构化设备数据库 + AI 观察 + 设备顾问 + rules fallback + 回归测试”的 MVP 闭环。

## 已完成

- 58 台 Apple 设备的结构化数据库，区分官方参数与 computed 字段。
- 前端观察工作台：类别、系列、维度和范围筛选，支持趋势与对比展示。
- `/api/ai-analysis`：AI 观察 API，带本地 fallback 和缓存生成 MVP。
- `/api/device-advisor`：设备顾问 API，带规则 fallback。
- 设备顾问面板：预算校验、错误提示、结果四态、推荐层级、场景快捷项、提交前摘要。
- 回归脚本：覆盖 fallback 场景、API 错误路径、`maxResults` 边界和脚本帮助信息。
- 本地 dev server：已切到 Webpack + polling，规避当前环境 watcher 问题。

## 当前进行中

- 真实模型联调：用真实 key 验证 AI 观察和设备顾问输出质量。
- 推荐样例补充：继续扩展设备顾问场景基线，但不再做零碎 UI 小修。
- 文档与包装：README、Project Plan、线程规则和技术点说明继续收口。

## 当前工作方式

- 只有明确阶段成果完成后，才交审查线程整体验收提交。

## 风险

- 真实模型效果尚未充分验证，不能把 fallback 当作最终 AI 能力。
- 回归脚本依赖当前的模块加载方式，后续环境变化要同步维护。
- 本地 dev server 使用 polling，稳定但比默认监听模式慢。
