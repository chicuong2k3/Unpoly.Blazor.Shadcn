using Bunit;
using Unpoly.Blazor.Shadcn.Components;

namespace Unpoly.Blazor.Shadcn.Tests;

/// <summary>
/// FloatingNav (Ruixen), BottomMenu (useLayouts) and FrequentlyAskedQuestions (ScrollX) have no
/// shadcn upstream for the parity theory to compare. These pin what each promises before ui.js
/// and Motion add any movement: the markup that works, and reads, with scripting off.
/// </summary>
public class MotionComponentTests : BunitContext
{
    // ---- FloatingNav --------------------------------------------------------------------------

    [Fact]
    public void A_floating_nav_draws_its_pill_inside_the_active_item_before_any_script()
    {
        var nav = Render<FloatingNav>(p => p
            .AddChildContent<FloatingNavItem>(i => i.Add(x => x.Label, "Home"))
            .AddChildContent<FloatingNavItem>(i => i.Add(x => x.Label, "Saved").Add(x => x.Active, true)));

        var pills = nav.FindAll("[data-slot=floating-nav-indicator]");
        Assert.Single(pills);
        Assert.Equal("Saved", pills[0].ParentElement!.QuerySelector(".sr-only")?.TextContent);
    }

    [Fact]
    public void A_floating_nav_link_marks_the_current_page_for_a_screen_reader()
    {
        var link = Render<FloatingNavItem>(p => p.Add(x => x.Href, "/blocks").Add(x => x.Active, true)).Find("a");

        Assert.Equal("page", link.GetAttribute("aria-current"));
    }

    [Fact]
    public void A_floating_nav_item_without_href_is_a_button_that_does_not_submit()
    {
        var button = Render<FloatingNavItem>(p => p.Add(x => x.Label, "Search")).Find("button");

        Assert.Equal("button", button.GetAttribute("type"));
    }

    // ---- BottomMenu ---------------------------------------------------------------------------

    IRenderedComponent<BottomMenu> Menu() => Render<BottomMenu>(p => p
        .AddChildContent<BottomMenuItem>(i => i.Add(x => x.Value, "new").Add(x => x.Label, "New")
            .Add(x => x.IconContent, "<svg></svg>").AddChildContent("<p>Note</p>"))
        .AddChildContent<BottomMenuItem>(i => i.Add(x => x.Value, "theme").Add(x => x.Label, "Theme")
            .Add(x => x.IconContent, "<svg></svg>")));

    [Fact]
    public void A_bottom_menu_button_opens_its_own_panel_with_no_script()
    {
        // popovertarget is the platform's: the panel opens, one at a time, with scripting off.
        var menu = Menu();
        var button = menu.Find("[data-slot=bottom-menu-item][data-value=new]");
        var panel = menu.Find("[data-slot=bottom-menu-panel]");

        Assert.Equal(panel.Id, button.GetAttribute("popovertarget"));
        Assert.True(panel.HasAttribute("popover"));
    }

    [Fact]
    public void A_bottom_menu_item_with_nothing_to_open_is_a_plain_button()
    {
        var menu = Menu();
        var button = menu.Find("[data-slot=bottom-menu-item][data-value=theme]");

        Assert.False(button.HasAttribute("popovertarget"));
        Assert.Single(menu.FindAll("[data-slot=bottom-menu-panel]"));
    }

    [Fact]
    public void Two_bottom_menus_on_one_page_never_share_a_panel_id()
    {
        var first = Menu().Find("[data-slot=bottom-menu-panel]").Id;
        var second = Menu().Find("[data-slot=bottom-menu-panel]").Id;

        Assert.NotEqual(first, second);
    }

    // ---- FrequentlyAskedQuestions -------------------------------------------------------------

    [Fact]
    public void A_faq_opens_one_question_at_a_time()
    {
        // One shared <details> name is upstream's type="single", with nothing to script.
        var faq = Render<FrequentlyAskedQuestions>();

        var names = faq.FindAll("details[data-slot=accordion-item]").Select(d => d.GetAttribute("name")).Distinct().ToArray();
        Assert.Single(names);
        Assert.False(string.IsNullOrEmpty(names[0]));
    }

    [Fact]
    public void A_faq_headline_is_a_second_level_heading_unless_asked_otherwise()
    {
        Assert.Single(Render<FrequentlyAskedQuestions>().FindAll("h2[data-slot=faq-title]"));
        Assert.Single(Render<FrequentlyAskedQuestions>(p => p.Add(x => x.HeadingLevel, 1)).FindAll("h1[data-slot=faq-title]"));
    }

    [Fact]
    public void A_faq_headline_reads_as_its_title_with_each_word_its_own_piece()
    {
        var title = Render<FrequentlyAskedQuestions>(p => p.Add(x => x.Title, "Ask us anything")).Find("[data-slot=faq-title]");

        Assert.Equal(["Ask", "us", "anything"], title.QuerySelectorAll("[data-slot=faq-word]").Select(w => w.TextContent));
    }

    [Fact]
    public void A_faq_support_address_is_a_mailto_link()
    {
        var link = Render<FrequentlyAskedQuestions>(p => p.Add(x => x.SupportEmail, "help@example.com")).Find("[data-slot=faq-description] a");

        Assert.Equal("mailto:help@example.com", link.GetAttribute("href"));
    }
}
