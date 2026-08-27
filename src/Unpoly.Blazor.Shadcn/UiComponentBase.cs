using Microsoft.AspNetCore.Components;

namespace Unpoly.Blazor.Shadcn;

/// <summary>
/// What every shadcn component shares: a <c>data-slot</c> root, a class string the caller can
/// extend, and pass-through for everything else — which is how <c>up-target</c>, <c>up-poll</c>
/// and the rest of Unpoly reach the DOM without a single component knowing Unpoly exists.
/// </summary>
/// <remarks>
/// <para>
/// <b>There is no tailwind-merge here.</b> In shadcn, <c>cn()</c> resolves conflicts, so
/// <c>className="h-12"</c> beats the variant's <c>h-9</c>. Two classes of equal specificity are
/// resolved by stylesheet order instead, and Tailwind's order is not the caller's — so passing
/// <c>Class="h-12"</c> may lose. Use the important modifier when overriding a value the variant
/// already sets: <c>Class="h-12!"</c>. Layout classes the variant does not set (margins, grid
/// placement, width) need nothing.
/// </para>
/// </remarks>
public abstract class UiComponentBase : ComponentBase
{
    /// <summary>Extra classes, appended after the component's own — see the remarks on merging.</summary>
    [Parameter] public string? Class { get; set; }

    /// <summary>What the component wraps.</summary>
    [Parameter] public RenderFragment? ChildContent { get; set; }

    /// <summary>
    /// Everything else, splatted onto the root element. This is how <c>up-target</c>,
    /// <c>up-poll</c>, <c>up-validate</c> and the rest of Unpoly reach the DOM without a single
    /// component having to know Unpoly exists.
    /// </summary>
    [Parameter(CaptureUnmatchedValues = true)]
    public IReadOnlyDictionary<string, object>? AdditionalAttributes { get; set; }

    /// <summary>shadcn's <c>cn()</c>, minus the conflict resolution: joins and drops the blanks.</summary>
    protected static string Cn(params string?[] parts) =>
        string.Join(' ', parts.Where(p => !string.IsNullOrWhiteSpace(p)));
}
