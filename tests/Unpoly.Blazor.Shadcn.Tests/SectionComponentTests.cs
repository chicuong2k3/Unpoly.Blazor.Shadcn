using System.Globalization;
using Bunit;
using Unpoly.Blazor.Shadcn.Components;

namespace Unpoly.Blazor.Shadcn.Tests;

/// <summary>
/// BottomNavBar, LogoCloud and PricingTable were built from 21st.dev descriptions; GrowthBusiness
/// and SubscriptionDetails are ports of ui-layouts blocks. None has a shadcn upstream for the
/// parity theory to compare. These pin what each promises before ui.js and Motion add any
/// movement: the markup that works, and reads, with scripting off.
/// </summary>
public class SectionComponentTests : BunitContext
{
    // ---- BottomNavBar -------------------------------------------------------------------------

    IRenderedComponent<BottomNavBar> NavBar(bool sticky = false) => Render<BottomNavBar>(p => p
        .Add(x => x.StickyBottom, sticky)
        .AddChildContent<BottomNavBarItem>(i => i.Add(x => x.Label, "Home").Add(x => x.Active, true).AddChildContent("<svg></svg>"))
        .AddChildContent<BottomNavBarItem>(i => i.Add(x => x.Label, "Search").AddChildContent("<svg></svg>")));

    [Fact]
    public void A_folded_bottom_nav_tab_still_carries_its_name()
    {
        // The inactive tab shows only its icon; its name is folded, not removed, so it is still
        // what a screen reader announces.
        var names = NavBar().FindAll("[data-slot=bottom-nav-bar-item]").Select(i => i.TextContent.Trim());

        Assert.Equal(["Home", "Search"], names);
    }

    [Fact]
    public void Only_the_active_bottom_nav_tab_is_marked_active()
    {
        var active = NavBar().FindAll("[data-slot=bottom-nav-bar-item][data-active=true]");

        Assert.Equal("Home", Assert.Single(active).TextContent.Trim());
    }

    [Fact]
    public void A_bottom_nav_tab_without_href_is_a_button_reporting_whether_it_is_pressed()
    {
        var pressed = NavBar().FindAll("button[data-slot=bottom-nav-bar-item]").Select(b => (b.GetAttribute("type"), b.GetAttribute("aria-pressed")));

        Assert.Equal([("button", "true"), ("button", "false")], pressed);
    }

    [Fact]
    public void A_bottom_nav_link_marks_the_current_page_for_a_screen_reader()
    {
        var link = Render<BottomNavBarItem>(p => p.Add(x => x.Href, "/inbox").Add(x => x.Active, true)).Find("a");

        Assert.Equal("page", link.GetAttribute("aria-current"));
    }

    [Theory]
    [InlineData(true, true)]
    [InlineData(false, false)]
    public void StickyBottom_pins_the_bar_to_the_window_only_when_asked(bool sticky, bool pinned)
    {
        var classes = NavBar(sticky).Find("[data-slot=bottom-nav-bar]").ClassList;

        Assert.Equal(pinned, classes.Contains("fixed") && classes.Contains("bottom-4"));
    }

    // ---- LogoCloud ----------------------------------------------------------------------------

    IRenderedComponent<LogoCloud> Cloud(string variant, int logos, int visible = 6) => Render<LogoCloud>(p =>
    {
        p.Add(x => x.Variant, variant).Add(x => x.Visible, visible);
        for (var i = 1; i <= logos; i++)
        {
            var name = $"Logo {i}";
            p.AddChildContent<LogoCloudItem>(item => item.AddChildContent(name));
        }
    });

    [Fact]
    public void A_logo_cloud_is_a_list_of_its_logos()
    {
        var items = Cloud("default", 3).FindAll("ul[data-slot=logo-cloud-list] > li[data-slot=logo-cloud-item]");

        Assert.Equal(["Logo 1", "Logo 2", "Logo 3"], items.Select(i => i.TextContent));
    }

    [Fact]
    public void A_marquee_writes_its_second_copy_inert_and_hidden_from_assistive_technology()
    {
        var lists = Cloud("marquee", 3).FindAll("[data-slot=logo-cloud-track] > ul");

        Assert.Equal(2, lists.Count);
        Assert.False(lists[0].HasAttribute("aria-hidden"));
        Assert.Equal("true", lists[1].GetAttribute("aria-hidden"));
        Assert.True(lists[1].HasAttribute("inert"));
    }

    [Fact]
    public void A_swap_cloud_shows_Visible_logos_and_queues_the_rest_hidden()
    {
        var items = Cloud("swap", 5, visible: 2).FindAll("[data-slot=logo-cloud-item]");

        Assert.Equal([false, false, true, true, true], items.Select(i => i.HasAttribute("hidden")));
    }

