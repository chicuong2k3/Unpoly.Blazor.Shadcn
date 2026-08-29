using Microsoft.Playwright;

namespace Unpoly.Blazor.Shadcn.Behaviour;

/// <summary>
/// The scroller, feature by feature against what shadcn documents.
/// </summary>
/// <remarks>
/// Two faults here were the same fault: every item carries <c>content-visibility: auto</c>, so an
/// item that has never been on screen has an ESTIMATED height until it is. A smooth scroll to the
/// bottom therefore finishes at a target that was true when it started, and an anchored turn's
/// offsetTop is a guess at the moment the compiler runs. Both are checked below.
/// </remarks>
[Collection(DemoCollection.Name)]
[Trait("Module", "MessageScroller")]
public class MessageScrollerTests(DemoFixture fixture) : DemoPage(fixture)
{
    class Scroller
    {
        public string Following { get; set; } = "";
        public string CanStart { get; set; } = "";
        public string CanEnd { get; set; } = "";
        public string Anchor { get; set; } = "";
        public int Top { get; set; }
        public int Items { get; set; }
        public int Anchored { get; set; }
        public int Buttons { get; set; }
        public bool AtMax { get; set; }
    }

    async Task<Scroller> ReadAsync(string preview) => await Page.EvaluateAsync<Scroller>("""
        preview => {
          const b = document.getElementById(preview).previousElementSibling;
          const root = b.querySelector('[data-slot="message-scroller"]');
          const v = root.querySelector('[data-slot="message-scroller-viewport"]');
          return {
            following: root.dataset.following ?? '',
            canStart: root.dataset.canScrollStart ?? '',
            canEnd: root.dataset.canScrollEnd ?? '',
            anchor: root.dataset.currentAnchor ?? '',
            top: Math.round(v.scrollTop),
            items: root.querySelectorAll('[data-slot="message-scroller-item"]').length,
            anchored: root.querySelectorAll('[data-scroll-anchor="true"]').length,
            buttons: root.querySelectorAll('[data-slot="message-scroller-button"]').length,
            atMax: Math.round(v.scrollTop) >= Math.round(v.scrollHeight - v.clientHeight) - 2,
          };
        }
        """, preview);

    Task ScrollAsync(string preview, string where) => Page.EvaluateAsync("""
        ([preview, where]) => {
          const b = document.getElementById(preview).previousElementSibling;
          const v = b.querySelector('[data-slot="message-scroller-viewport"]');
          v.scrollTop = where === 'end' ? v.scrollHeight : 0;
        }
        """, new[] { preview, where });

    [SkippableFact]
    public async Task The_thread_is_a_log_that_announces_what_arrives()
    {
        RequireDemo();
        await GoAsync("/components/message-scroller");
        await ShowAsync("preview-conversation-example");

        var aria = await Page.Locator("[data-slot=\"message-scroller-content\"]").First
            .EvaluateAsync<string>("c => c.getAttribute('role') + '|' + c.getAttribute('aria-relevant')");

        Assert.Equal("log|additions", aria);
        AssertQuiet();
    }

