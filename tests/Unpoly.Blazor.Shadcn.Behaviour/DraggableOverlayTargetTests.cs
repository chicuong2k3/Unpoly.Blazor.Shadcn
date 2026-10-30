namespace Unpoly.Blazor.Shadcn.Behaviour;

[Collection(DemoCollection.Name)]
[Trait("Module", "Media")]
public class DraggableOverlayTargetTests(DemoFixture fixture) : DemoPage(fixture)
{
    [SkippableFact]
    public async Task Tiny_overlay_controls_are_clickable_at_minimum_canvas_scale()
    {
        RequireDemo();
        await Page.SetViewportSizeAsync(390, 844);
        await GoAsync("/components/creative-media");
        await Page.Locator("[data-slot=draggable-overlay]").EvaluateAsync("el => el.dispatchEvent(new CustomEvent('draggable-overlay:set', { detail: { version: 1, x: .45, y: .45, width: .01, height: .01 } }))");
        await Page.Locator("[data-slot=image-canvas]").EvaluateAsync("el => { const v = el.querySelector('[data-canvas-viewport]').getBoundingClientRect(); el.dispatchEvent(new CustomEvent('image-canvas:restore', { detail: { version: 1, scale: .02, x: v.width / 2 - 6.4, y: v.height / 2 - 4.8 } })); }");
        foreach (var selector in new[] { "[data-overlay-move]", "[data-overlay-resize]" })
        {
            var handle = Page.Locator(selector);
            await handle.ClickAsync();
            Assert.True(await handle.EvaluateAsync<bool>("el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)); }"), selector);
        }
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Tiny_overlay_controls_are_clickable_at_each_canvas_corner()
    {
        RequireDemo();
        await Page.SetViewportSizeAsync(390, 844);
        await GoAsync("/components/creative-media");
        foreach (var position in new[] { new[] { 0d, 0d }, new[] { .99, 0d }, new[] { 0d, .99 }, new[] { .99, .99 } })
        {
            await Page.Locator("[data-slot=draggable-overlay]").EvaluateAsync("(el, p) => el.dispatchEvent(new CustomEvent('draggable-overlay:set', { detail: { version: 1, x: p[0], y: p[1], width: .01, height: .01 } }))", position);
            await Page.Locator("[data-overlay-move]").ClickAsync();
            await Page.Locator("[data-overlay-resize]").ClickAsync();
            Assert.True(await Page.Locator("[data-overlay-resize]").IsVisibleAsync());
        }
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Full_canvas_overlay_controls_remain_clickable()
    {
        RequireDemo();
        await Page.SetViewportSizeAsync(390, 844);
        await GoAsync("/components/creative-media");
        await Page.Locator("[data-slot=draggable-overlay]").EvaluateAsync("el => el.dispatchEvent(new CustomEvent('draggable-overlay:set', { detail: { version: 1, x: 0, y: 0, width: 1, height: 1 } }))");
        foreach (var selector in new[] { "[data-overlay-move]", "[data-overlay-resize]" })
        {
            var handle = Page.Locator(selector);
            await handle.ScrollIntoViewIfNeededAsync();
            Assert.True(await handle.EvaluateAsync<bool>("el => { const r=el.getBoundingClientRect(), v=el.closest('[data-canvas-viewport]').getBoundingClientRect(); return r.left >= v.left && r.right <= v.right && r.top >= v.top && r.bottom <= v.bottom; }"), $"{selector} is clipped by the viewport");
            await handle.ClickAsync(new() { Timeout = 5000 });
        }
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Tiny_overlay_controls_remain_distinct_and_clickable_after_zoom_out()
    {
        RequireDemo();
        await GoAsync("/components/creative-media");
        await Page.Locator("[data-slot=draggable-overlay]").EvaluateAsync("el => el.dispatchEvent(new CustomEvent('draggable-overlay:set', { detail: { version: 1, x: .45, y: .45, width: .01, height: .01 } }))");
        // Exercise the image canvas' own zoom and inverse target-size calculation.
        for (var i = 0; i < 4; i++) await Page.Locator("[data-canvas-action=zoom-out]").ClickAsync();
        var move = Page.Locator("[data-overlay-move]");
        var resize = Page.Locator("[data-overlay-resize]");
        var a = (await move.BoundingBoxAsync())!;
        var b = (await resize.BoundingBoxAsync())!;
        Assert.True(a.Width >= 24 && a.Height >= 24 && b.Width >= 24 && b.Height >= 24);
        Assert.True(a.Y + a.Height <= b.Y || b.Y + b.Height <= a.Y || a.X + a.Width <= b.X || b.X + b.Width <= a.X);
        await move.ClickAsync();
        await resize.ClickAsync();
        AssertQuiet();
    }
}
