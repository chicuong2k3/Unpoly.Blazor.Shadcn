using Bunit;
using Unpoly.Blazor.Shadcn.Components;

namespace Unpoly.Blazor.Shadcn.Tests;

public class InputValueTests : BunitContext
{
    [Fact]
    public void A_plain_value_attribute_is_rendered_without_binding()
    {
        // Blazor matches parameter names case-insensitively, so `value="..."` written as HTML lands
        // in the Value parameter. It used to be rendered only when ValueChanged was bound, which
        // emptied every unbound Input re-rendered after a failed submit.
        var input = Render<Input>(p => p.AddUnmatched("value", "kept")).Find("input");

        Assert.Equal("kept", input.GetAttribute("value"));
    }

    [Fact]
    public void No_value_renders_no_value_attribute()
    {
        var input = Render<Input>().Find("input");

        Assert.False(input.HasAttribute("value"));
    }

    [Fact]
    public void A_bound_value_is_rendered()
    {
        var input = Render<Input>(p => p.Add(c => c.Value, "bound").Add(c => c.ValueChanged, (string? _) => { })).Find("input");

        Assert.Equal("bound", input.GetAttribute("value"));
    }

    [Fact]
    public void A_single_thumb_slider_name_is_rendered_for_native_form_posts()
    {
        var input = Render<Slider>(p => p.Add(c => c.Name, "strength_pct").Add(c => c.Value, 80)).Find("input[type=range]");

        Assert.Equal("strength_pct", input.GetAttribute("name"));
        Assert.Equal("80", input.GetAttribute("value"));
    }
}
