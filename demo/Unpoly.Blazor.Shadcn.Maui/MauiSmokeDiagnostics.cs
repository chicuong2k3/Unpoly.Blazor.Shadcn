using Microsoft.Extensions.Logging;

namespace Unpoly.Blazor.Shadcn.Maui;

// Enabled only by the native smoke child process; normal demo launches write nothing.
internal static class MauiSmokeDiagnostics
{
    private static readonly object Gate = new();
    internal static bool Enabled => !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("MAUI_SMOKE_LOG_PATH"));

    internal static void Write(string message)
    {
        var path = Environment.GetEnvironmentVariable("MAUI_SMOKE_LOG_PATH");
        if (string.IsNullOrWhiteSpace(path)) return;
        try
        {
            lock (Gate) File.AppendAllText(path, $"{DateTimeOffset.UtcNow:O} {message}{Environment.NewLine}");
        }
        catch (IOException) { } // Diagnostics must not change the application lifecycle.
        catch (UnauthorizedAccessException) { }
    }
}

internal sealed class MauiSmokeLogProvider : ILoggerProvider
{
    public ILogger CreateLogger(string categoryName) => new SmokeLogger(categoryName);
    public void Dispose() { }

    private sealed class SmokeLogger(string category) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => category.StartsWith("Microsoft.AspNetCore.Components.WebView", StringComparison.Ordinal);
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            if (IsEnabled(logLevel)) MauiSmokeDiagnostics.Write($"{category} [{logLevel}] {formatter(state, exception)} {exception}");
        }
    }
}
