# Implementation Plan: Steps, Timeline, Sparkline, Map, ImageCompare (Lumeo parity)

## Context
Port 5 Lumeo components to Blazor static SSR + Unpoly with minimal bundle, API like lumeo.nativ.sh, reusing existing Stepper/ECharts patterns.

## Changes

### Steps (pure CSS, no JS)
- **File**: `src/Unpoly.Blazor.Shadcn/Components/Steps.razor` + `StepsItem.razor` + `StepsVariants.cs`
- **Change**: Horizontal/Vertical trail, CurrentStep+Clickable+Animated, Status Error, IconContent slot. Renders `data-slot="steps"`/`steps-item` with `data-current`/`data-status`.
- **Reuses**: `UiComponentBase.cs:19` (`Cn` via ClassMerge), `Stepper.razor:1` pattern for Native vs Radix trade-off, `ButtonVariants.cs` for clickable steps styling

### Timeline (pure CSS, no JS)
- **File**: `src/Unpoly.Blazor.Shadcn/Components/Timeline.razor` + `TimelineItem.razor`
- **Change**: Vertical/Horizontal, Alternate layout, ActiveIndex + ActiveIndexChanged, Animated dot/connector. `data-slot="timeline"`/`timeline-item` with `data-active-index`.
- **Reuses**: `Timeline` needs no `up.compiler`; same CSS token `h-control`/`text-control` via `deviations.json`

### Sparkline (reuse ECharts, 0 new JS)
- **File**: `src/Unpoly.Blazor.Shadcn.ECharts/Components/ESparkline.razor` (and thin `Sparkline.razor` wrapper in core that forwards to ECharts if referenced, else inline SVG fallback)
- **Change**: Props `Data`, `Type=line/area/bars`, `ShowArea`, `ShowDots`, `StrokeWidth`, `Color`. Renders tiny ECharts `grid:0, xAxis hidden, yAxis hidden, series: line/area/bars` via existing `EChart.razor:21` (`data-echarts` + `data-options`). Lazy-load via `echarts.js:55` already.
- **Reuses**: `EChart.razor:21`, `EChartsOption.cs:11`, `shadc.../ECharts/echarts.js:55` lazy-loader

### Map (separate package, lazy MapLibre GL)
- **File**: `src/Unpoly.Blazor.Shadcn.Maps/Map.razor` + `MapMarker.razor` + subcomponents (`Map.razor.cs` for JS interop helpers)
- **Change**: Props `Center [lat,lon], Zoom, Style=Auto->follows data-theme, Markers, Popups`. Creates new project `Unpoly.Blazor.Shadcn.Maps` with `wwwroot/map/map.js` (`up.compiler('[data-map]' lazy-load maplibre-gl@4 from unpkg + window.lumeoCdn override)`.
- **Reuses**: `ECharts` separation pattern: `src/Unpoly.Blazor.Shadcn.ECharts/Unpoly.Blazor.Shadcn.ECharts.csproj:1` as template; `ui.js:24` IIFE + destructor pattern for `loadScript`

### ImageCompare (Web Component, 3KB)
- **File**: `src/Unpoly.Blazor.Shadcn/Components/ImageCompare.razor` + `wwwroot/image-compare/img-comparison-slider.js` (vendored from sneas/img-comparison-slider@8)
- **Change**: Props `BeforeSrc, AfterSrc, BeforeLabel, AfterLabel, Orientation=horizontal/vertical, InitialPosition=50, ShowLabels`. Renders `<img-comparison-slider><img slot="first">...` and `up.compiler` registers WC if needed. No extra package, lazy-load WC via `loadScript` only when `[data-slot="image-compare"]` present.
- **Reuses**: `ui.js:24` lazy-loader `loadScript`, `AspectRatio.razor` pattern for sizing

## Implementation Sequence
1. Add `Unpoly.Blazor.Shadcn.Maps` project + update `Unpoly.Blazor.Shadcn.slnx` + `deviations.json` if needed (Steps/Timeline pure CSS, no deviation)
2. Vendor `maplibre-gl.js/css` stub + `img-comparison-slider` WC + create `Steps/Timeline` Razor (no JS)
3. Create `ESparkline` + core `Sparkline` fallback SVG, reuse ECharts lazy path
4. Implement `Map` + `ImageCompare` with `up.compiler` lazy loaders and theme-aware colors
5. Demo pages `/components/steps|timeline|sparkline|map|image-compare` + update `DocNav.razor:58` + the `check-pages` .NET command OURS

## Edge Cases & Risks
- Map without API key: MapLibre needs style URL; default `https://demotiles.maplibre.org/style.json` + provider switch via `AdditionalAttributes` and `window.lumeoCdn` self-host path — document in `/privacy`
- Sparkline in Table cell: test `overflow-hidden` container 80px width, SVG must not stretch
- Steps clickable accessibility: need `role="list"` + `aria-current="step"` on active `StepsItem`

## Verification
`dotnet build` then `dotnet test tests/Unpoly.Blazor.Shadcn.Tests --filter Steps` + manual `up.compiler` check in demo at `/components/steps` etc.
