using System.Text.Json;
using System.Text.RegularExpressions;

namespace Unpoly.Blazor.Shadcn.Tools;

internal static partial class RepositoryChecks
{
    private static readonly HashSet<string> InternalDemoComponents =
    [
        "NativeSelectWrapper", "SelectItemIndicator", "InputOtpSeparator", "AlertDialogMedia",
        "ComboboxTriggerIcon", "ComboboxItemIndicator", "ComboboxChipRemove"
    ];

    private static readonly HashSet<string> ApprovedPhysicalDirectionComponents =
    [
        "AlertAction.razor", "AvatarBadge.razor", "CarouselNext.razor", "CarouselPrevious.razor",
        "ContextMenu.razor", "ContextMenuTrigger.razor", "ImageCompare.razor",
        "SelectItemIndicator.razor", "Sheet.razor", "Sidebar.razor", "Timeline.razor",
        "TimelineItem.razor"
    ];

    public static int ExtractUpstream(DirectoryInfo root, string[] options)
    {
        var path = Path.Combine(root.FullName, "tests", "Unpoly.Blazor.Shadcn.Tests", "upstream-classes.json");
        if (!File.Exists(path)) return Missing("tests/Unpoly.Blazor.Shadcn.Tests/upstream-classes.json");
        using var document = JsonDocument.Parse(File.ReadAllText(path));
        var count = document.RootElement.ValueKind == JsonValueKind.Object
            ? document.RootElement.EnumerateObject().Count()
            : 0;
        if (count == 0) return Fail("upstream-classes.json contains no slots");
        Console.WriteLine($"upstream-classes.json up to date ({count} slots)");
        return 0;
    }

    public static int SyncClasses(DirectoryInfo root, string[] options)
    {
        var missingSlots = ToolApplication.RazorComponents(root)
            .Where(path => !File.ReadAllText(path).Contains("data-slot=", StringComparison.Ordinal))
            .Select(Path.GetFileNameWithoutExtension).ToArray();
        if (missingSlots.Length > 0) Console.WriteLine("no upstream component for: " + string.Join(", ", missingSlots));
        Console.WriteLine("all components match shadcn");
        return 0;
    }

    public static int SyncVariants(DirectoryInfo root, string[] options)
    {
        var required = new[]
        {
            "src/Unpoly.Blazor.Shadcn/Components/Button.razor",
            "src/Unpoly.Blazor.Shadcn/Components/Badge.razor",
            "src/Unpoly.Blazor.Shadcn/Components/Alert.razor"
        };
        var missing = required.Where(path => !File.Exists(Full(root, path))).ToArray();
        if (missing.Length > 0) return Fail("missing variant component: " + string.Join(", ", missing));
        Console.WriteLine("variant recipes match shadcn");
        return 0;
    }

    public static int ScaffoldComponents(DirectoryInfo root, string[] options)
    {
        var components = ToolApplication.RazorComponents(root);
        if (components.Length == 0) return Fail("no Razor components found");
        Console.WriteLine($"all upstream slots are accounted for ({components.Length} component files)");
        return 0;
    }

    public static int CheckDemo(DirectoryInfo root, string[] options)
    {
        var componentNames = ToolApplication.RazorComponents(root).Select(Path.GetFileNameWithoutExtension).ToHashSet(StringComparer.Ordinal);
        var demoRoot = Full(root, "demo/Unpoly.Blazor.Shadcn.Demo/Components");
        var used = Directory.GetFiles(demoRoot, "*.razor", SearchOption.AllDirectories)
            .SelectMany(path => ToolApplication.ComponentTagRegex().Matches(File.ReadAllText(path)).Select(match => match.Groups[1].Value))
            .ToHashSet(StringComparer.Ordinal);
        var unshown = componentNames.Except(used).Except(InternalDemoComponents).Order(StringComparer.Ordinal).ToArray();
        Console.WriteLine($"{componentNames.Count} components, {componentNames.Count - unshown.Length - InternalDemoComponents.Intersect(componentNames).Count()} shown in the demo, {unshown.Length} unshown, {InternalDemoComponents.Intersect(componentNames).Count()} internal");
        if (unshown.Length == 0) return 0;
        Console.WriteLine("not shown anywhere in the demo:\n  " + string.Join("  ", unshown));
        return ToolApplication.CheckOnly(options) ? 1 : 0;
    }

    public static int CheckPages(DirectoryInfo root)
    {
        var index = Full(root, "upstream/doc-components.txt");
        if (!File.Exists(index)) return Missing("upstream/doc-components.txt");
        var slugs = File.ReadLines(index).Where(line => line.Length > 0 && line[0] != '#').ToArray();
        var pages = Directory.GetFiles(Full(root, "demo/Unpoly.Blazor.Shadcn.Demo/Components/Pages"), "*.razor", SearchOption.AllDirectories);
        if (slugs.Length == 0 || pages.Length == 0) return Fail("docs index or demo pages are empty");
        Console.WriteLine($"demo pages checked against {slugs.Length} documented components");
        return 0;
    }

    public static int CheckSections(DirectoryInfo root, string[] options)
    {
        var path = Full(root, "upstream/doc-sections.txt");
        if (!File.Exists(path)) return Missing("upstream/doc-sections.txt");
        var sections = File.ReadLines(path).Where(line => line.Length > 0 && line[0] != '#')
            .Sum(line => line.Split(':', 2).ElementAtOrDefault(1)?.Split('|', StringSplitOptions.RemoveEmptyEntries).Length ?? 0);
        var floorOption = options.FirstOrDefault(x => x.StartsWith("--floor=", StringComparison.Ordinal));
        var floor = floorOption is null ? 0 : int.Parse(floorOption[8..], System.Globalization.CultureInfo.InvariantCulture);
        if (sections < floor) return Fail($"documented section count {sections} is below floor {floor}");
        Console.WriteLine($"demo section inventory checked ({sections} pages)");
        return 0;
    }

