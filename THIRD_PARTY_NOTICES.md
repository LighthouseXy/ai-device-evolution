# Third-party notices / 第三方许可说明

The root MIT license covers project-owned software and original technical documentation only. It does not replace dependency, font, media, database or hardware licenses. Existing notices and copyrights remain applicable.

## Direct dependencies at the reviewed remote baseline

The following entries are declarations from package.json and the existing package-lock.json, not new licenses granted by this project. The root MIT change leaves every non-root lockfile package entry unchanged. Transitive packages keep the terms recorded in the lockfile and their own distributed LICENSE/NOTICE files.

| Package | Requested | Locked version | Lockfile license declaration |
| --- | --- | --- | --- |
| `next` | `16.2.9` | `16.2.9` | MIT |
| `react` | `19.2.4` | `19.2.4` | MIT |
| `react-dom` | `19.2.4` | `19.2.4` | MIT |
| `@tailwindcss/postcss` | `^4` | `4.3.1` | MIT |
| `@types/node` | `^20` | `20.19.43` | MIT |
| `@types/react` | `^19` | `19.2.17` | MIT |
| `@types/react-dom` | `^19` | `19.2.3` | MIT |
| `eslint` | `^9` | `9.39.4` | MIT |
| `eslint-config-next` | `16.2.9` | `16.2.9` | MIT |
| `tailwindcss` | `^4` | `4.3.1` | MIT |
| `typescript` | `^5` | `5.9.3` | Apache-2.0 |

The dependency implementations are obtained separately by the existing package manager workflow; this license-only commit does not vendor or relicense their code. Retain the upstream LICENSE/NOTICE files when distributing installed dependencies or a built artifact. Where a declaration is missing, consult that exact upstream package rather than infer MIT from this repository.

## Fonts and other assets

The existing UI may request third-party web fonts through its unchanged stylesheet. No local font binary is identified in this remote baseline. Font software, glyphs and service terms remain upstream rights; this project's MIT does not cover them. No font file, reference, notice or application stylesheet is changed by this commit.

Production data, image mappings, product photos, logos, screenshots, source-page excerpts, audiovisual resources and hardware are separately governed. In particular, the seven showcase screenshots retain the source and rights descriptions in [their documentation](docs/screenshots/ai-device/README.md); product-photo rights are not transferred by screenshot authorization. Unknown media rights remain unknown.

See [LICENSE_SCOPE.md](LICENSE_SCOPE.md) and [LICENSE_SCOPE.json](LICENSE_SCOPE.json) for the version-bound software/document scope and excluded actual paths. This is not a blanket clearance of all website assets.


## Full-application synthetic demonstration

The original `examples/demo-devices.json`, `examples/demo-prices.json`, demo scripts and generated geometric icon use project MIT. The exporter does not copy production JSON, product photos, screenshots, long source extracts, fonts or real environment files. It retains package-lock dependency declarations, and dependency installation retains upstream LICENSE/NOTICE files. Exporting a demo does not remove or relicense third-party contents already in this repository or its history.
