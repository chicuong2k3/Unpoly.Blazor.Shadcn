using Bunit;
using Unpoly.Blazor.Shadcn.Components;

namespace Unpoly.Blazor.Shadcn.Tests;

[Trait("Layer", "Component")]
public class ComboboxItemTests : BunitContext
{
    [Fact]
    public void Label_is_published_as_data_label_for_the_script_to_read()
    {
        // The trigger reads this when the row is chosen. Without it the script falls back to the
        // row's own text, which for a row carrying an avatar and a description is all three run
        // together — the bug this parameter exists to fix.
        var item = Render<ComboboxItem>(p => p
            .Add(c => c.Value, "bun")
            .Add(c => c.Label, "Bun")
            .AddChildContent("<span>Bun</span><span>Fast.</span>"));

        Assert.Equal("Bun", item.Find("[data-slot='combobox-item']").GetAttribute("data-label"));
    }

    [Fact]
    public void An_item_without_a_label_publishes_none()
    {
        // Absent rather than empty: the script tests the attribute for truth, and "" would be
        // indistinguishable from a label somebody meant to be blank.
        var item = Render<ComboboxItem>(p => p.Add(c => c.Value, "bun").AddChildContent("Bun"));

        Assert.Null(item.Find("[data-slot='combobox-item']").GetAttribute("data-label"));
    }
}
