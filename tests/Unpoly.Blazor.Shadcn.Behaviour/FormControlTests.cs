using Microsoft.Playwright;

namespace Unpoly.Blazor.Shadcn.Behaviour;

/// <summary>
/// The controls that post: what they do, and what they look like while doing it.
/// </summary>
/// <remarks>
/// Two of these are here because a parameter existed and did nothing. Toggle's Variant and Size
/// were baked into its base and the switch under them returned "" for everything, and the parity
/// theory never noticed because it renders a component with its DEFAULTS: a table that exists and
/// is never consulted passes.
/// </remarks>
[Collection(DemoCollection.Name)]
[Trait("Module", "Forms")]
public class FormControlTests(DemoFixture fixture) : DemoPage(fixture)
{
    // ---- Select -------------------------------------------------------------------------------

    [SkippableFact]
    public async Task Choosing_a_row_writes_the_value_back_to_the_select_that_posts()
    {
        RequireDemo();
        await GoAsync("/components/select");
        var box = await ShowAsync("preview-select-basic");
        await box.Locator("[data-slot=\"select-trigger\"]").ClickAsync();
        await Page.WaitForTimeoutAsync(300);
        await Page.Locator("[data-slot=\"select-content\"]:popover-open [data-slot=\"select-item\"]").Nth(2).ClickAsync();
        await Page.WaitForTimeoutAsync(300);

        var state = await Page.EvaluateAsync<string>("""
            () => {
              const select = document.querySelector('#kind');
              const shown = select.parentElement.querySelector('[data-slot="select-value"]').textContent.trim();
              const open = !!document.querySelector('[data-slot="select-content"]:popover-open');
              return select.value + '|' + shown + '|' + open;
            }
            """);

        Assert.Equal("shoes|Shoes|False", state.Replace("|false", "|False"));
        AssertQuiet();
    }

    /// <summary>Radix locks it; the platform does not — a popover's background is inert to
    /// clicks and to the keyboard, but the wheel still reaches it.</summary>
    [SkippableFact]
    public async Task The_page_cannot_scroll_while_a_list_is_open()
    {
        RequireDemo();
        await GoAsync("/components/select");
        var box = await ShowAsync("preview-select-basic");
        var before = await Page.EvaluateAsync<int>("() => Math.round(scrollY)");

        await box.Locator("[data-slot=\"select-trigger\"]").ClickAsync();
        await Page.WaitForTimeoutAsync(300);
        await Page.Mouse.WheelAsync(0, 500);
        await Page.WaitForTimeoutAsync(400);

        Assert.Equal(before, await Page.EvaluateAsync<int>("() => Math.round(scrollY)"));
        AssertQuiet();
    }

    [SkippableFact]
    public async Task The_page_scrolls_again_once_the_list_closes()
    {
        RequireDemo();
        await GoAsync("/components/select");
        var box = await ShowAsync("preview-select-basic");
        var before = await Page.EvaluateAsync<int>("() => Math.round(scrollY)");
        await box.Locator("[data-slot=\"select-trigger\"]").ClickAsync();
        await Page.WaitForTimeoutAsync(300);

        await Page.Keyboard.PressAsync("Escape");
        await Page.WaitForTimeoutAsync(300);
        await Page.Mouse.WheelAsync(0, 400);
        await Page.WaitForTimeoutAsync(400);

        Assert.True(await Page.EvaluateAsync<int>("() => Math.round(scrollY)") > before);
        AssertQuiet();
    }

    /// <summary>The list opens with the chosen row over the trigger, so the value you already
    /// have does not move under the pointer.</summary>
    [SkippableFact]
    public async Task The_list_opens_with_the_chosen_row_over_the_trigger()
    {
        RequireDemo();
        await GoAsync("/components/select");
        var box = await ShowAsync("preview-select-align");
        await box.Locator("[data-slot=\"select-trigger\"]").ClickAsync();
        await Page.WaitForTimeoutAsync(400);

        var offset = await Page.EvaluateAsync<int>("""
            () => {
              const panel = [...document.querySelectorAll('[data-slot="select-content"]')].find(p => p.matches(':popover-open'));
              const trigger = document.querySelector('#sa-size').parentElement.querySelector('[data-slot="select-trigger"]');
              const chosen = panel.querySelector('[data-slot="select-item"][data-selected="true"]');
              return Math.round(chosen.getBoundingClientRect().top - trigger.getBoundingClientRect().top);
            }
            """);

        Assert.True(Math.Abs(offset) <= 8, $"the chosen row is {offset}px from the trigger");
        AssertQuiet();
    }

    [SkippableFact]
    public async Task A_disabled_select_is_still_drawn_as_a_select()
    {
        RequireDemo();
        await GoAsync("/components/select");
        await ShowAsync("preview-select-disabled");

        var drawn = await Page.EvaluateAsync<bool>("""
            () => {
              const trigger = [...document.querySelectorAll('[data-slot="select-trigger"]')].find(t => t.disabled);
              if (!trigger) return false;
              const style = getComputedStyle(trigger);
              return !!trigger.querySelector('svg') && Number(style.opacity) < 1 && style.cursor === 'not-allowed';
            }
            """);

        Assert.True(drawn, "a disabled select kept the browser's own control instead of the recipe");
        AssertQuiet();
    }

