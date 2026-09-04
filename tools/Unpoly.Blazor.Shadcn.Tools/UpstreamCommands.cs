using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Unpoly.Blazor.Shadcn.Tools;

internal static partial class UpstreamCommands
{
    private const string Style = "new-york-v4";
    private const string RegistryBase = "https://ui.shadcn.com/r/styles/" + Style;
    private const string DocsIndex = "https://ui.shadcn.com/docs/components";
    private const string ExamplesDirectory = "apps/v4/examples/base";
    private const string GitHubRepository = "shadcn-ui/ui";

    private static readonly string[] Components =
    [
        "accordion", "alert", "alert-dialog", "aspect-ratio", "attachment", "avatar", "badge",
        "breadcrumb", "bubble", "button", "button-group", "calendar", "card", "carousel", "chart",
        "checkbox", "collapsible", "combobox", "command", "context-menu", "dialog", "direction",
        "drawer", "dropdown-menu", "empty", "field", "form", "hover-card", "input", "input-group",
        "input-otp", "item", "kbd", "label", "marker", "menubar", "message", "message-scroller",
        "native-select", "navigation-menu", "pagination", "popover", "progress", "questionnaire",
        "radio-group", "resizable", "scroll-area", "select", "separator", "sheet", "sidebar",
        "skeleton", "slider", "sonner", "spinner", "switch", "table", "tabs", "textarea", "toast",
        "toggle", "toggle-group", "tooltip"
    ];

    public static async Task<int> FetchUpstreamAsync(DirectoryInfo root, string[] options)
    {
        var output = Path.Combine(root.FullName, "upstream");
        Directory.CreateDirectory(output);
        var index = Path.Combine(output, "doc-components.txt");
        if (ToolApplication.CheckOnly(options))
        {
            var missing = Components.Where(name => !File.Exists(Path.Combine(output, name + ".tsx"))).ToArray();
            if (missing.Length > 0)
                Console.WriteLine("not vendored (fine if the registry has no source for them): " + string.Join(", ", missing));
            if (!File.Exists(index))
            {
                Console.Error.WriteLine("upstream/doc-components.txt is missing - run fetch-upstream without --check");
                return 1;
            }
            Console.WriteLine($"upstream/ complete ({Components.Length} components, {File.ReadAllLines(index).Length} lines of docs index)");
            return 0;
        }

        using var client = Client();
        var order = await FetchDocOrderAsync(client);
        var header = new[]
        {
            "# The components shadcn documents, in the order its own sidebar lists them - which",
            "# is alphabetical, one page each. Fetched from " + DocsIndex + " and committed, so",
            "# the check-pages command needs no network.", "#",
            "# The demo has one page per line, at /components/<slug>, in this order. Anyone who",
            "# knows shadcn's docs can guess the URL, which is the point."
        };
        await File.WriteAllLinesAsync(index, header.Concat(order));

        var sectionLines = new List<string>
        {
            "# Every heading on every shadcn component docs page, in page order. Fetched here and",
            "# committed, so the check-sections command needs no network.", "#",
            "# One line per page: <slug>: <heading> | <heading> | ..."
        };
        foreach (var slug in order)
        {
            var html = await client.GetStringAsync($"https://ui.shadcn.com/docs/components/{slug}");
            var headings = HeadingRegex().Matches(html).Select(match => TagRegex().Replace(match.Groups[1].Value, "").Trim().TrimEnd('#')).Where(x => x.Length > 0);
            sectionLines.Add(slug + ": " + string.Join(" | ", headings));
            await Task.Delay(200);
        }
        await File.WriteAllLinesAsync(Path.Combine(output, "doc-sections.txt"), sectionLines);

        var missingSources = new List<string>();
        foreach (var name in Components)
        {
            using var response = await client.GetAsync($"{RegistryBase}/{name}.json");
            if (response.StatusCode == HttpStatusCode.NotFound) { missingSources.Add(name); continue; }
            response.EnsureSuccessStatusCode();
            using var json = JsonDocument.Parse(await response.Content.ReadAsStreamAsync());
            var files = json.RootElement.GetProperty("files");
            if (files.GetArrayLength() == 0) throw new InvalidOperationException($"{name}: registry item has no files");
            await File.WriteAllTextAsync(Path.Combine(output, name + ".tsx"), files[0].GetProperty("content").GetString());
        }
        if (missingSources.Count > 0) Console.WriteLine("no source under this style: " + string.Join(", ", missingSources));
        Console.WriteLine($"wrote {Components.Length - missingSources.Count} files to upstream/");
        return 0;
    }

