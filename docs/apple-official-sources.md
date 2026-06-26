# Apple 官方来源链接库

> **项目：** 数码观察站 DeviceScope
> **版本：** v1.1 | 2026-06-23
> **说明：** 本文件收录 Apple 官方来源链接，用于字段字典中 `SpecField.sourceUrl` 的标准化管理。

---

## 来源优先级

| 优先级 | sourceType | 说明 | 用途 |
|--------|-----------|------|------|
| 1 | `official_specs` | Apple 官方技术规格页 | 主要数据来源，最高优先级 |
| 2 | `apple_support` | Apple Support 文档页 | 补充技术细节、兼容性信息 |
| 3 | `apple_newsroom` | Apple 新闻稿 | 发布日期、首发价格、发布背景 |
| 4 | `apple_product_page` | 当前官网产品页 | 仍在售设备的营销信息 |

---

## 字段说明

每条记录包含以下字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 设备唯一 ID，如 `iphone-15-pro` |
| `category` | string | `phone` / `tablet` / `laptop` |
| `series` | string | iPhone / iPad Air / MacBook Pro 等 |
| `modelName` | string | 完整设备名 |
| `generation` | string | 代际或芯片代际 |
| `releaseYear` | number | 发布年份 |
| `sourcePageType` | string | `apple_product_specs` / `apple_support_docs` / `apple_newsroom` |
| `officialSpecUrl` | string | Apple 官方技术规格链接 |
| `supportUrl` | string \| null | Apple Support 链接 |
| `newsroomUrl` | string \| null | Apple 新闻稿链接 |
| `sourceStatus` | string | `verified` / `missing` / `needs_review` |
| `notes` | string | 备注 |

---

## iPhone 官方来源

> **URL 说明：** 当前在售设备使用 apple.com 产品规格页；旧款设备使用 Apple Support 文档页。

### iPhone 17 系列 (2025)

| id | modelName | releaseYear | sourcePageType | officialSpecUrl | sourceStatus | notes |
|----|-----------|-------------|----------------|-----------------|--------------|-------|
| iphone-17 | iPhone 17 | 2025 | apple_product_specs | `https://www.apple.com/iphone-17/specs/` | needs_review | 待确认 URL 格式 |
| iphone-air | iPhone Air | 2025 | apple_product_specs | `https://www.apple.com/iphone-air/specs/` | needs_review | 官方名称为 iPhone Air，非 iPhone 17 Air |
| iphone-17-pro | iPhone 17 Pro | 2025 | apple_product_specs | `https://www.apple.com/iphone-17-pro/specs/` | needs_review | shared specs page with Pro Max |
| iphone-17-pro-max | iPhone 17 Pro Max | 2025 | apple_product_specs | `https://www.apple.com/iphone-17-pro/specs/` | needs_review | shared specs page with Pro |

### iPhone 16 系列 (2024)

| id | modelName | releaseYear | sourcePageType | officialSpecUrl | sourceStatus | notes |
|----|-----------|-------------|----------------|-----------------|--------------|-------|
| iphone-16 | iPhone 16 | 2024 | apple_product_specs | `https://www.apple.com/iphone-16/specs/` | verified | shared specs page with Plus |
| iphone-16-plus | iPhone 16 Plus | 2024 | apple_product_specs | `https://www.apple.com/iphone-16/specs/` | verified | shared specs page with iPhone 16 |
| iphone-16-pro | iPhone 16 Pro | 2024 | apple_product_specs | `https://www.apple.com/iphone-16-pro/specs/` | verified | shared specs page with Pro Max |
| iphone-16-pro-max | iPhone 16 Pro Max | 2024 | apple_product_specs | `https://www.apple.com/iphone-16-pro/specs/` | verified | shared specs page with Pro |

### iPhone 15 系列 (2023)

| id | modelName | releaseYear | sourcePageType | officialSpecUrl | supportUrl | sourceStatus | notes |
|----|-----------|-------------|----------------|-----------------|------------|--------------|-------|
| iphone-15 | iPhone 15 | 2023 | apple_support_docs | — | `https://support.apple.com/en-us/111831` | verified | Apple Support tech specs |
| iphone-15-plus | iPhone 15 Plus | 2023 | apple_support_docs | — | `https://support.apple.com/en-us/111830` | verified | Apple Support tech specs |
| iphone-15-pro | iPhone 15 Pro | 2023 | apple_support_docs | — | `https://support.apple.com/en-us/111829` | verified | Apple Support tech specs |
| iphone-15-pro-max | iPhone 15 Pro Max | 2023 | apple_support_docs | — | `https://support.apple.com/en-us/111828` | verified | Apple Support tech specs |

