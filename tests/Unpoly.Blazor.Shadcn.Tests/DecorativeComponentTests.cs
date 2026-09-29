using Bunit;
using Unpoly.Blazor.Shadcn.Components;

namespace Unpoly.Blazor.Shadcn.Tests;

/// <summary>
/// The beyond-shadcn layers and layout pieces: AuroraBackground, BentoGrid, BentoCard, DotPattern,
/// GradientBorder, GridPattern, NumberTicker and Spotlight. They have no upstream to be compared
/// with, so the parity theory skips them — these are what pin their behaviour instead.
/// </summary>
public class DecorativeComponentTests : BunitContext
{
    // ---- decoration stays out of the accessibility tree ------------------------------------

    [Theory]
    [InlineData(typeof(AuroraBackground), "aurora-background")]
    [InlineData(typeof(DotPattern), "dot-pattern")]
    [InlineData(typeof(GridPattern), "grid-pattern")]
    [InlineData(typeof(Spotlight), "spotlight")]
    public void A_decorative_layer_is_hidden_from_assistive_technology(Type component, string slot)
    {
        // It carries no information, so a screen reader reaching it would only read noise.
        var root = this.RenderByName(component.Name).Find($"[data-slot={slot}]");

        Assert.Equal("true", root.GetAttribute("aria-hidden"));
    }

    [Theory]
    [InlineData(typeof(AuroraBackground), "aurora-background")]
    [InlineData(typeof(DotPattern), "dot-pattern")]
    [InlineData(typeof(GridPattern), "grid-pattern")]
    [InlineData(typeof(Spotlight), "spotlight")]
    public void A_decorative_layer_lets_pointer_events_through_to_the_content(Type component, string slot)
    {
        // A full-bleed layer that swallows clicks makes everything above it look dead.
        var root = this.RenderByName(component.Name).Find($"[data-slot={slot}]");

        Assert.Contains("pointer-events-none", root.ClassList);
    }

    // ---- per-instance ids -------------------------------------------------------------------

    [Fact]
    public void Two_dot_patterns_on_one_page_each_fill_from_their_own_pattern()
    {
        // Same id twice and the second resolves to the FIRST definition, silently.
        var first = Render<DotPattern>();
        var second = Render<DotPattern>();

        var ids = new[] { first, second }.Select(r => r.Find("pattern").GetAttribute("id")).ToArray();
        Assert.NotEqual(ids[0], ids[1]);
        Assert.Equal($"url(#{ids[1]})", second.Find("rect").GetAttribute("fill"));
    }

    [Fact]
    public void Two_grid_patterns_on_one_page_each_fill_from_their_own_pattern()
    {
        var first = Render<GridPattern>();
        var second = Render<GridPattern>();

        var ids = new[] { first, second }.Select(r => r.Find("pattern").GetAttribute("id")).ToArray();
        Assert.NotEqual(ids[0], ids[1]);
        Assert.Equal($"url(#{ids[1]})", second.Find("rect").GetAttribute("fill"));
    }

    [Fact]
    public void Two_spotlights_on_one_page_each_fill_from_their_own_gradient()
    {
        var first = Render<Spotlight>();
        var second = Render<Spotlight>();

        var ids = new[] { first, second }.Select(r => r.Find("radialGradient").GetAttribute("id")).ToArray();
        Assert.NotEqual(ids[0], ids[1]);
        Assert.Equal($"url(#{ids[1]})", second.Find("ellipse").GetAttribute("fill"));
    }

    // ---- aurora -----------------------------------------------------------------------------

    [Theory]
    [InlineData(false, 2)]
    [InlineData(true, 3)]
    public void Third_adds_a_third_blob(bool third, int expected)
    {
        var root = Render<AuroraBackground>(p => p.Add(a => a.Third, third)).Find("[data-slot=aurora-background]");

        Assert.Equal(expected, root.Children.Length);
    }

    [Theory]
    [InlineData(true, true)]
    [InlineData(false, false)]
    public void Animated_decides_whether_the_blobs_pulse(bool animated, bool pulses)
    {
        var blob = Render<AuroraBackground>(p => p.Add(a => a.Animated, animated))
            .Find("[data-slot=aurora-background] > div");

        Assert.Equal(pulses, blob.ClassList.Contains("animate-pulse"));
    }

    [Fact]
    public void Aurora_blobs_stop_moving_for_a_reader_who_asked_for_reduced_motion()
    {
        var blobs = Render<AuroraBackground>().FindAll("[data-slot=aurora-background] > div");

        Assert.All(blobs, blob => Assert.Contains("motion-reduce:animate-none", blob.ClassList));
    }

