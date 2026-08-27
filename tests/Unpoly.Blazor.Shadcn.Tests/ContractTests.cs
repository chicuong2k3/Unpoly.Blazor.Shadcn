using Bunit;

namespace Unpoly.Blazor.Shadcn.Tests;

/// <summary>
/// The four promises every component in the library makes, checked against every component
/// there is rather than against the handful someone remembered.
/// </summary>
/// <remarks>
/// Written as one theory per promise, not one test per component: the behaviour under test is
/// the promise, and xUnit reports the component that broke it by name anyway.
/// </remarks>
[Trait("Layer", "Contract")]
public class ContractTests : BunitContext
{
    [Theory]
    [MemberData(nameof(ComponentCatalog.Names), MemberType = typeof(ComponentCatalog))]
    public void Every_component_forwards_an_attribute_it_does_not_know(string name)
    {
        // This is the whole Unpoly integration. up-target, up-poll, up-validate and the rest are
        // written as plain attributes at the call site and must reach the DOM — which is why no
        // component in this library mentions Unpoly anywhere.
        var rendered = this.RenderByName(name, new Dictionary<string, object>
        {
            ["up-target"] = ".content",
        });

        Assert.Equal(".content", rendered.Subject(name).GetAttribute("up-target"));
    }

    [Theory]
    [MemberData(nameof(ComponentCatalog.Names), MemberType = typeof(ComponentCatalog))]
    public void Every_component_appends_the_caller_s_classes_last(string name)
    {
        // Last, because a caller's class can only win on source order — there is no
        // tailwind-merge here. A component that prepends silently loses every override.
        var rendered = this.RenderByName(name, new Dictionary<string, object>
        {
            ["Class"] = "probe-class",
        });

        Assert.EndsWith("probe-class", rendered.Subject(name).GetAttribute("class"));
    }

    [Theory]
    [MemberData(nameof(ComponentCatalog.Names), MemberType = typeof(ComponentCatalog))]
    public void Every_component_names_itself_with_a_data_slot(string name)
    {
        // data-slot is shadcn's stable hook and this library's test surface: class strings are
        // the design system's to rewrite, slots are not.
        var subject = this.RenderByName(name).Subject(name);

        Assert.True(subject.HasAttribute("data-slot") || SlotlessByDesign.Contains(name),
            $"{name} renders <{subject.TagName.ToLowerInvariant()}> with no data-slot");
    }

    [Fact]
    public void Every_required_parameter_has_a_seed_so_no_component_opts_out_of_these_tests()
    {
        var missing = ComponentCatalog.All
            .SelectMany(t => ComponentCatalog.MissingSeeds(t).Select(p => $"{t.Name}.{p}"))
            .ToArray();

        Assert.True(missing.Length == 0,
            "add these to ComponentCatalog.Seed: " + string.Join(", ", missing));
    }

    /// <summary>
    /// The one component with no slot, and why. Listed rather than skipped, so a new component
    /// cannot join it by accident.
    /// </summary>
    static readonly HashSet<string> SlotlessByDesign =
    [
        // An <svg> is identified by being an svg, and lucide-react gives icons no slot either.
        "Icon",
    ];
}
