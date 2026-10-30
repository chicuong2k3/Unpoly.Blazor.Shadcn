using Bunit;
using Unpoly.Blazor.Shadcn.Components;

namespace Unpoly.Blazor.Shadcn.Tests;

public class CreativeMediaTests : BunitContext
{
    [Fact]
    public void Asset_picker_renders_initial_selection_count()
    {
        var root = Render<AssetPicker>(p => p.Add(x => x.SelectedIds, new HashSet<string> { "off-page", "other" }));
        Assert.Equal("2", root.Find("[data-assets-count]").TextContent);
        Assert.False(root.Find("[data-assets-clear]").HasAttribute("disabled"));
    }

    [Fact]
    public void Asset_picker_clear_is_disabled_for_empty_selection()
    {
        Assert.True(Render<AssetPicker>().Find("[data-assets-clear]").HasAttribute("disabled"));
    }

    [Fact]
    public void Gallery_marks_initially_selected_tiles()
    {
        var root = Render<MediaGrid>(p => p.Add(x => x.Selectable, true)
            .Add(x => x.Items, new[] { new MediaAsset("a", "/a.png", "A") })
            .Add(x => x.SelectedIds, new HashSet<string> { "a" }));
        Assert.Single(root.FindAll("figure[data-selected]"));
    }

    [Theory]
    [InlineData("undo")]
    [InlineData("redo")]
    public void Mask_history_control_renders_a_glyph(string action)
    {
        var root = Render<MaskBrush>();
        Assert.NotEmpty(root.FindAll($"[data-mask-action={action}] svg > *"));
    }

    [Theory]
    [InlineData(-1, 0)]
    [InlineData(150, 100)]
    [InlineData(25, 25)]
    public void Comparison_clamps_its_announced_position(int position, int expected)
    {
        var slider = Render<ImageCompare>(p => p.Add(x => x.BeforeSrc, "/a.png").Add(x => x.AfterSrc, "/b.png")
            .Add(x => x.InitialPosition, position)).Find("[role=slider]");
        Assert.Equal(expected.ToString(), slider.GetAttribute("aria-valuenow"));
        Assert.Equal(expected.ToString(), slider.GetAttribute("value"));
    }

    [Fact]
    public void Comparison_has_one_container_per_named_image_slot()
    {
        var root = Render<ImageCompare>(p => p.Add(x => x.BeforeSrc, "/a.png").Add(x => x.AfterSrc, "/b.png"));
        Assert.Single(root.FindAll("[slot=first]"));
        Assert.Single(root.FindAll("[slot=second]"));
        Assert.NotNull(root.Find("[slot=first] img"));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(double.NaN)]
    [InlineData(double.PositiveInfinity)]
    public void Crop_rejects_invalid_aspect_ratio(double ratio) =>
        Assert.Throws<ArgumentOutOfRangeException>(() => Render<ImageCrop>(p => p.Add(x => x.AspectRatio, ratio)));

    [Fact]
    public void Crop_has_keyboard_editable_coordinates()
    {
        var root = Render<ImageCrop>();
        Assert.Equal(4, root.FindAll("input[type=number][data-crop-field]").Count);
    }

    [Fact]
    public void Gallery_does_not_fetch_full_video_sources()
    {
        var root = Render<MediaGrid>(p => p.Add(x => x.Items, new[] { new MediaAsset("v", "/full.mp4", "Clip") { IsVideo = true, ThumbnailSrc = "/thumb.png" } }));
        Assert.Empty(root.FindAll("video"));
        Assert.Equal("/thumb.png", root.Find("img").GetAttribute("src"));
        Assert.Equal("lazy", root.Find("img").GetAttribute("loading"));
    }

    // aria-label on an element with no role is ignored; the group role is what makes it a name.
    [Fact]
    public void Gallery_is_a_group_named_by_its_label()
    {
        var root = Render<MediaGrid>(p => p.Add(x => x.Label, "Assets")).Find("[data-slot=media-grid]");
        Assert.Equal("group", root.GetAttribute("role"));
        Assert.Equal("Assets", root.GetAttribute("aria-label"));
    }

    // An <img> with no src is invalid markup and draws as a broken image.
    [Fact]
    public void Gallery_video_without_a_thumbnail_draws_no_image()
    {
        var root = Render<MediaGrid>(p => p.Add(x => x.Items, new[] { new MediaAsset("v", "/full.mp4", "Clip") { IsVideo = true } }));
        Assert.Empty(root.FindAll("img"));
    }

    [Fact]
    public void Gallery_video_without_a_thumbnail_keeps_a_decorative_placeholder()
    {
        var root = Render<MediaGrid>(p => p.Add(x => x.Items, new[] { new MediaAsset("v", "/full.mp4", "Clip") { IsVideo = true } }));
        Assert.Single(root.FindAll("[data-media-preview=v] [data-media-placeholder][aria-hidden=true]"));
    }

    [Fact]
    public void Gallery_marks_preselected_assets()
    {
        var root = Render<MediaGrid>(p => p.Add(x => x.Items, new[] { new MediaAsset("a", "/a.png", "Photo") })
            .Add(x => x.Selectable, true).Add(x => x.SelectedIds, new HashSet<string> { "a" }));
        Assert.True(root.Find("input[type=checkbox]").HasAttribute("checked"));
    }

    [Fact]
    public void Lightbox_defers_media_elements_until_opened()
    {
        var root = Render<MediaLightbox>(p => p.Add(x => x.Items, new[] { new MediaAsset("a", "/large.png", "Photo") }));
        Assert.Empty(root.FindAll("img,video"));
        Assert.Single(root.FindAll("template[data-src]"));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(8193)]
    public void Canvas_rejects_unsafe_dimensions(int width) =>
        Assert.Throws<ArgumentOutOfRangeException>(() => Render<ImageCanvas>(p => p.Add(x => x.Width, width)));

    [Fact]
    public void Overlay_rejects_out_of_bounds_geometry() =>
        Assert.Throws<ArgumentOutOfRangeException>(() => Render<DraggableOverlay>(p => p.Add(x => x.X, .9).Add(x => x.Width, .2)));

    [Fact]
    public void Timeline_rejects_clip_beyond_duration() =>
        Assert.Throws<ArgumentException>(() => Render<MediaTimeline>(p => p.Add(x => x.Duration, 10)
            .Add(x => x.Clips, new[] { new MediaClip("a", "A", 9, 2) })));

    [Fact]
    public void Timeline_rejects_duplicate_ids() =>
        Assert.Throws<ArgumentException>(() => Render<MediaTimeline>(p => p.Add(x => x.Clips,
            new[] { new MediaClip("a", "A", 0, 2), new MediaClip("a", "B", 3, 2) })));
}
