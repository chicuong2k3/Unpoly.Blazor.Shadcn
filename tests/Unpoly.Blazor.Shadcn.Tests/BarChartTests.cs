using Bunit;
using Unpoly.Blazor.Shadcn.Components;

namespace Unpoly.Blazor.Shadcn.Tests;

public class BarChartTests : BunitContext
{
    static readonly double[] Week = [5, 10, 0, 2.5];
    static readonly string[] Days = ["Mon", "Tue", "Wed", "Thu"];

    [Fact]
    public void Every_value_is_one_bar()
    {
        var bars = Render<BarChart>(p => p.Add(c => c.Values, Week)).FindAll("[data-slot=bar-chart-bar]");

        Assert.Equal(4, bars.Count);
    }

    [Theory]
    [InlineData(0, "height: 50%")]
    // The largest value is the ceiling, so it is exactly the full plot height.
    [InlineData(1, "height: 100%")]
    [InlineData(3, "height: 25%")]
    public void A_bar_is_as_tall_as_its_share_of_the_largest_value(int index, string expected)
    {
        var fill = Render<BarChart>(p => p.Add(c => c.Values, Week))
            .FindAll("[data-slot=bar-chart-fill]")[index];

        Assert.StartsWith(expected + ";", fill.GetAttribute("style"));
    }

    [Theory]
    [InlineData(0.0)]
    [InlineData(-3.0)]
    [InlineData(double.NaN)]
    [InlineData(double.PositiveInfinity)]
    public void A_value_that_is_not_a_positive_number_is_a_muted_stub(double value)
    {
        // The day still exists — it had nothing in it. A missing bar would hide that.
        var fill = Render<BarChart>(p => p.Add(c => c.Values, new[] { 4.0, value }))
            .FindAll("[data-slot=bar-chart-fill]")[1];

        Assert.Equal("height: 2px", fill.GetAttribute("style"));
        Assert.Contains("bg-muted", fill.ClassList);
    }

    [Fact]
    public void An_all_zero_series_draws_every_bar_as_a_stub()
    {
        var fills = Render<BarChart>(p => p.Add(c => c.Values, new[] { 0.0, 0.0, 0.0 }))
            .FindAll("[data-slot=bar-chart-fill]");

        Assert.All(fills, fill => Assert.Equal("height: 2px", fill.GetAttribute("style")));
    }

    [Fact]
    public void Only_the_highlighted_bar_is_marked()
    {
        var bars = Render<BarChart>(p => p.Add(c => c.Values, Week).Add(c => c.Highlight, 1))
            .FindAll("[data-slot=bar-chart-bar]");

        Assert.Equal(["", "true", "", ""], bars.Select(b => b.GetAttribute("data-highlight") ?? ""));
    }

    [Theory]
    [InlineData(1, "var(--primary)")]
    [InlineData(0, "color-mix(in oklab, var(--primary) 45%, transparent)")]
    public void Bars_other_than_the_highlighted_one_are_dimmed(int index, string expected)
    {
        var fill = Render<BarChart>(p => p.Add(c => c.Values, Week).Add(c => c.Highlight, 1))
            .FindAll("[data-slot=bar-chart-fill]")[index];

        Assert.EndsWith("background: " + expected, fill.GetAttribute("style"));
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(99)]
    public void Without_a_highlight_in_range_every_bar_is_full_strength(int highlight)
    {
        var fills = Render<BarChart>(p => p.Add(c => c.Values, new[] { 1.0, 2.0 }).Add(c => c.Highlight, highlight))
            .FindAll("[data-slot=bar-chart-fill]");

        Assert.All(fills, fill => Assert.EndsWith("background: var(--primary)", fill.GetAttribute("style")));
    }

    [Fact]
    public void A_custom_colour_paints_the_bars()
    {
        var fill = Render<BarChart>(p => p.Add(c => c.Values, new[] { 1.0 }).Add(c => c.Color, "var(--chart-2)"))
            .Find("[data-slot=bar-chart-fill]");

        Assert.EndsWith("background: var(--chart-2)", fill.GetAttribute("style"));
    }

    [Fact]
    public void Each_bar_reads_as_its_label_value_and_suffix()
    {
        var bar = Render<BarChart>(p => p
                .Add(c => c.Values, Week).Add(c => c.Labels, Days).Add(c => c.ValueSuffix, " reviews"))
            .FindAll("[data-slot=bar-chart-bar]")[3];

        Assert.Equal("Thu: 2.5 reviews", bar.QuerySelector(".sr-only")?.TextContent);
        Assert.Equal("Thu: 2.5 reviews", bar.GetAttribute("title"));
    }

