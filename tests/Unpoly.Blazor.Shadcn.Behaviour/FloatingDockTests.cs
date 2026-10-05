using Microsoft.Playwright;

namespace Unpoly.Blazor.Shadcn.Behaviour;

/// <summary>
/// The motion ui.js adds to FloatingDock through Motion. The markup is pinned by the unit tests;
/// only a browser can show that a spring actually ran and a menu actually unfolded.
/// </summary>
[Collection(DemoCollection.Name)]
[Trait("Module", "Navigation")]
public class FloatingDockTests(DemoFixture fixture) : DemoPage(fixture)
{
    async Task<int[]> TileWidthsAsync(ILocator shelf) =>
        await shelf.Locator("[data-slot=floating-dock-tile]")
            .EvaluateAllAsync<int[]>("ts => ts.map(t => Math.round(t.getBoundingClientRect().width))");

    [SkippableFact]
    public async Task The_tile_under_the_pointer_swells_and_its_neighbours_less()
    {
        RequireDemo();
        await GoAsync("/components/floating-dock");
        var shelf = (await ShowAsync("preview-floating-dock-example")).Locator("[data-slot=floating-dock-desktop]");
        var third = (await shelf.Locator("[data-slot=floating-dock-tile]").Nth(2).BoundingBoxAsync())!;

        await Page.Mouse.MoveAsync(third.X + third.Width / 2, third.Y + third.Height / 2, new() { Steps = 5 });
        await Page.WaitForTimeoutAsync(700);
        var widths = await TileWidthsAsync(shelf);

        // Upstream's curve: 80px under the pointer, falling to the 40px rest 150px away.
        Assert.True(widths[2] >= 76, "under the pointer: " + string.Join(",", widths));
        Assert.True(widths[1] > 40 && widths[1] < widths[2], "beside it: " + string.Join(",", widths));
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Every_tile_settles_back_to_its_rest_size_when_the_pointer_leaves()
    {
        RequireDemo();
        await GoAsync("/components/floating-dock");
        var shelf = (await ShowAsync("preview-floating-dock-example")).Locator("[data-slot=floating-dock-desktop]");
        var first = (await shelf.Locator("[data-slot=floating-dock-tile]").First.BoundingBoxAsync())!;

        await Page.Mouse.MoveAsync(first.X + first.Width / 2, first.Y + first.Height / 2, new() { Steps = 5 });
        await Page.WaitForTimeoutAsync(500);
        await Page.Mouse.MoveAsync(5, 5, new() { Steps = 3 });
        await Page.WaitForTimeoutAsync(800);
        var widths = await TileWidthsAsync(shelf);

        Assert.True(widths.All(w => w == 40), "after leaving: " + string.Join(",", widths));
        AssertQuiet();
    }

    [SkippableFact]
    public async Task The_phone_menu_unfolds_its_links_and_folds_them_away_again()
    {
        RequireDemo();
        await GoAsync("/components/floating-dock");
        var menu = (await ShowAsync("preview-floating-dock-mobile")).Locator("[data-slot=floating-dock-mobile]");

        await menu.Locator("summary").ClickAsync();
        await Page.WaitForTimeoutAsync(700);
        var shown = await menu.Locator("[data-slot=floating-dock-item]")
            .EvaluateAllAsync<double[]>("as => as.map(a => Number(getComputedStyle(a).opacity))");
        Assert.True(shown.Length == 5 && shown.All(o => o == 1), "opacities once open: " + string.Join(",", shown));

        await menu.Locator("summary").ClickAsync();
        await Page.WaitForTimeoutAsync(800);
        Assert.False(await menu.EvaluateAsync<bool>("d => d.open"), "the menu should close after its links leave");
        AssertQuiet();
    }
}
