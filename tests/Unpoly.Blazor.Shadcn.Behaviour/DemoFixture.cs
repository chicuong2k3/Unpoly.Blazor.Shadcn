using System.Diagnostics;
using System.Net.Sockets;
using Microsoft.Playwright;

namespace Unpoly.Blazor.Shadcn.Behaviour;

/// <summary>
/// One demo application and one browser for the whole run.
/// </summary>
/// <remarks>
/// <para>
/// The demo is started as a real process on a free port rather than through
/// <c>WebApplicationFactory</c>, because that gives a <c>TestServer</c> with no socket and a
/// browser needs somewhere to connect. If something is already listening on
/// <c>BEHAVIOUR_URL</c> — the app you are developing against — that is used instead and nothing
/// is started, which makes the whole suite a fast inner loop rather than a CI-only ceremony.
/// </para>
/// <para>
/// Nothing here fails when the browser binaries are missing: <see cref="UnavailableReason"/> is
/// set and every test skips, exactly as the Nexora replays do. A suite that cannot run is not a
/// suite that failed.
/// </para>
/// </remarks>
public class DemoFixture : IAsyncLifetime
{
    IPlaywright? _playwright;
    Process? _app;

    public IBrowser? Browser { get; private set; }

    public string BaseUrl { get; private set; } = "";

    public string? UnavailableReason { get; private set; }

    public async Task InitializeAsync()
    {
        try
        {
            BaseUrl = await StartOrReuseAsync();
        }
        catch (Exception e)
        {
            UnavailableReason = $"the demo would not start ({e.Message.Split('\n')[0]})";
            return;
        }

        try
        {
            _playwright = await Playwright.CreateAsync();
            Browser = await _playwright.Chromium.LaunchAsync(new BrowserTypeLaunchOptions
            {
                // BEHAVIOUR_BROWSER points at a real installed browser — Opera, Edge, whatever a
                // report came from. Several faults here only ever appeared in one of them.
                ExecutablePath = Env("BEHAVIOUR_BROWSER"),
                Headless = Env("BEHAVIOUR_BROWSER") is null,
            });
        }
        catch (Exception e)
        {
            // pwsh bin/Debug/net10.0/playwright.ps1 install chromium
            UnavailableReason = $"Playwright Chromium unavailable ({e.Message.Split('\n')[0]})";
        }
    }

    /// <summary>A page with the demo's own layout width, so nothing is in its mobile shape.</summary>
    public async Task<IPage> NewPageAsync(int width = 1500, int height = 1100)
    {
        var page = await Browser!.NewPageAsync(new BrowserNewPageOptions
        {
            ViewportSize = new ViewportSize { Width = width, Height = height },
        });

        if (Safari15Sim)
        {
            var stub = Safari15StubPath();
            await page.AddInitScriptAsync(File.ReadAllText(stub));
        }

        return page;
    }

    public async Task DisposeAsync()
    {
        if (Browser is not null) await Browser.CloseAsync();
        _playwright?.Dispose();

        if (_app is { HasExited: false })
        {
            _app.Kill(entireProcessTree: true);
            await _app.WaitForExitAsync();
        }
        _app?.Dispose();
    }

