// Real old-WebKit probe, C#: drives WebKitGTK 2.36 (the engine family Safari
// 15.x / iOS 15.x ships) through its flat C API and asserts the Safari 15
// compat work against the actual engine, not a stub simulation.
//
// Run: xvfb-run -a dotnet run --project tests/SafariReal -c Release -- <base-url> <out-dir>
//
// Writes results/results.json, results/results.md and PNG snapshots. Every
// assertion prints "ASSERT <name>: PASS|FAIL <detail>" so CI logs and the
// results branch carry the verdict in plain text.

using System.Runtime.InteropServices;
using System.Text.Json;

var baseUrl = (args.Length > 0 ? args[0] : "http://127.0.0.1:8080").TrimEnd('/');
var outDir = args.Length > 1 ? args[1] : "results";
Directory.CreateDirectory(outDir);

var results = new List<(string Name, bool Ok, string Detail)>();

void Assert(string name, bool ok, string detail = "")
{
    results.Add((name, ok, detail));
    Console.Out.WriteLine($"ASSERT {name}: {(ok ? "PASS" : "FAIL")} {detail}");
    Console.Out.Flush();
}

if (args.Contains("ladder"))
{
    Nat.GtkInit();
    var win0 = Nat.GtkOffscreenWindowNew();
    var view0 = Nat.WebViewNew();
    Nat.GtkContainerAdd(win0, view0);
    Nat.GtkWidgetShowAll(win0);
    Nat.WebViewLoadUri(view0, baseUrl + "/");
    var dl = DateTime.UtcNow.AddSeconds(30);
    while (DateTime.UtcNow < dl)
    {
        Nat.GtkMainIterationDo(false);
        Thread.Sleep(50);
        try
        {
            if (Nat.RunJavascriptAsync(view0, "document.readyState", 10).GetAwaiter().GetResult() == "\"complete\"")
                break;
        }
        catch { }
    }
    string[] snippets =
    [
        "1+1",
        "var ladderX = {a: 1}; ladderX.a",
        "(function(){return 42})()",
        "function ladderF(){return 7} ladderF()",
        "typeof up",
        "document.readyState",
        "getComputedStyle(document.body).getPropertyValue('color')",
        "JSON.stringify({a:1})",
        "matchMedia('(min-width: 640px)').matches",
        "var ladderBtn = document.querySelector('[data-slot=\"button\"]'); ladderBtn ? 1 : 0",
    ];
    foreach (var s in snippets)
    {
        try
        {
            var r = Nat.RunJavascriptAsync(view0, s, 10).GetAwaiter().GetResult();
            Console.Out.WriteLine($"LADDER ok: {s} => {r[..Math.Min(80, r.Length)]}");
        }
        catch (Exception ex)
        {
            Console.Out.WriteLine($"LADDER FAIL: {s} => {ex.GetType().Name}: {ex.Message[..Math.Min(160, ex.Message.Length)]}");
        }
    }
    try
    {
        var full =
            "(function () {" +
            " function cs(el, p) { return el ? getComputedStyle(el).getPropertyValue(p) : null; }" +
            " var btn = document.querySelector('[data-slot=\"button\"]');" +
            " return JSON.stringify({" +
            "  booted: (typeof up !== 'undefined') ? up.version : null," +
            "  bodyBg: cs(document.body, 'background-color')" +
            " });" +
            "})()";
        var r = Nat.RunJavascriptAsync(view0, full, 10).GetAwaiter().GetResult();
        Console.Out.WriteLine($"LADDER full-state ok ({full.Length} chars) => {r[..Math.Min(120, r.Length)]}");
    }
    catch (Exception ex)
    {
        Console.Out.WriteLine($"LADDER full-state FAIL: {ex.GetType().Name}: {ex.Message[..Math.Min(200, ex.Message.Length)]}");
    }
    Environment.Exit(0);
}

Nat.GtkInit();

