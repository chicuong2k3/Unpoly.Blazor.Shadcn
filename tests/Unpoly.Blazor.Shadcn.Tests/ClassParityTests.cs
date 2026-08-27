using Bunit;
using Xunit;

namespace Unpoly.Blazor.Shadcn.Tests;

/// <summary>
/// The claim this library makes — that it *is* shadcn/ui — checked against shadcn's own source.
/// </summary>
/// <remarks>
/// <para>
/// Every component renders with its defaults, and its class list is compared with the one the
/// upstream .tsx produces for the same <c>data-slot</c>. Anything missing or extra fails unless
/// it is declared in <see cref="Deviations"/> with a reason.
/// </para>
/// <para>
/// Sets, not sequences: the order of classes in an attribute means nothing to CSS, and shadcn
/// reorders its own strings between releases. A test that failed on order would be noise, and
/// noise is how a suite stops being read.
/// </para>
/// </remarks>
[Trait("Layer", "Parity")]
public class ClassParityTests : BunitContext
{
    [SkippableTheory]
    [MemberData(nameof(ComponentCatalog.Names), MemberType = typeof(ComponentCatalog))]
    public void Every_component_renders_the_classes_shadcn_renders(string name)
    {
        var subject = this.RenderByName(name).Subject(name);
        var slot = subject.GetAttribute("data-slot");

        // A component with no slot, or a slot shadcn has no component for (this port's own
        // additions — Stepper, TagsInput, DatePicker, Pager), has nothing to be compared with.
        Skip.If(slot is null || !Upstream.Has(slot), $"no upstream component for '{slot ?? name}'");

        // Where shadcn uses asChild with a Button, the element IS a button here and is expected
        // to wear the button recipe — which the button parity tests check on its own. The slot's
        // own classes come after it, because that is the order upstream composes them in:
        // Button does cn(buttonVariants(...), className), so the caller's string wins the merge.
        // Carousel's arrows are the ones that need it — they override size and shape.
        IReadOnlyList<string> expected;
        if (Deviations.AsChildButton(slot!) is { } chosen)
        {
            expected = Upstream.Slot("button").WithAll(chosen);

            // Only when the slot carries classes of its own, which upstream passes as the
            // Button's className — recipe first, then them, because that is the order Button
            // composes them in and the order that decides the merge.
            if (chosen.ContainsKey("withSlotClasses"))
            {
                expected = [.. expected,
                            .. Upstream.Slot(Deviations.CvaFor(slot!) ?? slot!)
                                       .WithAll(Deviations.DefaultVariantFor(name))];
            }
        }
        else
        {
            expected = Upstream.Slot(Deviations.CvaFor(slot!) ?? slot!)
                               .WithAll(Deviations.DefaultVariantFor(name));
        }

        AssertSameClasses(slot!, subject.GetAttribute("class"), expected);
    }

    [Theory]
    [InlineData("default")]
    [InlineData("destructive")]
    [InlineData("outline")]
    [InlineData("secondary")]
    [InlineData("ghost")]
    [InlineData("link")]
    public void Every_button_variant_matches_shadcn(string variant)
    {
        var button = this.RenderByName("Button", new Dictionary<string, object> { ["Variant"] = variant })
            .Subject("Button");

        AssertSameClasses("button", button.GetAttribute("class"),
            Upstream.Slot("button").With("variant", variant));
    }

    [Theory]
    [InlineData("default")]
    [InlineData("sm")]
    [InlineData("lg")]
    [InlineData("icon")]
    public void Every_button_size_matches_shadcn(string size)
    {
        var button = this.RenderByName("Button", new Dictionary<string, object> { ["Size"] = size })
            .Subject("Button");

        AssertSameClasses("button", button.GetAttribute("class"),
            Upstream.Slot("button").With("size", size));
    }

    [Theory]
    [InlineData("default")]
    [InlineData("secondary")]
    [InlineData("destructive")]
    [InlineData("outline")]
    [InlineData("ghost")]
    [InlineData("link")]
    public void Every_badge_variant_matches_shadcn(string variant)
    {
        var badge = this.RenderByName("Badge", new Dictionary<string, object> { ["Variant"] = variant })
            .Subject("Badge");

        AssertSameClasses("badge", badge.GetAttribute("class"),
            Upstream.Slot("badge").With("variant", variant));
    }

    [Theory]
    [InlineData("default")]
    [InlineData("destructive")]
    public void Every_alert_variant_matches_shadcn(string variant)
    {
        var alert = this.RenderByName("Alert", new Dictionary<string, object> { ["Variant"] = variant })
            .Subject("Alert");

        AssertSameClasses("alert", alert.GetAttribute("class"),
            Upstream.Slot("alert").With("variant", variant));
    }

    // ----------------------------------------------------------------------------------------

    static void AssertSameClasses(string slot, string? rendered, IReadOnlyList<string> upstream)
    {
        var ours = (rendered ?? "").Split(' ', StringSplitOptions.RemoveEmptyEntries).ToHashSet();

        // The upstream list is the raw union of base + variant + size, which is what the .tsx
        // *says*. What React *renders* is that union through cn(), so `gap-2` from the base is
        // gone the moment the sm size sets `gap-1.5`. Merging both sides with the same engine is
        // what makes this a comparison of rendered output rather than of source text — and
        // without it every recipe whose variant overrides its own base reads as a difference.
        var theirs = ClassMerge.Of(string.Join(' ', upstream))
            .Split(' ', StringSplitOptions.RemoveEmptyEntries).ToHashSet();

        theirs.ExceptWith(Deviations.DroppedFor(slot));
        ours.ExceptWith(Deviations.AddedFor(slot));
        ours.ExceptWith(Deviations.ComposedFor(slot));

        // A token stands in for whichever of its upstream classes this slot actually used, so it
        // cancels them on both sides. Cancelling nothing means the component reached for the
        // token where shadcn sets no such property at all — a silent size change, so it fails.
        var unmatched = new List<string>();
        foreach (var (token, family) in Deviations.TokenSubstitutions)
        {
            if (!ours.Remove(token)) continue;
            if (theirs.RemoveWhere(family.Contains) == 0) unmatched.Add(token);
        }

        var missing = theirs.Except(ours).OrderBy(c => c).ToArray();
        var extra = ours.Except(theirs).OrderBy(c => c).ToArray();

        if (missing.Length == 0 && extra.Length == 0 && unmatched.Count == 0) return;

        var report = new List<string> { $"[data-slot={slot}] does not match shadcn." };
        if (missing.Length > 0) report.Add($"  missing:  {string.Join(' ', missing)}");
        if (extra.Length > 0) report.Add($"  extra:    {string.Join(' ', extra)}");
        if (unmatched.Count > 0)
            report.Add($"  token with nothing to stand in for: {string.Join(' ', unmatched)}");
        report.Add("  Fix the component, or declare it in Deviations with a reason.");

        Assert.Fail(string.Join('\n', report));
    }
}
