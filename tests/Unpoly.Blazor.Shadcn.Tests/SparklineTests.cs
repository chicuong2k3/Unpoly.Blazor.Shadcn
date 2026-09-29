using Bunit;
using Unpoly.Blazor.Shadcn.Components;

namespace Unpoly.Blazor.Shadcn.Tests;

public class SparklineTests : BunitContext
{
    static readonly double[] Series = [1, 4, 2, 8, 5];

    [Fact]
    public void The_line_is_never_filled()
    {
        var line = Render<Sparkline>(p => p.Add(c => c.Data, Series).Add(c => c.ShowArea, true))
            .Find("[data-slot=sparkline-line]");

        Assert.Equal("none", line.GetAttribute("fill"));
    }

    [Fact]
    public void The_area_is_a_separate_unstroked_path_closed_to_the_floor()
    {
        var area = Render<Sparkline>(p => p.Add(c => c.Data, Series).Add(c => c.ShowArea, true))
            .Find("[data-slot=sparkline-area]");

        Assert.Equal("none", area.GetAttribute("stroke"));
        Assert.EndsWith(" L 1 28 Z", area.GetAttribute("d"));
    }

    [Fact]
    public void Without_ShowArea_there_is_no_area()
    {
        var cut = Render<Sparkline>(p => p.Add(c => c.Data, Series));

        Assert.Empty(cut.FindAll("[data-slot=sparkline-area]"));
    }

    [Fact]
    public void A_custom_colour_fills_the_area_translucently()
    {
        // A custom colour used to fill the area at full strength, burying the line in a block.
        var area = Render<Sparkline>(p => p.Add(c => c.Data, Series).Add(c => c.ShowArea, true).Add(c => c.Color, "red"))
            .Find("[data-slot=sparkline-area]");

        Assert.Equal("color-mix(in oklab, red 18%, transparent)", area.GetAttribute("fill"));
    }

    [Fact]
    public void Coordinates_are_invariant_under_a_comma_decimal_culture()
    {
        using var _ = new CultureScope("de-DE");

        var d = Render<Sparkline>(p => p.Add(c => c.Data, new[] { 0.3, 0.7, 0.1 }))
            .Find("[data-slot=sparkline-line]").GetAttribute("d")!;

        Assert.DoesNotContain(",", d);
        Assert.Contains(".", d);
    }

    [Fact]
    public void Bars_are_invariant_under_a_comma_decimal_culture()
    {
        using var _ = new CultureScope("de-DE");

        var rect = Render<Sparkline>(p => p.Add(c => c.Data, new[] { 0.3, 0.7, 0.1 }).Add(c => c.Type, "bars"))
            .Find("rect");

        Assert.DoesNotContain(",", rect.GetAttribute("width"));
    }

    [Fact]
    public void A_non_finite_value_is_drawn_as_zero_rather_than_breaking_the_path()
    {
        var d = Render<Sparkline>(p => p.Add(c => c.Data, new[] { 1.0, double.NaN, 3.0 }))
            .Find("[data-slot=sparkline-line]").GetAttribute("d")!;

        Assert.DoesNotContain("NaN", d);
    }
}
