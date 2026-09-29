using Bunit;
using Unpoly.Blazor.Shadcn.Components;

namespace Unpoly.Blazor.Shadcn.Tests;

public class HeatmapTests : BunitContext
{
    [Fact]
    public void Without_labels_a_cell_is_named_by_its_position()
    {
        var cell = Render<Heatmap>(p => p.Add(h => h.Values, new[] { 3, 8 }).Add(h => h.ValueLabel, "reviews"))
            .FindAll("[data-slot=heatmap-cell]")[1];

        Assert.Equal("Day 2: 8 reviews.", cell.GetAttribute("title"));
    }

    [Fact]
    public void A_label_names_the_cell_in_its_title_and_screen_reader_text()
    {
        var cell = Render<Heatmap>(p => p
                .Add(h => h.Values, new[] { 3, 8 })
                .Add(h => h.Labels, new[] { "Mon 3 Mar", "Tue 4 Mar" })
                .Add(h => h.ValueLabel, "reviews"))
            .FindAll("[data-slot=heatmap-cell]")[1];

        Assert.Equal("Tue 4 Mar: 8 reviews.", cell.GetAttribute("title"));
        Assert.Equal("Tue 4 Mar: 8 reviews.", cell.QuerySelector(".sr-only")?.TextContent);
    }

    [Fact]
    public void Cells_past_the_end_of_a_short_label_list_fall_back_to_their_position()
    {
        var cell = Render<Heatmap>(p => p
                .Add(h => h.Values, new[] { 3, 8, 1 })
                .Add(h => h.Labels, new[] { "Mon" })
                .Add(h => h.ValueLabel, "reviews"))
            .FindAll("[data-slot=heatmap-cell]")[2];

        Assert.Equal("Day 3: 1 review.", cell.GetAttribute("title"));
    }

    [Theory]
    // Without Max the busiest cell of THIS series is the ceiling, so 4 of 4 is the darkest step.
    [InlineData(null, "bg-primary/90")]
    // With a shared ceiling of 8, the same 4 is half-way: 1 + 4*3/8 = step 2.
    [InlineData(8, "bg-primary/50")]
    // A non-positive ceiling is no ceiling, and the series decides again.
    [InlineData(0, "bg-primary/90")]
    public void Max_overrides_the_ceiling_the_steps_are_cut_from(int? max, string expected)
    {
        var cell = Render<Heatmap>(p => p.Add(h => h.Values, new[] { 2, 4 }).Add(h => h.Max, max))
            .FindAll("[data-slot=heatmap-cell]")[1];

        Assert.Contains(expected, cell.ClassList);
    }

    [Fact]
    public void A_value_above_max_lands_on_the_darkest_step()
    {
        var cell = Render<Heatmap>(p => p.Add(h => h.Values, new[] { 20 }).Add(h => h.Max, 5))
            .Find("[data-slot=heatmap-cell]");

        Assert.Contains("bg-primary/90", cell.ClassList);
    }

    [Theory]
    [InlineData(null, "rounded-[2px]")]
    [InlineData("rounded-full", "rounded-full")]
    public void Cell_radius_is_the_class_every_cell_wears(string? radius, string expected)
    {
        var heatmap = Render<Heatmap>(p =>
        {
            p.Add(h => h.Values, new[] { 1 });
            if (radius is not null) p.Add(h => h.CellRadius, radius);
        });

        Assert.Contains(expected, heatmap.Find("[data-slot=heatmap-cell]").ClassList);
    }

    [Theory]
    [InlineData(null, "grid-template-columns: repeat(7, 12px); gap: 2px")]
    [InlineData("rows", "grid-template-columns: repeat(7, 12px); gap: 2px")]
    [InlineData("columns", "grid-auto-flow: column; grid-template-rows: repeat(7, 12px); grid-auto-columns: 12px; gap: 2px")]
    [InlineData("Columns", "grid-auto-flow: column; grid-template-rows: repeat(7, 12px); grid-auto-columns: 12px; gap: 2px")]
    [InlineData("diagonal", "grid-template-columns: repeat(7, 12px); gap: 2px")]
    public void Flow_decides_which_axis_the_values_fill(string? flow, string expected)
    {
        var grid = Render<Heatmap>(p =>
        {
            p.Add(h => h.Values, new[] { 1, 2, 3 });
            if (flow is not null) p.Add(h => h.Flow, flow);
        }).Find("[data-slot=heatmap-grid]");

        Assert.Equal(expected, grid.GetAttribute("style"));
    }

    [Theory]
    [InlineData(3, "gap: 3px")]
    [InlineData(0, "gap: 0px")]
    [InlineData(-4, "gap: 0px")]
    public void Gap_is_the_space_between_cells_in_pixels(int gap, string expected)
    {
        var grid = Render<Heatmap>(p => p.Add(h => h.Values, new[] { 1 }).Add(h => h.Gap, gap))
            .Find("[data-slot=heatmap-grid]");

        Assert.EndsWith(expected, grid.GetAttribute("style"));
    }
}
