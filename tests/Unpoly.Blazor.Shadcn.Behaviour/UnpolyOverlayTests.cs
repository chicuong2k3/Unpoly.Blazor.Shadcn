using Microsoft.Playwright;

namespace Unpoly.Blazor.Shadcn.Behaviour;

/// <summary>
/// Unpoly's own overlay elements, dressed by ui.behavior.css as the library's Dialog.
/// </summary>
/// <remarks>
/// Asserted against the library rather than against numbers: the radius is whatever
/// <c>[data-slot="dialog-content"]</c> computes to and the ground is whatever <c>--popover</c>
/// resolves to, so a theme that changes either keeps these green, and an overlay that drifts
/// back to unpoly.css's white frame does not. The frame loses silently when it loses — unpoly.css
/// is unlayered and linked last, so a rule one step too weak is simply not applied.
/// </remarks>
[Collection(DemoCollection.Name)]
[Trait("Module", "Overlay")]
public class UnpolyOverlayTests(DemoFixture fixture) : DemoPage(fixture)
{
    class Box
    {
        public double Left { get; set; }
        public double Width { get; set; }
        public double ViewportWidth { get; set; }
    }

    /// <summary>Opens the Dialog page's up-layer="new modal" sample and waits for the route.</summary>
    async Task OpenModalAsync()
    {
        await GoAsync("/components/dialog");
        var sample = await ShowAsync("preview-dialog-unpoly-overlay");
        await sample.GetByText("Open as modal").ClickAsync();
        await Page.Locator("up-modal up-modal-box [data-overlay-route]").WaitForAsync();
        // Unpoly's own open animation, so the box is measured at rest.
        await Page.WaitForTimeoutAsync(500);
    }

    [SkippableFact]
    public async Task An_up_modal_box_has_the_dialog_content_radius()
    {
        RequireDemo();
        await OpenModalAsync();

        var radii = await Page.EvaluateAsync<string[]>("""
            () => [
              getComputedStyle(document.querySelector('[data-slot="dialog-content"]')).borderTopLeftRadius,
              getComputedStyle(document.querySelector('up-modal-box')).borderTopLeftRadius,
            ]
            """);

        Assert.NotEqual("0px", radii[0]);
        Assert.Equal(radii[0], radii[1]);
        AssertQuiet();
    }

    [SkippableFact]
    public async Task An_up_modal_box_paints_the_popover_token()
    {
        RequireDemo();
        await OpenModalAsync();

        var grounds = await Page.EvaluateAsync<string[]>("""
            () => {
              const probe = document.createElement('div');
              probe.style.background = 'var(--popover)';
              document.body.append(probe);
              const popover = getComputedStyle(probe).backgroundColor;
              probe.remove();
              return [popover, getComputedStyle(document.querySelector('up-modal-box')).backgroundColor];
            }
            """);

        Assert.Equal(grounds[0], grounds[1]);
        AssertQuiet();
    }

    /// <summary>
    /// Below sm the modal is a bottom sheet. The viewport's clientWidth is the width left beside
    /// its own scrollbar, which is all the box can have.
    /// </summary>
    [SkippableFact]
    public async Task At_390px_an_up_modal_box_spans_the_viewport_width()
    {
        RequireDemo();
        await Page.SetViewportSizeAsync(390, 844);
        await OpenModalAsync();

        var box = await Page.EvaluateAsync<Box>("""
            () => {
              const r = document.querySelector('up-modal-box').getBoundingClientRect();
              return { left: r.left, width: r.width,
                       viewportWidth: document.querySelector('up-modal-viewport').clientWidth };
            }
            """);

        Assert.True(Math.Abs(box.Left) < 1, $"the box starts {box.Left}px from the left edge");
        Assert.True(Math.Abs(box.Width - box.ViewportWidth) < 1,
            $"the box is {box.Width}px wide in a {box.ViewportWidth}px viewport");
        AssertQuiet();
    }
}
