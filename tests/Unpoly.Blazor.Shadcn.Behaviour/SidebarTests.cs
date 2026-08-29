using Microsoft.Playwright;

namespace Unpoly.Blazor.Shadcn.Behaviour;

/// <summary>
/// The sidebar collapses, and everything that has to move moves with it.
/// </summary>
/// <remarks>
/// Each of these has been broken at least once while the class-parity suite stayed green: the
/// panel kept its width because the root was missing <c>group</c>; the inset never followed
/// because the root carried a width of its own; an icon sidebar slid away instead of narrowing
/// because nothing said which mode it collapses into.
/// </remarks>
[Collection(DemoCollection.Name)]
[Trait("Module", "Sidebar")]
public class SidebarTests(DemoFixture fixture) : DemoPage(fixture)
{
    async Task<ILocator> DemoAsync()
    {
        await GoAsync("/components/sidebar");
        return await ShowAsync("preview-sidebar-example");
    }

    /// <summary>
    /// A plain settable class, not a positional record: Playwright deserialises an evaluate
    /// result by constructing the type and assigning members, so a type with no parameterless
    /// constructor fails at run time with a message about dynamic creation.
    /// </summary>
    class Shape
    {
        public string State { get; set; } = "";
        public int PanelWidth { get; set; }
        public int GapWidth { get; set; }
        public int TriggerX { get; set; }
        public int InsetX { get; set; }
    }

    async Task<Shape> ReadAsync() => await Page.EvaluateAsync<Shape>("""
        () => {
          const b = document.getElementById('preview-sidebar-example').previousElementSibling;
          const wrapper = b.querySelector('[data-slot="sidebar-wrapper"]');
          const container = b.querySelector('[data-slot="sidebar-container"]');
          const gap = b.querySelector('[data-slot="sidebar-gap"]');
          const trigger = b.querySelector('[data-slot="sidebar-trigger"]');
          const inset = b.querySelector('[data-slot="sidebar-inset"]');
          const frame = b.getBoundingClientRect();
          return {
            state: wrapper.dataset.state,
            panelWidth: Math.round(container.getBoundingClientRect().width),
            gapWidth: Math.round(gap.getBoundingClientRect().width),
            triggerX: Math.round(trigger.getBoundingClientRect().left - frame.left),
            insetX: Math.round(inset.getBoundingClientRect().left - frame.left),
          };
        }
        """);

    [SkippableFact]
    public async Task The_trigger_collapses_the_panel_to_its_icon_width()
    {
        RequireDemo();
        var demo = await DemoAsync();
        var open = await ReadAsync();

        await demo.Locator("[data-slot=\"sidebar-trigger\"]").ClickAsync();
        await Page.WaitForTimeoutAsync(700);
        var shut = await ReadAsync();

        Assert.Equal("expanded", open.State);
        Assert.Equal("collapsed", shut.State);
        Assert.True(shut.PanelWidth < open.PanelWidth / 2,
            $"the panel went {open.PanelWidth} -> {shut.PanelWidth}");
        AssertQuiet();
    }

    /// <summary>
    /// The panel is fixed and takes no space; a spacer beside it reserves the width. If the
    /// spacer does not shrink, nothing to its right can move.
    /// </summary>
    [SkippableFact]
    public async Task The_spacer_shrinks_with_the_panel()
    {
        RequireDemo();
        var demo = await DemoAsync();
        var open = await ReadAsync();

        await demo.Locator("[data-slot=\"sidebar-trigger\"]").ClickAsync();
        await Page.WaitForTimeoutAsync(700);
        var shut = await ReadAsync();

        Assert.True(shut.GapWidth < open.GapWidth, $"the spacer went {open.GapWidth} -> {shut.GapWidth}");
        AssertQuiet();
    }

    [SkippableFact]
    public async Task The_page_beside_it_follows_the_panel()
    {
        RequireDemo();
        var demo = await DemoAsync();
        var open = await ReadAsync();

        await demo.Locator("[data-slot=\"sidebar-trigger\"]").ClickAsync();
        await Page.WaitForTimeoutAsync(700);
        var shut = await ReadAsync();

        Assert.True(shut.InsetX < open.InsetX - 100, $"the page went {open.InsetX} -> {shut.InsetX}");
        Assert.True(shut.TriggerX < open.TriggerX - 100, $"the trigger went {open.TriggerX} -> {shut.TriggerX}");
        AssertQuiet();
    }