### iPhone 14 系列 (2022)

| id | modelName | releaseYear | sourcePageType | officialSpecUrl | supportUrl | sourceStatus | notes |
|----|-----------|-------------|----------------|-----------------|------------|--------------|-------|
| iphone-14 | iPhone 14 | 2022 | apple_support_docs | — | `https://support.apple.com/en-us/111850` | verified | Apple Support tech specs |
| iphone-14-plus | iPhone 14 Plus | 2022 | apple_support_docs | — | `https://support.apple.com/en-us/111854` | verified | Apple Support tech specs |
| iphone-14-pro | iPhone 14 Pro | 2022 | apple_support_docs | — | `https://support.apple.com/en-us/111849` | verified | Apple Support tech specs |
| iphone-14-pro-max | iPhone 14 Pro Max | 2022 | apple_support_docs | — | `https://support.apple.com/en-us/111846` | verified | Apple Support tech specs |

### iPhone 13 系列 (2021)

| id | modelName | releaseYear | sourcePageType | officialSpecUrl | supportUrl | sourceStatus | notes |
|----|-----------|-------------|----------------|-----------------|------------|--------------|-------|
| iphone-13 | iPhone 13 | 2021 | apple_support_docs | — | `https://support.apple.com/en-us/111872` | verified | Apple Support tech specs |
| iphone-13-mini | iPhone 13 mini | 2021 | apple_support_docs | — | `https://support.apple.com/en-us/111873` | verified | Apple Support tech specs |
| iphone-13-pro | iPhone 13 Pro | 2021 | apple_support_docs | — | `https://support.apple.com/en-us/111871` | verified | Apple Support tech specs |
| iphone-13-pro-max | iPhone 13 Pro Max | 2021 | apple_support_docs | — | `https://support.apple.com/en-us/111870` | verified | Apple Support tech specs |

### iPhone 12 系列 (2020)

| id | modelName | releaseYear | sourcePageType | officialSpecUrl | supportUrl | sourceStatus | notes |
|----|-----------|-------------|----------------|-----------------|------------|--------------|-------|
| iphone-12 | iPhone 12 | 2020 | apple_support_docs | — | `https://support.apple.com/en-us/111876` | verified | Apple Support tech specs |
| iphone-12-mini | iPhone 12 mini | 2020 | apple_support_docs | — | `https://support.apple.com/en-us/111877` | verified | Apple Support tech specs |
| iphone-12-pro | iPhone 12 Pro | 2020 | apple_support_docs | — | `https://support.apple.com/en-us/111875` | verified | Apple Support tech specs |
| iphone-12-pro-max | iPhone 12 Pro Max | 2020 | apple_support_docs | — | `https://support.apple.com/en-us/111874` | verified | Apple Support tech specs |

### iPhone 16e / iPhone SE 系列

| id | modelName | releaseYear | sourcePageType | officialSpecUrl | supportUrl | sourceStatus | notes |
|----|-----------|-------------|----------------|-----------------|------------|--------------|-------|
| iphone-16e-2025 | iPhone 16e | 2025 | apple_product_specs | `https://www.apple.com/iphone-16e/specs/` | — | needs_review | 当前在售，官方名称为 iPhone 16e |
| iphone-se-3-2022 | iPhone SE (3rd generation) | 2022 | apple_support_docs | — | `https://support.apple.com/en-us/111866` | verified | Apple Support tech specs |
| iphone-se-2-2020 | iPhone SE (2nd generation) | 2020 | apple_support_docs | — | `https://support.apple.com/en-us/111882` | verified | Apple Support tech specs |

---

## iPad 官方来源

> **URL 说明：** 当前在售设备使用 apple.com 产品规格页；旧款设备使用 Apple Support 文档页。

### iPad Pro 系列