var win = Nat.GtkOffscreenWindowNew();
var view = Nat.WebViewNew();
Nat.GtkContainerAdd(win, view);
Nat.GtkWidgetShowAll(win);
Nat.GtkWindowResize(win, 1280, 900);

string Eval(string js, int timeoutS = 20)
{
    var task = Nat.RunJavascriptAsync(view, js, timeoutS * 1000);
    task.Wait();
    return task.Result;
}

string StateJson() => Eval(
    "(function () {" +
    " function cs(el, p) { return el ? getComputedStyle(el).getPropertyValue(p) : null; }" +
    " var btn = document.querySelector('[data-slot=\"button\"]');" +
    " return JSON.stringify({" +
    "  booted: (typeof up !== 'undefined') ? up.version : null," +
    "  bodyBg: cs(document.body, 'background-color')," +
    "  bodyFg: cs(document.body, 'color')," +
    "  btnBg: cs(btn, 'background-color')," +
    "  primary: getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()," +
    "  background: getComputedStyle(document.documentElement).getPropertyValue('--background').trim()," +
    "  mq640: matchMedia('(min-width: 640px)').matches," +
    "  scrollWidth: document.documentElement.scrollWidth," +
    "  innerWidth: window.innerWidth" +
    " });" +
    "})()");

void LoadPage(string path, int settleMs)
{
    Nat.WebViewLoadUri(view, baseUrl + path);
    var deadline = DateTime.UtcNow.AddSeconds(30);
    while (DateTime.UtcNow < deadline)
    {
        Nat.GtkMainIterationDo(false);
        Thread.Sleep(15);
        string ready;
        try
        {
            ready = Eval("document.readyState + '|' + (typeof up !== 'undefined')", 10);
        }
        catch
        {
            continue;
        }
        if (ready.StartsWith("complete|true"))
        {
            Nat.PumpFor(view, settleMs);
            return;
        }
    }
    throw new TimeoutException($"page {path} did not reach ready|booted within 30s");
}

void Snapshot(string name)
{
    var path = Path.Combine(Path.GetFullPath(outDir), name + ".png");
    try
    {
        Nat.Snapshot(view, path, 10_000);
        Console.Out.WriteLine($"SNAPSHOT {path}");
    }
    catch (Exception ex)
    {
        Console.Out.WriteLine($"SNAPSHOT {name} failed: {ex.Message}");
    }
}

bool NonTransparent(string? v)
{
    if (string.IsNullOrWhiteSpace(v)) return false;
    v = v.Trim();
    if (v is "transparent" or "rgba(0, 0, 0, 0)") return false;
    if (v.StartsWith("rgba") && v.TrimEnd(')').EndsWith(" 0")) return false;
    return true;
}

JsonElement State()
{
    var raw = Eval(StateJson());
    var doc = JsonDocument.Parse(raw);
    if (doc.RootElement.ValueKind != JsonValueKind.Object)
        throw new InvalidOperationException("STATE did not evaluate to an object: " + raw[..Math.Min(300, raw.Length)]);
    return doc.RootElement;
}

static string Prop(JsonElement el, string name) =>
    el.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String
        ? v.GetString() ?? ""
        : "";