    [SkippableFact]
    public async Task The_rail_toggles_it_too()
    {
        RequireDemo();
        var demo = await DemoAsync();
        var open = await ReadAsync();

        await demo.Locator("[data-slot=\"sidebar-rail\"]").ClickAsync(new() { Force = true });
        await Page.WaitForTimeoutAsync(700);

        Assert.NotEqual(open.State, (await ReadAsync()).State);
        AssertQuiet();
    }

    /// <summary>shadcn documents ctrl+b, and this had no shortcut at all.</summary>
    [SkippableFact]
    public async Task Control_b_toggles_it()
    {
        RequireDemo();
        await DemoAsync();
        var open = await ReadAsync();

        await Page.Keyboard.PressAsync("Control+b");
        await Page.WaitForTimeoutAsync(600);

        Assert.NotEqual(open.State, (await ReadAsync()).State);
        AssertQuiet();
    }

    /// <summary>A shortcut that eats a letter is worse than no shortcut.</summary>
    [SkippableFact]
    public async Task Control_b_is_ignored_while_typing()
    {
        RequireDemo();
        await GoAsync("/components/sidebar");
        await ShowAsync("preview-sidebar-header-example");
        await Page.Locator("[data-slot=\"sidebar-input\"]").First.FocusAsync();
        var before = await Page.EvaluateAsync<string>(
            "() => document.querySelector('[data-slot=\"sidebar-wrapper\"]').dataset.state");

        await Page.Keyboard.PressAsync("Control+b");
        await Page.WaitForTimeoutAsync(500);

        Assert.Equal(before, await Page.EvaluateAsync<string>(
            "() => document.querySelector('[data-slot=\"sidebar-wrapper\"]').dataset.state"));
        AssertQuiet();
    }

    /// <summary>
    /// Every wrapper on the page has its own state: a trigger toggles the sidebar it is in and
    /// no other. The docs page carries thirteen of them, which is the only reason this is worth
    /// asserting.
    /// </summary>
    [SkippableFact]
    public async Task A_trigger_toggles_only_its_own_sidebar()
    {
        RequireDemo();
        var demo = await DemoAsync();
        var before = await Page.EvaluateAsync<string[]>(
            "() => [...document.querySelectorAll('[data-slot=\"sidebar-wrapper\"]')].map(w => w.dataset.state)");

        await demo.Locator("[data-slot=\"sidebar-trigger\"]").ClickAsync();
        await Page.WaitForTimeoutAsync(700);
        var after = await Page.EvaluateAsync<string[]>(
            "() => [...document.querySelectorAll('[data-slot=\"sidebar-wrapper\"]')].map(w => w.dataset.state)");

        var moved = before.Zip(after).Count(pair => pair.First != pair.Second);
        Assert.True(moved == 1, $"{moved} of {before.Length} sidebars changed");
        AssertQuiet();
    }

    /// <summary>
    /// Only while collapsed, which is upstream's rule and the only moment the row's own words
    /// are not on screen.
    /// </summary>
    [SkippableFact]
    public async Task A_row_shows_its_tooltip_only_once_the_sidebar_is_collapsed()
    {
        RequireDemo();
        var demo = await DemoAsync();
        var row = demo.Locator("[data-tooltip-target]").First;

        await row.HoverAsync();
        await Page.WaitForTimeoutAsync(500);
        var whileOpen = await OpenTipsAsync();

        await demo.Locator("[data-slot=\"sidebar-trigger\"]").ClickAsync();
        await Page.WaitForTimeoutAsync(700);
        await row.HoverAsync();
        await Page.WaitForTimeoutAsync(500);
        var whileShut = await OpenTipsAsync();

        Assert.Empty(whileOpen);
        Assert.Single(whileShut);
        AssertQuiet();
    }

    async Task<string[]> OpenTipsAsync() => await Page.EvaluateAsync<string[]>(
        "() => [...document.querySelectorAll('[data-slot=\"tooltip-content\"]')]" +
        ".filter(t => t.matches(':popover-open')).map(t => t.textContent.trim())");
}
