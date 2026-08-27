using Bunit;
using Microsoft.AspNetCore.Components;

namespace Unpoly.Blazor.Shadcn.Tests;

/// <summary>
/// Rendering a component whose type is only known at runtime, which every contract test needs
/// and bUnit's generic <c>Render&lt;T&gt;</c> cannot express.
/// </summary>
public static class Renderer
{
    public static IRenderedComponent<IComponent> RenderByName(
        this BunitContext ctx, string name, IReadOnlyDictionary<string, object>? extra = null)
    {
        var type = ComponentCatalog.Find(name);
        var parameters = new Dictionary<string, object>(ComponentCatalog.SeedFor(name));
        foreach (var (k, v) in extra ?? new Dictionary<string, object>()) parameters[k] = v;

        return ctx.Render<IComponent>(b =>
        {
            b.OpenComponent(0, type);
            // One literal sequence number for the whole set: the parameters are built at runtime,
            // so there is no source order for Blazor's diffing to track (ASP0006).
            b.AddMultipleAttributes(1, parameters!);
            b.CloseComponent();
        });
    }

    /// <summary>
    /// The element under test: the one a component's Class and splatted attributes land on.
    /// Usually the first it renders; where a platform frame wraps the shadcn box — a &lt;dialog&gt;,
    /// the table's scroll container — deviations.json names the slot, and the generator that
    /// writes the classes reads the same map.
    /// </summary>
    public static AngleSharp.Dom.IElement Subject(
        this IRenderedComponent<IComponent> rendered, string name) =>
        Deviations.SubjectSlot(name) is { } slot
            ? rendered.Find($"[data-slot={slot}]")
            : rendered.Root() ?? throw new InvalidOperationException($"{name} rendered no element");

    /// <summary>
    /// The first element the component actually produced. Not <c>Nodes[0]</c>: several components
    /// render leading whitespace or a comment, and a test that asserts on a text node is a test
    /// that fails for the wrong reason.
    /// </summary>
    public static AngleSharp.Dom.IElement? Root(this IRenderedComponent<IComponent> rendered) =>
        rendered.Nodes.OfType<AngleSharp.Dom.IElement>().FirstOrDefault();
}