    [Fact]
    public void A_bar_without_a_label_is_named_by_its_position()
    {
        var bar = Render<BarChart>(p => p.Add(c => c.Values, Week))
            .FindAll("[data-slot=bar-chart-bar]")[2];

        Assert.Equal("Bar 3: 0", bar.GetAttribute("title"));
    }

    [Fact]
    public void Bar_heights_are_written_in_invariant_culture_under_a_comma_decimal_locale()
    {
        using var _ = new CultureScope("de-DE");

        var chart = Render<BarChart>(p => p
            .Add(c => c.Values, new[] { 1.0, 3.0 }));

        // "33,33%" is an invalid declaration the browser drops without a word.
        Assert.StartsWith("height: 33.33%;", chart.FindAll("[data-slot=bar-chart-fill]")[0].GetAttribute("style"));
    }

    [Fact]
    public void The_sr_text_keeps_a_decimal_point_under_a_comma_decimal_locale()
    {
        using var _ = new CultureScope("de-DE");

        var bar = Render<BarChart>(p => p.Add(c => c.Values, new[] { 2.5 })).Find("[data-slot=bar-chart-bar]");

        Assert.Equal("Bar 1: 2.5", bar.GetAttribute("title"));
    }

    [Fact]
    public void The_plot_area_is_the_requested_height()
    {
        var bars = Render<BarChart>(p => p.Add(c => c.Values, Week).Add(c => c.Height, 80))
            .Find("[data-slot=bar-chart-bars]");

        Assert.Equal("height: 80px", bars.GetAttribute("style"));
    }

    [Fact]
    public void Show_values_prints_each_value_above_its_bar()
    {
        var fill = Render<BarChart>(p => p.Add(c => c.Values, Week).Add(c => c.ShowValues, true))
            .FindAll("[data-slot=bar-chart-fill]")[3];

        Assert.Equal("2.5", fill.QuerySelector("[aria-hidden=true]")?.TextContent);
    }

    [Fact]
    public void Show_values_adds_room_above_the_plot_rather_than_shrinking_it()
    {
        var bars = Render<BarChart>(p => p.Add(c => c.Values, Week).Add(c => c.Height, 80).Add(c => c.ShowValues, true))
            .Find("[data-slot=bar-chart-bars]");

        Assert.Equal("height: 94px; padding-top: 14px", bars.GetAttribute("style"));
    }

    [Fact]
    public void Values_are_not_printed_by_default()
    {
        var fills = Render<BarChart>(p => p.Add(c => c.Values, Week)).FindAll("[data-slot=bar-chart-fill]");

        Assert.All(fills, fill => Assert.Empty(fill.Children));
    }

    [Fact]
    public void Labels_are_printed_in_a_row_hidden_from_screen_readers()
    {
        // Hidden because each bar's sr-only text already carries its label.
        var row = Render<BarChart>(p => p.Add(c => c.Values, Week).Add(c => c.Labels, Days))
            .Find("[data-slot=bar-chart-labels]");

        Assert.Equal("true", row.GetAttribute("aria-hidden"));
        Assert.Equal(Days, row.Children.Select(c => c.TextContent));
    }

    [Fact]
    public void Show_labels_off_removes_the_label_row()
    {
        var chart = Render<BarChart>(p => p.Add(c => c.Values, Week).Add(c => c.Labels, Days).Add(c => c.ShowLabels, false));

        Assert.Empty(chart.FindAll("[data-slot=bar-chart-labels]"));
    }

    [Fact]
    public void Show_labels_off_still_names_the_bars_for_a_screen_reader()
    {
        var bar = Render<BarChart>(p => p.Add(c => c.Values, Week).Add(c => c.Labels, Days).Add(c => c.ShowLabels, false))
            .FindAll("[data-slot=bar-chart-bar]")[0];

        Assert.Equal("Mon: 5", bar.QuerySelector(".sr-only")?.TextContent);
    }

    [Theory]
    [InlineData(null, "Bar chart")]
    [InlineData("", "Bar chart")]
    [InlineData("Reviews this week", "Reviews this week")]
    public void The_chart_is_a_named_group(string? label, string expected)
    {
        var figure = Render<BarChart>(p => p.Add(c => c.Values, Week).Add(c => c.AriaLabel, label))
            .Find("figure[data-slot=bar-chart]");

        Assert.Equal("group", figure.GetAttribute("role"));
        Assert.Equal(expected, figure.GetAttribute("aria-label"));
    }
}
