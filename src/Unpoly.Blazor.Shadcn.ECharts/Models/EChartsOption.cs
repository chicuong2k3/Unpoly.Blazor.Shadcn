using System.Text.Json.Serialization;

namespace Unpoly.Blazor.Shadcn.ECharts.Models;

// ---------------------------------------------------------------------------
// ECharts option surface — intentionally shallow. Callers who need more can
// pass an anonymous object or raw JSON via EChart.Options / OptionsJson.
// This covers the examples at https://echarts.apache.org/en/index.html
// ---------------------------------------------------------------------------

public sealed class EChartsOption
{
    [JsonPropertyName("title")] public EChartsTitle? Title { get; set; }
    [JsonPropertyName("tooltip")] public EChartsTooltip? Tooltip { get; set; }
    [JsonPropertyName("legend")] public EChartsLegend? Legend { get; set; }
    [JsonPropertyName("grid")] public EChartsGrid? Grid { get; set; }
    [JsonPropertyName("xAxis")] public object? XAxis { get; set; }
    [JsonPropertyName("yAxis")] public object? YAxis { get; set; }
    [JsonPropertyName("polar")] public object? Polar { get; set; }
    [JsonPropertyName("radiusAxis")] public object? RadiusAxis { get; set; }
    [JsonPropertyName("angleAxis")] public object? AngleAxis { get; set; }
    [JsonPropertyName("radar")] public EChartsRadar? Radar { get; set; }
    [JsonPropertyName("dataset")] public object? Dataset { get; set; }
    [JsonPropertyName("series")] public EChartsSeries[]? Series { get; set; }
    [JsonPropertyName("color")] public string[]? Color { get; set; }
    [JsonPropertyName("backgroundColor")] public string? BackgroundColor { get; set; }
    [JsonPropertyName("animation")] public bool? Animation { get; set; }
    [JsonPropertyName("animationDuration")] public int? AnimationDuration { get; set; }
    [JsonPropertyName("animationEasing")] public string? AnimationEasing { get; set; }
    [JsonPropertyName("dataZoom")] public object? DataZoom { get; set; }
    [JsonPropertyName("toolbox")] public object? Toolbox { get; set; }
    [JsonPropertyName("visualMap")] public object? VisualMap { get; set; }
    [JsonPropertyName("axisPointer")] public object? AxisPointer { get; set; }
    [JsonPropertyName("calendar")] public object? Calendar { get; set; }
    [JsonPropertyName("geo")] public object? Geo { get; set; }
    [JsonPropertyName("parallelAxis")] public object? ParallelAxis { get; set; }

    [JsonExtensionData] public Dictionary<string, object?>? ExtensionData { get; set; }
}

public sealed class EChartsTitle
{
    [JsonPropertyName("text")] public string? Text { get; set; }
    [JsonPropertyName("subtext")] public string? Subtext { get; set; }
    [JsonPropertyName("left")] public string? Left { get; set; }
    [JsonPropertyName("textStyle")] public object? TextStyle { get; set; }
}

public sealed class EChartsTooltip
{
    [JsonPropertyName("show")] public bool? Show { get; set; }
    [JsonPropertyName("trigger")] public string? Trigger { get; set; }
    [JsonPropertyName("position")] public object? Position { get; set; }
    [JsonPropertyName("axisPointer")] public object? AxisPointer { get; set; }
    [JsonPropertyName("formatter")] public string? Formatter { get; set; }

    [JsonExtensionData] public Dictionary<string, object?>? ExtensionData { get; set; }
}

public sealed class EChartsLegend
{
    [JsonPropertyName("data")] public string[]? Data { get; set; }
    [JsonPropertyName("top")] public string? Top { get; set; }
    [JsonPropertyName("bottom")] public string? Bottom { get; set; }
    [JsonPropertyName("left")] public string? Left { get; set; }
    [JsonPropertyName("orient")] public string? Orient { get; set; }
    [JsonPropertyName("type")] public string? Type { get; set; }
}

