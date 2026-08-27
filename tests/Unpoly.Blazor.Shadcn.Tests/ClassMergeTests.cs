using Bunit;

namespace Unpoly.Blazor.Shadcn.Tests;

/// <summary>
/// The one promise a design system makes to the person using it: your class wins.
/// </summary>
/// <remarks>
/// Without tailwind-merge it does not. Two classes of equal specificity are resolved by
/// stylesheet order, which is Tailwind's order and not the caller's, so an override lands about
/// half the time — and the half it loses looks like a caching bug rather than a design decision.
/// These pin the behaviour that makes it deterministic.
/// </remarks>
[Trait("Layer", "Contract")]
public class ClassMergeTests : BunitContext
{
    [Theory]
    [InlineData("h-9", "h-12", "h-12")]
    [InlineData("px-4 py-2", "px-8", "py-2 px-8")]
    [InlineData("bg-primary text-white", "bg-destructive", "text-white bg-destructive")]
    [InlineData("rounded-md", "rounded-full", "rounded-full")]
    public void The_later_class_wins_when_two_set_the_same_property(string first, string second, string expected)
    {
        Assert.Equal(expected, ClassMerge.Of(first, second));
    }

    [Fact]
    public void Classes_that_do_not_conflict_are_all_kept()
    {
        // The common case, and the one a naive "last wins by property name" would break.
        Assert.Equal("flex items-center gap-2 w-full", ClassMerge.Of("flex items-center gap-2", "w-full"));
    }

    [Fact]
    public void A_variant_modifier_only_conflicts_with_the_same_modifier()
    {
        // hover:bg-* and bg-* are different properties as far as the cascade is concerned.
        Assert.Equal("bg-primary hover:bg-accent", ClassMerge.Of("bg-primary", "hover:bg-accent"));
    }

    // ---- the three tokens this library adds ------------------------------------------------

    [Theory]
    [InlineData("h-control", "h-12", "h-12")]
    [InlineData("text-control", "text-xs", "text-xs")]
    [InlineData("size-control", "size-6", "size-6")]
    public void This_library_s_own_tokens_conflict_with_the_utility_they_stand_in_for(
        string ours, string caller, string expected)
    {
        // tailwind-merge keeps classes it does not recognise, so an unregistered h-control would
        // survive beside h-12 and the caller's override would silently do nothing. This is the
        // test that catches a new token added without registering it.
        Assert.Equal(expected, ClassMerge.Of(ours, caller));
    }

    [Fact]
    public void A_component_s_own_class_beats_the_recipe_it_ships_with()
    {
        // The end-to-end version: through a real component, not through ClassMerge directly.
        var button = Render<Components.Button>(p => p.Add(b => b.Class, "h-12"));
        var classes = button.Find("button").GetAttribute("class")!.Split(' ');

        Assert.Contains("h-12", classes);
        Assert.DoesNotContain("h-control", classes);
    }

    [Fact]
    public void A_layout_class_is_appended_rather_than_replacing_anything()
    {
        var button = Render<Components.Button>(p => p.Add(b => b.Class, "w-full mt-4"));
        var classes = button.Find("button").GetAttribute("class")!;

        Assert.Contains("w-full", classes);
        Assert.Contains("mt-4", classes);
        Assert.Contains("h-control", classes);
    }

    [Fact]
    public void The_button_recipe_resolves_conflicts_between_its_own_parts()
    {
        // sm sets rounded-md and the base already did; one of them has to go, or the class list
        // grows a duplicate on every render.
        var classes = ButtonVariants.Of("outline", "sm").Split(' ');

        Assert.Single(classes, c => c == "rounded-md");
    }

    // ---- shape --------------------------------------------------------------------------

    [Fact]
    public void Blank_parts_are_dropped_rather_than_leaving_double_spaces()
    {
        Assert.Equal("flex gap-2", ClassMerge.Of("flex", null, "", "   ", "gap-2"));
    }

    [Fact]
    public void Nothing_at_all_is_an_empty_string_not_a_null()
    {
        // It renders straight into a class attribute; a null there is a literal "null" in the DOM.
        Assert.Equal("", ClassMerge.Of(null, null));
    }
}