| id | modelName | releaseYear | sourcePageType | officialSpecUrl | supportUrl | sourceStatus | notes |
|----|-----------|-------------|----------------|-----------------|------------|--------------|-------|
| ipad-pro-m5-11-2025 | iPad Pro 11-inch (M5) | 2025 | apple_support_docs | — | `https://support.apple.com/en-us/docs/ipad/301270` | verified | Apple Support tech specs |
| ipad-pro-m5-13-2025 | iPad Pro 13-inch (M5) | 2025 | apple_support_docs | — | `https://support.apple.com/en-us/docs/ipad/301272` | verified | Apple Support tech specs |
| ipad-pro-m4-11-2024 | iPad Pro 11-inch (M4) | 2024 | apple_support_docs | — | `https://support.apple.com/en-us/111842` | verified | Apple Support tech specs |
| ipad-pro-m4-13-2024 | iPad Pro 13-inch (M4) | 2024 | apple_support_docs | — | `https://support.apple.com/en-us/111841` | verified | Apple Support tech specs |
| ipad-pro-m2-2022 | iPad Pro (M2) | 2022 | apple_support_docs | — | `https://support.apple.com/en-us/111897` | verified | 11-inch 3rd gen, Apple Support |
| ipad-pro-m2-13-2022 | iPad Pro (M2) 12.9-inch | 2022 | apple_support_docs | — | `https://support.apple.com/en-us/111896` | verified | 12.9-inch 6th gen, Apple Support |

### iPad Air 系列

| id | modelName | releaseYear | sourcePageType | officialSpecUrl | supportUrl | sourceStatus | notes |
|----|-----------|-------------|----------------|-----------------|------------|--------------|-------|
| ipad-air-m4-2025 | iPad Air 11-inch (M4) | 2025 | apple_support_docs | — | `https://support.apple.com/en-us/docs/ipad/301281` | verified | Apple Support tech specs |
| ipad-air-m3-2025 | iPad Air 11-inch (M3) | 2025 | apple_support_docs | — | `https://support.apple.com/en-us/docs/ipad/301081` | verified | Apple Support tech specs |
| ipad-air-m2-2024 | iPad Air 11-inch (M2) | 2024 | apple_support_docs | — | `https://support.apple.com/en-us/docs/ipad/301027` | verified | Apple Support tech specs |

### iPad 标准版系列

| id | modelName | releaseYear | sourcePageType | officialSpecUrl | supportUrl | sourceStatus | notes |
|----|-----------|-------------|----------------|-----------------|------------|--------------|-------|
| ipad-a16-2025 | iPad (A16) | 2025 | apple_product_specs | `https://www.apple.com/ipad/specs/` | — | needs_review | 当前在售，待确认是否已更新 A16 |
| ipad-10th-2022 | iPad (10th generation) | 2022 | apple_support_docs | — | `https://support.apple.com/en-us/111840` | verified | Apple Support tech specs |
| ipad-9th-2021 | iPad (9th generation) | 2021 | apple_support_docs | — | `https://support.apple.com/en-us/111898` | verified | Apple Support tech specs |

### iPad mini 系列

| id | modelName | releaseYear | sourcePageType | officialSpecUrl | supportUrl | sourceStatus | notes |
|----|-----------|-------------|----------------|-----------------|------------|--------------|-------|
| ipad-mini-a17-pro-2024 | iPad mini (A17 Pro) | 2024 | apple_product_specs | `https://www.apple.com/ipad-mini/specs/` | — | verified | 当前在售 |
| ipad-mini-6th-2021 | iPad mini (6th generation) | 2021 | apple_support_docs | — | `https://support.apple.com/en-us/111886` | verified | Apple Support tech specs |

---

## MacBook 官方来源

> **URL 说明：** 当前在售设备使用 apple.com 产品规格页；旧款设备使用 Apple Support 文档页。按 13/14/15/16 英寸区分。

### MacBook Pro 系列

#### MacBook Pro 14-inch

| id | modelName | releaseYear | sourcePageType | officialSpecUrl | supportUrl | sourceStatus | notes |
|----|-----------|-------------|----------------|-----------------|------------|--------------|-------|
| macbook-pro-14-m5-2025 | MacBook Pro 14-inch (M5) | 2025 | apple_support_docs | — | `https://support.apple.com/en-us/docs/mac/301274` | verified | Apple Support tech specs |
| macbook-pro-14-m5-pro-2026 | MacBook Pro 14-inch (M5 Pro or M5 Max) | 2026 | apple_support_docs | — | `https://support.apple.com/en-us/docs/mac/301289` | verified | Apple Support tech specs |
| macbook-pro-14-m4-2024 | MacBook Pro 14-inch (M4) | 2024 | apple_support_docs | — | `https://support.apple.com/en-us/docs/mac/301068` | verified | Apple Support tech specs |
| macbook-pro-14-m4-pro-2024 | MacBook Pro 14-inch (M4 Pro or M4 Max) | 2024 | apple_support_docs | — | `https://support.apple.com/en-us/docs/mac/301069` | verified | Apple Support tech specs |
| macbook-pro-14-m3-2023 | MacBook Pro 14-inch (M3) | 2023 | apple_support_docs | — | null | needs_review | 未找到精确匹配的 Apple Support 页面 |
| macbook-pro-14-m2-2023 | MacBook Pro 14-inch (M2 Pro/Max) | 2023 | apple_support_docs | — | null | needs_review | 未找到精确匹配的 Apple Support 页面 |

