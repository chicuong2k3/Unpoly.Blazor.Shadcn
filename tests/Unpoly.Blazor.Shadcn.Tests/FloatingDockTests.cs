using Bunit;
using Unpoly.Blazor.Shadcn.Components;

namespace Unpoly.Blazor.Shadcn.Tests;

/// <summary>
/// FloatingDock is Aceternity's, not shadcn's, so the parity theory has nothing to compare it
/// with. These pin what the markup promises before ui.js adds any motion: both layouts, real
/// links, and a phone menu that works with scripting off.
/// </summary>
public class FloatingDockTests : BunitContext
{
    IRenderedComponent<FloatingDock> Dock(Action<ComponentParameterCollectionBuilder<FloatingDock>>? configure = null) =>
        Render<FloatingDock>(p =>
        {
            configure?.Invoke(p);
            p.AddChildContent<FloatingDockItem>(i => i.Add(x => x.Title, "Home").Add(x => x.Href, "/").AddChildContent("<svg></svg>"));
            p.AddChildContent<FloatingDockItem>(i => i.Add(x => x.Title, "Blocks").Add(x => x.Href, "/blocks").AddChildContent("<svg></svg>"));
        });

    [Fact]
    public void Each_link_is_rendered_once_for_the_shelf_and_once_for_the_phone_menu()
    {
        // CSS picks one layout at md, so both must be in the markup — and each copy must know
        // which one it is, or the phone menu would draw 40px tiles with hover-only titles.
        var dock = Dock();

        Assert.Equal(["/", "/blocks"], dock.FindAll("[data-slot=floating-dock-desktop] [data-layout=desktop]").Select(a => a.GetAttribute("href")));
        Assert.Equal(["/", "/blocks"], dock.FindAll("[data-slot=floating-dock-menu] [data-layout=mobile]").Select(a => a.GetAttribute("href")));
    }

    [Fact]
    public void The_phone_menu_is_a_native_disclosure_with_a_named_button()
    {
        // A <details> opens and closes with no script; the summary carries only an icon, so its
        // name has to come from aria-label.
        var summary = Dock().Find("details[data-slot=floating-dock-mobile] > summary");

        Assert.Equal("Open navigation", summary.GetAttribute("aria-label"));
    }

    [Fact]
    public void A_phone_link_is_named_by_its_title()
    {
        // The phone copy shows only the icon, so the title rides along as screen-reader text.
        var link = Dock().Find("[data-layout=mobile]");

        Assert.Equal("Home", link.QuerySelector(".sr-only")?.TextContent);
    }

    [Fact]
    public void A_desktop_tile_rests_at_upstream_s_size_before_any_script_runs()
    {
        // 40px tile, 20px icon: what a page with no script draws, and what ui.js springs from.
        var tile = Dock().Find("[data-slot=floating-dock-tile]");

        Assert.Contains("size-10", tile.ClassList);
        Assert.Contains("size-5", tile.QuerySelector("[data-slot=floating-dock-icon]")!.ClassList);
    }

    [Fact]
    public void A_desktop_title_appears_on_keyboard_focus_as_well_as_hover()
    {
        var title = Dock().Find("[data-slot=floating-dock-title]");

        Assert.Contains("group-hover:opacity-100", title.ClassList);
        Assert.Contains("group-focus-visible:opacity-100", title.ClassList);
    }

    [Fact]
    public void DesktopClass_replaces_the_breakpoint_it_conflicts_with()
    {
        // Merged, not appended: md:hidden next to md:flex would lose on stylesheet order.
        var shelf = Dock(p => p.Add(x => x.DesktopClass, "md:hidden")).Find("[data-slot=floating-dock-desktop]");

        Assert.Contains("md:hidden", shelf.ClassList);
        Assert.DoesNotContain("md:flex", shelf.ClassList);
    }
}