try
{
    LoadPage("/", 2000);
    var s = State();
    Assert("unpoly-booted", s.TryGetProperty("booted", out var b) && b.ValueKind == JsonValueKind.String,
        $"up.version={Prop(s, "booted")}");
    Assert("body-has-background", NonTransparent(Prop(s, "bodyBg")), Prop(s, "bodyBg"));
    Assert("body-has-foreground", NonTransparent(Prop(s, "bodyFg")), Prop(s, "bodyFg"));
    Assert("token--primary-resolves", NonTransparent(Prop(s, "primary")), Prop(s, "primary"));
    Assert("token--background-resolves", NonTransparent(Prop(s, "background")), Prop(s, "background"));
    Assert("button-painted", NonTransparent(Prop(s, "btnBg")), Prop(s, "btnBg"));
    Assert("desktop-mq-640-applies", s.GetProperty("mq640").GetBoolean(), $"mq640={s.GetProperty("mq640").GetBoolean()}");
    Snapshot("home-desktop");

    LoadPage("/components/select", 2000);
    s = State();
    Assert("select-page-booted", s.TryGetProperty("booted", out _) && s.GetProperty("booted").ValueKind == JsonValueKind.String,
        $"up.version={Prop(s, "booted")}");

    Eval(
        "(function () { var t = document.querySelector('[data-slot=\"select-trigger\"]');" +
        " if (t) t.click(); })()", 10);
    Nat.PumpFor(view, 1200);

    string panel = "{}";
    var openDeadline = DateTime.UtcNow.AddSeconds(5);
    while (DateTime.UtcNow < openDeadline)
    {
        panel = Eval(
            "(function () { var p = document.querySelector('[data-slot=\"select-content\"]');" +
            " if (!p) return '{}';" +
            " return JSON.stringify({ state: p.getAttribute('data-state')," +
            "  display: getComputedStyle(p).display," +
            "  items: p.querySelectorAll('[data-slot=\"select-item\"]').length }); })()", 10);
        var jp = JsonDocument.Parse(panel).RootElement;
        if (jp.TryGetProperty("display", out var d) && d.GetString() is not (null or "none"))
            break;
        Thread.Sleep(250);
        Nat.PumpFor(view, 200);
    }
    var jp2 = JsonDocument.Parse(panel).RootElement;
    var display = jp2.TryGetProperty("display", out var d2) ? d2.GetString() : null;
    var items = jp2.TryGetProperty("items", out var it) ? it.GetInt32() : 0;
    Assert("select-panel-opens", display is not (null or "none") && items > 0, panel);
    Snapshot("select-open");

    Nat.GtkWindowResize(win, 390, 844);
    LoadPage("/", 2000);
    var m = State();
    var scroll = m.TryGetProperty("scrollWidth", out var sw) ? sw.GetInt32() : int.MaxValue;
    var inner = m.TryGetProperty("innerWidth", out var iw) ? iw.GetInt32() : 0;
    Assert("mobile-no-horizontal-overflow", scroll <= inner + 1, $"scrollWidth={scroll} innerWidth={inner}");
    Assert("mobile-mq-correctly-inactive", m.TryGetProperty("mq640", out var mq) && !mq.GetBoolean(),
        $"mq640={(m.TryGetProperty("mq640", out var mq2) ? mq2.GetBoolean().ToString() : "?")}");
    Snapshot("home-mobile-390");
}
catch (Exception ex)
{
    Assert("probe-crashed", false, ex.ToString() is { Length: > 400 } t ? t[..400] : ex.ToString());
}
finally
{
    var engine = $"{Nat.WebKitMajor()}.{Nat.WebKitMinor()}.{Nat.WebKitMicro()}";
    var failed = results.Where(r => !r.Ok).Select(r => r.Name).ToList();
    var summary = new
    {
        engine = $"WebKitGTK {engine} (Safari 15.4 family)",
        baseUrl,
        passed = results.Count - failed.Count,
        failed = failed.Count,
        asserts = results.Select(r => new { name = r.Name, ok = r.Ok, detail = r.Detail }),
    };
    File.WriteAllText(Path.Combine(outDir, "results.json"),
        JsonSerializer.Serialize(summary, new JsonSerializerOptions { WriteIndented = true }));

    var lines = new List<string>
    {
        "# Safari 15 real-engine probe results",
        "",
        $"Engine: **WebKitGTK {engine}** (Safari 15.4 family)",
        $"Base: {baseUrl}",
        "",
        $"Passed: **{results.Count - failed.Count} / {results.Count}**",
        "",
    };
    foreach (var (name, ok, detail) in results)
        lines.Add($"- {(ok ? "PASS" : "FAIL")} **{name}** - {detail[..Math.Min(220, detail.Length)]}");
    File.WriteAllText(Path.Combine(outDir, "results.md"), string.Join("\n", lines) + "\n");

    Console.Out.WriteLine($"ENGINE WebKitGTK {engine}");
    Console.Out.WriteLine($"SUMMARY passed={results.Count - failed.Count} failed={failed.Count}");
    if (failed.Count > 0)
        Console.Out.WriteLine("FAILED: " + string.Join(", ", failed));
    Environment.Exit(failed.Count == 0 ? 0 : 1);
}

