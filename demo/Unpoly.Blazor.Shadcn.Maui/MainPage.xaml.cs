namespace Unpoly.Blazor.Shadcn.Maui;

public partial class MainPage : ContentPage
{
	public MainPage()
	{
		MauiSmokeDiagnostics.Write("MainPage constructing");
        InitializeComponent();
        Loaded += (_, _) => MauiSmokeDiagnostics.Write("MainPage loaded");
        blazorWebView.HandlerChanged += (_, _) => MauiSmokeDiagnostics.Write("BlazorWebView handler changed");
        blazorWebView.BlazorWebViewInitializing += (_, args) =>
        {
            MauiSmokeDiagnostics.Write("BlazorWebView initializing");
#if WINDOWS && DEBUG
            // Elevated WebView2 hosts ignore WEBVIEW2_* environment overrides. The
            // smoke harness opts a Debug demo into one validated loopback CDP port.
            // Never accept an arbitrary browser-arguments string or enable this in Release.
            if (int.TryParse(Environment.GetEnvironmentVariable("MAUI_SMOKE_CDP_PORT"), out var port)
                && port is >= 1024 and <= 65535)
            {
                args.EnvironmentOptions ??= new Microsoft.Web.WebView2.Core.CoreWebView2EnvironmentOptions();
                args.EnvironmentOptions.AdditionalBrowserArguments = $"--remote-debugging-port={port} --remote-debugging-address=127.0.0.1";
                args.UserDataFolder = Path.Combine(Path.GetTempPath(), $"shadcn-maui-smoke-{Environment.ProcessId}-{port}");
                MauiSmokeDiagnostics.Write($"Debug smoke CDP port={port}; profile={args.UserDataFolder}");
            }
#endif
        };
        blazorWebView.BlazorWebViewInitialized += (_, _) => MauiSmokeDiagnostics.Write("BlazorWebView initialized");
	}
}
