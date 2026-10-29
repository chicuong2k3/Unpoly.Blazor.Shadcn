using Microsoft.Playwright;

namespace Unpoly.Blazor.Shadcn.Behaviour;

[Collection(DemoCollection.Name)]
[Trait("Module", "Media")]
public class CreativeMediaTests(DemoFixture fixture) : DemoPage(fixture)
{
    [SkippableFact]
    public async Task Gallery_preview_opens_the_selected_asset()
    {
        RequireDemo();
        await GoAsync("/components/creative-media");
        await Page.Locator("[data-slot=media-grid][data-lightbox-target=creative-preview] [data-media-preview=reference]").ClickAsync();
        await Page.WaitForFunctionAsync("() => document.querySelector('#creative-preview').open");
        Assert.Equal("Reference image", await Page.Locator("[data-media-stage] img").GetAttributeAsync("alt"));
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Keyboard_moves_an_overlay_in_normalized_units()
    {
        RequireDemo();
        await GoAsync("/components/creative-media");
        await Page.Locator("[data-overlay-move]").PressAsync("ArrowRight");
        var x = await Page.Locator("[data-slot=draggable-overlay]").EvaluateAsync<double>("el => Number(el.dataset.x)");
        Assert.InRange(x, .109999, .110001);
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Timeline_keyboard_trim_preserves_the_clip_end()
    {
        RequireDemo();
        await GoAsync("/components/creative-media");
        await Page.Locator("[data-media-clip=intro] [data-clip-start]").PressAsync("ArrowRight");
        var end = await Page.Locator("[data-media-clip=intro]").EvaluateAsync<double>("el => Number(el.dataset.start) + Number(el.dataset.length)");
        Assert.Equal(8, end, 6);
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Mask_draws_in_image_coordinates_after_zoom()
    {
        RequireDemo();
        await GoAsync("/components/creative-media");
        await Page.Locator("[data-canvas-action=zoom-in]").ClickAsync();
        var canvas = Page.Locator("[data-slot=mask-brush] canvas");
        await canvas.ScrollIntoViewIfNeededAsync();
        var box = (await canvas.BoundingBoxAsync())!;
        await Page.Mouse.ClickAsync(box.X + box.Width * .8f, box.Y + box.Height * .8f);
        var alpha = await canvas.EvaluateAsync<int>("c => c.getContext('2d').getImageData(Math.floor(c.width*.8), Math.floor(c.height*.8), 1, 1).data[3]");
        Assert.True(alpha > 0);
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Crop_exports_original_image_coordinates()
    {
        RequireDemo();
        await GoAsync("/components/creative-media");
        await Page.WaitForFunctionAsync("() => Number(document.querySelector('[data-crop-field=width]').value) > 0");
        await Page.EvaluateAsync("() => document.querySelector('[data-slot=image-crop]').addEventListener('image-crop:apply', e => window.__crop = { width:e.detail.width, x:e.detail.crop.x, blob:e.detail.blob instanceof Blob })");
        await Page.Locator("[data-slot=image-crop-apply]").ClickAsync();
        await Page.WaitForFunctionAsync("() => window.__crop?.blob === true");
        Assert.True(await Page.EvaluateAsync<bool>("() => window.__crop.width > 0 && window.__crop.x >= 0"));
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Reentering_after_Unpoly_navigation_has_one_comparison_key_handler()
    {
        RequireDemo();
        await GoAsync("/components/creative-media");
        await Page.EvaluateAsync("() => window.__mediaNavigationToken = 'same-document'");
        await Page.Locator(".doc-nav a[href='/components/button']").ClickAsync();
        // Scope links to the visible sidebar: the command palette contains hidden copies.
        // ClickAsync waits for the click, not for Unpoly's asynchronous replacement.
        // Clicking the still-current Creative Media link here can be ignored as up-current.
        await Page.GetByRole(AriaRole.Heading, new() { Name = "Button", Exact = true }).WaitForAsync();
        await Page.Locator(".doc-nav a[href='/components/creative-media']").ClickAsync();
        await Page.GetByRole(AriaRole.Heading, new() { Name = "Creative Media", Exact = true }).WaitForAsync();
        await Page.WaitForFunctionAsync("() => customElements.get('img-comparison-slider') && document.querySelector('img-comparison-slider')?.value === 30");
        await Page.EvaluateAsync("() => { window.__comparisonChanges = 0; document.querySelector('[data-slot=image-compare]').addEventListener('image-compare:change', () => window.__comparisonChanges++); }");
        await Page.Locator("img-comparison-slider").PressAsync("ArrowRight");
        Assert.Equal("31", await Page.Locator("img-comparison-slider").GetAttributeAsync("aria-valuenow"));
        Assert.Equal(1, await Page.EvaluateAsync<int>("() => window.__comparisonChanges"));
        Assert.Equal("same-document", await Page.EvaluateAsync<string>("() => window.__mediaNavigationToken"));
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Mobile_canvas_fits_the_viewport()
    {
        RequireDemo();
        await Page.SetViewportSizeAsync(390, 844);
        await GoAsync("/components/creative-media");
        var viewport = (await Page.Locator("[data-canvas-viewport]").BoundingBoxAsync())!;
        Assert.InRange(viewport.Width, 1, 390);
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Touch_mask_maps_to_source_pixels_at_double_device_pixel_ratio()
    {
        RequireDemo();
        await using var context = await Fixture.Browser!.NewContextAsync(new()
        {
            ViewportSize = new() { Width = 390, Height = 844 },
            HasTouch = true,
            IsMobile = true,
            DeviceScaleFactor = 2,
        });
        var page = await context.NewPageAsync();
        var errors = new List<string>();
        page.PageError += (_, error) => errors.Add(error);
        await page.GotoAsync(Fixture.BaseUrl + "/components/creative-media", new() { WaitUntil = WaitUntilState.NetworkIdle });
        var canvas = page.Locator("[data-slot=mask-brush] canvas");
        await canvas.ScrollIntoViewIfNeededAsync();
        var box = (await canvas.BoundingBoxAsync())!;
        await page.Touchscreen.TapAsync(box.X + box.Width * .75f, box.Y + box.Height * .75f);
        Assert.Equal(2, await page.EvaluateAsync<int>("() => window.devicePixelRatio"));
        Assert.True(await canvas.EvaluateAsync<bool>("c => c.width === 640 && c.height === 480 && c.getContext('2d').getImageData(480, 360, 1, 1).data[3] > 0"));
        Assert.Empty(errors);
    }

}
