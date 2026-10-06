using Microsoft.Playwright;

namespace Unpoly.Blazor.Shadcn.Behaviour;

/// <summary>
/// What ui.js, Motion and ui.behavior.css add to BottomNavBar, LogoCloud and PricingTable — the
/// parts only a browser can show: a name that unfolds, a strip that moves and stops, a cell that
/// swaps, a price that counts, a form that comes back as it was left.
/// </summary>
[Collection(DemoCollection.Name)]
[Trait("Module", "Sections")]
public class SectionComponentTests(DemoFixture fixture) : DemoPage(fixture)
{
    [SkippableFact]
    public async Task Picking_a_bottom_nav_tab_unfolds_its_name_and_folds_the_last_one()
    {
        RequireDemo();
        await GoAsync("/components/bottom-nav-bar");
        var bar = (await ShowAsync("preview-bottom-nav-bar-example")).Locator("[data-slot=bottom-nav-bar]");

        await bar.Locator("[data-slot=bottom-nav-bar-item]").Nth(2).ClickAsync();
        await Page.WaitForTimeoutAsync(900);
        var widths = await bar.Locator("[data-slot=bottom-nav-bar-label]")
            .EvaluateAllAsync<int[]>("ls => ls.map(l => Math.round(l.getBoundingClientRect().width))");

        Assert.True(widths[2] > 20 && widths.Where((_, i) => i != 2).All(w => w == 0), "label widths: " + string.Join(",", widths));
        Assert.Equal("true", await bar.Locator("[data-slot=bottom-nav-bar-item]").Nth(2).GetAttributeAsync("aria-pressed"));
        AssertQuiet();
    }

    [SkippableFact]
    public async Task A_marquee_moves_on_its_own_and_stops_under_the_pointer()
    {
        RequireDemo();
        await GoAsync("/components/logo-cloud");
        var viewport = (await ShowAsync("preview-logo-cloud-marquee")).Locator("[data-slot=logo-cloud-viewport]");
        const string Offset = "v => new DOMMatrix(getComputedStyle(v.querySelector('[data-slot=logo-cloud-track]')).transform).m41";

        var first = await viewport.EvaluateAsync<double>(Offset);
        await Page.WaitForTimeoutAsync(400);
        var moving = await viewport.EvaluateAsync<double>(Offset);
        await viewport.HoverAsync();
        await Page.WaitForTimeoutAsync(100);
        var paused = await viewport.EvaluateAsync<double>(Offset);
        await Page.WaitForTimeoutAsync(400);
        var still = await viewport.EvaluateAsync<double>(Offset);

        Assert.True(moving < first, $"left alone: {first:0.0} → {moving:0.0}");
        Assert.True(Math.Abs(still - paused) < 0.5, $"under the pointer: {paused:0.0} → {still:0.0}");
        AssertQuiet();
    }

    [SkippableFact]
    public async Task A_swap_cloud_brings_a_queued_logo_into_a_cell_and_keeps_the_count()
    {
        RequireDemo();
        await GoAsync("/components/logo-cloud");
        var list = (await ShowAsync("preview-logo-cloud-swap")).Locator("[data-slot=logo-cloud-list]");
        const string Shown = "l => [...l.children].filter(c => !c.hidden).map(c => c.textContent.trim())";

        var before = await list.EvaluateAsync<string[]>(Shown);
        await Page.WaitForTimeoutAsync(3600);
        var after = await list.EvaluateAsync<string[]>(Shown);

        Assert.Equal(6, after.Length);
        Assert.True(after.Except(before).Any(), $"before: {string.Join(",", before)} | after: {string.Join(",", after)}");
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Switching_billing_counts_each_price_to_its_new_value()
    {
        RequireDemo();
        await GoAsync("/components/pricing-table");
        var table = (await ShowAsync("preview-pricing-table-example")).Locator("[data-slot=pricing-table]");
        const string Shown = "t => [...t.querySelectorAll('[data-slot=pricing-table-price]')].filter(p => p.offsetParent).map(p => Number(p.textContent.replace(/[^0-9.]/g, '')))";

        await table.Locator("label:has(input[value=yearly])").ClickAsync();
        await Page.WaitForTimeoutAsync(150);
        var counting = await table.EvaluateAsync<double[]>(Shown);
        await Page.WaitForTimeoutAsync(900);
        var settled = await table.EvaluateAsync<double[]>(Shown);

        // Mid-count the Pro price is between its monthly 49 and its yearly 470.
        Assert.True(counting[1] > 49 && counting[1] < 470, "while counting: " + string.Join(",", counting));
        Assert.Equal([144d, 470d, 990d], settled);
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Choosing_a_plan_lights_its_column_and_names_the_button()
    {
        RequireDemo();
        await GoAsync("/components/pricing-table");
        var table = (await ShowAsync("preview-pricing-table-example")).Locator("[data-slot=pricing-table]");

        await table.Locator("label:has(input[value=Starter])").ClickAsync();
        var lit = await table.Locator("[data-slot=pricing-table-matrix] [data-selected=true]")
            .EvaluateAllAsync<string[]>("cs => [...new Set(cs.map(c => c.dataset.plan))]");

        Assert.Equal(["Starter"], lit);
        Assert.Equal("Starter", await table.Locator("[data-slot=pricing-table-choice]").TextContentAsync());
        AssertQuiet();
    }

    [SkippableFact]
    public async Task A_pricing_table_submits_the_choice_and_comes_back_as_it_was_left()
    {
        RequireDemo();
        await GoAsync("/components/pricing-table");
        var table = (await ShowAsync("preview-pricing-table-example")).Locator("[data-slot=pricing-table]");

        await table.Locator("label:has(input[value=yearly])").ClickAsync();
        await table.Locator("label:has(input[value=Enterprise])").ClickAsync();
        await table.Locator("button[type=submit]").ClickAsync();
        await Page.WaitForURLAsync("**/components/pricing-table?*");
        await Page.WaitForTimeoutAsync(300);
        var back = Example("preview-pricing-table-example").Locator("[data-slot=pricing-table]");
        var checkedValues = await back.Locator("input:checked").EvaluateAllAsync<string[]>("is => is.map(i => i.value)");

        Assert.Contains("billing=yearly", Page.Url);
        Assert.Equal(["yearly", "Enterprise"], checkedValues);
        AssertQuiet();
    }
}