    [Fact]
    public void Only_a_swap_cloud_hides_any_logo()
    {
        var hidden = Cloud("spotlight", 9, visible: 2).FindAll("[data-slot=logo-cloud-item][hidden]");

        Assert.Empty(hidden);
    }

    [Theory]
    [InlineData("MARQUEE", "marquee")]
    [InlineData(" swap ", "swap")]
    [InlineData("confetti", "default")]
    public void A_logo_cloud_variant_is_read_leniently(string given, string read)
    {
        Assert.Equal(read, Cloud(given, 1).Find("[data-slot=logo-cloud]").GetAttribute("data-variant"));
    }

    // ---- PricingTable -------------------------------------------------------------------------

    static readonly PricingPlan[] Plans =
    [
        new("Starter", 15, 144),
        new("Pro", 49, 470) { Popular = true },
        new("Enterprise", 99, 990),
    ];

    static readonly PricingFeature[] Features =
    [
        new("Analytics", "Starter"),
        new("Priority support", "Pro"),
        new("Phone support", "Enterprise"),
        new("Time travel", "Platinum"),
    ];

    IRenderedComponent<PricingTable> Table(string? selected = null, string billing = "monthly") => Render<PricingTable>(p => p
        .Add(x => x.Plans, Plans).Add(x => x.Features, Features)
        .Add(x => x.Action, "/signup").Add(x => x.SelectedPlan, selected).Add(x => x.Billing, billing));

    [Fact]
    public void A_pricing_table_is_a_get_form_that_submits_plan_and_billing()
    {
        var form = Table().Find("form[data-slot=pricing-table]");

        Assert.Equal("get", form.GetAttribute("method"));
        Assert.Equal("/signup", form.GetAttribute("action"));
        Assert.Equal(["billing", "plan"], form.QuerySelectorAll("input[type=radio]").Select(i => i.GetAttribute("name")).Distinct().Order());
        Assert.Single(form.QuerySelectorAll("button[type=submit]"));
    }

    [Theory]
    [InlineData(0, "Included,Included,Included")]
    [InlineData(1, "Not included,Included,Included")]
    [InlineData(2, "Not included,Not included,Included")]
    [InlineData(3, "Not included,Not included,Not included")]
    public void A_feature_is_included_from_its_plan_onwards(int row, string expected)
    {
        var cells = Table().FindAll("tbody tr")[row].QuerySelectorAll("td svg title").Select(t => t.TextContent);

        Assert.Equal(expected, string.Join(",", cells));
    }

    [Fact]
    public void Without_a_selection_the_popular_plan_is_checked()
    {
        var checkedPlan = Table().Find("input[name=plan][checked]");

        Assert.Equal("Pro", checkedPlan.GetAttribute("value"));
    }

    [Fact]
    public void The_selected_plan_lights_its_column_and_names_the_button()
    {
        var table = Table(selected: "Enterprise");

        Assert.All(table.FindAll("[data-selected=true]"), c => Assert.Equal("Enterprise", c.GetAttribute("data-plan")));
        Assert.Equal(1 + Features.Length, table.FindAll("[data-selected=true]").Count);
        Assert.Equal("Enterprise", table.Find("[data-slot=pricing-table-choice]").TextContent);
    }

    [Theory]
    [InlineData("yearly", "yearly")]
    [InlineData("Yearly", "yearly")]
    [InlineData("weekly", "monthly")]
    public void The_billing_given_is_the_radio_checked(string billing, string expected)
    {
        Assert.Equal(expected, Table(billing: billing).Find("input[name=billing][checked]").GetAttribute("value"));
    }

    [Fact]
    public void Every_plan_writes_both_prices_for_the_css_to_choose_between()
    {
        var prices = Table().FindAll("[data-slot=pricing-table-plan]")[1].QuerySelectorAll("[data-slot=pricing-table-price]")
            .Select(p => (p.GetAttribute("data-billing"), p.TextContent));

        Assert.Equal([("monthly", "$49"), ("yearly", "$470")], prices);
    }

    [Fact]
    public void Prices_are_written_invariantly_whatever_the_culture()
    {
        // data-value is read back by ui.js as a JavaScript number; under a comma-decimal culture
        // "1234,5" would read as NaN and the count would have nowhere to go.
        var culture = CultureInfo.CurrentCulture;
        CultureInfo.CurrentCulture = new CultureInfo("de-DE");
        try
        {
            var price = Render<PricingTable>(p => p
                    .Add(x => x.Plans, [new PricingPlan("Big", 1234.5m, 12345m)])
                    .Add(x => x.Features, []))
                .Find("[data-slot=pricing-table-price][data-billing=monthly]");

            Assert.Equal(("1234.5", "2", "$1,234.50"), (price.GetAttribute("data-value"), price.GetAttribute("data-decimals"), price.TextContent));
        }
        finally
        {
            CultureInfo.CurrentCulture = culture;
        }
    }

