# 复现记录 / Reproducibility

基线 / Baseline: `ad92531dece0e5bd739047b9098cf75159430fe6`。环境 / Environment: Node 24.14.0、npm 11.9.0。本轮使用干净文件副本和现有完整 npm 缓存，没有复制本地来源缓存、真实环境文件或未提交数据；没有浏览器/视觉验收或真实模型调用。

## 当前默认分支可复现的基础流程 / Verified default-branch basics

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run build:data
npm run typecheck
npm run lint
NEXT_TELEMETRY_DISABLED=1 OPENAI_API_KEY= DEEPSEEK_API_KEY= npm run build -- --webpack
NEXT_TELEMETRY_DISABLED=1 OPENAI_API_KEY= DEEPSEEK_API_KEY= npm start -- --hostname 127.0.0.1
```

本轮实际安装使用 `npm ci --offline --ignore-scripts --no-audit --no-fund`，退出码为 0；数据生成、typecheck、lint 与生产 build 均退出 0。`build:data` 未改变已入库生成 JSON 的字节。空缓存断网不能安装依赖；上面的普通安装命令需要 npm registry 或可用缓存。最后的服务启动命令是使用步骤，本轮监听被环境拒绝，未标为已通过。

The actual clean install used the `--offline` form with a populated cache. Installation, data generation, typecheck, lint and production build exited successfully. Generated JSON remained byte-identical. Empty offline caches cannot install dependencies. The final server-start command is an instruction, not a passing result from this run: loopback listening was denied by the execution environment.

`npm run dev` 使用已有 Webpack/polling 开发入口。页面可能请求原有外链图片与字体；基础构建通过不表示完整运行界面完全离线。

## 完整 check 的缺口 / Full check gap

`npm run check` 本轮退出 1：前面的 typecheck、lint、分类/数据审计与价格工作流回归完成，随后 `scripts/source-snapshot-regression.mjs` 在 `scripts/lib/source-snapshot.mjs` 的离线来源快照检查中报缺失。本轮未下载外部来源或伪造缓存。后续链式检查没有运行，不能称整套 check 通过。私有历史缓存不是干净克隆的默认组成部分。

The full check exited 1 at a missing offline source snapshot. Later chained checks were not reached. No external evidence was downloaded or fabricated. Historical local evidence caches are not supplied by a clean clone.

## 单独交付、尚未合入的完整应用演示补丁 / Separate unmerged full-app demo patch

该补丁保留原应用路由、组件与默认生产脚本，仅增加导出器、原创合成输入、验证器与离线回归脚本；工具忽略规则避免生成目录进入 Git/lint。导出器只创建新的 `.demo-app`，拒绝覆盖已有目录，不复制生产 JSON、产品图片、来源长文或真实配置；默认构建路径不变。公开 README 不把补丁命令当作当前默认分支已有能力。

在隔离副本应用补丁后，完整演示的 30 条虚构设备、2 品牌、5 品类、10 个三代系列验证通过；重复生成、重复 ID 负例、目录分组及真实顾问路由的离线规则回退通过，网络 fetch 由测试拒绝。干净安装、typecheck、lint 与生产 build 通过。当前本地较新的未提交源码也通过了相同导出器的数据/API 回归与 typecheck；没有将它冒充远端已发布代码。

The unmerged patch exports the original full application with 30 fictional devices into a fresh `.demo-app`. Production inputs and scripts are unchanged. Data/API regressions, deterministic generation, clean install, typecheck, lint and production build passed in the isolated default-branch copy. A copy of the newer uncommitted local source also passed data/API regressions and typecheck; it remains unpublished.

本轮 `npm run test:http` 未通过：绑定 `127.0.0.1:3197` 返回 `listen EPERM`，服务器尚未启动。已停止此项，不换端口或绕过权限；没有据此归咎应用，也没有宣称 HTTP、浏览器或视觉验收通过。

HTTP verification remains blocked by `listen EPERM` on loopback. No alternate port or permission workaround was attempted, and no HTTP or visual acceptance is claimed.
