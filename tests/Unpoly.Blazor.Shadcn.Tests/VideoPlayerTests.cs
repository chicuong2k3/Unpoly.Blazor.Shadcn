using Bunit;
using Unpoly.Blazor.Shadcn.Components;

namespace Unpoly.Blazor.Shadcn.Tests;

/// <summary>
/// VideoPlayer renders the Video.js 10 default skin: <c>&lt;video-player&gt;</c> &gt; <c>&lt;video-skin&gt;</c> &gt;
/// native <c>&lt;video&gt;</c>. The custom elements are registered client-side by ui.js, so everything here is
/// about the markup the server emits and what a failed script load leaves behind.
/// </summary>
public class VideoPlayerTests : BunitContext
{
    private IRenderedComponent<VideoPlayer> Player(Action<ComponentParameterCollectionBuilder<VideoPlayer>>? parameters = null) =>
        Render<VideoPlayer>(parameters ?? (_ => { }));

    [Fact]
    public void Video_player_is_a_videojs_player_wrapping_a_skin_and_a_native_video()
    {
        var root = Player(p => p.Add(x => x.Src, "/clip.mp4")).Find("[data-slot=video-player]");

        Assert.Equal("video-player", root.LocalName);
        var skin = root.QuerySelector("video-skin");
        Assert.NotNull(skin);
        Assert.Equal("/clip.mp4", skin!.QuerySelector("video")?.GetAttribute("src"));
    }

    [Fact]
    public void Video_has_no_media_chrome_slot_any_more() =>
        Assert.False(Player(p => p.Add(x => x.Src, "/c.mp4")).Find("video").HasAttribute("slot"));

    [Fact]
    public void Native_controls_stay_on_the_video_until_the_skin_takes_over() =>
        Assert.True(Player(p => p.Add(x => x.Src, "/c.mp4")).Find("video").HasAttribute("controls"));

    [Theory]
    [InlineData("16/9")]
    [InlineData("9/16")]
    [InlineData("1/1")]
    public void Aspect_ratio_reaches_the_skin(string ratio) =>
        Assert.Contains($"aspect-ratio:{ratio}", Player(p => p.Add(x => x.AspectRatio, ratio)).Find("video-skin").GetAttribute("style"));

    [Fact]
    public void Aspect_ratio_defaults_to_sixteen_by_nine() =>
        Assert.Contains("aspect-ratio:16/9", Player().Find("video-skin").GetAttribute("style"));

    [Fact]
    public void Title_becomes_the_content_title_attribute() =>
        Assert.Equal("Phim ngắn", Player(p => p.Add(x => x.Title, "Phim ngắn")).Find("video-player").GetAttribute("content-title"));

    [Fact]
    public void Title_is_absent_when_not_set() =>
        Assert.False(Player().Find("video-player").HasAttribute("content-title"));

    [Theory]
    [InlineData(null, "vi")]
    [InlineData("en", "en")]
    public void Lang_defaults_to_vietnamese_and_can_be_overridden(string? lang, string expected) =>
        Assert.Equal(expected, Player(p => { if (lang is not null) p.Add(x => x.Lang, lang); }).Find("video-player").GetAttribute("lang"));

    [Fact]
    public void A_title_with_markup_characters_stays_text_and_cannot_add_attributes()
    {
        const string hostile = "a\"><script>x</script>";
        var root = Player(p => p.Add(x => x.Title, hostile)).Find("video-player");

        Assert.Equal(hostile, root.GetAttribute("content-title"));
        Assert.Null(root.QuerySelector("script"));
    }

    [Fact]
    public void A_poster_with_quotes_stays_one_attribute_value()
    {
        var video = Player(p => p.Add(x => x.Poster, "/p.jpg\" onerror=\"x")).Find("video");

        Assert.Equal("/p.jpg\" onerror=\"x", video.GetAttribute("poster"));
        Assert.False(video.HasAttribute("onerror"));
    }

    [Fact]
    public void Loop_muted_and_preload_reach_the_video_element()
    {
        var video = Player(p => p.Add(x => x.Loop, true).Add(x => x.Muted, true).Add(x => x.Preload, "none")).Find("video");

        Assert.True(video.HasAttribute("loop"));
        Assert.True(video.HasAttribute("muted"));
        Assert.Equal("none", video.GetAttribute("preload"));
    }

    [Fact]
    public void Playsinline_is_always_set_so_phones_do_not_force_fullscreen() =>
        Assert.True(Player().Find("video").HasAttribute("playsinline"));

    [Fact]
    public void Caller_class_lands_on_the_root()
    {
        var root = Player(p => p.Add(x => x.Class, "rounded-lg w-full")).Find("[data-slot=video-player]");

        Assert.Contains("rounded-lg", root.ClassList);
        Assert.Contains("w-full", root.ClassList);
    }

    [Fact]
    public void Extra_attributes_land_on_the_root()
    {
        var root = Player(p => p.AddUnmatched("data-test", "x")).Find("[data-slot=video-player]");

        Assert.Equal("x", root.GetAttribute("data-test"));
    }

    [Fact]
    public void The_root_is_a_block_so_width_and_rounding_classes_apply()
    {
        var root = Player().Find("[data-slot=video-player]");

        Assert.Contains("display:block", root.GetAttribute("style"));
    }

    [Fact]
    public void Child_content_such_as_caption_tracks_sits_inside_the_video()
    {
        var video = Player(p => p.AddChildContent("<track kind=\"captions\" src=\"/vi.vtt\" srclang=\"vi\" label=\"Tiếng Việt\">")).Find("video");

        Assert.NotNull(video.QuerySelector("track[srclang=vi]"));
    }

    [Fact]
    public void Theme_tokens_are_mapped_onto_the_videojs_css_variables()
    {
        var style = Player().Find("video-skin").GetAttribute("style");

        Assert.Contains("--media-accent-color:var(--primary)", style);
        Assert.Contains("--media-border-radius:var(--radius)", style);
    }
}
