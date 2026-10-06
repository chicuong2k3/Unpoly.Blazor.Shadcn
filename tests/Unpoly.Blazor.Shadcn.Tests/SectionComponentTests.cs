using System.Globalization;
using Bunit;
using Unpoly.Blazor.Shadcn.Components;

namespace Unpoly.Blazor.Shadcn.Tests;

/// <summary>
/// BottomNavBar, LogoCloud and PricingTable were built from 21st.dev descriptions, so there is no
/// upstream source for the parity theory to compare. These pin what each promises before ui.js
/// and Motion add any movement: the markup that works, and reads, with scripting off.
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
}
