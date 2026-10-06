using Microsoft.Playwright;

namespace Unpoly.Blazor.Shadcn.Behaviour;

/// <summary>
/// What ui.js, Motion and ui.behavior.css add to BottomNavBar, LogoCloud, PricingTable,
/// GrowthBusiness and SubscriptionDetails — the parts only a browser can show: a name that
/// unfolds, a strip that moves and stops, a cell that swaps, a price that counts or rolls, a
/// form that comes back as it was left, pieces that wait to be scrolled to.
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

    const string ShownPrices = "s => [...s.querySelectorAll('[data-billing-roll] > [data-billing]')].filter(p => p.offsetParent).map(p => p.textContent)";

    // The SubscriptionDetails demo lays upstream's Unsplash photo along its featured card. A
    // test must not depend on a third party being reachable, so the photo is answered locally.
    async Task StubPhotosAsync() =>
        await Page.RouteAsync("https://images.unsplash.com/**", route => route.FulfillAsync(new()
        {
            ContentType = "image/png",
            BodyBytes = Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="),
        }));

    [SkippableFact]
    public async Task Flipping_the_growth_business_switch_rolls_each_price_to_its_monthly_figure()
    {
        RequireDemo();
        await GoAsync("/components/growth-business");
        var section = (await ShowAsync("preview-growth-business-example")).Locator("[data-slot=growth-business]");
        await Page.WaitForTimeoutAsync(5000);

        var before = await section.EvaluateAsync<string[]>(ShownPrices);
        await section.Locator("[data-slot=switch]").ClickAsync();
        await Page.WaitForTimeoutAsync(150);
        var rolling = await section.Locator("[data-billing-roll] [aria-hidden=true]").CountAsync();
        await Page.WaitForTimeoutAsync(1000);
        var after = await section.EvaluateAsync<string[]>(ShownPrices);
        var leftover = await section.Locator("[data-billing-roll] [aria-hidden=true]").CountAsync();

        Assert.Equal(["23", "47", "79"], before);
        Assert.True(rolling > 0, "no digit columns while the price changed");
        Assert.Equal(["29", "59", "99"], after);
        Assert.Equal(0, leftover);
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Subscription_details_pieces_wait_out_of_sight_and_arrive_once_scrolled_to()
    {
        RequireDemo();
        await StubPhotosAsync();
        await GoAsync("/components/subscription-details");
        var section = Example("preview-subscription-details-custom").Locator("[data-slot=subscription-details]");
        const string Opacities = "s => [...s.querySelectorAll('[data-timeline]')].map(e => Number(getComputedStyle(e).opacity))";

        var before = await section.EvaluateAsync<double[]>(Opacities);
        await section.ScrollIntoViewIfNeededAsync();
        await Page.WaitForTimeoutAsync(3500);
        var after = await section.EvaluateAsync<double[]>(Opacities);

        Assert.True(before.All(o => o == 0), "before scrolling: " + string.Join(",", before));
        Assert.True(after.All(o => o == 1), "after scrolling: " + string.Join(",", after));
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Two_subscription_sections_on_one_page_keep_their_own_billing()
    {
        RequireDemo();
        await StubPhotosAsync();
        await GoAsync("/components/subscription-details");
        var first = Example("preview-subscription-details-example").Locator("[data-slot=subscription-details]");
        var second = Example("preview-subscription-details-custom").Locator("[data-slot=subscription-details]");

        await first.ScrollIntoViewIfNeededAsync();
        await first.Locator("label:has(input[value=yearly])").ClickAsync();
        await Page.WaitForTimeoutAsync(1000);
        var checkedValues = new[]
        {
            await first.Locator("input:checked").GetAttributeAsync("value") ?? "",
            await second.Locator("input:checked").GetAttributeAsync("value") ?? "",
        };

        Assert.Equal(["yearly", "yearly"], checkedValues);
        Assert.Equal(["9", "17", "34", "51"], await first.EvaluateAsync<string[]>(ShownPrices));
        AssertQuiet();
    }
}
