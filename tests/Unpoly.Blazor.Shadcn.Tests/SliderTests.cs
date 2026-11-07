using Bunit;
using Unpoly.Blazor.Shadcn.Components;

namespace Unpoly.Blazor.Shadcn.Tests;

public class SliderTests : BunitContext
{
    [Fact]
    public void A_named_slider_posts_under_that_name_without_a_binding()
    {
        // The single-thumb branch used to drop Name, because `name="duration"` at the call site binds
        // to the Name parameter and the parameter was only read by the several-thumb branch. A slider
        // inside a form then submitted nothing, and the server charged its own default instead of the
        // value the user had picked.
        var input = Render<Slider>(p => p
            .Add(s => s.Id, "duration")
            .Add(s => s.Name, "duration")
            .Add(s => s.Min, 2d)
            .Add(s => s.Max, 180d)
            .Add(s => s.Value, 30d)).Find("input");

        Assert.Equal("duration", input.GetAttribute("name"));
        Assert.Equal("30", input.GetAttribute("value"));
    }

    [Fact]
    public void A_named_slider_posts_under_that_name_with_a_binding()
    {
        var input = Render<Slider>(p => p
            .Add(s => s.Id, "duration")
            .Add(s => s.Name, "duration")
            .Add(s => s.Value, 10d)
            .Add(s => s.ValueChanged, (decimal _) => { })).Find("input");

        Assert.Equal("duration", input.GetAttribute("name"));
    }

    [Fact]
    public void An_unnamed_slider_renders_no_name_attribute()
    {
        // Brush-size sliders are read by their own data attribute, not by the form; an empty name
        // would post them and shadow the payload.
        var input = Render<Slider>(p => p.Add(s => s.Value, 32d)).Find("input");

        Assert.False(input.HasAttribute("name"));
    }
}
