# src/data/ 数据文件说明

## 运行时数据

| 文件 | 用途 |
|------|------|
| `apple-devices-db.json` | 唯一设备主数据，58 台 Apple 设备；页面和分析模块统一通过 `src/lib/devices-db.ts` 读取 |
| `apple-sources.json` | 官方来源登记，仅用于来源审计，不参与页面运行时查询 |

## archive/ 目录

历史批次和旧版数据均已合并进主数据，只保留用于溯源参考。运行时代码不得从 `archive/` 读取数据。

- `archive/legacy/`：2026-06-25 的旧 specs、computed 和 v0 扁平数据快照。
- `archive/apple-devices-*-batch-*.json`：主数据合并前的采集批次。

修改主数据后运行 `npm run test:device-taxonomy`，校验设备标识、字段结构、比较组和前代引用。
