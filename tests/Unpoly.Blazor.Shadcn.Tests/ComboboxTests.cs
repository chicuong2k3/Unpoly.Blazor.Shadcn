using Bunit;
using Unpoly.Blazor.Shadcn.Components;

namespace Unpoly.Blazor.Shadcn.Tests;

[Trait("Layer", "Component")]
public class ComboboxTests : BunitContext
{
    [Fact]
    public void Creatable_is_published_for_the_script_to_read()
    {
        // ui.js decides whether Enter makes a chip from this attribute and nothing else.
        var root = Render<Combobox>(p => p
                .Add(c => c.Target, "tags").Add(c => c.Multiple, true).Add(c => c.Creatable, true))
            .Find("[data-slot=combobox]");

        Assert.Equal("true", root.GetAttribute("data-creatable"));
    }

    [Fact]
    public void A_combobox_that_is_not_creatable_claims_nothing()
    {
        // A bool attribute renders valueless when true-ish and CSS or script cannot tell; absent
        // is the only honest "no".
        var root = Render<Combobox>(p => p.Add(c => c.Target, "tags").Add(c => c.Multiple, true))
            .Find("[data-slot=combobox]");

        Assert.False(root.HasAttribute("data-creatable"));
    }
}
