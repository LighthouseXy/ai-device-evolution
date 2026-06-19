---
name: device-scope-patterns
description: Coding patterns extracted from device-scope (数码观察站) — Next.js + React + Tailwind CSS data comparison app
version: 1.0.0
source: codebase-analysis
analyzed_files: 7
stack: Next.js 16 / React 19 / Tailwind CSS 4 / TypeScript 5
---

# DeviceScope Patterns

## Project Overview

数码观察站 (DeviceScope) is a multi-brand device spec comparison, generational evolution analysis, and next-gen configuration prediction tool. Currently Apple-only (iPhone/iPad/MacBook), with plans to expand.

## Code Architecture

```
src/
├── app/                      # Next.js App Router
│   ├── globals.css           # Tailwind imports + CSS custom properties
│   ├── icon.svg              # App icon
│   ├── layout.tsx            # Root layout (Server Component, zh-CN locale)
│   └── page.tsx              # Home page (Server Component wrapper)
├── components/               # UI components (PascalCase.tsx)
│   └── DeviceWorkbench.tsx   # Core workbench — single large component
├── lib/                      # Data processing & utilities
│   └── devices.ts            # Type defs, data queries, formatters, stats
└── data/                     # Static data sources
    └── devices.json          # ~50+ Apple device records (flat JSON array)
```

## Key Patterns

### 1. Server/Client Component Split

- **Root layout** (`src/app/layout.tsx`): Server Component — exports `metadata`, wraps children in `<html lang="zh-CN">`
- **Page** (`src/app/page.tsx`): Server Component — thin wrapper, imports and renders a client component
- **Interactive components**: Marked with `"use client"` at the top of the file

```typescript
// ✅ page.tsx — thin Server Component wrapper
import DeviceWorkbench from "@/components/DeviceWorkbench";
export default function Home() {
  return <DeviceWorkbench />;
}

// ✅ DeviceWorkbench.tsx starts with
"use client";
```

### 2. Type Definitions with Discriminated Unions

Types are defined in `src/lib/devices.ts` alongside the data they describe:

```typescript
// Category union — used to branch UI and data logic
export type DeviceCategory = "phone" | "tablet" | "laptop";

// Tier union — used for filtering and grouping
export type DeviceTier =
  | "base" | "mini" | "air" | "pro" | "pro_max"
  | "m" | "m_pro" | "m_max";

// Main data interface — flat fields + nested specs Record
export type Device = {
  id: string;
  brand: string;
  category: DeviceCategory;
  series: string;
  tier: DeviceTier;
  // ... top-level fields for trends/charts
  specs?: DeviceSpecs;  // Record<string, string | number | boolean | undefined>
};
```

**Pattern**: Top-level fields are used for charting/trends. The `specs` Record holds category-specific details accessed via helper functions like `specText()`.

### 3. Data Loading Pattern

Static JSON is imported and cast to the typed array:

```typescript
import devices from "@/data/devices.json";
export const allDevices = devices as Device[];
```

No runtime validation — TypeScript trust. This is a read-only data display app.

### 4. Config-Driven UI

The workbench uses **configuration arrays** to drive the comparison UI:

```typescript
// Each category is a config object with label, specs array, and getValue functions
const phoneCategories: ComparisonCategory[] = [
  {
    key: "price",
    label: "💰 价格",
    specs: [
      { label: "首发价格", getValue: (device) => formatMaybeCurrency(device.launchPrice) },
      // ...
    ],
  },
  // ... 7 more categories
];
```

**Pattern**: Define a `ComparisonCategory` type, create separate config arrays per device category (`phoneCategories`, `tabletCategories`, `laptopCategories`), and select the right one with `getComparisonCategories(category)`.

### 5. Helper Function Naming Convention

| Function | Purpose |
|----------|---------|
| `specText(device, key)` | Get string value from specs, returns `"待补充"` (pending) if missing |
| `specOptional(device, key)` | Get optional value, returns `undefined` if missing (no pending fallback) |
| `firstAvailable(device, keys)` | Try multiple keys, return first non-pending value |
| `cameraValue(device)` | Domain-specific getter with fallback logic |
| `weightValue(device)` | Domain-specific getter with fallback logic |

### 6. useMemo for All Derived State

Every computed/derived value uses `useMemo`. No inline computations in JSX:

```typescript
const availableSeries = useMemo(
  () => getSeriesByCategory(selectedCategory),
  [selectedCategory]
);
const comparisonDevices = useMemo(() => { /* filter + sort */ }, [range, seriesDevices]);
```

### 7. CSS Architecture

`src/app/globals.css` uses Tailwind 4's `@import` and CSS custom properties:

```css
@import "tailwindcss";

:root {
  --primary: #3B82F6;
  --text: #1E293B;
  --border: #E8E4DC;
}

@theme inline {
  --color-background: var(--bg-start);
  --font-sans: "Inter", "SF Pro Display", ...;
}
```

Reusable utility classes (not in Tailwind config):
- `.card` — rounded container with border and shadow
- `.gradient-title` — blue gradient text via `background-clip: text`
- `.glow-active` — focus ring glow effect
- `.dot-live` — pulsing animation for "live" indicators

### 8. SVG Chart Pattern

Charts use raw SVG (no library) with `viewBox="0 0 100 80"` coordinate system:

```typescript
function TrendChart({ devices, metric }: { devices: Device[]; metric: MetricConfig }) {
  // 1. Filter to numeric points
  // 2. Calculate Y-axis range (custom for AI: 0-10)
  // 3. Map data points to SVG coordinates
  // 4. Draw smooth bezier curve path
  // 5. Render Y-axis ticks + data point labels
}
```

### 9. Chinese + English Conventions

- **Code identifiers**: English (`selectedCategory`, `formatCurrency`)
- **Comments**: Chinese with `// ====================` section dividers
- **UI text**: Chinese (labels, descriptions, placeholders)
- **Pending/fallback text**: `"待补充"`

### 10. Import Alias

Uses Next.js default `@/*` path alias for src imports:

```json
{ "paths": { "@/*": ["./src/*"] } }
```

## Adding Features

### Add a New Device
1. Add JSON object to `src/data/devices.json` following existing structure
2. Ensure `category`, `series`, `tier`, `generation`, and all required fields are present
3. UI auto-updates — all queries derive from `allDevices`

### Add a New Product Category
1. Add category string to `DeviceCategory` type in `src/lib/devices.ts`
2. Create `xxxCategories: ComparisonCategory[]` config (8 sections, matching existing pattern)
3. Add to `getComparisonCategories()` switch
4. Update `categoryLabels` with Chinese label
5. Add devices to `devices.json`

### Add a New Chart Metric
1. Add key to `MetricKey` type union
2. Add `MetricConfig` entry to `metricConfigs` array
3. Add button to `quickMetrics` array

## TypeScript Settings

- **strict**: true
- **moduleResolution**: bundler
- **jsx**: react-jsx
- **path alias**: `@/*` → `./src/*`

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| next | 16.2.9 | Framework |
| react | 19.2.4 | UI library |
| tailwindcss | ^4 | CSS framework |
| typescript | ^5 | Type checking |
| eslint-config-next | 16.2.9 | Linting |
