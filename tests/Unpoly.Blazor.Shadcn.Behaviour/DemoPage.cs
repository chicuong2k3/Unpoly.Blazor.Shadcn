using Microsoft.Playwright;

namespace Unpoly.Blazor.Shadcn.Behaviour;

/// <summary>
/// The base every behaviour test derives from: a page on the demo, and the two or three moves
/// every one of them makes.
/// </summary>
/// <remarks>
/// Console errors are collected and asserted at the end of each test. Half the faults found
/// while writing these announced themselves that way first — <c>toast.info is not a function</c>
/// was in the console for weeks — and nobody was listening.
/// </remarks>
public abstract class DemoPage(DemoFixture fixture) : IAsyncLifetime
{
    protected DemoFixture Fixture { get; } = fixture;

    protected IPage Page { get; private set; } = default!;

    readonly List<string> _noise = [];

    public async Task InitializeAsync()
    {
        if (Fixture.UnavailableReason is not null) return;

        Page = await Fixture.NewPageAsync();
        Page.PageError += (_, e) => _noise.Add("pageerror: " + e.Split('\n')[0]);
        Page.Console += (_, m) => { if (m.Type == "error") _noise.Add("console: " + m.Text); };
    }

    public async Task DisposeAsync()
    {
        if (Page is not null) await Page.CloseAsync();
    }

    /// <summary>Skips rather than fails when there is no browser or no demo to drive.</summary>
    protected void RequireDemo()
    {
        if (Fixture.UnavailableReason is not null) Console.WriteLine("skipping: " + Fixture.UnavailableReason);
        Skip.If(Fixture.UnavailableReason is not null, Fixture.UnavailableReason ?? "");
    }

    protected async Task GoAsync(string path)
    {
        await Page.GotoAsync(Fixture.BaseUrl + path, new() { WaitUntil = WaitUntilState.NetworkIdle });
    }

    /// <summary>
    /// The preview box of an <c>&lt;Example&gt;</c>: the sibling before the code panel it is
    /// named for. Every page is built the same way, so this is how a test says "the Disabled one".
    /// </summary>
    protected ILocator Example(string previewId) =>
        Page.Locator($"#{previewId}").Locator("xpath=preceding-sibling::div[1]");

    protected async Task<ILocator> ShowAsync(string previewId)
    {
        var box = Example(previewId);
        await box.ScrollIntoViewIfNeededAsync();
        await Page.WaitForTimeoutAsync(250);
        return box;
    }

    /// <summary>
    /// A locator over open popovers. Playwright evaluates locators in the native
    /// selector engine, which never matches the polyfill's class fallback — so
    /// under SAFARI15_SIM the bare pseudo-class is rewritten to it. Anywhere
    /// else the selector passes through untouched.
    /// </summary>
    protected ILocator OpenPopoverLocator(string selector) =>
        Page.Locator(DemoFixture.Safari15Sim
            ? System.Text.RegularExpressions.Regex.Replace(
                selector, @"(?<!\\):popover-open", @".\:popover-open")
            : selector);

    /// <summary>Nothing in the console. Called by every test, last.</summary>
    protected void AssertQuiet()
    {
        Assert.True(_noise.Count == 0, "the page raised: " + string.Join(" | ", _noise));
    }
}
