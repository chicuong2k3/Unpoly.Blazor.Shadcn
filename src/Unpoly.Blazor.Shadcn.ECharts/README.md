# Unpoly.Blazor.Shadcn.ECharts

Apache ECharts for Blazor static SSR with Unpoly — **separated from the core** so the core ships no charting JS.

The server renders a `<div data-echarts data-options='...'>`; the compiler in `wwwroot/echarts.js` creates, resizes and disposes the ECharts instance on every Unpoly fragment swap. No `IJSRuntime`, no interactivity required.

## Why separate?

The core `Unpoly.Blazor.Shadcn` is copy-in source with zero charting dependency. `echarts.min.js` is ~1 MB minified. Keeping it in `Unpoly.Blazor.Shadcn.ECharts` means apps that use only the `Chart` container + `<table>` fallback never download it or add its `@source`.

## Wiring

```razor
@* App.razor *@
<script src="_content/Unpoly.Blazor.Shadcn.ECharts/echarts/echarts.min.js" defer></script>
<script src="_content/Unpoly.Blazor.Shadcn/ui.js" defer></script>
<script src="_content/Unpoly.Blazor.Shadcn.ECharts/echarts.js" defer></script>
```

```css
/* app.css */
@import "tailwindcss";
@import "../../Unpoly.Blazor.Shadcn/Styles/ui.css";
@source "../../Unpoly.Blazor.Shadcn.ECharts/Components/**/*.razor";
@source "../../Unpoly.Blazor.Shadcn.ECharts/wwwroot/echarts.js";
```

## Usage

### Free-form (same JSON as echarts.org)

```razor
@using Unpoly.Blazor.Shadcn.ECharts.Components

<EChart Height="350px" Options="@Options" />

@code {
    object Options => new {
        tooltip = new { trigger = "axis" },
        xAxis = new { type = "category", data = new[] { "Mon","Tue","Wed" } },
        yAxis = new { type = "value" },
        series = new[] { new { type = "line", data = new[] { 120, 200, 150 } } }
    };
}
```

Or raw JSON:

```razor
<EChart OptionsJson='{"xAxis":{"type":"category","data":["Mon","Tue"]},"series":[{"type":"bar","data":[5,8]}]}' />
```

### Convenience wrappers

```razor
<EBarChart Categories="@cats" Values="@vals" SeriesName="Revenue" />
<ELineChart Categories="@cats" Values="@vals" Smooth />
<EAreaChart Categories="@cats" Values="@vals" />
<EPieChart Data="@pieData" />
<EDonutChart Data="@pieData" />
<ERadarChart Indicators="@indicators" Values="@vals" />
<EScatterChart Data="@scatter" />
```

All wrappers forward `Height`, `Width`, `Theme`, `Class`, and `AdditionalAttributes` (so `up-target` etc. work).

## Theming

When `Color` / `color` is not set, the JS compiler injects shadcn `--chart-1..5` so a theme change moves the chart without re-serializing. Override with `Color` or `Options.color`.

## Unpoly safety

The compiler is an `up.compiler('[data-echarts]')` wrapped in an IIFE and returning a destructor (disconnects `MutationObserver`/`ResizeObserver`, disposes the chart). It survives fragment swaps and nesting.

## Contents

- `Components/EChart.razor` — base renderer
- `Components/EBarChart.razor`, `ELineChart.razor`, `EAreaChart.razor`, `EPieChart.razor`, `EDonutChart.razor`, `ERadarChart.razor`, `EScatterChart.razor`
- `Models/EChartsOption.cs`, `EChartsJson.cs`, `EChartsTheme.cs`
- `wwwroot/echarts.js` — compiler
- `wwwroot/echarts/echarts.min.js` — vendored ECharts 5.x
