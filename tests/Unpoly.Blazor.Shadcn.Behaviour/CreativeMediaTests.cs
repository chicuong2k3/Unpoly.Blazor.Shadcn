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
        await Page.Locator("[data-media-preview=reference]").ClickAsync();
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
        await Page.Locator("a[href='/components/button']").First.ClickAsync();
        await Page.Locator("a[href='/components/creative-media']").First.ClickAsync();
        await Page.WaitForFunctionAsync("() => customElements.get('img-comparison-slider') && document.querySelector('img-comparison-slider')?.value === 30");
        await Page.Locator("img-comparison-slider").PressAsync("ArrowRight");
        Assert.Equal("31", await Page.Locator("img-comparison-slider").GetAttributeAsync("aria-valuenow"));
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
}
