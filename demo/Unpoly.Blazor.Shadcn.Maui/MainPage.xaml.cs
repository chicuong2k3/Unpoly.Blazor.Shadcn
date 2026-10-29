namespace Unpoly.Blazor.Shadcn.Maui;

public partial class MainPage : ContentPage
{
	public MainPage()
	{
		MauiSmokeDiagnostics.Write("MainPage constructing");
        InitializeComponent();
        Loaded += (_, _) => MauiSmokeDiagnostics.Write("MainPage loaded");
        blazorWebView.HandlerChanged += (_, _) => MauiSmokeDiagnostics.Write("BlazorWebView handler changed");
        blazorWebView.BlazorWebViewInitializing += (_, _) => MauiSmokeDiagnostics.Write("BlazorWebView initializing");
        blazorWebView.BlazorWebViewInitialized += (_, _) => MauiSmokeDiagnostics.Write("BlazorWebView initialized");
	}
}
