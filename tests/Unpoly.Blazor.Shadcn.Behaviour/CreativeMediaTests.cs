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

    // ---- Lightbox ---------------------------------------------------------------------------

    // Stepping past the last asset reloaded it: a playing video restarted from nothing.
    [SkippableFact]
    public async Task Lightbox_stepping_past_the_last_asset_keeps_it_loaded()
    {
        RequireDemo();
        await GoAsync("/components/creative-media");
        await OpenPreviewAsync("reference");
        await Page.EvaluateAsync("() => window.__shown = document.querySelector('#creative-preview [data-media-stage] > *')");
        await Page.Keyboard.PressAsync("ArrowRight");
        Assert.True(await Page.EvaluateAsync<bool>("() => window.__shown === document.querySelector('#creative-preview [data-media-stage] > *')"));
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Lightbox_stepping_past_the_last_asset_announces_no_change()
    {
        RequireDemo();
        await GoAsync("/components/creative-media");
        await OpenPreviewAsync("reference");
        await CountAsync("[data-slot=media-lightbox]", "media-lightbox:change");
        await Page.Keyboard.PressAsync("ArrowRight");
        Assert.Equal(0, await CountedAsync());
        AssertQuiet();
    }

    // The label sat on the panel inside <dialog>, a generic element, so the dialog had no name.
    [SkippableFact]
    public async Task Lightbox_dialog_is_named_by_its_label()
    {
        RequireDemo();
        await GoAsync("/components/creative-media");
        await OpenPreviewAsync("reference");
        Assert.Equal(1, await Page.GetByRole(AriaRole.Dialog, new() { Name = "Media preview", Exact = true }).CountAsync());
        AssertQuiet();
    }

    // The image was natively draggable, so the browser cancelled the pointer and a mouse swipe
    // never navigated.
    [SkippableFact]
    public async Task Lightbox_mouse_swipe_moves_to_the_previous_asset()
    {
        RequireDemo();
        await GoAsync("/components/creative-media");
        await OpenPreviewAsync("reference");
        await Page.WaitForFunctionAsync("() => document.querySelector('#creative-preview [data-media-stage] img')?.complete");
        var box = (await Page.Locator("#creative-preview [data-media-stage] img").BoundingBoxAsync())!;
        await Page.Mouse.MoveAsync(box.X + box.Width * .2f, box.Y + box.Height / 2);
        await Page.Mouse.DownAsync();
        await Page.Mouse.MoveAsync(box.X + box.Width * .8f, box.Y + box.Height / 2, new() { Steps = 8 });
        await Page.Mouse.UpAsync();
        Assert.Equal("Mountain landscape", await Page.Locator("#creative-preview [data-media-stage] img").GetAttributeAsync("alt"));
        AssertQuiet();
    }

    // ---- Asset picker and gallery -----------------------------------------------------------

    // A grid swapped in for another page is rendered from the server's SelectedIds. It came back
    // unchecked, and Confirm then reconciled the choice out of the selection.
    [SkippableFact]
    public async Task Asset_picker_confirms_a_choice_after_its_grid_is_rendered_again()
    {
        RequireDemo();
        await GoAsync("/components/creative-media");
        await OpenPickerAsync();
        await Page.Locator("#creative-assets input[value=landscape]").CheckAsync();
        await RenderPickerGridAgainAsync();
        await Page.EvaluateAsync("() => document.querySelector('[data-slot=asset-picker]').addEventListener('asset-picker:confirm', e => window.__ids = e.detail.ids)");
        await Page.Locator("#creative-assets [data-assets-confirm]").ClickAsync();
        Assert.Equal(new[] { "landscape" }, await Page.EvaluateAsync<string[]>("() => window.__ids"));
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Asset_picker_shows_a_kept_choice_as_checked_after_its_grid_is_rendered_again()
    {
        RequireDemo();
        await GoAsync("/components/creative-media");
        await OpenPickerAsync();
        await Page.Locator("#creative-assets input[value=landscape]").CheckAsync();
        await RenderPickerGridAgainAsync();
        Assert.True(await Page.Locator("#creative-assets input[value=landscape]").IsCheckedAsync());
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Asset_picker_dialog_is_named_by_its_label()
    {
        RequireDemo();
        await GoAsync("/components/creative-media");
        await OpenPickerAsync();
        Assert.Equal(1, await Page.GetByRole(AriaRole.Dialog, new() { Name = "Choose assets", Exact = true }).CountAsync());
        AssertQuiet();
    }

    // aria-label on an element with no role is ignored, so the library had no name.
    [SkippableFact]
    public async Task Gallery_is_announced_by_its_label()
    {
        RequireDemo();
        await GoAsync("/components/creative-media");
        Assert.Equal(1, await Page.GetByRole(AriaRole.Group, new() { Name = "Media library", Exact = true }).CountAsync());
        AssertQuiet();
    }

    // ---- Timeline ----------------------------------------------------------------------------

    // Only the step was snapped, so ten steps of .1 stored .9999999999999999.
    [SkippableFact]
    public async Task Timeline_keyboard_steps_stay_on_the_snap_grid()
    {
        RequireDemo();
        await GoAsync("/components/creative-media");
        var move = Page.Locator("[data-media-clip=intro] [data-clip-move]");
        for (var i = 0; i < 10; i++) await move.PressAsync("ArrowRight");
        Assert.Equal("1", await Page.Locator("[data-media-clip=intro]").GetAttributeAsync("data-start"));
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Timeline_trim_handle_leaves_up_and_down_to_the_page()
    {
        RequireDemo();
        await GoAsync("/components/creative-media");
        await CountAsync("[data-slot=media-timeline]", "media-timeline:change");
        await Page.Locator("[data-media-clip=intro] [data-clip-end]").PressAsync("ArrowUp");
        Assert.Equal(0, await CountedAsync());
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Timeline_press_without_movement_is_not_a_change()
    {
        RequireDemo();
        await GoAsync("/components/creative-media");
        await CountAsync("[data-slot=media-timeline]", "media-timeline:change");
        await Page.Locator("[data-media-clip=scene] [data-clip-move]").ClickAsync();
        Assert.Equal(0, await CountedAsync());
        AssertQuiet();
    }

    // Selection was only a data-* style hook, invisible to assistive technology.
    [SkippableFact]
    public async Task Timeline_announces_only_the_selected_clip_as_current()
    {
        RequireDemo();
        await GoAsync("/components/creative-media");
        await Page.Locator("[data-media-clip=scene] [data-clip-move]").PressAsync("ArrowRight");
        Assert.Equal("true", await Page.Locator("[data-media-clip=scene] [data-clip-move]").GetAttributeAsync("aria-current"));
        Assert.Null(await Page.Locator("[data-media-clip=intro] [data-clip-move]").GetAttributeAsync("aria-current"));
        AssertQuiet();
    }

    // ---- Overlay and comparison ------------------------------------------------------------

    // 57 × .01 is .5700000000000001 in binary floating point, and that was what got serialized.
    [SkippableFact]
    public async Task Overlay_serializes_grid_positions_exactly()
    {
        RequireDemo();
        await GoAsync("/components/creative-media");
        var move = Page.Locator("[data-overlay-move]");
        for (var i = 0; i < 4; i++) await move.PressAsync("Shift+ArrowRight");
        for (var i = 0; i < 7; i++) await move.PressAsync("ArrowRight");
        Assert.Equal("0.57", await Page.Locator("[data-slot=draggable-overlay]").GetAttributeAsync("data-x"));
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Overlay_key_at_the_edge_is_not_a_change()
    {
        RequireDemo();
        await GoAsync("/components/creative-media");
        var move = Page.Locator("[data-overlay-move]");
        await move.PressAsync("Shift+ArrowLeft");
        await CountAsync("[data-slot=draggable-overlay]", "draggable-overlay:change");
        await move.PressAsync("ArrowLeft");
        Assert.Equal(0, await CountedAsync());
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Overlay_press_without_movement_is_not_a_change()
    {
        RequireDemo();
        await GoAsync("/components/creative-media");
        await CountAsync("[data-slot=draggable-overlay]", "draggable-overlay:change");
        await Page.Locator("[data-overlay-move]").ClickAsync();
        Assert.Equal(0, await CountedAsync());
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Comparison_home_at_zero_is_not_a_change()
    {
        RequireDemo();
        await GoAsync("/components/creative-media");
        // The definition loads lazily and then applies data-position; wait so it cannot land late.
        await Page.WaitForFunctionAsync("() => customElements.get('img-comparison-slider') && document.querySelector('img-comparison-slider')?.value === 30");
        var slider = Page.Locator("img-comparison-slider");
        await slider.PressAsync("Home");
        await CountAsync("[data-slot=image-compare]", "image-compare:change");
        await slider.PressAsync("Home");
        Assert.Equal(0, await CountedAsync());
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Overlay_keyboard_edit_updates_accessible_bounds()
    {
        RequireDemo();
        await GoAsync("/components/creative-media");
        var resize = Page.Locator("[data-overlay-resize]");
        Assert.Equal("Left 10%, top 10%, width 30%, height 20%.", await resize.GetAttributeAsync("aria-description"));
        await resize.PressAsync("ArrowRight");
        Assert.Equal("Left 10%, top 10%, width 31%, height 20%.", await resize.GetAttributeAsync("aria-description"));
        Assert.Equal("Left 10%, top 10%, width 31%, height 20%.", await Page.Locator("[data-slot=draggable-overlay] [role=status]").TextContentAsync());
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Timeline_trim_updates_accessible_bounds()
    {
        RequireDemo();
        await GoAsync("/components/creative-media");
        var trim = Page.Locator("[data-media-clip=intro] [data-clip-start]");
        Assert.Equal("Start 0 seconds, end 8 seconds, duration 8 seconds, track 1.", await trim.GetAttributeAsync("aria-description"));
        await trim.PressAsync("ArrowRight");
        Assert.Equal("Start 0.1 seconds, end 8 seconds, duration 7.9 seconds, track 1.", await trim.GetAttributeAsync("aria-description"));
        Assert.Equal("Introduction. Start 0.1 seconds, end 8 seconds, duration 7.9 seconds, track 1.", await Page.Locator("[data-slot=media-timeline] [role=status]").TextContentAsync());
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Comparison_controls_keep_a_dark_edge_over_light_images()
    {
        RequireDemo();
        await GoAsync("/components/creative-media");
        var shadows = await Page.Locator("img-comparison-slider").EvaluateAsync<string[]>(
            "el => ['--divider-shadow', '--default-handle-shadow'].map(name => getComputedStyle(el).getPropertyValue(name).trim())");
        Assert.All(shadows, value => { Assert.False(string.IsNullOrWhiteSpace(value)); Assert.NotEqual("none", value); });
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Desktop_editor_tool_groups_do_not_overlap()
    {
        RequireDemo();
        await AssertToolLayoutAsync(1280, 900);
    }

    [SkippableFact]
    public async Task Mobile_editor_tool_groups_do_not_overlap()
    {
        RequireDemo();
        await AssertToolLayoutAsync(390, 844);
    }

    async Task AssertToolLayoutAsync(int width, int height)
    {
        await Page.SetViewportSizeAsync(width, height);
        await GoAsync("/components/creative-media");
        var fits = await Page.EvaluateAsync<bool>("""
            () => {
              const canvas = document.querySelector('[data-slot=image-canvas]').getBoundingClientRect();
              const groups = [...document.querySelector('[data-mask-toolbar]').children].map(el => el.getBoundingClientRect());
              return groups.every((r, i) => r.left >= canvas.left - 1 && r.right <= canvas.right + 1 && groups.slice(i + 1).every(other =>
                Math.min(r.right, other.right) - Math.max(r.left, other.left) <= 1 || Math.min(r.bottom, other.bottom) - Math.max(r.top, other.top) <= 1));
            }
            """);
        Assert.True(fits, $"Toolbar groups overlap or overflow at {width}px.");
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Timeline_trim_handles_anchor_to_opposite_clip_edges()
    {
        RequireDemo();
        await GoAsync("/components/creative-media");
        Assert.True(await Page.EvaluateAsync<bool>("""
            () => [...document.querySelectorAll('[data-media-clip]')].every(clip => {
              const r = clip.getBoundingClientRect(), start = clip.querySelector('[data-clip-start]').getBoundingClientRect(), end = clip.querySelector('[data-clip-end]').getBoundingClientRect();
              return Math.abs(start.left - r.left) <= 2 && Math.abs(end.right - r.right) <= 2 && start.right <= end.left;
            })
            """));
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Crop_coordinates_are_available_in_an_expandable_panel()
    {
        RequireDemo();
        await GoAsync("/components/creative-media");
        var field = Page.Locator("[data-crop-field=x]");
        Assert.False(await field.IsVisibleAsync());
        await Page.Locator("[data-crop-details] summary").ClickAsync();
        Assert.True(await field.IsVisibleAsync());
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Comparison_layers_fill_the_frame()
    {
        RequireDemo();
        await GoAsync("/components/creative-media");
        await Page.WaitForFunctionAsync("() => customElements.get('img-comparison-slider') && [...document.querySelectorAll('[data-slot=image-compare] img')].every(img => img.complete && img.naturalWidth > 0)");
        Assert.True(await Page.Locator("img-comparison-slider").EvaluateAsync<bool>("el => { const frame = el.getBoundingClientRect(); return frame.height > 0 && [...el.querySelectorAll('img')].every(img => Math.abs(img.getBoundingClientRect().height - frame.height) <= 2) }"));
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Asset_picker_count_survives_grid_replacement()
    {
        RequireDemo();
        await GoAsync("/components/creative-media");
        await OpenPickerAsync();
        await Page.Locator("#creative-assets input[value=landscape]").CheckAsync();
        await RenderPickerGridAgainAsync();
        Assert.Equal("1", await Page.Locator("#creative-assets [data-assets-count]").TextContentAsync());
        Assert.Equal(1, await Page.Locator("#creative-assets figure[data-selected]").CountAsync());
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Asset_picker_clear_removes_choices_from_other_pages()
    {
        RequireDemo();
        await GoAsync("/components/creative-media");
        await OpenPickerAsync();
        await Page.Locator("#creative-assets input[value=landscape]").CheckAsync();
        await Page.EvaluateAsync("() => document.querySelector('#creative-assets [data-slot=media-grid]').remove()");
        await Page.Locator("#creative-assets [data-assets-clear]").ClickAsync();
        await Page.EvaluateAsync("() => document.querySelector('[data-slot=asset-picker]').addEventListener('asset-picker:confirm', e => window.__clearedIds = e.detail.ids, { once: true })");
        await Page.Locator("#creative-assets [data-assets-confirm]").ClickAsync();
        Assert.Empty(await Page.EvaluateAsync<string[]>("() => window.__clearedIds"));
        AssertQuiet();
    }

    async Task OpenPreviewAsync(string id)
    {
        await Page.Locator($"[data-slot=media-grid][data-lightbox-target=creative-preview] [data-media-preview={id}]").ClickAsync();
        await Page.WaitForFunctionAsync("() => document.querySelector('#creative-preview').open");
    }

    async Task OpenPickerAsync()
    {
        await Page.Locator("[data-slot=dialog-trigger][data-target=creative-assets]").ClickAsync();
        await Page.WaitForFunctionAsync("() => document.querySelector('#creative-assets').open");
    }

    /// <summary>What a paginated server swap delivers: the picker's grid rendered again from
    /// the server's SelectedIds, which knows nothing of choices made in the browser.</summary>
    Task RenderPickerGridAgainAsync() => Page.EvaluateAsync(
        "() => { const grid = document.querySelector('[data-slot=asset-picker] [data-slot=media-grid]'); grid.outerHTML = grid.outerHTML.replace(/ checked(=\"[^\"]*\")?/g, '') }");

    /// <summary>Starts counting one event on one element; read the count with <see cref="CountedAsync"/>.</summary>
    Task CountAsync(string selector, string eventName) => Page.EvaluateAsync(
        "([selector, name]) => { window.__count = 0; document.querySelector(selector).addEventListener(name, () => window.__count++) }",
        new[] { selector, eventName });

    Task<int> CountedAsync() => Page.EvaluateAsync<int>("() => window.__count");
}
