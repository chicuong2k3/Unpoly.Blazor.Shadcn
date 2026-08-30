namespace Unpoly.Blazor.Shadcn.ECharts.Models;

/// <summary>
/// shadcn theme bridge for ECharts. The JS compiler reads --chart-1..5 and injects them when
/// an option has no explicit <c>color</c>. This C# helper lets a server-side builder do the same
/// when it wants deterministic JSON (e.g. for tests) without reading computed styles.
/// </summary>
public static class EChartsTheme
{
    /// <summary>shadcn CSS variables that the demo and themes set.</summary>
    public static readonly string[] ChartVariables =
    [
        "var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"
    ];

    /// <summary>Default shadcn palette as raw oklch/hsl strings — used only as fallback when CSS vars are unavailable.</summary>
    public static readonly string[] FallbackPalette =
    [
        "hsl(12 76% 61%)", "hsl(173 58% 39%)", "hsl(197 37% 24%)", "hsl(43 74% 66%)", "hsl(27 87% 67%)"
    ];

    /// <summary>Returns the palette the JS will actually resolve (CSS variables).</summary>
    public static IReadOnlyList<string> DefaultPalette => ChartVariables;

    /// <summary>
    /// Builds a minimal option patch that makes ECharts legible on shadcn backgrounds.
    /// Caller can merge it with their own option; the JS compiler does this automatically when
    /// <c>color</c> is absent, so server-side use is optional.
    /// </summary>
    public static object ShadcnDefaults() => new
    {
        color = ChartVariables,
        backgroundColor = "transparent",
        textStyle = new { color = "hsl(var(--foreground))", fontFamily = "var(--font-sans, ui-sans-serif)" },
        animationDuration = 300
    };
}
