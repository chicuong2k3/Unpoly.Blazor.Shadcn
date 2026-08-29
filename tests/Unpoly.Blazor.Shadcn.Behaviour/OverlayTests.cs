using Microsoft.Playwright;

namespace Unpoly.Blazor.Shadcn.Behaviour;

/// <summary>
/// The panels: what opens them, what closes them, and where they land.
/// </summary>
/// <remarks>
/// Placement is asserted against the trigger rather than against pixels. Every placement fault
/// this library has had was of one shape — the panel opened somewhere unrelated to the control
/// that opened it — and that is a relation, not a coordinate.
/// </remarks>
[Collection(DemoCollection.Name)]
[Trait("Module", "Overlay")]
public class OverlayTests(DemoFixture fixture) : DemoPage(fixture)
{
    class Placement
    {
        public bool Open { get; set; }
        public int Dx { get; set; }
        public int Below { get; set; }
        public bool InView { get; set; }
    }

    async Task<Placement> PlacementAsync(string panelId, string triggerSelector) =>
        await Page.EvaluateAsync<Placement>("""
            ([id, sel]) => {
              const panel = document.getElementById(id);
              if (!panel?.matches(':popover-open')) return { open: false, dx: 0, below: 0, inView: false };
              const p = panel.getBoundingClientRect();
              const t = document.querySelector(sel).getBoundingClientRect();
              return {
                open: true,
                dx: Math.round(p.left - t.left),
                below: Math.round(p.top - t.bottom),
                inView: p.left >= -1 && p.right <= innerWidth + 1 && p.top >= -1,
              };
            }
            """, new[] { panelId, triggerSelector });

    [SkippableFact]
    public async Task A_popover_opens_aligned_to_its_trigger()
    {
        RequireDemo();
        await GoAsync("/components/popover");
        var box = await ShowAsync("preview-popover-basic");
        await box.Locator("[popovertarget=\"pop-basic\"]").ClickAsync();
        await Page.WaitForTimeoutAsync(400);

        var placed = await PlacementAsync("pop-basic", "[popovertarget=\"pop-basic\"]");
        Assert.True(placed.Open, "the panel did not open");
        Assert.True(Math.Abs(placed.Dx) < 3, $"align=start, but it is {placed.Dx}px off the trigger's edge");
        Assert.True(placed.InView, "it opened partly off screen");
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Escape_closes_a_popover()
    {
        RequireDemo();
        await GoAsync("/components/popover");
        var box = await ShowAsync("preview-popover-basic");
        await box.Locator("[popovertarget=\"pop-basic\"]").ClickAsync();
        await Page.WaitForTimeoutAsync(300);

        await Page.Keyboard.PressAsync("Escape");
        await Page.WaitForTimeoutAsync(300);

        Assert.False((await PlacementAsync("pop-basic", "[popovertarget=\"pop-basic\"]")).Open);
        AssertQuiet();
    }

    /// <summary>
    /// A site header opens on hover; requiring a click there costs a second click to get out of
    /// it again.
    /// </summary>
    [SkippableFact]
    public async Task The_navigation_menu_opens_on_hover()
    {
        RequireDemo();
        await GoAsync("/components/navigation-menu");
        var trigger = Page.Locator("[popovertarget=\"nav-home\"]");
        await trigger.ScrollIntoViewIfNeededAsync();
        await Page.WaitForTimeoutAsync(300);

        await trigger.HoverAsync();
        await Page.WaitForTimeoutAsync(500);

        Assert.True(await IsOpenAsync("nav-home"));
        AssertQuiet();
    }

    /// <summary>
    /// Arriving at a plain link is leaving whatever is open, and it used to leave it open with
    /// the pointer nowhere near it.
    /// </summary>
    [SkippableFact]
    public async Task Reaching_a_bar_item_with_no_panel_closes_the_open_one()
    {
        RequireDemo();
        await GoAsync("/components/navigation-menu");
        var trigger = Page.Locator("[popovertarget=\"nav-home\"]");
        await trigger.ScrollIntoViewIfNeededAsync();
        await Page.WaitForTimeoutAsync(300);
        await trigger.HoverAsync();
        await Page.WaitForTimeoutAsync(500);

        await Page.Locator("[data-slot=\"navigation-menu-link\"]", new() { HasTextString = "Docs" })
            .First.HoverAsync();
        await Page.WaitForTimeoutAsync(500);

        Assert.False(await IsOpenAsync("nav-home"));
        AssertQuiet();
    }

    /// <summary>
    /// A row that opens a menu is the most common sidebar pattern there is, and a bare
    /// popovertarget gets no placement at all: the compiler matches on the trigger's slot.
    /// </summary>
    [SkippableFact]
    public async Task A_sidebar_row_places_the_menu_it_opens()
    {
        RequireDemo();
        await GoAsync("/components/sidebar");
        await ShowAsync("preview-sidebar-header-example");
        await Page.Locator("[data-target=\"sb-workspaces\"]").ClickAsync();
        await Page.WaitForTimeoutAsync(400);

        var placed = await PlacementAsync("sb-workspaces", "[data-target=\"sb-workspaces\"]");
        Assert.True(placed.Open, "the menu did not open");
        Assert.True(Math.Abs(placed.Dx) < 8, $"it is {placed.Dx}px from the row that opened it");
        Assert.True(placed.InView, "it opened partly off screen");
        AssertQuiet();
    }

    /// <summary>
    /// The composer's "+" was an input-group button carrying only a popovertarget, so it got no
    /// placement and the menu opened in the middle of the window.
    /// </summary>
    [SkippableFact]
    public async Task The_chat_composer_menu_is_placed_against_its_button()
    {
        RequireDemo();
        await GoAsync("/components/message-scroller");
        await ShowAsync("preview-conversation-example");
        await Page.Locator("[data-target=\"chat-tools\"]").ClickAsync();
        await Page.WaitForTimeoutAsync(400);

        var placed = await PlacementAsync("chat-tools", "[data-target=\"chat-tools\"]");
        Assert.True(placed.Open, "the menu did not open");
        Assert.True(Math.Abs(placed.Dx) < 8, $"it is {placed.Dx}px from the button that opened it");
        AssertQuiet();
    }

    async Task<bool> IsOpenAsync(string id) =>
        await Page.EvaluateAsync<bool>("id => document.getElementById(id).matches(':popover-open')", id);
}