    async Task<string> StartOrReuseAsync()
    {
        var given = Env("BEHAVIOUR_URL");
        if (given is not null)
        {
            if (await RespondsAsync(given)) return given.TrimEnd('/');
            throw new InvalidOperationException($"nothing is listening on {given}");
        }

        var url = $"http://127.0.0.1:{FreePort()}";

        // Started from the demo's OWN output folder, not from ours. A referenced library ships
        // its wwwroot as a static web asset, and what maps /_content/… to it is a manifest that
        // sits beside the demo's build output — copying the dll next to the tests leaves the
        // manifest behind, so ui.js and app.css both 404 and every component is unstyled and
        // inert. The reference is kept so the demo is built before the tests run; the process is
        // started where the build put it.
        var dll = DemoAssembly();

        var start = new ProcessStartInfo("dotnet", $"\"{dll}\"")
        {
            WorkingDirectory = Path.GetDirectoryName(dll)!,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
        };
        start.Environment["ASPNETCORE_URLS"] = url;
        // Development, and not as a shortcut: UseStaticWebAssets is wired only in Development, and
        // it is what maps /_content/Unpoly.Blazor.Shadcn/… to the library's wwwroot from a build
        // output. Anywhere else the manifest is ignored, ui.js and app.css both 404, and every
        // component on the page is unstyled and inert — which looks exactly like a component that
        // does not work. A published demo would serve them from disk; a built one needs this.
        start.Environment["ASPNETCORE_ENVIRONMENT"] = "Development";

        _app = Process.Start(start) ?? throw new InvalidOperationException("dotnet would not start");

        // Drain the child's console, reading into nothing. The app logs every request at
        // Information level, and a redirected stdout is a pipe with a bounded buffer. Once
        // enough tests have logged into it - somewhere around the fortieth, depending on how
        // much each page says - the app's own Console.WriteLine blocks in WriteFile, and every
        // thread that logs next, i.e. every request thread, waits on the logger behind it.
        // From then on the demo accepts connections and answers nothing, and every remaining
        // test fails with an identical networkidle timeout. Reading the stream keeps the pipe
        // from filling; the text itself is not needed.
        _app.BeginOutputReadLine();
        _app.BeginErrorReadLine();

        for (var i = 0; i < 120; i++)
        {
            if (_app.HasExited) throw new InvalidOperationException("the demo exited while starting");
            if (await RespondsAsync(url)) return url;
            await Task.Delay(500);
        }
        throw new TimeoutException($"the demo did not answer on {url} within a minute");
    }

    static async Task<bool> RespondsAsync(string url)
    {
        try
        {
            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
            using var response = await http.GetAsync(url);
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    static int FreePort()
    {
        var listener = new TcpListener(System.Net.IPAddress.Loopback, 0);
        listener.Start();
        var port = ((System.Net.IPEndPoint)listener.LocalEndpoint).Port;
        listener.Stop();
        return port;
    }

    /// <summary>
    /// The demo dll where its own build put it, found by walking up to the repository root. The
    /// configuration is taken from this assembly's path, so a Release run finds the Release demo.
    /// </summary>
    static string DemoAssembly()
    {
        // bin/<configuration>/<tfm>/ — the parent of the tfm folder is the one that names it.
        var here = AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
        var configuration = Path.GetFileName(Path.GetDirectoryName(here)) ?? "Debug";
        var from = new DirectoryInfo(AppContext.BaseDirectory);
        for (var dir = from; dir is not null; dir = dir.Parent)
        {
            var candidate = Path.Combine(dir.FullName, "demo", "Unpoly.Blazor.Shadcn.Demo",
                                         "bin", configuration, "net10.0", "Unpoly.Blazor.Shadcn.Demo.dll");
            if (File.Exists(candidate)) return candidate;
        }
        throw new FileNotFoundException(
            "the demo has not been built; run `dotnet build demo/Unpoly.Blazor.Shadcn.Demo` first");
    }

    static string? Env(string name) =>
        Environment.GetEnvironmentVariable(name) is { Length: > 0 } value ? value : null;

    /// <summary>
    /// Safari 15 simulation: the stub removes APIs the polyfill then restores,
    /// so the suite exercises the compat path. Off by default; modern runs are
    /// untouched.
    /// </summary>
    internal static bool Safari15Sim => Env("SAFARI15_SIM") is not null;

    /// <summary>
    /// Finds safari15-stub.js by walking up from the test assembly toward the repository root.
    /// </summary>
    static string Safari15StubPath()
    {
        var here = new DirectoryInfo(AppContext.BaseDirectory);
        for (var dir = here; dir is not null; dir = dir.Parent)
        {
            var candidate = Path.Combine(dir.FullName, "safari15-stub.js");
            if (File.Exists(candidate)) return candidate;
        }
        throw new FileNotFoundException(
            "safari15-stub.js not found; ensure it exists beside the behaviour test sources");
    }
}

/// <summary>
/// One application and one browser, shared. The pages are independent; the process is not.
/// </summary>
[CollectionDefinition(Name)]
public class DemoCollection : ICollectionFixture<DemoFixture>
{
    public const string Name = "demo";
}
