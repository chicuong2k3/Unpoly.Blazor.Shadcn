using System.Text.Json;

namespace Unpoly.Blazor.Shadcn.Tests;

/// <summary>
/// The class sets shadcn/ui actually ships, read from <c>upstream-classes.json</c> — which
/// <c>tools/extract_upstream.py</c> generates from the real .tsx files vendored under
/// <c>upstream/</c>.
/// </summary>
/// <remarks>
/// Comparing against a string someone retyped from the docs proves nothing: it is the same
/// memory twice, and it agrees with the implementation for exactly the same reason the
/// implementation is wrong. This reads shadcn's own source instead.
/// </remarks>
public sealed record UpstreamSlot(
    IReadOnlyList<string> Base,
    IReadOnlyDictionary<string, IReadOnlyDictionary<string, IReadOnlyList<string>>> Variants,
    IReadOnlyDictionary<string, string> Defaults)
{
    /// <summary>Base plus the default value of every variant group — what the component renders
    /// when the caller passes nothing, which is what a default render should be compared to.</summary>
    public IReadOnlyList<string> Default()
    {
        var all = new List<string>(Base);
        foreach (var (group, keys) in Variants)
        {
            if (Defaults.TryGetValue(group, out var key) && keys.TryGetValue(key, out var classes))
                all.AddRange(classes);
        }
        return all;
    }

    /// <summary>Base plus a named value for each group, falling back to that group's default.</summary>
    public IReadOnlyList<string> WithAll(IReadOnlyDictionary<string, string> chosen)
    {
        var all = new List<string>(Base);
        foreach (var (g, keys) in Variants)
        {
            var wanted = chosen.GetValueOrDefault(g) ?? Defaults.GetValueOrDefault(g);
            if (wanted is not null && keys.TryGetValue(wanted, out var classes))
                all.AddRange(classes);
        }
        return all;
    }

    /// <summary>Base plus one named variant value, plus the defaults of every other group.</summary>
    public IReadOnlyList<string> With(string group, string key)
    {
        var all = new List<string>(Base);
        foreach (var (g, keys) in Variants)
        {
            var wanted = g == group ? key : Defaults.GetValueOrDefault(g);
            if (wanted is not null && keys.TryGetValue(wanted, out var classes))
                all.AddRange(classes);
        }
        return all;
    }
}

public static class Upstream
{
    static readonly Lazy<IReadOnlyDictionary<string, UpstreamSlot>> Loaded = new(() =>
    {
        var path = Path.Combine(AppContext.BaseDirectory, "upstream-classes.json");
        using var stream = File.OpenRead(path);
        // Case-insensitive because the JSON is written by a Python tool in snake/lower case and
        // read into PascalCase properties. Without it every list binds empty, and the parity
        // tests pass or fail on nothing at all.
        var raw = JsonSerializer.Deserialize<Dictionary<string, Raw>>(stream,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;
        return raw.ToDictionary(
            kv => kv.Key,
            kv => new UpstreamSlot(
                kv.Value.Base,
                kv.Value.Variants.ToDictionary(
                    g => g.Key,
                    g => (IReadOnlyDictionary<string, IReadOnlyList<string>>)g.Value.ToDictionary(
                        k => k.Key, k => (IReadOnlyList<string>)k.Value)),
                kv.Value.Defaults));
    });

    public static bool Has(string slot) => Loaded.Value.ContainsKey(slot);

    public static UpstreamSlot Slot(string slot) =>
        Loaded.Value.TryGetValue(slot, out var s)
            ? s
            : throw new InvalidOperationException(
                $"no upstream data for slot '{slot}' — add its component to tools/fetch_upstream.py");

    public static IEnumerable<string> Slots => Loaded.Value.Keys.OrderBy(k => k);

    sealed class Raw
    {
        public List<string> Base { get; set; } = [];
        public Dictionary<string, Dictionary<string, List<string>>> Variants { get; set; } = [];
        public Dictionary<string, string> Defaults { get; set; } = [];
    }
}
