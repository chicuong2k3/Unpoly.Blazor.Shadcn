using Bunit;
using Unpoly.Blazor.Shadcn.Components;

namespace Unpoly.Blazor.Shadcn.Tests;

/// <summary>
/// The accessibility half of the parity contract, and the half that is reproducible exactly.
/// </summary>
/// <remarks>
/// <para>
/// Class strings and DOM shape can be compared to shadcn by eye. ARIA cannot: it is invisible,
/// it degrades silently, and nothing in a screenshot says the switch is announcing itself as a
/// checkbox. So every role and aria-* this library emits is pinned here, one behaviour per test,
/// with the reason it exists — because the failure mode of an accessibility regression is that
/// nobody notices for a year.
/// </para>
/// <para>
/// What is <b>not</b> here: focus order, focus trapping, and keyboard interaction. Those need a
/// real browser and live in the Playwright suite; bUnit renders markup, it does not move focus.
/// </para>
/// </remarks>
[Trait("Layer", "Accessibility")]
public class AccessibilityTests : BunitContext
{
    // ---- landmarks and naming --------------------------------------------------------------

    [Fact]
    public void Breadcrumb_names_its_navigation_landmark()
    {
        // A page can hold several <nav>s. Without the label they are announced identically and
        // a screen reader user cannot tell the crumb trail from the main menu.
        var nav = Render<Breadcrumb>().Find("nav");

        Assert.Equal("breadcrumb", nav.GetAttribute("aria-label"));
    }

    [Fact]
    public void Pagination_names_its_navigation_landmark()
    {
        var nav = Render<Pagination>().Find("nav");

        Assert.Equal("pagination", nav.GetAttribute("aria-label"));
    }

    // ---- current position ------------------------------------------------------------------

    [Fact]
    public void The_current_crumb_says_it_is_the_current_page()
    {
        var page = Render<BreadcrumbPage>().Find("[data-slot=breadcrumb-page]");

        Assert.Equal("page", page.GetAttribute("aria-current"));
    }

    [Fact]
    public void The_current_crumb_is_announced_as_a_link_that_goes_nowhere()
    {
        // Radix keeps role=link so the trail reads as a list of links, and adds aria-disabled so
        // the last one is not offered as somewhere to go. Dropping the role would make the final
        // crumb vanish from a links list; dropping aria-disabled would invite a pointless click.
        var page = Render<BreadcrumbPage>().Find("[data-slot=breadcrumb-page]");

        Assert.Equal("link", page.GetAttribute("role"));
        Assert.Equal("true", page.GetAttribute("aria-disabled"));
    }

    [Fact]
    public void The_current_page_link_says_it_is_the_current_page()
    {
        var link = Render<PaginationLink>(p => p.Add(l => l.IsActive, true)).Find("a");

        Assert.Equal("page", link.GetAttribute("aria-current"));
    }

    [Fact]
    public void A_page_link_that_is_not_current_claims_nothing()
    {
        var link = Render<PaginationLink>().Find("a");

        Assert.False(link.HasAttribute("aria-current"));
    }

    // ---- decoration must not be read aloud -------------------------------------------------

    [Fact]
    public void The_crumb_separator_is_hidden_from_the_accessibility_tree()
    {
        // "slash" between every crumb is noise; the <nav aria-label="breadcrumb"> already said
        // what this list is.
        var sep = Render<BreadcrumbSeparator>().Find("[data-slot=breadcrumb-separator]");

        Assert.Equal("true", sep.GetAttribute("aria-hidden"));
        Assert.Equal("presentation", sep.GetAttribute("role"));
    }

    [Fact]
    public void An_icon_with_no_title_is_hidden_from_the_accessibility_tree()
    {
        // lucide-react's default, and the right one: most icons sit beside a label that already
        // says the same thing, and announcing "chevron down" after "Sort" is noise.
        var svg = Render<Icon>(p => p.Add(i => i.Name, "check")).Find("svg");

        Assert.Equal("true", svg.GetAttribute("aria-hidden"));
        Assert.False(svg.HasAttribute("role"));
    }

    [Fact]
    public void An_icon_given_a_title_becomes_an_image_with_a_name()
    {
        // For the case the icon IS the label — a bare icon button with nothing else in it.
        var svg = Render<Icon>(p => p
            .Add(i => i.Name, "trash-2")
            .Add(i => i.Title, "Delete")).Find("svg");

        Assert.Equal("img", svg.GetAttribute("role"));
        Assert.False(svg.HasAttribute("aria-hidden"));
        Assert.Equal("Delete", svg.QuerySelector("title")!.TextContent);
    }

    [Fact]
    public void A_decorative_separator_is_hidden_but_a_meaningful_one_is_not()
    {
        // Radix's `decorative` prop. A rule that only draws a line is noise to a screen reader;
        // one that actually divides two regions is structure and has to be announced.
        var decorative = Render<Separator>().Find("[data-slot=separator]");
        var meaningful = Render<Separator>(p => p.Add(s => s.Decorative, false)).Find("[data-slot=separator]");

        Assert.Equal("none", decorative.GetAttribute("role"));
        Assert.Equal("separator", meaningful.GetAttribute("role"));
        Assert.Equal("horizontal", meaningful.GetAttribute("aria-orientation"));
    }

    // ---- controls announce what they are ---------------------------------------------------

    [Fact]
    public void A_switch_is_announced_as_a_switch_and_not_as_a_checkbox()
    {
        // It is an <input type=checkbox> underneath, because that is what posts. Without
        // role=switch it is announced as "checkbox", and a checkbox that looks like a toggle is
        // exactly the mismatch this attribute exists to prevent.
        var input = Render<Switch>().Find("input");

        Assert.Equal("switch", input.GetAttribute("role"));
    }