    // ---- GrowthBusiness, SubscriptionDetails ----------------------------------------------------

    static string[] Shown<T>(IRenderedComponent<T> section, string billing) where T : Microsoft.AspNetCore.Components.IComponent =>
        section.FindAll($"[data-billing-roll] > [data-billing={billing}]").Select(p => p.TextContent).ToArray();

    [Fact]
    public void GrowthBusiness_ships_upstreams_three_plans_with_the_middle_one_featured()
    {
        var cards = Render<GrowthBusiness>().FindAll("[data-timeline] > div > [data-timeline]");

        Assert.Equal(["Basic Plan", "Business Plan", "Premium Plan"], cards.Select(c => c.QuerySelector("h3")!.TextContent));
        Assert.Equal([false, true, false], cards.Select(c => c.GetAttribute("data-featured") == "true"));
    }

    [Fact]
    public void GrowthBusiness_writes_every_price_for_both_billings()
    {
        var section = Render<GrowthBusiness>();

        Assert.Equal(["29", "59", "99"], Shown(section, "monthly"));
        Assert.Equal(["23", "47", "79"], Shown(section, "yearly"));
    }

    [Theory]
    [InlineData(null, true, "yearly")]
    [InlineData("monthly", false, "monthly")]
    public void The_growth_business_switch_starts_on_yearly_as_upstream_does(string? billing, bool on, string scope)
    {
        var section = Render<GrowthBusiness>(p => { if (billing is not null) p.Add(x => x.Billing, billing); });

        Assert.Equal(on, section.Find("[data-slot=switch]").HasAttribute("checked"));
        Assert.Equal(scope, section.Find("[data-slot=growth-business]").GetAttribute("data-billing-scope"));
    }

    [Fact]
    public void A_plan_with_an_href_gets_a_link_and_one_without_a_button_that_does_not_submit()
    {
        var section = Render<GrowthBusiness>(p => p.Add(x => x.Plans,
        [
            new PricingTier("A", "a", 1, 1, ["x"]) { Href = "/signup?plan=a" },
            new PricingTier("B", "b", 2, 2, ["y"]),
        ]));

        Assert.Equal("/signup?plan=a", section.Find("a").GetAttribute("href"));
        Assert.Equal("button", section.Find("button").GetAttribute("type"));
    }

    [Fact]
    public void SubscriptionDetails_ships_upstreams_annual_prices_as_its_own_sums()
    {
        // Upstream rounds 85% of each monthly price; the defaults carry those results.
        var section = Render<SubscriptionDetails>();

        Assert.Equal(["10", "20", "40", "60"], Shown(section, "monthly"));
        Assert.Equal(["9", "17", "34", "51"], Shown(section, "yearly"));
    }

    [Fact]
    public void Two_subscription_sections_never_share_a_radio_group()
    {
        // Radios outside a form group by name across the page: a shared name let the second
        // section uncheck the first one's billing.
        var first = Render<SubscriptionDetails>().Find("input[type=radio]").GetAttribute("name");
        var second = Render<SubscriptionDetails>().Find("input[type=radio]").GetAttribute("name");

        Assert.NotEqual(first, second);
    }

    [Fact]
    public void The_featured_photo_is_only_in_the_markup_when_given()
    {
        Assert.Empty(Render<SubscriptionDetails>().FindAll("img"));

        var img = Render<SubscriptionDetails>(p => p.Add(x => x.FeaturedImage, "/photo.jpg")).Find("[data-featured=true] img");
        Assert.Equal(("/photo.jpg", ""), (img.GetAttribute("src"), img.GetAttribute("alt")));
    }

    [Fact]
    public void A_null_question_leaves_the_row_under_the_cards_out()
    {
        Assert.Single(Render<SubscriptionDetails>().FindAll("h3"));
        Assert.Empty(Render<SubscriptionDetails>(p => p.Add(x => x.Question, null)).FindAll("h3"));
    }

    [Fact]
    public void Section_prices_are_written_invariantly_whatever_the_culture()
    {
        var culture = CultureInfo.CurrentCulture;
        CultureInfo.CurrentCulture = new CultureInfo("de-DE");
        try
        {
            var section = Render<SubscriptionDetails>(p => p.Add(x => x.Plans,
                [new PricingTier("Big", "b", 1234.5m, 12000m, ["x"])]));

            Assert.Equal(["1,234.50"], Shown(section, "monthly"));
            Assert.Equal(["12,000"], Shown(section, "yearly"));
        }
        finally
        {
            CultureInfo.CurrentCulture = culture;
        }
    }
}