public sealed class EChartsGrid
{
    [JsonPropertyName("left")] public string? Left { get; set; }
    [JsonPropertyName("right")] public string? Right { get; set; }
    [JsonPropertyName("top")] public string? Top { get; set; }
    [JsonPropertyName("bottom")] public string? Bottom { get; set; }
    [JsonPropertyName("containLabel")] public bool? ContainLabel { get; set; }
}

public sealed class EChartsAxis
{
    [JsonPropertyName("type")] public string? Type { get; set; }
    [JsonPropertyName("data")] public object? Data { get; set; }
    [JsonPropertyName("name")] public string? Name { get; set; }
    [JsonPropertyName("boundaryGap")] public object? BoundaryGap { get; set; }
    [JsonPropertyName("axisLabel")] public object? AxisLabel { get; set; }
    [JsonPropertyName("axisLine")] public object? AxisLine { get; set; }
    [JsonPropertyName("splitLine")] public object? SplitLine { get; set; }
    [JsonPropertyName("min")] public object? Min { get; set; }
    [JsonPropertyName("max")] public object? Max { get; set; }
}

public sealed class EChartsRadar
{
    [JsonPropertyName("indicator")] public EChartsRadarIndicator[]? Indicator { get; set; }
    [JsonPropertyName("shape")] public string? Shape { get; set; }
    [JsonPropertyName("splitNumber")] public int? SplitNumber { get; set; }
}

public sealed class EChartsRadarIndicator
{
    [JsonPropertyName("name")] public string? Name { get; set; }
    [JsonPropertyName("max")] public double? Max { get; set; }
    [JsonPropertyName("min")] public double? Min { get; set; }
}

public sealed class EChartsSeries
{
    [JsonPropertyName("type")] public string? Type { get; set; }
    [JsonPropertyName("name")] public string? Name { get; set; }
    [JsonPropertyName("data")] public object? Data { get; set; }
    [JsonPropertyName("stack")] public string? Stack { get; set; }
    [JsonPropertyName("smooth")] public object? Smooth { get; set; }
    [JsonPropertyName("areaStyle")] public object? AreaStyle { get; set; }
    [JsonPropertyName("itemStyle")] public object? ItemStyle { get; set; }
    [JsonPropertyName("lineStyle")] public object? LineStyle { get; set; }
    [JsonPropertyName("barWidth")] public string? BarWidth { get; set; }
    [JsonPropertyName("barGap")] public string? BarGap { get; set; }
    [JsonPropertyName("radius")] public object? Radius { get; set; }
    [JsonPropertyName("center")] public string[]? Center { get; set; }
    [JsonPropertyName("label")] public object? Label { get; set; }
    [JsonPropertyName("labelLine")] public object? LabelLine { get; set; }
    [JsonPropertyName("emphasis")] public object? Emphasis { get; set; }
    [JsonPropertyName("encode")] public object? Encode { get; set; }
    [JsonPropertyName("symbol")] public string? Symbol { get; set; }
    [JsonPropertyName("symbolSize")] public object? SymbolSize { get; set; }
    [JsonPropertyName("showSymbol")] public bool? ShowSymbol { get; set; }
    [JsonPropertyName("roseType")] public string? RoseType { get; set; }
    [JsonPropertyName("coordinateSystem")] public string? CoordinateSystem { get; set; }
    [JsonPropertyName("markLine")] public object? MarkLine { get; set; }
    [JsonPropertyName("markPoint")] public object? MarkPoint { get; set; }
    [JsonPropertyName("markArea")] public object? MarkArea { get; set; }
    [JsonPropertyName("rippleEffect")] public object? RippleEffect { get; set; }
    [JsonPropertyName("symbolRepeat")] public object? SymbolRepeat { get; set; }
    [JsonPropertyName("symbolClip")] public object? SymbolClip { get; set; }

    [JsonExtensionData] public Dictionary<string, object?>? ExtensionData { get; set; }
}

public sealed class EChartDataPoint
{
    [JsonPropertyName("value")] public double Value { get; set; }
    [JsonPropertyName("name")] public string? Name { get; set; }

    public EChartDataPoint() { }
    public EChartDataPoint(string name, double value) { Name = name; Value = value; }
}
