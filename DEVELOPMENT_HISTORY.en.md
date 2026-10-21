# Development history

[简体中文](DEVELOPMENT_HISTORY.md) | [English](DEVELOPMENT_HISTORY.en.md) · [Project overview](README.en.md)

This record is based on commits reachable from the current remote `main` and their actual file differences. At the reviewed baseline `9598ef2`, 190 commits are reachable: the first snapshot is dated 2026-06-19, and functional/data maintenance continues through 2026-10-17. The presentation and licensing work on 2026-10-21 is listed separately. Dates use Git committer time in UTC, which can differ by a day from local dates in commit subjects.

These are selected changes, not a complete release log. Commit links retain the repository’s current access restrictions; they do not establish software releases, community adoption or third-party redistribution rights. Adding a test script does not prove a historical passing run. Uncommitted local changes and isolated demo candidates are excluded from published progress.

## Initial snapshot

| UTC date | Substantive change verified in the diff | Commit |
| --- | --- | --- |
| 2026-06-19 | Initial checked-in snapshot: the Next/React project, device workbench, device records and field dictionary entered Git. This is a snapshot date, not an inferred earlier development or launch date. | [119fb65](https://github.com/LighthouseXy/ai-device-evolution/commit/119fb65f2be1e6fe4d9a97f10da0de6ec1f5e018) |

## Feature and data development

| UTC date | Substantive change verified in the diff | Commit |
| --- | --- | --- |
| 2026-06-27 | Added the structured AI analysis endpoint, request-field validation and result normalization in the API route and analysis library. | [e58edaf](https://github.com/LighthouseXy/ai-device-evolution/commit/e58edaf47a72a8de6efc8c2b05703f9c08ec925e) |
| 2026-06-28 | Added budget, category and use-case inputs to the advisor panel, connected it to the advisor API and revised candidate recommendation logic. | [8213af3](https://github.com/LighthouseXy/ai-device-evolution/commit/8213af326500a893bca546159a196d0bd71ee7b4) |
| 2026-07-03 | Rebuilt the home page and added catalog and device-detail routes, including category filtering and separate detail views. | [4f1a17e](https://github.com/LighthouseXy/ai-device-evolution/commit/4f1a17ed18a19a365bbd05c178a3469a731d57b7) |
| 2026-08-25 | Matched comparison prices to memory/storage configurations, updated the comparison page and series selector, and added data audit conditions. | [0fa173c](https://github.com/LighthouseXy/ai-device-evolution/commit/0fa173cdb368f930b5c0336e0165d701784c1aad) |
| 2026-08-30 | Added the price-snapshot workflow and its regression script, together with data-audit updates and execution commands. | [4d12967](https://github.com/LighthouseXy/ai-device-evolution/commit/4d129674a6994fc11dc4957b8335e6f74509ef78) |
| 2026-09-06 | Added a manifest-driven multi-brand database builder, validating brand and source-to-device correspondence and connecting the generated data to the app. | [b197c79](https://github.com/LighthouseXy/ai-device-evolution/commit/b197c792761372bee4884a3f75db2def3679d60b) |
| 2026-10-07 | Expanded the multi-brand catalog and collection/build scripts, adding catalog-coverage, image-availability and model regression checks. This records code/data changes; it does not establish redistribution rights for third-party materials. | [d1f3f4d](https://github.com/LighthouseXy/ai-device-evolution/commit/d1f3f4d94347643924d0cb1f7a43ce03cf16edc0) |
| 2026-10-07 | Unified the comparison entry point with a same-category 2–3-device selection and URL-preserved choices; introduced detail galleries and per-configuration prices, with corresponding catalog/trend filter updates. | [e149c2b](https://github.com/LighthouseXy/ai-device-evolution/commit/e149c2b6ccfe6f05af4dca55b28c6abf37407541) |

## Maintenance and quality improvements

| UTC date | Substantive change verified in the diff | Commit |
| --- | --- | --- |
| 2026-06-30 | Added an advisor evaluation script and fixed-input fixtures, including an offline evaluation entry point. Script addition is recorded here without claiming a historical passing run. | [31fef2b](https://github.com/LighthouseXy/ai-device-evolution/commit/31fef2b7a698e39c796eca0cc49e257953729dd6) |
| 2026-07-04 | Split the advisor API service and analysis rules/normalization modules, extracted a TypeScript test loader and added an analysis regression script. | [d2480fa](https://github.com/LighthouseXy/ai-device-evolution/commit/d2480fa140737722013ef269d249cf0a7abf560e) |
| 2026-08-30 | Added bounded retries and timeouts to price fetching for 408, 429 and server errors, with corresponding regression assertions. | [d011c0c](https://github.com/LighthouseXy/ai-device-evolution/commit/d011c0c5f7d2adc3b3ab3b5a228e3c155e892e96) |
| 2026-09-06 | Strengthened cross-brand quality checks for source-registry consistency, trusted hosts, required specifications, price metadata and benchmark metadata. | [88c643e](https://github.com/LighthouseXy/ai-device-evolution/commit/88c643e2c691289afd2fafd1fbf8ab175d954894) |
| 2026-09-06 | Added brand, memory, configurations and camera-benchmark protocol information to advisor facts; the prompt warns against directly comparing scores from different protocols. | [6b22941](https://github.com/LighthouseXy/ai-device-evolution/commit/6b2294142de7b62f2c220aa9094bac2fcdec42e4) |
| 2026-10-07 | Bound advisor quote selection to configurations and minimum memory/storage requirements, with budget, fact-review and evaluation coverage. | [5ccd335](https://github.com/LighthouseXy/ai-device-evolution/commit/5ccd33597ea4407c248c6c9c5a2cc2256c45cabd) |
| 2026-10-17 | Synchronized catalog and image registrations, added image-policy auditing and catalog pagination/filter regressions. Image auditing distinguishes recorded, unverified and missing states; it is not copyright clearance. | [7212cb4](https://github.com/LighthouseXy/ai-device-evolution/commit/7212cb4af8464ecb0c81774fe45ecb30fd58bc0e) |

## Presentation, documentation and licensing

| UTC date | Substantive change verified in the diff | Commit |
| --- | --- | --- |
| 2026-10-21 | Published linked Chinese/English READMEs and seven feature screenshots, with source and known-issue notes; application functionality was unchanged. | [27658be](https://github.com/LighthouseXy/ai-device-evolution/commit/27658bed7ebe1712e4996aa8cc8428e047947202) |
| 2026-10-21 | Published MIT terms for original software and technical documentation, path scope and third-party notices, aligning package license fields; production data and third-party materials were not blanket-relicensed under MIT. | [9598ef2](https://github.com/LighthouseXy/ai-device-evolution/commit/9598ef2f0e2a242cae80a6ab6a192d07ac206aaf) |

## Current boundaries

- The website UI remains primarily Chinese; bilingual READMEs do not imply website internationalization.
- A recorded home-page series-summary display issue remains pending; see [known issues](docs/OPEN_SOURCE_KNOWN_ISSUES.md).
- Original code and technical documentation use [MIT](LICENSE). Third-party materials and production databases retain their own rights; see [license scope](LICENSE_SCOPE.md) and [third-party notices](THIRD_PARTY_NOTICES.md).
