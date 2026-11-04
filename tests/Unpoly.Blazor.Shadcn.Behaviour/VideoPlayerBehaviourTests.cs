using Microsoft.Playwright;

namespace Unpoly.Blazor.Shadcn.Behaviour;

[Collection(DemoCollection.Name)]
[Trait("Module", "Media")]
public class VideoPlayerBehaviourTests(DemoFixture fixture) : DemoPage(fixture)
{
    [SkippableFact]
    public async Task Videojs_skin_upgrades_all_players_and_replaces_native_controls()
    {
        RequireDemo();
        await GoAsync("/components/video-player");
        await Page.WaitForFunctionAsync("""
            () => {
                const players = [...document.querySelectorAll('[data-slot="video-player"]')];
                return players.length >= 6 && players.every(p => p.dataset.videojs === 'ready');
            }
            """);

        Assert.True(await Page.EvaluateAsync<bool>("() => !!customElements.get('video-skin')"));
        Assert.True(await Page.EvaluateAsync<bool>("() => [...document.querySelectorAll('[data-slot=\"video-player\"] video')].every(v => !v.controls)"));
        Assert.True(await Page.EvaluateAsync<bool>("() => [...document.querySelectorAll('video-skin')].some(s => { const r = s.getBoundingClientRect(); return r.height > r.width * 1.2; })"));
        Assert.True(await Page.EvaluateAsync<bool>("() => [...document.querySelectorAll('video-player')].some(p => p.getAttribute('content-title') === 'Bông hoa')"));
    }

    [SkippableFact]
    public async Task Player_reinitializes_after_unpoly_navigation()
    {
        RequireDemo();
        await GoAsync("/components/video-player");
        await Page.WaitForFunctionAsync("() => document.querySelector('[data-slot=\"video-player\"]')?.dataset.videojs === 'ready'");
        await Page.Locator(".doc-nav a[href='/components/button']").ClickAsync();
        await Page.GetByRole(AriaRole.Heading, new() { Name = "Button", Exact = true }).WaitForAsync();
        await Page.Locator(".doc-nav a[href='/components/video-player']").ClickAsync();
        await Page.GetByRole(AriaRole.Heading, new() { Name = "Video Player", Exact = true }).WaitForAsync();
        await Page.WaitForFunctionAsync("() => [...document.querySelectorAll('[data-slot=\"video-player\"]')].every(p => p.dataset.videojs === 'ready' && !p.querySelector('video').controls)");
    }

    [SkippableFact]
    public async Task Failed_module_load_retains_native_controls()
    {
        RequireDemo();
        await Page.RouteAsync("**/videojs/video.js", route => route.AbortAsync());
        await GoAsync("/components/video-player");
        await Page.WaitForFunctionAsync("() => document.querySelector('[data-slot=\"video-player\"]')?.dataset.videojs === 'failed'");
        Assert.True(await Page.EvaluateAsync<bool>("() => document.querySelector('[data-slot=\"video-player\"] video').controls"));
        Assert.False(await Page.EvaluateAsync<bool>("() => !!customElements.get('video-skin')"));
        // The import failure is intentional; do not AssertQuiet() on this page.
    }
}
