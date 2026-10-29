using Microsoft.Extensions.Logging;

﻿namespace Unpoly.Blazor.Shadcn.Maui;

public static class MauiProgram
{
	public static MauiApp CreateMauiApp()
	{
		MauiSmokeDiagnostics.Write($"CreateMauiApp: interactive={Environment.UserInteractive}");
		var builder = MauiApp.CreateBuilder();
		builder
			.UseMauiApp<App>()
			.ConfigureFonts(fonts =>
			{
				fonts.AddFont("OpenSans-Regular.ttf", "OpenSansRegular");
			});

		builder.Services.AddMauiBlazorWebView();
        if (MauiSmokeDiagnostics.Enabled)
        {
            builder.Logging.AddFilter("Microsoft.AspNetCore.Components.WebView", LogLevel.Trace);
            builder.Logging.AddProvider(new MauiSmokeLogProvider());
        }
		builder.Services.AddScoped(sp => new HttpClient { BaseAddress = new Uri("http://localhost/") });

#if DEBUG
		builder.Services.AddBlazorWebViewDeveloperTools();
		builder.Logging.AddDebug();
#endif

		return builder.Build();
	}
}
