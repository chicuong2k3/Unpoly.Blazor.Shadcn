using Microsoft.Playwright;

namespace Unpoly.Blazor.Shadcn.Behaviour;

/// <summary>
/// Tabs, the command palette and the toast: the three places where a keyboard or a click has to
/// reach the right thing.
/// </summary>
[Collection(DemoCollection.Name)]
[Trait("Module", "Navigation")]
public class NavigationTests(DemoFixture fixture) : DemoPage(fixture)
{
    // ---- Tabs ---------------------------------------------------------------------------------

    [SkippableFact]
    public async Task Clicking_a_tab_shows_exactly_its_panel()
    {
        RequireDemo();
        await GoAsync("/components/tabs");
        var box = await ShowAsync("preview-tabs-example");

        await box.Locator("[data-slot=\"tabs-trigger\"]").Nth(1).ClickAsync();
        await Page.WaitForTimeoutAsync(300);

        var shown = await box.Locator("[data-slot=\"tabs-content\"]")
            .EvaluateAllAsync<string[]>("all => all.filter(c => !c.hidden).map(c => c.dataset.value)");

        Assert.Single(shown);
        Assert.Equal("password", shown[0]);
        AssertQuiet();
    }

    /// <summary>
    /// This page puts every example inside its own Preview/Code tabs, so an example that is a tab
    /// strip is a Tabs inside a Tabs — and both compilers saw the same bubbled key. The outer one
    /// could not find the trigger in its own list and moved focus to its own first tab.
    /// </summary>
    [SkippableFact]
    public async Task An_arrow_key_keeps_focus_inside_the_strip_it_started_in()
    {
        RequireDemo();
        await GoAsync("/components/tabs");
        var box = await ShowAsync("preview-tabs-example");
        await box.Locator("[data-slot=\"tabs-trigger\"]").First.FocusAsync();

        await Page.Keyboard.PressAsync("ArrowRight");
        await Page.WaitForTimeoutAsync(300);

        var where = await Page.EvaluateAsync<string>("""
            () => {
              const active = document.activeElement;
              const box = document.getElementById('preview-tabs-example').previousElementSibling;
              return (active?.dataset?.slot ?? 'none') + '|' + box.contains(active);
            }
            """);

        Assert.Equal("tabs-trigger|True", where.Replace("|true", "|True"));
        AssertQuiet();
    }

    /// <summary>A screen reader could reach the strip and never reach what it opens.</summary>
    [SkippableFact]
    public async Task A_tab_and_its_panel_name_each_other()
    {
        RequireDemo();
        await GoAsync("/components/tabs");
        var box = await ShowAsync("preview-tabs-example");

        var wired = await Page.EvaluateAsync<bool>("""
            () => {
              const b = document.getElementById('preview-tabs-example').previousElementSibling;
              const tab = b.querySelector('[data-slot="tabs-trigger"]');
              const panel = b.querySelector('[data-slot="tabs-content"]');
              return tab.getAttribute('aria-controls') === panel.id && panel.id.length > 0
                  && panel.getAttribute('aria-labelledby') === tab.id && tab.id.length > 0;
            }
            """);

        Assert.True(wired, "aria-controls and aria-labelledby are not wired");
        AssertQuiet();
    }

    /// <summary>Several strips on one page must not mint the same ids.</summary>
    [SkippableFact]
    public async Task Every_panel_on_the_page_has_its_own_id()
    {
        RequireDemo();
        await GoAsync("/components/tabs");

        var duplicates = await Page.EvaluateAsync<string[]>("""
            () => {
              const ids = [...document.querySelectorAll('[data-slot="tabs-content"]')].map(c => c.id);
              return ids.filter((id, i) => ids.indexOf(id) !== i);
            }
            """);

        Assert.Empty(duplicates);
        AssertQuiet();
    }

