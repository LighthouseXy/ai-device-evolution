# 数码观察站 / DeviceScope

[简体中文](README.md) | [English](README.en.md)

> 原创软件代码及原创技术文档采用 [MIT](LICENSE)；第三方代码、依赖、字体、图片、数据库、影音和硬件保留各自权利。详见 [许可范围](LICENSE_SCOPE.md)。

DeviceScope 是一个电子设备参数、产品对比与选购建议平台，以可追溯的结构化资料展示规格变化和配置差异，并提供 AI 辅助建议。

- 在线演示：[ai-device-evolution.vercel.app](https://ai-device-evolution.vercel.app/)
- GitHub：[LighthouseXy/ai-device-evolution](https://github.com/LighthouseXy/ai-device-evolution)

## 核心能力

- 设备库：苹果、小米、红米、三星、华为、OPPO、vivo、荣耀八个品牌；手机、平板电脑、笔记本电脑、手表、手环五个品类。
- 产品对比：统一入口选择同品牌或跨品牌，支持 2–3 台同品类设备自选；同品牌支持代际范围，卡片与参数列同步横向滚动。
- 分层筛选：品牌 → 设备种类 → 产品系列；小米与红米分开，细碎系列归入产品族，旗舰/主力产品靠前。
- 参数与报价：不提供内存/存储配置选择器；具体配置价格直接逐项列示，影响芯片、CPU/GPU 等参数的配置差异在相应字段说明。
- 图片与详情：设备主图、已记录的配色/款式切换及放大；参数分区使用独立双列卡片，正文统一字重，长文本按原文条目完整展示，不使用折叠详情。
- 同款整理：确认同一型号的颜色、表带及材质款合并展示，保留原始证据、款式图片与价格/重量差异；不同尺寸、NFC、蜂窝网络和芯片版本不随意合并。
- 趋势观察：按品牌、品类、产品系列及指标观察数据；不同价格类型不混为实时行情。
- AI 顾问：最多 12 个候选、每机最多两笔代表报价、最多推荐 3 台；自然语言建议加设备索引，设备与报价由服务端绑定校验；不可用时明确显示规则回退。

## 当前数据与边界（2026-10-07）

| 指标 | 数量与口径 |
| --- | --- |
| 来源记录 / 公开目录型号 | 991 / 970 |
| 手机 / 平板 / 笔记本 / 手表 / 手环 | 477 / 160 / 115 / 170 / 48，目录口径 |
| 原始严格比较组 / 规格字段 | 421 / 19,267 |
| 已整理同款组 | 17 组，38 条款式记录归为 17 个型号 |
| 默认图片 / 尚缺主图 | 983 / 8，原始记录口径 |
| 有至少一笔有效当前价 / 二手价 | 68 / 97 个型号，不代表全部配置覆盖 |

数据保存为本地 JSON 分库，经清单构建合并；不是已迁移到 SQL 数据库。Apple 原英文官网快照独立保留，不用于默认回填。官方和主流第三方规格如实标注来源；报价采用中国大陆公开商品页的日期快照，不是实时最低价。二手价仅作轻量参考。

近十年小米/红米/三星按 2017–2026、近五年华为/OPPO/vivo/荣耀按 2022–2026 整理，Apple 延续 2016 年起的范围。已完成多批扩容，但目录审计仍标记 partial，不能声称已覆盖期间所有产品、配置和颜色。缺失字段保持空值；照片来源可追溯不等于获得商业使用许可，当前图片许可状态未明确。3D 产品展示已取消。

`/compare` 和 `/trends` 的文字洞察来自本地规则，不是联网模型。`/api/ai-analysis` 有接口基础，但产品对比未接入真实 AI。顾问的 ID/报价绑定与有限正文一致性检查不能证明全部自然语言事实正确。

## 技术与验收

Next.js 16、React 19、TypeScript、Tailwind CSS 4；本地 JSON、来源元数据及 Node 回归脚本；OpenAI / DeepSeek 与 rules fallback。

2026-10-07 完整 `npm run check` 与生产构建通过（1002 个静态页面，保留原详情链接）；桌面 1280px、手机 390px 的同款归并、配色切换、跨品牌选择与详情布局已检查。400 份穿戴参数/发布来源快照及图片快照通过离线回放。当前阶段未新增付费模型调用，不能据模拟 API 通过率宣称推荐准确率或模型稳定性。

DeepSeek 顾问显式关闭 thinking，输出上限 900 token、每次请求 15 秒超时，最多一次重试；15 秒不是含重试的整体耗时上限。现版本真实 Token、耗时、回退及文字事实仍需授权后的代表样例验收。

## 本地运行与检查

```bash
npm install
npm run dev
npm run check
npm run build
npm run test:wearable
node scripts/audit-catalog-coverage.mjs --output /tmp/catalog-audit.json
npm run prices -- plan --type current --limit 20
npm run eval:device-advisor -- --provider=offline
```

本地默认 `http://localhost:3000` 只在运行电脑可访问，手机远程查看使用 Vercel 地址。开发服务使用 Webpack + polling。

模型密钥仅保存在环境配置中，缺密钥时使用规则回退。真实评测需明确授权；只有指定 `--out` 才保存本地评测结果。部署复用既有 Vercel 项目；`.vercelignore` 排除环境文件、私有工具目录、来源缓存与评测结果，生产评测看板不开放。

## 文档

- [项目计划与具体阶段](docs/PROJECT_PLAN.md)
- [技术说明](docs/README.md)
- [字段字典](docs/field-dictionary.md)
- [来源管理](docs/apple-official-sources.md)
- [本次变更与验收](docs/logs/2026-10-07.md)
- [后续建议及已取消范围](docs/FUTURE_FEATURES.md)

## 许可证与材料范围

根 [LICENSE](LICENSE) 为标准 MIT，适用于范围清单中的原创软件及原创技术文档；允许按 MIT 商业使用、修改和再分发，须保留版权及许可声明。第三方材料与真实产品数据库不受根许可统一覆盖，原许可及版权继续适用。详见 [LICENSE_SCOPE.md](LICENSE_SCOPE.md) 与 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