    // ---- Toggle -------------------------------------------------------------------------------

    [SkippableFact]
    public async Task The_outline_toggle_has_a_border()
    {
        RequireDemo();
        await GoAsync("/components/toggle");
        var box = await ShowAsync("preview-toggle-outline");

        var border = await box.Locator("[data-slot=\"toggle\"]").First
            .EvaluateAsync<string>("t => getComputedStyle(t).borderTopWidth + ' ' + getComputedStyle(t).borderTopColor");

        Assert.DoesNotContain("0px", border);
        Assert.Contains("oklch", border);
        AssertQuiet();
    }

    [SkippableFact]
    public async Task The_three_toggle_sizes_are_three_heights()
    {
        RequireDemo();
        await GoAsync("/components/toggle");
        var box = await ShowAsync("preview-toggle-size");

        var heights = await box.Locator("[data-slot=\"toggle\"]")
            .EvaluateAllAsync<int[]>("all => all.map(t => t.offsetHeight)");

        Assert.Equal([32, 36, 40], heights);
        AssertQuiet();
    }

    /// <summary>The root is a label, and a label is never :disabled — only the input is.</summary>
    [SkippableFact]
    public async Task A_disabled_toggle_dims()
    {
        RequireDemo();
        await GoAsync("/components/toggle");
        var box = await ShowAsync("preview-toggle-disabled");

        var opacity = await box.Locator("[data-slot=\"toggle\"]")
            .EvaluateAllAsync<double[]>("all => all.map(t => Number(getComputedStyle(t).opacity))");

        Assert.All(opacity, o => Assert.True(o < 1, "a disabled toggle looked exactly like an enabled one"));
        AssertQuiet();
    }

    /// <summary>shadcn interpolates the chosen weight; there is no state here, so all four words
    /// are in the markup and :has() picks.</summary>
    [SkippableFact]
    public async Task The_font_weight_group_rewrites_its_description()
    {
        RequireDemo();
        await GoAsync("/components/toggle-group");
        var box = await ShowAsync("preview-toggle-group-custom");

        foreach (var (label, word) in new[] { ("Light", "font-light"), ("Bold", "font-bold") })
        {
            await box.Locator($"[data-slot=\"toggle-group-item\"][aria-label=\"{label}\"]").ClickAsync();
            await Page.WaitForTimeoutAsync(250);

            var shown = await box.Locator("[data-slot=\"field-description\"]")
                .EvaluateAsync<string>("d => d.innerText.replace(/\\s+/g, ' ').trim()");
            Assert.Contains(word, shown);
        }
        AssertQuiet();
    }

    // ---- Slider -------------------------------------------------------------------------------

    /// <summary>Logical properties turn with the writing mode: once the box is vertical,
    /// inline-size IS the height and the gradient's "to right" runs across six pixels.</summary>
    [SkippableFact]
    public async Task A_vertical_slider_is_taller_than_it_is_wide()
    {
        RequireDemo();
        await GoAsync("/components/slider");
        await ShowAsync("preview-slider-vertical");

        var shape = await Page.Locator("[data-slot=\"slider\"][data-orientation=\"vertical\"]").First
            .EvaluateAsync<int[]>("s => [Math.round(s.getBoundingClientRect().width), Math.round(s.getBoundingClientRect().height)]");

        Assert.Equal(16, shape[0]);
        Assert.True(shape[1] > 100, $"it is only {shape[1]}px tall");
        AssertQuiet();
    }

    /// <summary>`id` at the call site was captured by the Id parameter and never reached the
    /// element, so every label and output pointing at a slider addressed nothing.</summary>
    [SkippableFact]
    public async Task The_output_follows_the_slider_it_names()
    {
        RequireDemo();
        await GoAsync("/components/slider");
        await ShowAsync("preview-slider-controlled");
        var output = Page.Locator("output[for=\"slider-temperature\"]");
        var before = await output.InnerTextAsync();

        await Page.Locator("#slider-temperature").FocusAsync();
        await Page.Keyboard.PressAsync("ArrowRight");
        await Page.Keyboard.PressAsync("ArrowRight");
        await Page.WaitForTimeoutAsync(300);

        Assert.NotEqual(before, await output.InnerTextAsync());
        AssertQuiet();
    }

    // ---- Switch -------------------------------------------------------------------------------

    /// <summary>The thumb was 1rem at every size, so in a 24x14 track it was taller than the
    /// track and the background showed past it.</summary>
    [SkippableFact]
    public async Task The_small_switch_thumb_fits_inside_its_track()
    {
        RequireDemo();
        await GoAsync("/components/switch");
        await ShowAsync("preview-switch-size");

        var thumbs = await Page.Locator("[data-slot=\"switch\"][data-size=\"sm\"]")
            .EvaluateAllAsync<double[]>("all => all.map(s => parseFloat(getComputedStyle(s, '::after').height))");

        Assert.NotEmpty(thumbs);
        Assert.All(thumbs, h => Assert.True(h <= 12, $"the thumb is {h}px in a 14px track"));
        AssertQuiet();
    }
}