#### MacBook Pro 16-inch

| id | modelName | releaseYear | sourcePageType | officialSpecUrl | supportUrl | sourceStatus | notes |
|----|-----------|-------------|----------------|-----------------|------------|--------------|-------|
| macbook-pro-16-m5-2026 | MacBook Pro 16-inch (M5 Pro or M5 Max) | 2026 | apple_support_docs | — | `https://support.apple.com/en-us/docs/mac/301286` | verified | Apple Support tech specs |
| macbook-pro-16-m4-2024 | MacBook Pro 16-inch (M4 Pro or M4 Max) | 2024 | apple_support_docs | — | `https://support.apple.com/en-us/docs/mac/301070` | verified | Apple Support tech specs |
| macbook-pro-16-m3-2023 | MacBook Pro 16-inch (M3 Pro/Max) | 2023 | apple_support_docs | — | null | needs_review | 未找到精确匹配的 Apple Support 页面 |
| macbook-pro-16-m2-2023 | MacBook Pro 16-inch (M2 Pro/Max) | 2023 | apple_support_docs | — | `https://support.apple.com/en-us/111838` | verified | Apple Support tech specs |

#### MacBook Pro 13-inch (旧款)

| id | modelName | releaseYear | sourcePageType | officialSpecUrl | supportUrl | sourceStatus | notes |
|----|-----------|-------------|----------------|-----------------|------------|--------------|-------|
| macbook-pro-13-m2-2022 | MacBook Pro 13-inch (M2) | 2022 | apple_support_docs | — | `https://support.apple.com/en-us/111869` | verified | Apple Support tech specs |
| macbook-pro-13-m1-2020 | MacBook Pro 13-inch (M1) | 2020 | apple_support_docs | — | `https://support.apple.com/en-us/111893` | verified | Apple Support tech specs |

### MacBook Air 系列

#### MacBook Air 13-inch

| id | modelName | releaseYear | sourcePageType | officialSpecUrl | supportUrl | sourceStatus | notes |
|----|-----------|-------------|----------------|-----------------|------------|--------------|-------|
| macbook-air-13-m5-2026 | MacBook Air 13-inch (M5) | 2026 | apple_support_docs | — | `https://support.apple.com/en-us/docs/mac/301288` | verified | Apple Support tech specs |
| macbook-air-13-m4-2025 | MacBook Air 13-inch (M4) | 2025 | apple_support_docs | — | `https://support.apple.com/en-us/docs/mac/301086` | verified | Apple Support tech specs |
| macbook-air-13-m3-2024 | MacBook Air 13-inch (M3) | 2024 | apple_support_docs | — | `https://support.apple.com/en-us/docs/mac/301019` | verified | Apple Support tech specs |
| macbook-air-13-m2-2022 | MacBook Air 13-inch (M2) | 2022 | apple_support_docs | — | `https://support.apple.com/en-us/111867` | verified | Apple Support tech specs |
| macbook-air-13-m1-2020 | MacBook Air 13-inch (M1) | 2020 | apple_support_docs | — | `https://support.apple.com/en-us/111883` | verified | Apple Support tech specs |

#### MacBook Air 15-inch

| id | modelName | releaseYear | sourcePageType | officialSpecUrl | supportUrl | sourceStatus | notes |
|----|-----------|-------------|----------------|-----------------|------------|--------------|-------|
| macbook-air-15-m5-2026 | MacBook Air 15-inch (M5) | 2026 | apple_support_docs | — | `https://support.apple.com/en-us/docs/mac/301287` | verified | Apple Support tech specs |
| macbook-air-15-m4-2025 | MacBook Air 15-inch (M4) | 2025 | apple_support_docs | — | `https://support.apple.com/en-us/docs/mac/301087` | verified | Apple Support tech specs |
| macbook-air-15-m3-2024 | MacBook Air 15-inch (M3) | 2024 | apple_support_docs | — | `https://support.apple.com/en-us/docs/mac/301020` | verified | Apple Support tech specs |

