using Microsoft.Playwright;

namespace Unpoly.Blazor.Shadcn.Behaviour;

/// <summary>
/// A hover card opens on hover and — the part that was reported eight times — goes away again.
/// </summary>
/// <remarks>
/// Three independent mechanisms close it, and each is tested on its own, because the value of
/// having three is that no single one has to be right: the platform's light dismiss
/// (<c>popover="auto"</c>), the trigger's own pointerleave, and a sweep that closes any card
/// whose trigger and panel are both un-hovered. The sweep exists for the case the other two
/// cannot see — a fragment swap that replaces the trigger and leaves the panel behind.
/// </remarks>
[Collection(DemoCollection.Name)]
[Trait("Module", "Overlay")]
public class HoverCardTests(DemoFixture fixture) : DemoPage(fixture)
{
    async Task<ILocator> TriggerAsync(string target)
    {
        await GoAsync("/components/hover-card");
        var trigger = Page.Locator($"[data-target=\"{target}\"]").First;
        await trigger.ScrollIntoViewIfNeededAsync();
        return trigger;
    }

    /// <summary>Moves the real pointer onto an element the way a hand would, in steps.</summary>
    async Task HoverAsync(ILocator element)
    {
        var box = await element.BoundingBoxAsync() ?? throw new InvalidOperationException("not on screen");
        await Page.Mouse.MoveAsync(box.X + box.Width / 2, box.Y + box.Height / 2, new() { Steps = 8 });
        await Page.WaitForTimeoutAsync(700);
    }

    async Task<string[]> OpenCardsAsync() => await Page.EvaluateAsync<string[]>(
        "() => [...document.querySelectorAll('[data-slot=\"hover-card-content\"]')]" +
        ".filter(c => c.matches(':popover-open')).map(c => c.id)");

    [SkippableFact]
    public async Task Hovering_the_trigger_opens_the_card()
    {
        RequireDemo();
        await HoverAsync(await TriggerAsync("hc-basic"));

        Assert.Equal(["hc-basic"], await OpenCardsAsync());
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Leaving_the_trigger_closes_the_card()
    {
        RequireDemo();
        await HoverAsync(await TriggerAsync("hc-basic"));

        await Page.Mouse.MoveAsync(40, 700, new() { Steps = 15 });
        await Page.WaitForTimeoutAsync(1500);

        Assert.Empty(await OpenCardsAsync());
        AssertQuiet();
    }

    [SkippableFact]
    public async Task The_card_stays_while_the_pointer_is_on_it()
    {
        RequireDemo();
        await HoverAsync(await TriggerAsync("hc-basic"));

        var card = await Page.Locator("#hc-basic").BoundingBoxAsync();
        await Page.Mouse.MoveAsync(card!.X + card.Width / 2, card.Y + card.Height / 2, new() { Steps = 12 });
        await Page.WaitForTimeoutAsync(600);

        Assert.Equal(["hc-basic"], await OpenCardsAsync());
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Leaving_the_card_itself_closes_it()
    {
        RequireDemo();
        await HoverAsync(await TriggerAsync("hc-basic"));
        var card = await Page.Locator("#hc-basic").BoundingBoxAsync();
        await Page.Mouse.MoveAsync(card!.X + card.Width / 2, card.Y + card.Height / 2, new() { Steps = 12 });
        await Page.WaitForTimeoutAsync(400);

        await Page.Mouse.MoveAsync(40, 700, new() { Steps = 20 });
        await Page.WaitForTimeoutAsync(1500);

        Assert.Empty(await OpenCardsAsync());
        AssertQuiet();
    }

    /// <summary>
    /// A click focuses the trigger, and focus used to exempt a card from the safety net — so a
    /// card opened, clicked, and abandoned stayed on screen for good.
    /// </summary>
    [SkippableFact]
    public async Task A_card_whose_trigger_was_clicked_still_closes()
    {
        RequireDemo();
        await HoverAsync(await TriggerAsync("hc-basic"));

        await Page.Mouse.DownAsync();
        await Page.Mouse.UpAsync();
        await Page.Mouse.MoveAsync(40, 700, new() { Steps = 20 });
        await Page.WaitForTimeoutAsync(1500);

        Assert.Empty(await OpenCardsAsync());
        AssertQuiet();
    }

    /// <summary>
    /// popover="manual" has no light dismiss, so two cards could sit open at once — the second
    /// covering the first's trigger, which then never saw a pointerleave.
    /// </summary>
    [SkippableFact]
    public async Task Only_one_card_is_ever_open()
    {
        RequireDemo();
        await GoAsync("/components/hover-card");

        foreach (var target in new[] { "hc-basic", "hc-fast", "hc-slow" })
        {
            var trigger = Page.Locator($"[data-target=\"{target}\"]").First;
            await trigger.ScrollIntoViewIfNeededAsync();
            var box = await trigger.BoundingBoxAsync();
            await Page.Mouse.MoveAsync(box!.X + box.Width / 2, box.Y + box.Height / 2, new() { Steps = 4 });
            await Page.WaitForTimeoutAsync(200);
        }
        await Page.WaitForTimeoutAsync(800);

        Assert.True((await OpenCardsAsync()).Length <= 1);
        AssertQuiet();
    }

    /// <summary>The platform's own dismissal, which is what popover="auto" buys.</summary>
    [SkippableFact]
    public async Task Clicking_away_dismisses_it_with_no_script_involved()
    {
        RequireDemo();
        await HoverAsync(await TriggerAsync("hc-basic"));

        await Page.Mouse.MoveAsync(700, 950, new() { Steps = 10 });
        await Page.Mouse.DownAsync();
        await Page.Mouse.UpAsync();
        await Page.WaitForTimeoutAsync(400);

        Assert.Empty(await OpenCardsAsync());
        AssertQuiet();
    }
}