    /// <summary>The line variant exists because there is no pill, only an underline.</summary>
    [SkippableFact]
    public async Task The_line_variant_draws_no_pill()
    {
        RequireDemo();
        await GoAsync("/components/tabs");
        var box = await ShowAsync("preview-tabs-line");

        var background = await box.Locator("[data-slot=\"tabs-list\"]")
            .EvaluateAsync<string>("l => getComputedStyle(l).backgroundColor");

        Assert.Equal("rgba(0, 0, 0, 0)", background);
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Vertical_tabs_put_the_panel_beside_the_list()
    {
        RequireDemo();
        await GoAsync("/components/tabs");
        await ShowAsync("preview-tabs-vertical");

        var beside = await Page.EvaluateAsync<bool>("""
            () => {
              const b = document.getElementById('preview-tabs-vertical').previousElementSibling;
              const list = b.querySelector('[data-slot="tabs-list"]');
              const shown = [...b.querySelectorAll('[data-slot="tabs-content"]')].find(c => !c.hidden);
              return getComputedStyle(list).flexDirection === 'column'
                  && shown.getBoundingClientRect().left >= list.getBoundingClientRect().right - 2;
            }
            """);

        Assert.True(beside, "the panel is under the list rather than beside it");
        AssertQuiet();
    }

    // ---- Command ------------------------------------------------------------------------------

    [SkippableFact]
    public async Task The_down_arrow_moves_the_selection_down()
    {
        RequireDemo();
        await GoAsync("/components/command");
        var box = await ShowAsync("preview-command-example");
        await box.Locator("[data-slot=\"command-input\"]").FocusAsync();

        var first = await SelectedIndexAsync("preview-command-example");
        await Page.Keyboard.PressAsync("ArrowDown");
        await Page.WaitForTimeoutAsync(250);
        var second = await SelectedIndexAsync("preview-command-example");

        Assert.Equal(first + 1, second);
        AssertQuiet();
    }

    [SkippableFact]
    public async Task The_up_arrow_moves_it_back()
    {
        RequireDemo();
        await GoAsync("/components/command");
        var box = await ShowAsync("preview-command-example");
        await box.Locator("[data-slot=\"command-input\"]").FocusAsync();
        await Page.Keyboard.PressAsync("ArrowDown");
        await Page.Keyboard.PressAsync("ArrowDown");
        await Page.WaitForTimeoutAsync(250);
        var before = await SelectedIndexAsync("preview-command-example");

        await Page.Keyboard.PressAsync("ArrowUp");
        await Page.WaitForTimeoutAsync(250);

        Assert.Equal(before - 1, await SelectedIndexAsync("preview-command-example"));
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Typing_filters_the_list()
    {
        RequireDemo();
        await GoAsync("/components/command");
        var box = await ShowAsync("preview-command-example");
        var input = box.Locator("[data-slot=\"command-input\"]");
        var all = await box.Locator("[data-slot=\"command-item\"]:not([hidden])").CountAsync();

        await input.FillAsync("tab");
        await Page.WaitForTimeoutAsync(300);

        var shown = await box.Locator("[data-slot=\"command-item\"]:not([hidden])").CountAsync();
        Assert.True(shown < all && shown > 0, $"{all} items became {shown}");
        AssertQuiet();
    }

    async Task<int> SelectedIndexAsync(string preview) => await Page.EvaluateAsync<int>("""
        preview => {
          const b = document.getElementById(preview).previousElementSibling;
          const items = [...b.querySelectorAll('[data-slot="command-item"]:not([hidden])')];
          return items.findIndex(i => i.dataset.selected === 'true');
        }
        """, preview);

    // ---- Toast --------------------------------------------------------------------------------

    /// <summary>The toast's own CSS sat in a layer that toastify.css beat, so none of it applied
    /// and the box kept Toastify's 2px radius and transparent background.</summary>
    [SkippableFact]
    public async Task A_toast_wears_the_popover_surface()
    {
        RequireDemo();
        await GoAsync("/components/toast");
        var box = await ShowAsync("preview-toast-types");
        await box.Locator("button").First.ClickAsync();
        await Page.WaitForTimeoutAsync(500);

        var shape = await Page.Locator("[data-slot=\"sonner-toast\"]").First.EvaluateAsync<string>("""
            t => {
              const s = getComputedStyle(t);
              return [s.backgroundColor, s.borderRadius, s.fontSize, !!t.querySelector('svg')].join('|');
            }
            """);

        Assert.DoesNotContain("rgba(0, 0, 0, 0)", shape);
        Assert.DoesNotContain("2px", shape);
        Assert.EndsWith("|True", shape.Replace("|true", "|True"));
        AssertQuiet();
    }

    /// <summary>toast() read its options for the type and the duration and never for `action`.</summary>
    [SkippableFact]
    public async Task A_toast_with_an_action_draws_a_button_that_works()
    {
        RequireDemo();
        await GoAsync("/components/toast");
        var box = await ShowAsync("preview-toast-action");
        await box.Locator("button", new() { HasTextString = "With an undo" }).ClickAsync();
        await Page.WaitForTimeoutAsync(500);

        var action = Page.Locator("[data-slot=\"sonner-action\"]");
        Assert.Equal("Undo", (await action.InnerTextAsync()).Trim());

        await action.ClickAsync();
        await Page.WaitForTimeoutAsync(600);

        var left = await Page.Locator("[data-slot=\"sonner-toast\"]")
            .EvaluateAllAsync<string[]>("all => all.map(t => t.textContent.trim())");
        Assert.Single(left);
        Assert.Contains("restored", left[0]);
        AssertQuiet();
    }
}