---

## 待补充 / 待确认

### 需要人工确认的设备

| 设备 | 原因 | 状态 |
|------|------|------|
| iPhone 17 系列 | 2025 年新款，URL 格式待确认 | needs_review |
| iPhone Air | 新产品线，官方名称和 URL 待确认 | needs_review |
| iPad (A16) | 待确认是否已更新 A16 芯片页面 | needs_review |
| MacBook Pro 14-inch (M3) | 待确认 M3 芯片页面 | needs_review |
| MacBook Pro 16-inch (M3) | 待确认 M3 Pro/Max 芯片页面 | needs_review |
| 所有 newsroomUrl | Apple 新闻稿 URL 格式不统一，需人工搜索确认 | needs_review |

### 确认方法

1. **当前在售设备：** 直接访问 apple.com 产品规格页，确认芯片型号
2. **旧款设备：** 直接访问 Apple Support 文档页，确认页面存在且包含完整规格
3. **新闻稿：** 在 Apple Newsroom 搜索设备名称

---

## JSON 格式示例

> 以下为单条记录的 JSON 格式示例，用于后续生成完整的 `src/data/apple-sources.json`。

```json
{
  "id": "iphone-15-pro",
  "category": "phone",
  "series": "iPhone",
  "modelName": "iPhone 15 Pro",
  "generation": "15 Pro",
  "releaseYear": 2023,
  "sourcePageType": "apple_support_docs",
  "officialSpecUrl": null,
  "supportUrl": "https://support.apple.com/en-us/111829",
  "newsroomUrl": null,
  "sourceStatus": "verified",
  "notes": "Apple Support tech specs page"
}
```

---

## 附录：URL 模式总结

### Apple Support 文档页 URL 模式

```
https://support.apple.com/en-us/{doc_id}
```

已确认的文档 ID：

| doc_id | 设备 |
|--------|------|
| 111828 | iPhone 15 Pro Max |
| 111829 | iPhone 15 Pro |
| 111830 | iPhone 15 Plus |
| 111831 | iPhone 15 |
| 111838 | MacBook Pro (16-inch, 2023) |
| 111840 | iPad (10th generation) |
| 111841 | iPad Pro 12.9-inch (6th generation) |
| 111842 | iPad Pro 11-inch (4th generation) |
| 111846 | iPhone 14 Pro Max |
| 111849 | iPhone 14 Pro |
| 111850 | iPhone 14 |
| 111854 | iPhone 14 Plus |
| 111866 | iPhone SE (3rd generation) |
| 111867 | MacBook Air (M2, 2022) |
| 111869 | MacBook Pro (13-inch, M2, 2022) |
| 111870 | iPhone 13 Pro Max |
| 111871 | iPhone 13 Pro |
| 111872 | iPhone 13 |
| 111873 | iPhone 13 mini |
| 111874 | iPhone 12 Pro Max |
| 111875 | iPhone 12 Pro |
| 111876 | iPhone 12 |
| 111877 | iPhone 12 mini |
| 111882 | iPhone SE (2nd generation) |
| 111883 | MacBook Air (M1, 2020) |
| 111886 | iPad mini (6th generation) |
| 111887 | iPad Air (5th generation) |
| 111893 | MacBook Pro (13-inch, M1, 2020) |
| 111896 | iPad Pro 12.9-inch (5th generation) |
| 111897 | iPad Pro 11-inch (3rd generation) |
| 111898 | iPad (9th generation) |
| 111901 | MacBook Pro (16-inch, 2021) |
| 111902 | MacBook Pro (14-inch, 2021) |

### iPhone 规格页 URL 模式

```
https://www.apple.com/iphone-{model}/specs/
```

- 标准版/Plus 共用：`/iphone-16/specs/`
- Pro/Pro Max 共用：`/iphone-16-pro/specs/`
- iPhone Air：`/iphone-air/specs/`
- iPhone SE：`/iphone-se/specs/`

### iPad 规格页 URL 模式

```
https://www.apple.com/{series}/specs/
```

- iPad Pro：`/ipad-pro/specs/`
- iPad Air：`/ipad-air/specs/`
- iPad：`/ipad/specs/`
- iPad mini：`/ipad-mini/specs/`

### MacBook 规格页 URL 模式

```
https://www.apple.com/{series}/specs/
```

- MacBook Pro：`/macbook-pro/specs/`
- MacBook Air：`/macbook-air/specs/`
