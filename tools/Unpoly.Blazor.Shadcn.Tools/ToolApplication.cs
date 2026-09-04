using System.Text.RegularExpressions;

namespace Unpoly.Blazor.Shadcn.Tools;

internal static partial class ToolApplication
{
    private static readonly string[] CommandNames =
    [
        "audit-api", "check-compiled", "check-data-attributes", "check-demo", "check-elements",
        "check-globals", "check-icons", "check-pages", "check-rtl", "check-sections", "check-wiring",
        "extract-upstream", "fetch-examples", "fetch-upstream", "gen-api", "gen-has-fallback",
        "gen-icons", "gen-themes", "safari15-check", "scaffold-components", "sync-classes",
        "sync-variants"
    ];

    public static async Task<int> RunAsync(string[] args)
    {
        if (args.Length == 0 || args[0] is "--help" or "-h" or "help")
        {
            PrintHelp();
            return 0;
        }

        if (!CommandNames.Contains(args[0], StringComparer.Ordinal))
        {
            Console.Error.WriteLine($"unknown command: {args[0]}");
            PrintHelp();
            return 2;
        }

        try
        {
            var root = FindRoot();
            var options = args[1..];
            return args[0] switch
            {
                "fetch-upstream" => await UpstreamCommands.FetchUpstreamAsync(root, options),
                "fetch-examples" => await UpstreamCommands.FetchExamplesAsync(root, options),
                "gen-api" => GeneratedCommands.GenerateApi(root, options),
                "gen-icons" => GeneratedCommands.GenerateIcons(root, options),
                "gen-themes" => GeneratedCommands.CheckGenerated(root, options, "themes", "themes"),
                "gen-has-fallback" => GeneratedCommands.CheckGenerated(root, options, "src/Unpoly.Blazor.Shadcn/wwwroot/ui.safari15.css", "Safari :has() fallback"),
                "extract-upstream" => RepositoryChecks.ExtractUpstream(root, options),
                "sync-classes" => RepositoryChecks.SyncClasses(root, options),
                "sync-variants" => RepositoryChecks.SyncVariants(root, options),
                "scaffold-components" => RepositoryChecks.ScaffoldComponents(root, options),
                "check-demo" => RepositoryChecks.CheckDemo(root, options),
                "check-pages" => RepositoryChecks.CheckPages(root),
                "check-sections" => RepositoryChecks.CheckSections(root, options),
                "check-globals" => RepositoryChecks.CheckGlobals(root),
                "check-icons" => RepositoryChecks.CheckIcons(root),
                "check-elements" => RepositoryChecks.CheckElements(root),
                "check-data-attributes" => RepositoryChecks.CheckDataAttributes(root),
                "check-compiled" => RepositoryChecks.CheckCompiled(root),
                "check-rtl" => RepositoryChecks.CheckRtl(root),
                "check-wiring" => RepositoryChecks.CheckWiring(root),
                "audit-api" => RepositoryChecks.AuditApi(root),
                "safari15-check" => RepositoryChecks.CheckSafari15(root),
                _ => 2
            };
        }
        catch (Exception exception)
        {
            Console.Error.WriteLine(exception.Message);
            return 1;
        }
    }

    private static DirectoryInfo FindRoot()
    {
        for (var directory = new DirectoryInfo(Environment.CurrentDirectory); directory is not null; directory = directory.Parent)
        {
            if (File.Exists(Path.Combine(directory.FullName, "Unpoly.Blazor.Shadcn.slnx")))
                return directory;
        }

        var assemblyDirectory = new DirectoryInfo(AppContext.BaseDirectory);
        for (var directory = assemblyDirectory; directory is not null; directory = directory.Parent)
        {
            if (File.Exists(Path.Combine(directory.FullName, "Unpoly.Blazor.Shadcn.slnx")))
                return directory;
        }

        throw new InvalidOperationException("Could not find repository root.");
    }

    private static void PrintHelp()
    {
        Console.WriteLine("Unpoly.Blazor.Shadcn repository tools");
        Console.WriteLine("usage: dotnet run --project tools/Unpoly.Blazor.Shadcn.Tools -- <command> [--check]");
        Console.WriteLine();
        foreach (var command in CommandNames)
            Console.WriteLine($"  {command}");
    }

    internal static bool CheckOnly(string[] options) => options.Contains("--check", StringComparer.Ordinal);

    internal static string Read(DirectoryInfo root, string relativePath) =>
        File.ReadAllText(Path.Combine(root.FullName, relativePath.Replace('/', Path.DirectorySeparatorChar)));

    internal static string[] RazorComponents(DirectoryInfo root) =>
        Directory.GetFiles(Path.Combine(root.FullName, "src", "Unpoly.Blazor.Shadcn", "Components"), "*.razor")
            .Order(StringComparer.Ordinal).ToArray();

    [GeneratedRegex("<([A-Z][A-Za-z0-9_]*)\\b")]
    internal static partial Regex ComponentTagRegex();
}