    [SkippableFact]
    public async Task It_opens_at_the_newest_message_and_follows()
    {
        RequireDemo();
        await GoAsync("/components/message-scroller");
        await ShowAsync("preview-conversation-example");

        var state = await ReadAsync("preview-conversation-example");

        Assert.Equal("true", state.Following);
        Assert.True(state.Top > 0, "it opened at the top of the thread");
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Scrolling_up_stops_it_following_and_offers_the_way_back()
    {
        RequireDemo();
        await GoAsync("/components/message-scroller");
        await ShowAsync("preview-conversation-example");
        await ScrollAsync("preview-conversation-example", "start");
        await Page.WaitForTimeoutAsync(400);

        var state = await ReadAsync("preview-conversation-example");
        var offered = await Page.EvaluateAsync<bool>("""
            () => {
              const b = document.getElementById('preview-conversation-example').previousElementSibling;
              const button = b.querySelector('[data-slot="message-scroller-button"][data-direction="end"]');
              return !button.hidden && button.dataset.active === 'true';
            }
            """);

        Assert.Equal("false", state.Following);
        Assert.True(offered, "nothing said there was more below");
        AssertQuiet();
    }

    /// <summary>The scroll used to stop short, and short of the end is not the end — so
    /// following never resumed either.</summary>
    [SkippableFact]
    public async Task The_jump_button_reaches_the_end_and_resumes_following()
    {
        RequireDemo();
        await GoAsync("/components/message-scroller");
        var box = await ShowAsync("preview-conversation-example");
        await ScrollAsync("preview-conversation-example", "start");
        await Page.WaitForTimeoutAsync(400);

        await box.Locator("[data-slot=\"message-scroller-button\"][data-direction=\"end\"]").ClickAsync();
        await Page.WaitForTimeoutAsync(1400);

        var state = await ReadAsync("preview-conversation-example");
        Assert.True(state.AtMax, "it stopped short of the end");
        Assert.Equal("true", state.Following);
        AssertQuiet();
    }

    /// <summary>An anchored turn settles ScrollMargin from the top — unless the thread ends
    /// first, when there is nothing left to scroll.</summary>
    [SkippableFact]
    public async Task An_anchored_turn_settles_below_the_margin()
    {
        RequireDemo();
        await GoAsync("/components/message-scroller");
        await ShowAsync("preview-message-scroller-anchoring");

        var placed = await Page.EvaluateAsync<int[]>("""
            () => {
              const b = document.getElementById('preview-message-scroller-anchoring').previousElementSibling;
              const root = b.querySelector('[data-slot="message-scroller"]');
              const v = root.querySelector('[data-slot="message-scroller-viewport"]');
              const last = [...root.querySelectorAll('[data-scroll-anchor="true"]')].pop();
              const atMax = Math.round(v.scrollTop) >= Math.round(v.scrollHeight - v.clientHeight) - 2;
              return [Number(root.dataset.scrollMargin), Math.round(last.offsetTop - v.scrollTop), atMax ? 1 : 0];
            }
            """);

        Assert.True(Math.Abs(placed[1] - placed[0]) <= 6 || placed[2] == 1,
            $"the anchor sits {placed[1]}px down with a margin of {placed[0]}");
        AssertQuiet();
    }

    [SkippableFact]
    public async Task A_transcript_can_be_told_to_open_at_the_top()
    {
        RequireDemo();
        await GoAsync("/components/message-scroller?at=start");
        await ShowAsync("preview-message-scroller-opening");

        Assert.True((await ReadAsync("preview-message-scroller-opening")).Top < 8);
        AssertQuiet();
    }

    [SkippableFact]
    public async Task A_command_outside_the_thread_scrolls_it_to_a_named_turn()
    {
        RequireDemo();
        await GoAsync("/components/message-scroller");
        var box = await ShowAsync("preview-message-scroller-commands");
        var before = await ReadAsync("preview-message-scroller-commands");

        await box.Locator("[data-scroll-to-message]").First.ClickAsync();
        await Page.WaitForTimeoutAsync(900);

        Assert.NotEqual(before.Top, (await ReadAsync("preview-message-scroller-commands")).Top);
        AssertQuiet();
    }

    [SkippableFact]
    public async Task The_root_publishes_where_the_reader_can_still_go()
    {
        RequireDemo();
        await GoAsync("/components/message-scroller");
        await ShowAsync("preview-message-scroller-scrollable");

        await ScrollAsync("preview-message-scroller-scrollable", "start");
        await Page.WaitForTimeoutAsync(400);
        var top = await ReadAsync("preview-message-scroller-scrollable");

        await ScrollAsync("preview-message-scroller-scrollable", "end");
        await Page.WaitForTimeoutAsync(400);
        var end = await ReadAsync("preview-message-scroller-scrollable");

        Assert.Equal(("false", "true"), (top.CanStart, top.CanEnd));
        Assert.Equal(("true", "false"), (end.CanStart, end.CanEnd));
        AssertQuiet();
    }

    /// <summary>All four sentences are in the markup; the attributes on the root choose.</summary>
    [SkippableFact]
    public async Task The_footer_shows_one_sentence_and_no_script_picks_it()
    {
        RequireDemo();
        await GoAsync("/components/message-scroller");
        await ShowAsync("preview-message-scroller-scrollable");
        await ScrollAsync("preview-message-scroller-scrollable", "end");
        await Page.WaitForTimeoutAsync(400);

        var visible = await Page.EvaluateAsync<string[]>("""
            () => {
              const b = document.getElementById('preview-message-scroller-scrollable').previousElementSibling;
              return [...b.querySelectorAll('[data-slot="card-footer"] span')]
                .filter(s => s.offsetWidth > 0).map(s => s.textContent.trim());
            }
            """);

        Assert.Single(visible);
        AssertQuiet();
    }

    [SkippableFact]
    public async Task The_current_anchor_follows_the_reader_and_the_outline_follows_it()
    {
        RequireDemo();
        await GoAsync("/components/message-scroller");
        await ShowAsync("preview-message-scroller-visibility");

        await ScrollAsync("preview-message-scroller-visibility", "end");
        await Page.WaitForTimeoutAsync(500);
        var atEnd = await ReadAsync("preview-message-scroller-visibility");

        await ScrollAsync("preview-message-scroller-visibility", "start");
        await Page.WaitForTimeoutAsync(500);
        var atTop = await ReadAsync("preview-message-scroller-visibility");

        var lit = await Page.EvaluateAsync<string[]>(
            "() => [...document.querySelectorAll('[data-anchor-mark][data-current=\"true\"]')].map(m => m.dataset.anchorMark)");

        Assert.NotEqual(atEnd.Anchor, atTop.Anchor);
        Assert.NotEmpty(lit);
        Assert.All(lit, id => Assert.Equal(atTop.Anchor, id));
        AssertQuiet();
    }

    /// <summary>Content that arrives ABOVE the reader must not move the page under their eyes.</summary>
    [SkippableFact]
    public async Task Older_messages_arrive_above_and_the_reader_keeps_their_place()
    {
        RequireDemo();
        await GoAsync("/components/message-scroller");
        var box = await ShowAsync("preview-message-scroller-history");
        await ScrollAsync("preview-message-scroller-history", "start");
        await Page.WaitForTimeoutAsync(300);
        var before = await ReadAsync("preview-message-scroller-history");

        await box.Locator("a", new() { HasTextString = "Load earlier" }).ClickAsync();
        await Page.WaitForTimeoutAsync(1500);
        await ShowAsync("preview-message-scroller-history");
        var after = await ReadAsync("preview-message-scroller-history");

        Assert.True(after.Items > before.Items, $"{before.Items} turns became {after.Items}");
        Assert.True(after.Top >= before.Top, "the thread jumped when history arrived");
        AssertQuiet();
    }

    [SkippableFact]
    public async Task A_new_message_arrives_at_the_bottom_and_the_view_follows()
    {
        RequireDemo();
        await GoAsync("/components/message-scroller");
        var box = await ShowAsync("preview-message-scroller-streaming");
        var before = await ReadAsync("preview-message-scroller-streaming");

        await box.Locator("a[href*=\"sent=\"]").Last.ClickAsync();
        await Page.WaitForTimeoutAsync(1500);
        await ShowAsync("preview-message-scroller-streaming");
        var after = await ReadAsync("preview-message-scroller-streaming");

        Assert.True(after.Items > before.Items);
        Assert.Equal("true", after.Following);
        AssertQuiet();
    }

    /// <summary>A marker is a thing that happened rather than a thing someone said, and it
    /// anchors like any other turn.</summary>
    [SkippableFact]
    public async Task A_marker_joins_the_thread_as_a_turn_and_takes_the_anchor()
    {
        RequireDemo();
        await GoAsync("/components/message-scroller");
        var box = await ShowAsync("preview-message-scroller-group-chat");
        var before = await ReadAsync("preview-message-scroller-group-chat");

        await box.Locator("a", new() { HasTextString = "Add Rocky" }).ClickAsync();
        await Page.WaitForTimeoutAsync(1500);
        await ShowAsync("preview-message-scroller-group-chat");
        var after = await ReadAsync("preview-message-scroller-group-chat");

        Assert.True(after.Items > before.Items);
        Assert.True(after.Anchored > before.Anchored);
        AssertQuiet();
    }

    [SkippableFact]
    public async Task ScrollMargin_decides_how_much_of_the_previous_reply_stays_visible()
    {
        RequireDemo();
        await GoAsync("/components/message-scroller?margin=120&sent=4");
        await ShowAsync("preview-message-scroller-previous-context");

        var placed = await Page.EvaluateAsync<int[]>("""
            () => {
              const b = document.getElementById('preview-message-scroller-previous-context').previousElementSibling;
              const root = b.querySelector('[data-slot="message-scroller"]');
              const v = root.querySelector('[data-slot="message-scroller-viewport"]');
              const last = [...root.querySelectorAll('[data-scroll-anchor="true"]')].pop();
              const atMax = Math.round(v.scrollTop) >= Math.round(v.scrollHeight - v.clientHeight) - 2;
              return [Number(root.dataset.scrollMargin), Math.round(last.offsetTop - v.scrollTop), atMax ? 1 : 0];
            }
            """);

        Assert.Equal(120, placed[0]);
        Assert.True(Math.Abs(placed[1] - 120) <= 8 || placed[2] == 1,
            $"the anchor sits {placed[1]}px down with a margin of {placed[0]}");
        AssertQuiet();
    }

    /// <summary>A thread that can go both ways carries both buttons.</summary>
    [SkippableFact]
    public async Task A_scroller_can_carry_a_button_for_each_direction()
    {
        RequireDemo();
        await GoAsync("/components/message-scroller");
        await ShowAsync("preview-message-scroller-opening");

        Assert.Equal(2, (await ReadAsync("preview-message-scroller-opening")).Buttons);
        AssertQuiet();
    }
}
