# 开发记录

[简体中文](DEVELOPMENT_HISTORY.md) | [English](DEVELOPMENT_HISTORY.en.md) · [项目说明](README.md)

本记录依据当前远端 `main` 可达的 Git 提交与实际文件差异整理。核对基线为 `9598ef2`：190 个可达提交，首个快照为 2026-06-19，功能与数据维护记录延续至 2026-10-17；2026-10-21 的展示和许可整理单独列出。日期统一采用 Git 提交者时间的 UTC 日期，可能与提交标题中的本地日期相差一天。

以下是代表性变更，不是完整发布日志。提交链接保留仓库当前访问权限；它们不代表软件版本发布、社区采用或第三方版权授权。新增测试脚本不等于历史测试结果已验证。本地未提交修改及隔离演示候选不计入已发布进度。

## 初次快照

| UTC 日期 | 已核对的实质变更 | 提交 |
| --- | --- | --- |
| 2026-06-19 | 初次入库快照：Next/React 工程、设备工作台、设备数据和字段字典已入库。此日期是 Git 快照记录，不推定更早的开发或上线日期。 | [119fb65](https://github.com/LighthouseXy/ai-device-evolution/commit/119fb65f2be1e6fe4d9a97f10da0de6ec1f5e018) |

## 功能与数据演进

| UTC 日期 | 已核对的实质变更 | 提交 |
| --- | --- | --- |
| 2026-06-27 | 加入结构化 AI 分析接口、请求字段检查和分析结果归一化；变更集中于 API 路由及分析库。 | [e58edaf](https://github.com/LighthouseXy/ai-device-evolution/commit/e58edaf47a72a8de6efc8c2b05703f9c08ec925e) |
| 2026-06-28 | 新增顾问面板中的预算、品类与使用需求输入，并接入顾问 API，调整候选推荐逻辑。 | [8213af3](https://github.com/LighthouseXy/ai-device-evolution/commit/8213af326500a893bca546159a196d0bd71ee7b4) |
| 2026-07-03 | 重建首页，并新增设备库列表与设备详情路由；目录可按品类筛选，详情独立展示。 | [4f1a17e](https://github.com/LighthouseXy/ai-device-evolution/commit/4f1a17ed18a19a365bbd05c178a3469a731d57b7) |
| 2026-08-25 | 将内存与存储配置纳入对比报价匹配，调整对比页和系列选择，并补充数据审计条件。 | [0fa173c](https://github.com/LighthouseXy/ai-device-evolution/commit/0fa173cdb368f930b5c0336e0165d701784c1aad) |
| 2026-08-30 | 新增价格快照工作流及对应回归脚本，补充数据审计和运行命令。 | [4d12967](https://github.com/LighthouseXy/ai-device-evolution/commit/4d129674a6994fc11dc4957b8335e6f74509ef78) |
| 2026-09-06 | 新增按清单合并多品牌设备与来源登记的数据生成脚本，检查品牌、来源记录与设备对应关系，并接入应用。 | [b197c79](https://github.com/LighthouseXy/ai-device-evolution/commit/b197c792761372bee4884a3f75db2def3679d60b) |
| 2026-10-07 | 扩展多品牌目录与配套采集/合并脚本，新增目录覆盖率、图片可用性和型号回归检查。此记录说明代码与数据变更，不代表第三方素材已取得再分发授权。 | [d1f3f4d](https://github.com/LighthouseXy/ai-device-evolution/commit/d1f3f4d94347643924d0cb1f7a43ce03cf16edc0) |
| 2026-10-07 | 统一对比入口，加入同品类 2–3 台设备自选及可保存的 URL 参数；详情页引入图库和逐项配置报价，并同步目录与趋势筛选。 | [e149c2b](https://github.com/LighthouseXy/ai-device-evolution/commit/e149c2b6ccfe6f05af4dca55b28c6abf37407541) |

## 维护与质量改进

| UTC 日期 | 已核对的实质变更 | 提交 |
| --- | --- | --- |
| 2026-06-30 | 新增顾问评测脚本与固定输入样例，提供离线评测入口。这里只记录脚本加入，不据此宣称历史运行通过。 | [31fef2b](https://github.com/LighthouseXy/ai-device-evolution/commit/31fef2b7a698e39c796eca0cc49e257953729dd6) |
| 2026-07-04 | 拆分顾问 API 服务与分析规则/归一化模块，抽取 TypeScript 测试加载器，加入分析回归脚本。 | [d2480fa](https://github.com/LighthouseXy/ai-device-evolution/commit/d2480fa140737722013ef269d249cf0a7abf560e) |
| 2026-08-30 | 为价格采集增加有限次数重试及超时处理，覆盖 408、429 和服务器错误，并补充对应回归断言。 | [d011c0c](https://github.com/LighthouseXy/ai-device-evolution/commit/d011c0c5f7d2adc3b3ab3b5a228e3c155e892e96) |
| 2026-09-06 | 强化跨品牌数据质量检查：来源登记一致性、可信域名、必填规格、价格元数据及基准分数元数据。 | [88c643e](https://github.com/LighthouseXy/ai-device-evolution/commit/88c643e2c691289afd2fafd1fbf8ab175d954894) |
| 2026-09-06 | 顾问候选事实加入品牌、内存、配置及影像基准协议信息；提示词明确不同协议分数不能直接比较。 | [6b22941](https://github.com/LighthouseXy/ai-device-evolution/commit/6b2294142de7b62f2c220aa9094bac2fcdec42e4) |
| 2026-10-07 | 将顾问报价选择绑定具体配置及最低内存/存储需求，补充预算内外、事实复核与评测覆盖。 | [5ccd335](https://github.com/LighthouseXy/ai-device-evolution/commit/5ccd33597ea4407c248c6c9c5a2cc2256c45cabd) |
| 2026-10-17 | 同步目录与图片登记，新增图片策略审计及目录分页/筛选回归；图片审计区分已登记、待核实和缺失状态，不等同版权清权。 | [7212cb4](https://github.com/LighthouseXy/ai-device-evolution/commit/7212cb4af8464ecb0c81774fe45ecb30fd58bc0e) |

## 展示、文档与许可准备

| UTC 日期 | 已核对的实质变更 | 提交 |
| --- | --- | --- |
| 2026-10-21 | 发布中英文 README 互链及七张功能展示图，加入截图来源与已知问题说明；未改应用功能。 | [27658be](https://github.com/LighthouseXy/ai-device-evolution/commit/27658bed7ebe1712e4996aa8cc8428e047947202) |
| 2026-10-21 | 发布原创软件与原创技术文档的 MIT 许可、路径范围和第三方说明，统一软件包许可字段；生产数据及第三方素材未统一改授 MIT。 | [9598ef2](https://github.com/LighthouseXy/ai-device-evolution/commit/9598ef2f0e2a242cae80a6ab6a192d07ac206aaf) |

## 当前边界

- 网站界面目前主要为中文；双语 README 不表示网站已完成国际化。
- 首页系列摘要存在已登记显示问题，仍待后续修复，见[已知问题](docs/OPEN_SOURCE_KNOWN_ISSUES.md)。
- 原创代码及原创技术文档采用 [MIT](LICENSE)；第三方素材与生产数据库适用各自权利，见[许可范围](LICENSE_SCOPE.md)及[第三方说明](THIRD_PARTY_NOTICES.md)。
