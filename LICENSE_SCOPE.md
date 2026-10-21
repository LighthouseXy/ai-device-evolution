# MIT license scope / MIT 许可范围

本仓库的原创软件代码和原创技术文档采用根 [LICENSE](LICENSE) 的标准 MIT，版权主体为 `Copyright (c) 2026 LighthouseXy`。MIT 允许商业使用、修改和再分发，须保留版权及许可声明；本项目不在该软件许可范围内附加非商业限制。

Original project software and original technical-document portions are MIT licensed. Third-party materials retain their own terms. The project MIT grant does not license a third party's code, trademarks, photos, databases, fonts, audiovisual work or hardware merely because they appear in this repository. Private repository status is not an additional MIT condition.

## Exact version and paths

This inventory was checked against default-branch baseline `2a44a9f1927dbc3d0a827a54f6845c3028df270a`, plus the demo addon and scope/doc updates introduced together. Only original portions are granted under MIT. See [LICENSE_SCOPE.json](LICENSE_SCOPE.json) for exact categories.

### First-party software

- `eslint.config.mjs`
- `next-env.d.ts`
- `next.config.ts`
- `postcss.config.mjs`
- `scripts/ai-analysis-eval.mjs`
- `scripts/ai-analysis-regression.mjs`
- `scripts/audit-catalog-coverage.mjs`
- `scripts/audit-device-data-quality.mjs`
- `scripts/audit-image-availability.mjs`
- `scripts/audit-image-policy.mjs`
- `scripts/build-device-database.mjs`
- `scripts/catalog-list-regression.mjs`
- `scripts/compare-configuration-regression.mjs`
- `scripts/device-advisor-ai-eval.mjs`
- `scripts/device-advisor-api-regression.mjs`
- `scripts/device-advisor-regression.mjs`
- `scripts/device-model-regression.mjs`
- `scripts/lib/advisor-fact-review.mjs`
- `scripts/lib/android-official-specs.mjs`
- `scripts/lib/apple-memory.mjs`
- `scripts/lib/apple-ports.mjs`
- `scripts/lib/device-images.mjs`
- `scripts/lib/dxomark-snapshot.mjs`
- `scripts/lib/fetch-with-retry.mjs`
- `scripts/lib/google-device.mjs`
- `scripts/lib/ji-used-item.mjs`
- `scripts/lib/load-ts-module.mjs`
- `scripts/lib/normalize-product-name.mjs`
- `scripts/lib/price-date.mjs`
- `scripts/lib/price-plan.mjs`
- `scripts/lib/source-snapshot.mjs`
- `scripts/lib/zol-device.mjs`
- `scripts/price-snapshot-workflow-regression.mjs`
- `scripts/price-snapshot-workflow.mjs`
- `scripts/source-snapshot-regression.mjs`
- `scripts/sync-android-five-year-batch2.mjs`
- `scripts/sync-android-five-year-batch3.mjs`
- `scripts/sync-android-five-year-batch4.mjs`
- `scripts/sync-android-five-year-batch5.mjs`
- `scripts/sync-android-five-year-batch6.mjs`
- `scripts/sync-android-five-year.mjs`
- `scripts/sync-android-official-fields.mjs`
- `scripts/sync-android-reference-fields.mjs`
- `scripts/sync-apple-zh-cn-data.mjs`
- `scripts/sync-device-images.mjs`
- `scripts/sync-google-devices.mjs`
- `scripts/sync-honor-magic-pro.mjs`
- `scripts/sync-huawei-expansion.mjs`
- `scripts/sync-huawei-five-year.mjs`
- `scripts/sync-huawei-mate-pro.mjs`
- `scripts/sync-huawei-matebook-14-2024.mjs`
- `scripts/sync-huawei-matepad-11-5.mjs`
- `scripts/sync-huawei-pura-ultra.mjs`
- `scripts/sync-huawei-tablet-official.mjs`
- `scripts/sync-oppo-find-x-ultra.mjs`
- `scripts/sync-redmi-book-14.mjs`
- `scripts/sync-samsung-batch2.mjs`
- `scripts/sync-samsung-batch3.mjs`
- `scripts/sync-samsung-batch4.mjs`
- `scripts/sync-samsung-batch5.mjs`
- `scripts/sync-samsung-camera-fields.mjs`
- `scripts/sync-samsung-galaxy-s-ultra.mjs`
- `scripts/sync-samsung-history.mjs`
- `scripts/sync-vivo-x-ultra.mjs`
- `scripts/sync-wearable-devices.mjs`
- `scripts/sync-xiaomi-camera-fields.mjs`
- `scripts/sync-xiaomi-computing-expansion.mjs`
- `scripts/sync-xiaomi-history-batch2.mjs`
- `scripts/sync-xiaomi-history-batch3.mjs`
- `scripts/sync-xiaomi-history-batch4.mjs`
- `scripts/sync-xiaomi-history-batch5.mjs`
- `scripts/sync-xiaomi-history.mjs`
- `scripts/sync-xiaomi-pad-standard.mjs`
- `scripts/sync-xiaomi-phone-expansion.mjs`
- `scripts/sync-xiaomi-ultra-pilot.mjs`
- `scripts/validate-device-taxonomy.mjs`
- `scripts/wearable-regression.mjs`
- `src/app/advisor/page.tsx`
- `src/app/api/ai-analysis/route.ts`
- `src/app/api/dev/device-advisor-eval/route.ts`
- `src/app/api/device-advisor/route.ts`
- `src/app/compare/custom/page.tsx`
- `src/app/compare/page.tsx`
- `src/app/dev/device-advisor-eval/page.tsx`
- `src/app/devices/[id]/page.tsx`
- `src/app/devices/page.tsx`
- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/app/loading.tsx`
- `src/app/page.tsx`
- `src/app/trends/page.tsx`
- `src/components/CompareSeriesSelect.tsx`
- `src/components/CustomCompareContent.tsx`
- `src/components/CustomCompareSelectors.tsx`
- `src/components/DeviceAdvisorEvalDashboard.tsx`
- `src/components/DeviceAdvisorEvalParts.tsx`
- `src/components/DeviceAdvisorPanel.tsx`
- `src/components/DeviceAdvisorResult.tsx`
- `src/components/DeviceCatalog.tsx`
- `src/components/DeviceCatalogFilters.tsx`
- `src/components/DeviceImage.tsx`
- `src/components/DevicePhotoZoom.tsx`
- `src/components/DeviceSeriesTrendExplorer.tsx`
- `src/components/DeviceSpecGrid.tsx`
- `src/components/ProductCompareTable.tsx`
- `src/components/layout/PageHeader.tsx`
- `src/components/layout/SectionHeader.tsx`
- `src/components/layout/SiteFooter.tsx`
- `src/components/layout/SiteNav.tsx`
- `src/components/layout/TickDivider.tsx`
- `src/lib/ai-analysis-normalize.ts`
- `src/lib/ai-analysis-rules.ts`
- `src/lib/ai-analysis-types.ts`
- `src/lib/ai-analysis-utils.ts`
- `src/lib/ai-analysis.ts`
- `src/lib/catalog-list.ts`
- `src/lib/catalog-order.ts`
- `src/lib/comparison-selection.ts`
- `src/lib/device-advisor-ai-types.ts`
- `src/lib/device-advisor-ai.ts`
- `src/lib/device-advisor-deepseek.ts`
- `src/lib/device-advisor-eval.ts`
- `src/lib/device-advisor-normalize.ts`
- `src/lib/device-advisor-openai.ts`
- `src/lib/device-advisor-rules.ts`
- `src/lib/device-advisor-types.ts`
- `src/lib/device-advisor-utils.ts`
- `src/lib/device-advisor.ts`
- `src/lib/device-categories.ts`
- `src/lib/device-configurations.ts`
- `src/lib/device-images.ts`
- `src/lib/device-models.ts`
- `src/lib/device-spec-fields.ts`
- `src/lib/devices-db.ts`
- `src/lib/number-format.ts`
- `src/lib/page-navigation.ts`
- `src/lib/photo-zoom.ts`
- `src/lib/use-session-state.ts`

### Original technical documentation

- `.claude/skills/device-scope-patterns.md` — original project-authored portions only; third-party quotations and embedded materials retain their rights.
- `LICENSE` — original project-authored portions only; third-party quotations and embedded materials retain their rights.
- `LICENSE_SCOPE.json` — original project-authored portions only; third-party quotations and embedded materials retain their rights.
- `LICENSE_SCOPE.md` — original project-authored portions only; third-party quotations and embedded materials retain their rights.
- `README.en.md` — original project-authored portions only; third-party quotations and embedded materials retain their rights.
- `README.md` — original project-authored portions only; third-party quotations and embedded materials retain their rights.
- `THIRD_PARTY_NOTICES.md` — original project-authored portions only; third-party quotations and embedded materials retain their rights.
- `THREAD_RULES.md` — original project-authored portions only; third-party quotations and embedded materials retain their rights.
- `docs/FUTURE_FEATURES.md` — original project-authored portions only; third-party quotations and embedded materials retain their rights.
- `docs/OPEN_SOURCE_KNOWN_ISSUES.md` — original project-authored portions only; third-party quotations and embedded materials retain their rights.
- `docs/PROJECT_PLAN.md` — original project-authored portions only; third-party quotations and embedded materials retain their rights.
- `docs/README.md` — original project-authored portions only; third-party quotations and embedded materials retain their rights.
- `docs/apple-official-sources.md` — original project-authored portions only; third-party quotations and embedded materials retain their rights.
- `docs/archive/field-dictionary-v2.1.md` — original project-authored portions only; third-party quotations and embedded materials retain their rights.
- `docs/field-dictionary.md` — original project-authored portions only; third-party quotations and embedded materials retain their rights.
- `docs/logs/2026-07-13.md` — original project-authored portions only; third-party quotations and embedded materials retain their rights.
- `docs/logs/2026-07-22.md` — original project-authored portions only; third-party quotations and embedded materials retain their rights.
- `docs/logs/2026-07-23.md` — original project-authored portions only; third-party quotations and embedded materials retain their rights.
- `docs/logs/2026-07-30.md` — original project-authored portions only; third-party quotations and embedded materials retain their rights.
- `docs/logs/2026-08-30.md` — original project-authored portions only; third-party quotations and embedded materials retain their rights.
- `docs/logs/2026-08-31.md` — original project-authored portions only; third-party quotations and embedded materials retain their rights.
- `docs/logs/2026-10-02.md` — original project-authored portions only; third-party quotations and embedded materials retain their rights.
- `docs/logs/2026-10-07.md` — original project-authored portions only; third-party quotations and embedded materials retain their rights.
- `docs/screenshots/ai-device/README.md` — original project-authored portions only; third-party quotations and embedded materials retain their rights.
- `src/data/README.md` — original project-authored portions only; third-party quotations and embedded materials retain their rights.

### First-party configuration and metadata

- `.gitignore`
- `.vercelignore`
- `package-lock.json`
- `package.json`
- `tsconfig.json`

## Data, media, dependencies and hardware are separate

- Production databases, price records, source records, image mappings and fixture data under `src/data/` and `scripts/fixtures/` are not blanket-MIT software. Source URLs or hashes do not grant redistribution rights. See the excluded exact paths in LICENSE_SCOPE.json and any material-specific notice.
- Product photographs, screenshots, logos and graphical assets under `public/`, `docs/screenshots/`, and `src/app/icon.svg` retain their own rights. The requested GitHub showcase images keep their existing attribution/rights caveats; screenshot-use authorization does not transfer rights in the underlying product photos or marks.
- Project-written screenshot documentation may be MIT prose; the screenshot pixels and referenced third-party material are not relicensed by that documentation.
- Dependencies and any external fonts retain their upstream licenses and copyrights. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). No dependency license entry or existing media/font notice is overwritten.
- No hardware-design file is identified in this baseline. Future or separately supplied hardware, audio/video, firmware resources and other third-party assets are not automatically brought under this software grant.

## Other local review materials

Local review bundles, caches, environment files and research/media additions are not included by this commit. The original full-application exporter, fictional fixtures and validation scripts listed below are included in this repository version.

这次提交仅增加许可与范围/第三方说明、更新中英文 README 许可段落和第一方包许可字段。源码、数据库、媒体、CI、运行行为和仓库可见性不变，不提交申请。


## Included full-application demo addon

The following original software, technical documents and synthetic fixtures are explicitly MIT, in addition to the existing original-software scope:

- `DATA_BOUNDARIES.md`
- `DEMO.md`
- `DEVELOPMENT_HISTORY.en.md`
- `DEVELOPMENT_HISTORY.md`
- `REPRODUCIBILITY.md`
- `examples/demo-devices.json`
- `examples/demo-prices.json`
- `scripts/demo-data-regression.mjs`
- `scripts/demo-http-regression.mjs`
- `scripts/export-demo.mjs`
- `scripts/lib/validate-device-records.mjs`
- `scripts/prepare-demo-data.mjs`
- `scripts/run-demo.mjs`
- `scripts/validate-data.mjs`

`node scripts/export-demo.mjs` creates a separate `.demo-app` containing the original application with fictional inputs. Its self-authored generated JSON and geometric icon are MIT. Installed dependencies and their LICENSE/NOTICE files retain upstream terms. Production `src/data` records, image metadata, photos, screenshots, source quotations and historical third-party materials remain outside the project MIT grant. Nothing is removed from existing reachable history.
