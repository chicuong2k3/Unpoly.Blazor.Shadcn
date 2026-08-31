using Bunit;
using Unpoly.Blazor.Shadcn.ECharts.Components;
using Unpoly.Blazor.Shadcn.ECharts.Models;

namespace Unpoly.Blazor.Shadcn.Tests;

public class EChartsTests : TestContext
{
    [Fact]
    public void EChart_renders_data_echarts_and_options()
    {
        var opts = new { xAxis = new { type = "category", data = new[] { "Mon", "Tue" } }, series = new[] { new { type = "bar", data = new[] { 1, 2 } } } };
        var cut = Render<EChart>(p => p.Add(c => c.Options, opts).Add(c => c.Height, "300px"));
        var div = cut.Find("[data-slot=\"echart\"]");
        Assert.True(div.HasAttribute("data-echarts"));
        Assert.NotNull(div.GetAttribute("data-options"));
        Assert.Contains("bar", div.GetAttribute("data-options"));
    }

    [Fact]
    public void EChart_applies_size_as_style()
    {
        var cut = Render<EChart>(p => p.Add(c => c.Options, new { }).Add(c => c.Height, "400px").Add(c => c.Width, "600px"));
        var style = cut.Find("[data-slot=\"echart\"]").GetAttribute("style");
        Assert.Contains("height:400px", style);
        Assert.Contains("width:600px", style);
    }

    [Fact]
    public void EChart_overflow_visible_so_tooltip_not_clipped()
    {
        var cut = Render<EChart>(p => p.Add(c => c.Options, new { }));
        Assert.Contains("overflow-visible", cut.Find("[data-slot=\"echart\"]").ClassName);
    }

    [Fact]
    public void EBarChart_generates_bar_series()
    {
        var cut = Render<EBarChart>(p => p.Add(c => c.Categories, new[] { "A", "B" }).Add(c => c.Values, new[] { 1.0, 2.0 }));
        var opts = cut.Find("[data-slot=\"echart\"]").GetAttribute("data-options");
        Assert.Contains("\"bar\"", opts);
        Assert.Contains("\"A\"", opts);
    }

    [Fact]
    public void ELineChart_respects_show_legend_and_tooltip()
    {
        var cut = Render<ELineChart>(p => p.Add(c => c.Categories, new[] { "M" }).Add(c => c.Values, new[] { 1.0 }).Add(c => c.ShowLegend, false).Add(c => c.ShowTooltip, false));
        var opts = cut.Find("[data-slot=\"echart\"]").GetAttribute("data-options");
        // legend/tooltip omitted when false -> not in json
        Assert.DoesNotContain("\"legend\"", opts);
    }

    [Fact]
    public void EPieChart_serializes_pie_data()
    {
        var data = new[] { new EChartDataPoint("A", 10), new EChartDataPoint("B", 20) };
        var cut = Render<EPieChart>(p => p.Add(c => c.Data, data));
        var opts = cut.Find("[data-slot=\"echart\"]").GetAttribute("data-options");
        Assert.Contains("\"pie\"", opts);
        Assert.Contains("\"A\"", opts);
    }

    [Fact]
    public void EChart_option_override_merges_via_extension_data()
    {
        var ov = new Dictionary<string, object?> { ["toolbox"] = new { feature = new { saveAsImage = new { } } } };
        var cut = Render<EBarChart>(p => p.Add(c => c.Categories, new[] { "A" }).Add(c => c.Values, new[] { 1.0 }).Add(c => c.OptionOverride, ov));
        Assert.Contains("toolbox", cut.Find("[data-slot=\"echart\"]").GetAttribute("data-options"));
    }

    [Fact]
    public void ECharts_is_loading_renders_skeleton_not_chart()
    {
        var cut = Render<EBarChart>(p => p.Add(c => c.Categories, new[] { "A" }).Add(c => c.Values, new[] { 1.0 }).Add(c => c.IsLoading, true));
        Assert.NotNull(cut.Find("[data-slot=\"chart-skeleton\"]"));
        Assert.Empty(cut.FindAll("[data-slot=\"echart\"]"));
    }

    [Theory]
    [InlineData(80)]
    [InlineData(120)]
    [InlineData(350)]
    public void EChart_respects_height_param(int h)
    {
        var cut = Render<EChart>(p => p.Add(c => c.Options, new { }).Add(c => c.Height, $"{h}px"));
        Assert.Contains($"height:{h}px", cut.Find("[data-slot=\"echart\"]").GetAttribute("style"));
    }

    [Fact]
    public void EThemeRiverChart_emits_single_axis_or_init_throws()
    {
        // themeRiver has no xAxis/yAxis; ECharts 5.x throws in getInitialData
        // ("reading 'get'" on undefined) when the singleAxis component is absent.
        var cut = Render<EThemeRiverChart>(p => p.Add(c => c.Data,
            new object[] { new object[] { "2024/01/01", 10.0, "A" } }));
        Assert.Contains("\"singleAxis\"", cut.Find("[data-slot=\"echart\"]").GetAttribute("data-options"));

        // a caller-provided singleAxis wins — the default { type = "time" } must not be emitted
        var ov = new Dictionary<string, object?> { ["singleAxis"] = new { type = "time", min = "2024/01/01" } };
        var cut2 = Render<EThemeRiverChart>(p => p.Add(c => c.Data, new object[0]).Add(c => c.OptionOverride, ov));
        Assert.Contains("2024/01/01", cut2.Find("[data-slot=\"echart\"]").GetAttribute("data-options"));
    }
}