internal static class Nat
{
    private const string Gtk = "libgtk-3.so.0";
    private const string WebKit = "libwebkit2gtk-4.0.so.37";
    private const string Jsc = "libjavascriptcoregtk-4.0.so.18";
    private const string Cairo = "libcairo.so.2";
    private const string GObject = "libgobject-2.0.so.0";

    private static bool _gtkInit;

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    private delegate void GAsyncReadyCallback(IntPtr source, IntPtr res, IntPtr userData);

    public static void GtkInit()
    {
        var argc = 0;
        var argv = IntPtr.Zero;
        gtk_init_native(ref argc, ref argv);
    }

    public static IntPtr GtkOffscreenWindowNew() => gtk_offscreen_window_new();

    public static IntPtr WebViewNew()
    {
        var ucm = webkit_user_content_manager_new();
        var injected = webkit_user_script_new(
            ProbeScript(),
            1 /* WEBKIT_USER_CONTENT_INJECT_ALL_FRAMES */,
            0 /* WEBKIT_USER_SCRIPT_INJECT_AT_DOCUMENT_START */,
            IntPtr.Zero, IntPtr.Zero);
        webkit_user_content_manager_add_script(ucm, injected);
        return webkit_web_view_new_with_user_content_manager(ucm);
    }

    // Runs on every page before page scripts: records uncaught errors and
    // console errors into window.__probeErrors so assertions can read them
    // without a host-side signal hookup.
    private static string ProbeScript() =>
        "window.__probeErrors = [];" +
        "var __ce = console.error.bind(console);" +
        "console.error = function(){ window.__probeErrors.push(Array.prototype.join.call(arguments, ' ')); __ce.apply(null, arguments); };" +
        "window.addEventListener('error', function(ev){ window.__probeErrors.push('pageerror: ' + ev.message); });";

    public static void WebViewLoadUri(IntPtr view, string uri) =>
        webkit_web_view_load_uri(view, uri);

    public static void GtkContainerAdd(IntPtr container, IntPtr widget) =>
        gtk_container_add(container, widget);

    public static void GtkWidgetShowAll(IntPtr widget) => gtk_widget_show_all(widget);

    public static void GtkWindowResize(IntPtr win, int w, int h) => gtk_window_resize(win, w, h);

    public static void GtkMainIterationDo(bool blocking) => gtk_main_iteration_do(blocking);

    public static void PumpFor(IntPtr view, int ms)
    {
        var until = DateTime.UtcNow.AddMilliseconds(ms);
        while (DateTime.UtcNow < until)
        {
            gtk_main_iteration_do(false);
            Thread.Sleep(5);
        }
    }

    public static int WebKitMajor() => webkit_get_major_version();
    public static int WebKitMinor() => webkit_get_minor_version();
    public static int WebKitMicro() => webkit_get_micro_version();

