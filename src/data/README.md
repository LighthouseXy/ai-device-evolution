# src/data/ 数据文件说明

## 核心文件（前端使用）

| 文件 | 用途 |
|------|------|
| apple-devices-db.json | 主数据，58 台 Apple 设备，前端直接加载 |
| apple-devices.json | 设备 specs 字段 |
| apple-devices-computed.json | 计算字段（AI 能力、升级幅度等） |
| apple-sources.json | 官方来源登记 |
| devices.json | 旧版数据，仅 devices.ts 引用，后续可废弃 |

## archive/ 目录

历史批次文件，已全部合并进主数据，保留用于溯源参考。