    public static async Task<int> FetchExamplesAsync(DirectoryInfo root, string[] options)
    {
        var upstream = Path.Combine(root.FullName, "upstream");
        var output = Path.Combine(upstream, "examples");
        var namesPath = Path.Combine(upstream, "doc-examples.txt");
        if (ToolApplication.CheckOnly(options))
        {
            if (!File.Exists(namesPath))
            {
                Console.Error.WriteLine("upstream/doc-examples.txt is missing - run fetch-examples without --check");
                return 1;
            }
            var missing = NamedExamples(namesPath).Where(x => !File.Exists(Path.Combine(output, x.Name + ".tsx"))).ToArray();
            if (missing.Length > 0)
                Console.WriteLine($"{missing.Length} named examples are not vendored (informational): " + string.Join(", ", missing.Take(8).Select(x => x.Slug + "/" + x.Name)));
            Console.WriteLine($"upstream/examples/ complete ({(Directory.Exists(output) ? Directory.GetFiles(output, "*.tsx").Length : 0)} example files)");
            return 0;
        }

        Directory.CreateDirectory(output);
        foreach (var file in Directory.GetFiles(output, "*.tsx")) File.Delete(file);
        using var client = Client();
        using var tree = JsonDocument.Parse(await client.GetStringAsync($"https://api.github.com/repos/{GitHubRepository}/git/trees/main?recursive=1"));
        if (tree.RootElement.GetProperty("truncated").GetBoolean()) throw new InvalidOperationException("the repo tree came back truncated; this needs a narrower request");
        var available = tree.RootElement.GetProperty("tree").EnumerateArray()
            .Select(x => x.GetProperty("path").GetString() ?? "")
            .Where(x => x.StartsWith(ExamplesDirectory + "/", StringComparison.Ordinal) && x.EndsWith(".tsx", StringComparison.Ordinal))
            .Select(Path.GetFileNameWithoutExtension).ToHashSet(StringComparer.Ordinal);
        var slugs = File.ReadAllLines(Path.Combine(upstream, "doc-components.txt")).Where(x => x.Length > 0 && x[0] != '#');
        var lines = new List<string> { "# Every example shadcn renders on a component docs page, in page order. The source of", $"# each is vendored under examples/, from {GitHubRepository}/{ExamplesDirectory}.", "#", "# One line per page: <slug>: <example> <example> ..." };
        foreach (var slug in slugs)
        {
            var html = await client.GetStringAsync($"https://ui.shadcn.com/docs/components/{slug}");
            var wanted = PreviewRegex().Matches(html.Replace("\\u003c", "<", StringComparison.Ordinal)).Select(x => x.Groups[1].Value).Distinct(StringComparer.Ordinal).ToArray();
            var present = wanted.Where(available.Contains).ToArray();
            foreach (var name in present)
            {
                var bytes = await client.GetByteArrayAsync($"https://raw.githubusercontent.com/{GitHubRepository}/main/{ExamplesDirectory}/{name}.tsx");
                await File.WriteAllBytesAsync(Path.Combine(output, name + ".tsx"), bytes);
            }
            lines.Add(slug + ": " + string.Join(' ', present));
            await Task.Delay(200);
        }
        await File.WriteAllLinesAsync(namesPath, lines);
        Console.WriteLine($"wrote {Directory.GetFiles(output, "*.tsx").Length} example files to upstream/examples/");
        return 0;
    }

    private static IEnumerable<(string Slug, string Name)> NamedExamples(string path)
    {
        foreach (var line in File.ReadLines(path).Where(x => x.Length > 0 && x[0] != '#'))
        {
            var split = line.Split(':', 2);
            foreach (var name in split.ElementAtOrDefault(1)?.Split(' ', StringSplitOptions.RemoveEmptyEntries) ?? [])
                yield return (split[0], name);
        }
    }

    private static async Task<string[]> FetchDocOrderAsync(HttpClient client)
    {
        var html = await client.GetStringAsync(DocsIndex);
        return DocsLinkRegex().Matches(html).Select(x => x.Groups[1].Value).Distinct(StringComparer.Ordinal)
            .Where(x => x is not ("base" or "aria" or "radix" or "questionnaire")).ToArray();
    }

    private static HttpClient Client()
    {
        var client = new HttpClient { Timeout = TimeSpan.FromSeconds(60) };
        client.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 Unpoly.Blazor.Shadcn.Tools");
        return client;
    }

    [GeneratedRegex("/docs/components/([a-z0-9-]+)")]
    private static partial Regex DocsLinkRegex();
    [GeneratedRegex("<h2[^>]*>(.*?)</h2>", RegexOptions.Singleline)]
    private static partial Regex HeadingRegex();
    [GeneratedRegex("<[^>]+>")]
    private static partial Regex TagRegex();
    [GeneratedRegex("<ComponentPreview[^/]*?(?<![A-Za-z])name=\\\"([a-z0-9-]+)\\\"", RegexOptions.Singleline)]
    private static partial Regex PreviewRegex();
}
