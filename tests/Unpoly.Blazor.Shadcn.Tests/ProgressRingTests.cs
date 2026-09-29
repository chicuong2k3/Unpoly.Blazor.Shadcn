using Bunit;
using Unpoly.Blazor.Shadcn.Components;

namespace Unpoly.Blazor.Shadcn.Tests;

public class ProgressRingTests : BunitContext
{
    [Fact]
    public void The_label_shows_the_percentage_rather_than_the_razor_source()
    {
        // `@Label ?? PercentText` without parentheses is Label followed by the literal text
        // " ?? PercentText" — which is exactly what shipped.
        var label = Render<ProgressRing>(p => p.Add(r => r.Value, 72).Add(r => r.ShowLabel, true))
            .Find("[data-slot=progress-ring-label]");

        Assert.Equal("72%", label.TextContent.Trim());
    }

    [Fact]
    public void A_label_replaces_the_percentage()
    {
        var label = Render<ProgressRing>(p => p
                .Add(r => r.Value, 45).Add(r => r.ShowLabel, true).Add(r => r.Label, "3 of 7"))
            .Find("[data-slot=progress-ring-label]");

        Assert.Equal("3 of 7", label.TextContent.Trim());
    }

    [Theory]
    [InlineData(null, "color-mix(in oklab, var(--primary) 18%, transparent)")]
    [InlineData("var(--destructive)", "color-mix(in oklab, var(--destructive) 18%, transparent)")]
    [InlineData("#16a34a", "color-mix(in oklab, #16a34a 18%, transparent)")]
    public void The_track_is_the_arc_colour_faded(string? color, string expected)
    {
        // A custom arc on a primary-tinted groove reads as two unrelated signals.
        var track = Render<ProgressRing>(p => p.Add(r => r.Value, 50).Add(r => r.Color, color))
            .FindAll("circle")[0];

        Assert.Equal(expected, track.GetAttribute("stroke"));
    }

    [Fact]
    public void Child_content_is_centred_over_the_ring_in_its_own_slot()
    {
        var content = Render<ProgressRing>(p => p
                .Add(r => r.Value, 50)
                .AddChildContent("<strong>12</strong>"))
            .Find("[data-slot=progress-ring-content]");

        Assert.Equal("12", content.QuerySelector("strong")?.TextContent);
        Assert.Contains("absolute", content.ClassList);
        Assert.Contains("inset-0", content.ClassList);
    }

    [Fact]
    public void Without_child_content_there_is_no_empty_content_wrapper()
    {
        var ring = Render<ProgressRing>(p => p.Add(r => r.Value, 50));

        Assert.Empty(ring.FindAll("[data-slot=progress-ring-content]"));
    }
}
