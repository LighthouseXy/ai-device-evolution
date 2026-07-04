# DeviceScope 快速项目说明

## 一句话

DeviceScope 是一个电子设备代际演进分析平台。当前第一阶段以 Apple 设备作为样本范围，已形成“真实设备数据库 + 首页 / 设备库 / 设备详情 + 代际对比 + 趋势观察 + AI 顾问 + DeepSeek 接入 + AI eval 闭环”的产品闭环。

## 已完成

- 第一阶段 58 台 Apple 设备的结构化数据库，区分官方参数与 computed 字段。
- 首页、设备库、设备详情、代际对比和趋势观察已完成 v2 前端重构。
- 前端观察工作台：类别、系列、维度和范围筛选，支持趋势与对比展示。
- `/api/device-advisor`：设备顾问 API，支持 OpenAI / DeepSeek provider，失败时回退规则推荐。
- `/api/ai-analysis`：AI 观察 API，带本地 fallback 和缓存生成 MVP。
- AI eval 闭环：评测结果写入 `.eval-results/`，dev-only 看板可读取并切换结果文件。
- `/compare` 和 `/trends` 的洞察来自本地规则分析，不是真实模型调用。
- 本地 dev server：已切到 Webpack + polling，规避当前环境 watcher 问题。

## 当前进行中

- 真实模型联调：继续复测 AI 观察和设备顾问输出质量，DeepSeek 仅按已复测状态描述，不写成长期稳定承诺。
- 推荐样例补充：继续扩展设备顾问场景基线，但不再做零碎 UI 小修。

## 风险

- 真实模型效果尚未充分验证，不能把 fallback 当作最终 AI 能力。
- 回归脚本依赖当前的模块加载方式，后续环境变化要同步维护。
- 本地 dev server 使用 polling，稳定但比默认监听模式慢。
