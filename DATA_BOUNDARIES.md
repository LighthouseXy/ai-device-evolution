# 数据与素材边界 / Data and material boundaries

核对基线：`ad92531dece0e5bd739047b9098cf75159430fe6`。以下是数据结构与字段分类，不是法律侵权判定、准确性保证或一揽子素材清权证明。不会仅因来源是第三方，就认定规格事实或 URL 侵权。

Reviewed baseline: `ad92531`. This is structural classification, not a determination of infringement, factual accuracy or blanket rights clearance. A third-party source alone does not establish infringement of a fact or URL.

## 默认分支的实际内容 / Actual default-branch contents

| 路径 / Path | 字段 / Fields | 实际数量与含义 / Count and meaning |
| --- | --- | --- |
| `src/data/devices-db.json` | `devices` / `devices[*].specs` | 991 条来源记录，运行时归并为 926 个目录型号；19,395 个规格字段对象。 |
| 同上 / same | `specs[*].value` | 14,914 个字符串、3,477 个数字、705 个布尔值、299 个数组。数字和字符串不能仅凭类型认定为准确事实；文本值也可能含说明。 |
| 同上 / same | `releaseYear` / `releaseDate` / `*.verifiedAt` | 发布年份/日期与核验时间分别保留，不能混同产品发布日期与采集日期。逐字段统计不将它们当作文字作品。 |
| `src/data/price-observations.json` | `current` / `used` 下的 `value`（含逐型号数组） | 316 个价格观测值：213 个当前价、103 个二手价，分别涉及 81 / 79 个型号，分别绑定日期、配置、状态与来源；不是 316 个唯一型号或实时行情。 |
| `src/data/devices-db.json` | `*.sourceUrl` 等来源 URL / source URLs | 21,774 个来源/其他 URL 叶值出现次数，含嵌套配置证据，不能当作唯一来源页数或授权证明。 |
| `src/data/device-images.json` | 图片对象的 `url` 及相关 URL 字段 | 989 个外链图片 URL 出现次数；来源页链接另计。图片 URL 不等于仓内保存了原图。 |
| `src/data/device-image-galleries.json` | 图库图片 `url` 等 / gallery image URLs | 2,279 个外链图片 URL 出现次数；同图可被多处引用，非唯一图片数。 |
| `src/data/**/*.json` | `rawText` / `evidence` / `description` / `excerpt` / `content` / `text` / `summary` | 长度至少 300 字符的证据文本候选共 2,405 次出现、334 个不同内容哈希，其中 66 次含可识别 HTML/CSS/脚本片段。此阈值只用于定位复核，不是版权保护门槛。 |
| `public/*.svg`、`src/app/icon.svg`、`docs/screenshots/ai-device/*` | 仓内图片/SVG文件 / repository image files | 共 14 份文件：6 份 public SVG、1 份应用图标、7 张展示截图。截图使用授权不改变图内第三方产品图权利。 |

规格、日期、价格等事实与表达方式分开处理。来源 URL 保留可追溯性，不自动授予目标网页或图片的再分发权。`rawText` 长字段中有参数列表、配置价格列表、注释及来源文字，不能把全部长字段认定为宣传文案，也不能全部视为纯事实。明确出现的 HTML/CSS/脚本证据片段与可能的长文案摘录，应按具体字段、原始来源和现有许可复核；本轮未删除或重写它们。

Separate factual information from its expression. Keep source URLs for traceability without treating them as redistribution grants. Long evidence fields include specification lists, price/configuration lists, notes and source text. They are not all marketing copy or all bare facts. Review identifiable source fragments and potential long quotations individually; nothing was deleted or rewritten by this review.

## 具体待复核位置 / Concrete review locations

- `src/data/archive/apple-devices-batch-2.json` 的 `devices[*].dimensions.rawText` 与 `devices[*].rearCamera.rawText`，以及 `src/data/archive/apple-devices-batch-3.json` 的同类字段，包含已识别的较长 HTML/CSS/脚本证据片段，部分字段可达 9,059 字符。可达旧版本也需要纳入公开范围决定。
- `src/data/devices-db.json` 的 `devices[*].specs.*.rawText` 有 570 次长文本候选；例如 `sportsModes.rawText` 9 次、`dimensions.rawText` 4 次、`launchPrice.rawText` 23 次。先判断是参数/报价表、原创整理还是来源表达，再确定需要哪些授权或引用边界，不能按长度直接判侵权。
- `src/data/price-observations.json` 的 `current` / `used` 下 `rawText` 字段 共 62 次长文本候选；价格值与证据描述分开处理。
- `src/data/device-images.json` 与 `src/data/device-image-galleries.json`：分别核对实际图片源、作者、许可及适用条件；来源 URL 与访问成功都不是授权证明。
- `public/next.svg`、`public/vercel.svg` 及其他图标保留各自上游/商标边界；`src/app/globals.css` 的第三方字体服务引用也不由本项目 MIT 授权。
- 七张展示截图的来源见[截图说明](docs/screenshots/ai-device/README.md)，首页已知显示问题见[已知问题](docs/OPEN_SOURCE_KNOWN_ISSUES.md)。

These locations identify review work, not proven infringement. Recorded third-party terms may permit use; assess each item on its own evidence. A missing rights record remains an unknown, not automatic proof that permission is absent.

## 原创与第三方范围 / Original and third-party scope

原创软件及原创技术文档采用 [MIT](LICENSE)，以[许可范围](LICENSE_SCOPE.md)和[第三方说明](THIRD_PARTY_NOTICES.md)为准。生产数据库、第三方文字表达、图片、字体、商标与其他材料保留各自权利。不存在仅因本次结构化分类就自动把生产数据改授 MIT 的步骤。

Original software and technical documentation use MIT within the documented scope. Production databases and third-party expression, images, fonts and marks retain their own rights. This classification does not relicense production data.

本地未提交的图片/证据扩展与远端内容不同，未当作已发布内容列入上表。完整合成演示的可合入补丁另行交付，尚未推送：它将原应用复制到隔离目录，由原创虚构数据运行，不替换生产数据，也不清理可达历史。复现状态见[复现记录](REPRODUCIBILITY.md)。

Local uncommitted additions differ from this remote baseline and are excluded from the published counts above. A separately delivered, unpushed demo patch copies the original application into an isolated directory with original fictional data; it does not replace production data or remove reachable history. See [reproducibility](REPRODUCIBILITY.md).