    [Fact]
    public void A_radio_group_is_announced_as_a_group()
    {
        var group = Render<RadioGroup>().Find("[data-slot=radio-group]");

        Assert.Equal("radiogroup", group.GetAttribute("role"));
    }

    [Fact]
    public void A_progress_bar_reports_its_position_and_its_bounds()
    {
        // A progressbar with no aria-valuenow is announced as indeterminate — "loading", forever,
        // whatever the bar is drawing.
        var bar = Render<Progress>(p => p.Add(x => x.Value, 40)).Find("[data-slot=progress]");

        Assert.Equal("progressbar", bar.GetAttribute("role"));
        Assert.Equal("0", bar.GetAttribute("aria-valuemin"));
        Assert.Equal("100", bar.GetAttribute("aria-valuemax"));
        Assert.Equal("40", bar.GetAttribute("aria-valuenow"));
    }

    // ---- things that appear, and things that change ----------------------------------------

    [Fact]
    public void An_alert_is_announced_when_it_arrives()
    {
        var alert = Render<Alert>().Find("[data-slot=alert]");

        Assert.Equal("alert", alert.GetAttribute("role"));
    }

    [Fact]
    public void A_validation_message_is_announced_when_it_arrives()
    {
        // The error appears after a submit, when focus is elsewhere. Without role=alert the user
        // is left on a form that silently refused them.
        var message = Render<FormMessage>(p => p.Add(m => m.Message, "Required.")).Find("[data-slot=form-message]");

        Assert.Equal("alert", message.GetAttribute("role"));
    }

    // ---- disclosure ------------------------------------------------------------------------

    [Fact]
    public void A_dialog_trigger_says_it_opens_a_dialog()
    {
        var trigger = Render<DialogTrigger>(p => p.Add(t => t.Target, "d")).Find("button");

        Assert.Equal("dialog", trigger.GetAttribute("aria-haspopup"));
    }

    [Fact]
    public void A_menu_trigger_says_it_opens_a_menu_and_that_it_is_closed()
    {
        // aria-expanded must be present and false before the first click, not absent: absent
        // means "this is not a disclosure", which is a different control entirely.
        var trigger = Render<DropdownMenuTrigger>(p => p.Add(t => t.Target, "m")).Find("button");

        Assert.Equal("menu", trigger.GetAttribute("aria-haspopup"));
        Assert.Equal("false", trigger.GetAttribute("aria-expanded"));
    }

    [Fact]
    public void A_menu_and_its_items_are_announced_as_a_menu()
    {
        var menu = Render<DropdownMenuContent>(p => p.Add(c => c.Id, "m")).Find("[data-slot=dropdown-menu-content]");
        var item = Render<DropdownMenuItem>().Find("[data-slot=dropdown-menu-item]");

        Assert.Equal("menu", menu.GetAttribute("role"));
        Assert.Equal("menuitem", item.GetAttribute("role"));
    }

    [Fact]
    public void A_tooltip_describes_its_trigger_rather_than_naming_it()
    {
        // aria-describedby, not aria-label: the tooltip adds to the control's name, it does not
        // replace it. Labelling it would throw away whatever the button actually says.
        var trigger = Render<TooltipTrigger>(p => p.Add(t => t.Target, "t")).Find("button");

        Assert.Equal("t", trigger.GetAttribute("aria-describedby"));
    }

    [Fact]
    public void A_tooltip_is_announced_as_a_tooltip()
    {
        var tip = Render<TooltipContent>(p => p.Add(c => c.Id, "t")).Find("[data-slot=tooltip-content]");

        Assert.Equal("tooltip", tip.GetAttribute("role"));
    }

    // ---- tabs ------------------------------------------------------------------------------

    [Fact]
    public void A_tab_list_and_its_tabs_are_announced_as_tabs()
    {
        var list = Render<TabsList>().Find("[data-slot=tabs-list]");
        var trigger = Render<TabsTrigger>().Find("[data-slot=tabs-trigger]");
        var panel = Render<TabsContent>().Find("[data-slot=tabs-content]");

        Assert.Equal("tablist", list.GetAttribute("role"));
        Assert.Equal("tab", trigger.GetAttribute("role"));
        Assert.Equal("tabpanel", panel.GetAttribute("role"));
    }

    [Fact]
    public void A_tab_never_submits_the_form_it_happens_to_sit_in()
    {
        // Not accessibility, but the same class of silent damage: a <button> inside a <form>
        // submits by default, so a tab without type=button posts the form on every click.
        var trigger = Render<TabsTrigger>().Find("[data-slot=tabs-trigger]");

        Assert.Equal("button", trigger.GetAttribute("type"));
    }

    // ---- labelling -------------------------------------------------------------------------

    [Fact]
    public void A_form_label_points_at_the_control_it_names()
    {
        var label = Render<FormLabel>(p => p.Add(l => l.For, "email")).Find("label");

        Assert.Equal("email", label.GetAttribute("for"));
    }

    [Fact]
    public void A_label_in_error_says_so_in_the_dom_and_not_only_in_colour()
    {
        // Colour alone fails 1.4.1. data-error is what the recipe turns red, and what anything
        // else can read.
        var label = Render<FormLabel>(p => p.Add(l => l.Error, true)).Find("label");

        Assert.Equal("true", label.GetAttribute("data-error"));
    }
}
