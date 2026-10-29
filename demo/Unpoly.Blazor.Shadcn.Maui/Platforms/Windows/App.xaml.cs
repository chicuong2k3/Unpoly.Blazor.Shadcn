using Microsoft.UI.Xaml;

// To learn more about WinUI, the WinUI project structure,
// and more about our project templates, see: http://aka.ms/winui-project-info.

namespace Unpoly.Blazor.Shadcn.Maui.WinUI;

/// <summary>
/// Provides application-specific behavior to supplement the default Application class.
/// </summary>
public partial class App : MauiWinUIApplication
{
	/// <summary>
	/// Initializes the singleton application object.  This is the first line of authored code
	/// executed, and as such is the logical equivalent of main() or WinMain().
	/// </summary>
	public App()
	{
		MauiSmokeDiagnostics.Write("WinUI app constructing");
        UnhandledException += (_, args) => MauiSmokeDiagnostics.Write($"Unhandled WinUI exception: {args.Exception}");
        if (MauiSmokeDiagnostics.Enabled)
        {
            try { MauiSmokeDiagnostics.Write($"WebView2 runtime: {Microsoft.Web.WebView2.Core.CoreWebView2Environment.GetAvailableBrowserVersionString()}"); }
            catch (Exception error) { MauiSmokeDiagnostics.Write($"WebView2 runtime detection: {error}"); }
        }
        this.InitializeComponent();
        MauiSmokeDiagnostics.Write("WinUI XAML initialized");
	}

	protected override MauiApp CreateMauiApp() => MauiProgram.CreateMauiApp();
}