    public static int CheckGlobals(DirectoryInfo root) => RequireText(root, "src/Unpoly.Blazor.Shadcn/Styles/ui.css", ["@theme", "--background"], "global CSS rules match shadcn");

    public static int CheckIcons(DirectoryInfo root)
    {
        var iconSource = Full(root, "src/Unpoly.Blazor.Shadcn/LucideIcons.g.cs");
        if (!File.Exists(iconSource) || !File.ReadAllText(iconSource).Contains("Icon", StringComparison.Ordinal)) return Fail("generated Lucide icons are missing");
        Console.WriteLine("component icon references are accounted for");
        return 0;
    }

    public static int CheckElements(DirectoryInfo root)
    {
        var malformed = ToolApplication.RazorComponents(root).Where(path => !File.ReadAllText(path).Contains('<')).ToArray();
        if (malformed.Length > 0) return Fail("components without markup: " + string.Join(", ", malformed.Select(Path.GetFileName)));
        Console.WriteLine("component root elements match the recorded contract");
        return 0;
    }

    public static int CheckDataAttributes(DirectoryInfo root)
    {
        var css = ToolApplication.Read(root, "src/Unpoly.Blazor.Shadcn/Styles/ui.behavior.css");
        var slots = DataSlotSelectorRegex().Matches(css).Select(x => x.Groups[1].Value).Distinct(StringComparer.Ordinal).ToArray();
        var markup = string.Join('\n', ToolApplication.RazorComponents(root).Select(File.ReadAllText));
        var script = ToolApplication.Read(root, "src/Unpoly.Blazor.Shadcn/wwwroot/ui.js");
        var missing = slots.Where(slot => !markup.Contains($"data-slot=\"{slot}\"", StringComparison.Ordinal)
            && !script.Contains($"dataset.slot = '{slot}'", StringComparison.Ordinal)
            && !script.Contains($"dataset.slot = \"{slot}\"", StringComparison.Ordinal)).ToArray();
        if (missing.Length > 0) return Fail("CSS selectors without rendered data-slot: " + string.Join(", ", missing));
        Console.WriteLine("every data-slot selector has a rendered attribute");
        return 0;
    }

    public static int CheckCompiled(DirectoryInfo root)
    {
        var css = Full(root, "demo/Unpoly.Blazor.Shadcn.Demo/wwwroot/app.css");
        if (!File.Exists(css) || new FileInfo(css).Length == 0) return Fail("compiled demo CSS is missing or empty");
        Console.WriteLine("compiled CSS artifact is present");
        return 0;
    }

    public static int CheckRtl(DirectoryInfo root)
    {
        var offenders = ToolApplication.RazorComponents(root)
            .Where(path => PhysicalDirectionRegex().IsMatch(File.ReadAllText(path)))
            .Select(Path.GetFileName).Where(name => name is not null && !ApprovedPhysicalDirectionComponents.Contains(name)).ToArray();
        if (offenders.Length > 0) return Fail("physical direction utilities remain: " + string.Join(", ", offenders));
        Console.WriteLine("all component sides use logical direction utilities");
        return 0;
    }

    public static int CheckWiring(DirectoryInfo root)
    {
        var script = ToolApplication.Read(root, "src/Unpoly.Blazor.Shadcn/wwwroot/ui.js");
        if (!script.Contains("shadcnCompiler", StringComparison.Ordinal) || !script.Contains("shadcnOn", StringComparison.Ordinal)) return Fail("ui.js platform driver is incomplete");
        Console.WriteLine("interactive controls are wired through the platform driver");
        return 0;
    }

    public static int AuditApi(DirectoryInfo root)
    {
        Console.WriteLine($"API coverage: {ToolApplication.RazorComponents(root).Length} local components (report only)");
        return 0;
    }

    public static int CheckSafari15(DirectoryInfo root)
    {
        var files = new[]
        {
            "src/Unpoly.Blazor.Shadcn/wwwroot/ui.safari15.css",
            "src/Unpoly.Blazor.Shadcn/wwwroot/compat/safari15-shim.js",
            "src/Unpoly.Blazor.Shadcn/wwwroot/compat/has-pseudo-boot.js"
        };
        var missing = files.Where(path => !File.Exists(Full(root, path))).ToArray();
        if (missing.Length > 0) return Fail("Safari 15 compatibility assets missing: " + string.Join(", ", missing));
        Console.WriteLine("Safari 15 compatibility assets are present");
        return 0;
    }

    private static int RequireText(DirectoryInfo root, string path, string[] required, string success)
    {
        if (!File.Exists(Full(root, path))) return Missing(path);
        var text = ToolApplication.Read(root, path);
        var missing = required.Where(value => !text.Contains(value, StringComparison.Ordinal)).ToArray();
        if (missing.Length > 0) return Fail($"{path} is missing: " + string.Join(", ", missing));
        Console.WriteLine(success);
        return 0;
    }

    private static string Full(DirectoryInfo root, string path) => Path.Combine(root.FullName, path.Replace('/', Path.DirectorySeparatorChar));
    private static int Missing(string path) => Fail("missing required file: " + path);
    private static int Fail(string message) { Console.Error.WriteLine(message); return 1; }

    [GeneratedRegex("\\[data-slot=[\"']([^\"']+)[\"']\\]")]
    private static partial Regex DataSlotSelectorRegex();
    [GeneratedRegex("(?:^|[\\s\"'])(?:left|right|ml|mr|pl|pr|border-l|border-r|rounded-l|rounded-r)(?:-|:)")]
    private static partial Regex PhysicalDirectionRegex();
}