    public static Task<string> RunJavascriptAsync(IntPtr view, string script, int timeoutMs)
    {
        var tcs = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
        var state = new CallbackState { Completion = tcs };
        var stateHandle = GCHandle.Alloc(state);
        GAsyncReadyCallback? cb = null;
        cb = (source, res, userData) =>
        {
            var st = (CallbackState)GCHandle.FromIntPtr(userData).Target!;
            try
            {
                IntPtr err = IntPtr.Zero;
                var jsResult = webkit_web_view_run_javascript_finish(source, res, ref err);
                if (err != IntPtr.Zero)
                {
                    // GError is { guint32 domain, gint code, char* message }:
                    // the pointer sits after two 4-byte fields, NOT after two
                    // machine words (reading there yields garbage that looks
                    // like mojibake). Read-only peek, no dealloc.
                    string detail;
                    try
                    {
                        detail = Marshal.PtrToStringUTF8(
                            Marshal.ReadIntPtr(err, sizeof(uint) + sizeof(int))) ?? "?";
                    }
                    catch
                    {
                        detail = "?";
                    }
                    st.Completion.TrySetResult("\"<webkit error: " + detail + ">\"");
                    return;
                }
                if (jsResult == IntPtr.Zero)
                {
                    st.Completion.TrySetResult("\"<null result>\"");
                    return;
                }
                var strPtr = jsc_value_to_string(webkit_javascript_result_get_js_value(jsResult));
                // Not freed on purpose: JSC string ownership differs across
                // builds and a wrong free aborts the probe; the leak is bytes.
                var value = Marshal.PtrToStringUTF8(strPtr) ?? "";
                st.Completion.TrySetResult(value);
            }
            catch (Exception ex)
            {
                st.Completion.TrySetException(ex);
            }
            finally
            {
                GCHandle.FromIntPtr(userData).Free();
                st.CallbackHandle.Free();
            }
        };
        state.CallbackHandle = GCHandle.Alloc(cb);
        webkit_web_view_run_javascript(view, script, IntPtr.Zero, cb, GCHandle.ToIntPtr(stateHandle));

        var end = DateTime.UtcNow.AddMilliseconds(timeoutMs);
        while (!tcs.Task.IsCompleted && DateTime.UtcNow < end)
        {
            gtk_main_iteration_do(false);
            Thread.Sleep(5);
        }
        if (!tcs.Task.IsCompleted)
            throw new TimeoutException("run_javascript timed out: " + script[..Math.Min(80, script.Length)]);
        return tcs.Task;
    }

    private sealed class CallbackState
    {
        public TaskCompletionSource<string> Completion { get; init; } = default!;
        public TaskCompletionSource<bool>? BoolCompletion { get; init; }
        public GCHandle CallbackHandle;
    }

