# 完整应用合成演示

这是现有仓库中原应用的隔离演示，保留原路由、组件与默认生产数据路径。在仓库根执行：

```sh
npm ci --ignore-scripts --no-audit --no-fund
node scripts/export-demo.mjs
cd .demo-app
npm ci --ignore-scripts --no-audit --no-fund
npm run validate:data
npm run test:data
npm run typecheck
npm run lint
npm run build
npm run test:http
```

有完整缓存时可给两处 ci 加 `--offline`。启动用 `npm start -- --hostname 127.0.0.1`；开发用 `npm run dev -- --hostname 127.0.0.1`。本轮 HTTP 因环境 listen EPERM 未完成，其余上述检查通过。仅在允许监听 loopback 的环境运行 HTTP 测试。

导出器只创建固定新目录 .demo-app，存在则拒绝。源 src/data、页面/组件、默认 package scripts 和原有素材不变；根目录只增加脚本/原创样例及 .gitignore、TypeScript 和 ESLint 的生成目录忽略项。发行副本保留原路由组件；仅修改虚构品牌标签、数据说明、默认系列回退、空 JSON 类型断言、禁用远程字体及自建几何图标，不重排布局。SOURCE_MANIFEST.json 列出逐文件来源/发行哈希，数据可重复生成。

原软件、原创文档、自建虚构数据和图标采用 MIT；依赖保持原许可，安装后的 LICENSE/NOTICE 必须保留。无第三方产品图或生产长摘录；图片元数据留空，使用原缺图组件。标准启动包装器清空 provider keys，拒绝真实 .env 文件，走已有规则回退；无模型调用。无需 root 新环境变量或外部服务权限。

已登记首页系列摘要问题未修复，不能用合成数据宣称 bug 已解决。本演示不删除或清理现有仓库/可达历史中的第三方材料，也不改变仓库可见性。
