# 数据与素材边界 / Data and material boundaries

核对基线：`ad92531dece0e5bd739047b9098cf75159430fe6`。以下按数据结构与字段分类，列出需要复核的材料。准确性、权利许可及侵权判断需结合具体内容与证据分别核实，不能仅凭第三方来源就认定规格事实或 URL 侵权。

Reviewed baseline: `ad92531`. This structural classification identifies material for review. Factual accuracy, rights clearance and any infringement assessment require item-specific content and evidence. A third-party source alone does not establish infringement of a fact or URL.

## 默认分支的实际内容 / Actual default-branch contents

| 路径 / Path | 字段 / Fields | 实际数量与含义 / Count and meaning |
| --- | --- | --- |
| `src/data/devices-db.json` | `devices` / `devices[*].specs` | 991 条来源记录，运行时归并为 926 个目录型号；19,395 个规格字段对象。 |
| 同上 / same | `specs[*].value` | 14,914 个字符串、3,477 个数字、705 个布尔值、299 个数组。数字和字符串不能仅凭类型认定为准确事实；文本值也可能含说明。 |
| 同上 / same | `releaseYear` / `releaseDate` / `*.verifiedAt` | 发布年份/日期与核验时间分别保留，不能混同产品发布日期与采集日期。逐字段统计不将它们当作文字作品。 |
| `src/data/price-observations.json` | `current` / `used` 下的 `value`（含逐型号数组） | 316 个价格观测值：213 个当前价、103 个二手价，分别涉及 81 / 79 个型号，分别绑定日期、配置、状态与来源；316 按观测值计数，并非唯一型号数；实时行情需另查。 |
| `src/data/devices-db.json` | `*.sourceUrl` 等来源 URL / source URLs | 21,774 个来源/其他 URL 叶值出现次数，含嵌套配置证据，不能当作唯一来源页数或授权证明。 |
| `src/data/device-images.json` | 图片对象的 `url` 及相关 URL 字段 | 989 个外链图片 URL 出现次数；来源页链接另计。此处统计外链引用，仓内图片文件另列。 |
| `src/data/device-image-galleries.json` | 图库图片 `url` 等 / gallery image URLs | 2,279 个外链图片 URL 出现次数；同图可被多处引用，非唯一图片数。 |
| `src/data/**/*.json` | `rawText` / `evidence` / `description` / `excerpt` / `content` / `text` / `summary` | 长度至少 300 字符的证据文本候选共 2,405 次出现、334 个不同内容哈希，其中 66 次含可识别 HTML/CSS/脚本片段。此阈值用于定位复核；版权保护需按具体内容判断。 |
| `public/*.svg`、`src/app/icon.svg`、`docs/screenshots/ai-device/*` | 仓内图片/SVG文件 / repository image files | 共 14 份文件：6 份 public SVG、1 份应用图标、7 张展示截图。截图使用授权不改变图内第三方产品图权利。 |

规格、日期、价格等事实与表达方式分开处理。来源 URL 保留可追溯性，不自动授予目标网页或图片的再分发权。`rawText` 长字段中有参数列表、配置价格列表、注释及来源文字，不能把全部长字段认定为宣传文案，也不能全部视为纯事实。明确出现的 HTML/CSS/脚本证据片段与可能的长文案摘录，应按具体字段、原始来源和现有许可复核；本轮未删除或重写它们。

Separate factual information from its expression. Keep source URLs for traceability without treating them as redistribution grants. Long evidence fields include specification lists, price/configuration lists, notes and source text. Classify each field by its actual content, including factual information and expressive text. Review identifiable source fragments and potential long quotations individually; nothing was deleted or rewritten by this review.

## 具体待复核位置 / Concrete review locations

- `src/data/archive/apple-devices-batch-2.json` 的 `devices[*].dimensions.rawText` 与 `devices[*].rearCamera.rawText`，以及 `src/data/archive/apple-devices-batch-3.json` 的同类字段，包含已识别的较长 HTML/CSS/脚本证据片段，部分字段可达 9,059 字符。可达旧版本也需要纳入公开范围决定。
- `src/data/devices-db.json` 的 `devices[*].specs.*.rawText` 有 570 次长文本候选；例如 `sportsModes.rawText` 9 次、`dimensions.rawText` 4 次、`launchPrice.rawText` 23 次。先判断是参数/报价表、原创整理还是来源表达，再确定需要哪些授权或引用边界，不能按长度直接判侵权。
- `src/data/price-observations.json` 的 `current` / `used` 下 `rawText` 字段 共 62 次长文本候选；价格值与证据描述分开处理。
- `src/data/device-images.json` 与 `src/data/device-image-galleries.json`：分别核对实际图片源、作者、许可及适用条件；授权状态需另查许可证据。
- `public/next.svg`、`public/vercel.svg` 及其他图标保留各自上游/商标边界；`src/app/globals.css` 的第三方字体服务引用也不由本项目 MIT 授权。
- 七张展示截图的来源见[截图说明](docs/screenshots/ai-device/README.md)，首页已知显示问题见[已知问题](docs/OPEN_SOURCE_KNOWN_ISSUES.md)。

Review these locations against item-specific evidence and applicable third-party terms, which may permit use. Missing rights records leave permission status unknown.

## 原创与第三方范围 / Original and third-party scope

原创软件及原创技术文档采用 [MIT](LICENSE)，以[许可范围](LICENSE_SCOPE.md)和[第三方说明](THIRD_PARTY_NOTICES.md)为准。生产数据库、第三方文字表达、图片、字体、商标与其他材料保留各自权利。不存在仅因本次结构化分类就自动把生产数据改授 MIT 的步骤。

Original software and technical documentation use MIT within the documented scope. Production databases and third-party expression, images, fonts and marks retain their own rights. This classification does not relicense production data.

本地未提交的图片/证据扩展与远端内容不同，未当作已发布内容列入上表。完整合成演示导出器及原创样例现已纳入源码（见 [DEMO.md](DEMO.md)）：它将原应用复制到隔离目录，由原创虚构数据运行，不替换生产数据，也不清理可达历史。复现状态见[复现记录](REPRODUCIBILITY.md)。

Local uncommitted additions differ from this remote baseline and are excluded from the published counts above. The included original demo addon copies the original application into an isolated directory with original fictional data; it does not replace production data or remove reachable history. See [reproducibility](REPRODUCIBILITY.md).