    // ---- bento ------------------------------------------------------------------------------

    [Theory]
    [InlineData(2, "lg:grid-cols-2")]
    [InlineData(3, "lg:grid-cols-3")]
    [InlineData(6, "lg:grid-cols-6")]
    // Out of range falls back to 3: a column count is layout, not validation.
    [InlineData(1, "lg:grid-cols-3")]
    [InlineData(9, "lg:grid-cols-3")]
    public void Bento_grid_columns_become_a_literal_class_tailwind_can_see(int columns, string expected)
    {
        var grid = Render<BentoGrid>(p => p.Add(g => g.Columns, columns)).Find("[data-slot=bento-grid]");

        Assert.Contains(expected, grid.ClassList);
    }

    [Fact]
    public void Bento_grid_rows_have_a_fixed_height_by_default_so_spans_mean_something()
    {
        var grid = Render<BentoGrid>().Find("[data-slot=bento-grid]");

        Assert.Contains("auto-rows-[180px]", grid.ClassList);
    }

    [Fact]
    public void Bento_card_keeps_the_card_slot_the_theme_reaches_it_through()
    {
        // Renaming the slot loses Card's padding and its quiet border — see BentoCard.razor.
        var card = Render<BentoCard>().Find("[data-slot=card]");

        Assert.Contains("h-full", card.ClassList);
    }

    // ---- gradient border --------------------------------------------------------------------

    [Theory]
    [InlineData(null, "bg-background")]
    [InlineData("bg-card", "bg-card")]
    public void Gradient_border_paints_its_inset_with_the_surface(string? surface, string expected)
    {
        var inset = Render<GradientBorder>(p => p.Add(g => g.Surface, surface))
            .Find("[data-slot=gradient-border] > [data-slot=gradient-border-surface]");

        Assert.Contains(expected, inset.ClassList);
    }

    [Fact]
    public void Gradient_border_wraps_its_child_inside_the_surface()
    {
        var inset = Render<GradientBorder>(p => p.AddChildContent("<p>Pro plan</p>"))
            .Find("[data-slot=gradient-border-surface]");

        Assert.Equal("Pro plan", inset.QuerySelector("p")?.TextContent);
    }

    // ---- number ticker ----------------------------------------------------------------------

    [Fact]
    public void Number_ticker_renders_its_final_value_on_the_server()
    {
        // No script, a crawler, a print — all read the real number, never a zero waiting to count.
        var ticker = Render<NumberTicker>(p => p
                .Add(t => t.Value, 1240.5).Add(t => t.DecimalPlaces, 2).Add(t => t.Prefix, "$"))
            .Find("[data-slot=number-ticker]");

        Assert.Equal("$1,240.50", ticker.TextContent);
    }

    [Fact]
    public void Number_ticker_hands_the_animation_its_configuration_as_data_attributes()
    {
        var ticker = Render<NumberTicker>(p => p
                .Add(t => t.Value, 1240.5).Add(t => t.StartValue, 100).Add(t => t.Direction, "DOWN")
                .Add(t => t.Delay, 0.25).Add(t => t.DecimalPlaces, 1).Add(t => t.Suffix, "%"))
            .Find("[data-slot=number-ticker]");

        Assert.Equal("1240.5", ticker.GetAttribute("data-ticker-value"));
        Assert.Equal("100", ticker.GetAttribute("data-ticker-start"));
        Assert.Equal("down", ticker.GetAttribute("data-ticker-direction"));
        Assert.Equal("0.25", ticker.GetAttribute("data-ticker-delay"));
        Assert.Equal("1", ticker.GetAttribute("data-ticker-decimals"));
        Assert.Equal("%", ticker.GetAttribute("data-ticker-suffix"));
    }

    [Fact]
    public void Number_ticker_writes_invariant_numbers_under_a_comma_decimal_locale()
    {
        // data-ticker-value="1,5" reads back as NaN and the ticker never moves.
        using var _ = new CultureScope("de-DE");

        var ticker = Render<NumberTicker>(p => p.Add(t => t.Value, 1234.5).Add(t => t.DecimalPlaces, 1))
            .Find("[data-slot=number-ticker]");

        Assert.Equal("1234.5", ticker.GetAttribute("data-ticker-value"));
        Assert.Equal("1,234.5", ticker.TextContent);
    }
}
