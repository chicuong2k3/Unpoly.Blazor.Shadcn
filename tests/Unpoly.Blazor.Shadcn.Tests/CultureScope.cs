using System.Globalization;

namespace Unpoly.Blazor.Shadcn.Tests;

/// <summary>
/// Renders under a comma-decimal culture for the length of a <c>using</c>, then puts the thread's
/// culture back. The bug this exists to catch is invisible on an English machine: a component
/// that formats a number with the current culture writes <c>height: 62,5%</c> under de-DE, the
/// browser drops the declaration, and nothing anywhere says why.
/// </summary>
/// <remarks>
/// CurrentCulture flows with the async context rather than being process-wide, so one test
/// switching it cannot leak into another running in parallel.
/// </remarks>
public sealed class CultureScope : IDisposable
{
    readonly CultureInfo _culture = CultureInfo.CurrentCulture;
    readonly CultureInfo _uiCulture = CultureInfo.CurrentUICulture;

    public CultureScope(string name)
    {
        CultureInfo.CurrentCulture = CultureInfo.GetCultureInfo(name);
        CultureInfo.CurrentUICulture = CultureInfo.GetCultureInfo(name);
    }

    public void Dispose()
    {
        CultureInfo.CurrentCulture = _culture;
        CultureInfo.CurrentUICulture = _uiCulture;
    }
}
