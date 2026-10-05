using Microsoft.Playwright;

namespace Unpoly.Blazor.Shadcn.Behaviour;

/// <summary>
/// What ui.js and Motion add to FloatingNav, BottomMenu and FrequentlyAskedQuestions — the parts
/// only a browser can show: a pill that travels, a panel placed and swapped, rows that wait to be
/// scrolled to.
/// </summary>
[Collection(DemoCollection.Name)]
[Trait("Module", "Navigation")]
public class MotionComponentTests(DemoFixture fixture) : DemoPage(fixture)
{
    [SkippableFact]
    public async Task The_floating_nav_pill_travels_to_the_item_that_was_picked()
    {
        RequireDemo();
        await GoAsync("/components/floating-nav");
        var nav = (await ShowAsync("preview-floating-nav-example")).Locator("[data-slot=floating-nav]");
        var target = nav.Locator("[data-slot=floating-nav-item]").Nth(4);

        await target.ClickAsync();
        await Page.WaitForTimeoutAsync(800);
        var pill = (await nav.Locator(":scope > [data-slot=floating-nav-indicator]").BoundingBoxAsync())!;
        var item = (await target.BoundingBoxAsync())!;

        Assert.True(Math.Abs(pill.X - item.X) < 2 && Math.Abs(pill.Width - item.Width) < 2,
            $"pill at {pill.X:0}/{pill.Width:0}, item at {item.X:0}/{item.Width:0}");
        AssertQuiet();
    }

    [SkippableFact]
    public async Task A_bottom_menu_panel_opens_centred_above_the_bar()
    {
        RequireDemo();
        await GoAsync("/components/bottom-menu");
        var menu = (await ShowAsync("preview-bottom-menu-example")).Locator("[data-slot=bottom-menu]");

        await menu.Locator("[data-value=new]").ClickAsync();
        await Page.WaitForTimeoutAsync(500);
        var panel = (await Page.Locator("[data-slot=bottom-menu-panel]:popover-open").BoundingBoxAsync())!;
        var bar = (await menu.Locator("[data-slot=bottom-menu-bar]").BoundingBoxAsync())!;

        var gap = bar.Y - (panel.Y + panel.Height);
        var drift = (panel.X + panel.Width / 2) - (bar.X + bar.Width / 2);
        Assert.True(gap is > 4 and < 20 && Math.Abs(drift) < 2, $"gap above bar {gap:0}px, off centre by {drift:0}px");
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Picking_another_bottom_menu_button_swaps_the_panel_and_its_expanded_state()
    {
        RequireDemo();
        await GoAsync("/components/bottom-menu");
        var menu = (await ShowAsync("preview-bottom-menu-example")).Locator("[data-slot=bottom-menu]");

        await menu.Locator("[data-value=new]").ClickAsync();
        await Page.WaitForTimeoutAsync(400);
        await menu.Locator("[data-value=profile]").ClickAsync();
        await Page.WaitForTimeoutAsync(500);

        var open = await Page.Locator("[data-slot=bottom-menu-panel]:popover-open").EvaluateAllAsync<string[]>("ps => ps.map(p => p.id.split('-').pop())");
        Assert.Equal(["profile"], open);
        Assert.Equal("false", await menu.Locator("[data-value=new]").GetAttributeAsync("aria-expanded"));
        Assert.Equal("true", await menu.Locator("[data-value=profile]").GetAttributeAsync("aria-expanded"));
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Faq_rows_wait_out_of_sight_and_rise_in_once_scrolled_to()
    {
        RequireDemo();
        await GoAsync("/components/faq-section");
        var faq = Example("preview-faq-section-custom").Locator("[data-slot=frequently-asked-questions]");
        const string Opacities = "s => [...s.querySelectorAll('[data-slot=faq-item]')].map(e => Number(getComputedStyle(e).opacity))";

        var before = await faq.EvaluateAsync<double[]>(Opacities);
        await faq.ScrollIntoViewIfNeededAsync();
        await Page.WaitForTimeoutAsync(2000);
        var after = await faq.EvaluateAsync<double[]>(Opacities);

        Assert.True(before.All(o => o == 0), "before scrolling: " + string.Join(",", before));
        Assert.True(after.All(o => o == 1), "after scrolling: " + string.Join(",", after));
        AssertQuiet();
    }
}