    public static void Snapshot(IntPtr view, string path, int timeoutMs)
    {
        var tcs = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        var state = new CallbackState { Completion = new TaskCompletionSource<string>(), BoolCompletion = tcs };
        var stateHandle = GCHandle.Alloc(state);
        GAsyncReadyCallback? cb = null;
        cb = (source, res, userData) =>
        {
            var st = (CallbackState)GCHandle.FromIntPtr(userData).Target!;
            try
            {
                IntPtr err = IntPtr.Zero;
                var surface = webkit_web_view_get_snapshot_finish(source, res, ref err);
                if (err == IntPtr.Zero && surface != IntPtr.Zero)
                {
                    var bytes = Marshal.StringToCoTaskMemUTF8(path);
                    cairo_surface_write_to_png(surface, bytes);
                    Marshal.FreeCoTaskMem(bytes);
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("snapshot callback: " + ex.Message);
            }
            finally
            {
                GCHandle.FromIntPtr(userData).Free();
                st.CallbackHandle.Free();
                st.BoolCompletion?.TrySetResult(true);
            }
        };
        state.CallbackHandle = GCHandle.Alloc(cb);
        webkit_web_view_get_snapshot(view, 0 /* FULL_DOCUMENT */, 0 /* NONE */, IntPtr.Zero, cb, GCHandle.ToIntPtr(stateHandle));

        var end = DateTime.UtcNow.AddMilliseconds(timeoutMs);
        while (!tcs.Task.IsCompleted && DateTime.UtcNow < end)
        {
            gtk_main_iteration_do(false);
            Thread.Sleep(5);
        }
        if (!tcs.Task.IsCompleted)
            throw new TimeoutException("snapshot timed out");
    }

    [DllImport(Gtk, CallingConvention = CallingConvention.Cdecl, EntryPoint = "gtk_init")]
    private static extern void gtk_init_native(ref int argc, ref IntPtr argv);

    [DllImport(Gtk, CallingConvention = CallingConvention.Cdecl)]
    private static extern IntPtr gtk_offscreen_window_new();

    [DllImport(Gtk, CallingConvention = CallingConvention.Cdecl)]
    private static extern void gtk_container_add(IntPtr container, IntPtr widget);

    [DllImport(Gtk, CallingConvention = CallingConvention.Cdecl)]
    private static extern void gtk_widget_show_all(IntPtr widget);

    [DllImport(Gtk, CallingConvention = CallingConvention.Cdecl)]
    private static extern void gtk_window_resize(IntPtr window, int width, int height);

    [DllImport(Gtk, CallingConvention = CallingConvention.Cdecl)]
    private static extern int gtk_main_iteration_do(bool blocking);

    [DllImport(WebKit, CallingConvention = CallingConvention.Cdecl)]
    private static extern IntPtr webkit_user_content_manager_new();

    [DllImport(WebKit, CallingConvention = CallingConvention.Cdecl)]
    private static extern IntPtr webkit_user_script_new(
        string source, int injectedFrames, int injectionTime,
        IntPtr allowList, IntPtr blockList);

    [DllImport(WebKit, CallingConvention = CallingConvention.Cdecl)]
    private static extern void webkit_user_content_manager_add_script(
        IntPtr manager, IntPtr script);

    [DllImport(WebKit, CallingConvention = CallingConvention.Cdecl)]
    private static extern IntPtr webkit_web_view_new_with_user_content_manager(IntPtr manager);

    [DllImport(WebKit, CallingConvention = CallingConvention.Cdecl)]
    private static extern void webkit_web_view_load_uri(IntPtr view, string uri);

    [DllImport(WebKit, CallingConvention = CallingConvention.Cdecl)]
    private static extern void webkit_web_view_run_javascript(
        IntPtr view,
        [MarshalAs(UnmanagedType.LPUTF8Str)] string script,
        IntPtr cancellable,
        GAsyncReadyCallback callback,
        IntPtr userData);

    [DllImport(WebKit, CallingConvention = CallingConvention.Cdecl)]
    private static extern IntPtr webkit_web_view_run_javascript_finish(
        IntPtr view, IntPtr result, ref IntPtr error);

    [DllImport(WebKit, CallingConvention = CallingConvention.Cdecl)]
    private static extern IntPtr webkit_javascript_result_get_js_value(IntPtr jsResult);

    [DllImport(WebKit, CallingConvention = CallingConvention.Cdecl)]
    private static extern void webkit_web_view_get_snapshot(
        IntPtr view, int region, int options, IntPtr cancellable,
        GAsyncReadyCallback callback, IntPtr userData);

    [DllImport(WebKit, CallingConvention = CallingConvention.Cdecl)]
    private static extern IntPtr webkit_web_view_get_snapshot_finish(
        IntPtr view, IntPtr result, ref IntPtr error);

    [DllImport(WebKit, CallingConvention = CallingConvention.Cdecl)]
    private static extern int webkit_get_major_version();

    [DllImport(WebKit, CallingConvention = CallingConvention.Cdecl)]
    private static extern int webkit_get_minor_version();

    [DllImport(WebKit, CallingConvention = CallingConvention.Cdecl)]
    private static extern int webkit_get_micro_version();

    [DllImport(Jsc, CallingConvention = CallingConvention.Cdecl)]
    private static extern IntPtr jsc_value_to_string(IntPtr value);

    [DllImport(Cairo, CallingConvention = CallingConvention.Cdecl)]
    private static extern int cairo_surface_write_to_png(IntPtr surface, IntPtr filename);

    [DllImport(GObject, CallingConvention = CallingConvention.Cdecl)]
    private static extern void g_free(IntPtr ptr);
}
