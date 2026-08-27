using System.Text.Json;

namespace Unpoly.Blazor.Shadcn.Tests;

/// <summary>
/// Every place this port's class list differs from shadcn's, and the reason — read from
/// <c>deviations.json</c> at the repository root.
/// </summary>
/// <remarks>
/// <para>
/// The same file drives <c>tools/sync_classes.py</c>, which writes the components. One source,
/// so the generator and the test cannot disagree about what counts as a deviation — if they read
/// separate lists, the test would happily pass on whatever the generator produced.
/// </para>
/// <para>
/// Adding an entry is a decision someone reviews. If the reason does not fit in a sentence, the
/// component is wrong, not the list.
/// </para>
/// </remarks>
public static class Deviations
{
    sealed class Entry
    {
        public List<string> Classes { get; set; } = [];
        public string Why { get; set; } = "";
    }

    sealed class File_
    {
        public Dictionary<string, JsonElement> Tokens { get; set; } = [];
        public Dictionary<string, Entry> Added { get; set; } = [];
        public Dictionary<string, Entry> Dropped { get; set; } = [];
        public Dictionary<string, JsonElement> Subject { get; set; } = [];
        public Dictionary<string, JsonElement> AsChildButton { get; set; } = [];
        public Dictionary<string, JsonElement> DefaultVariant { get; set; } = [];
        public Dictionary<string, JsonElement> Composed { get; set; } = [];
    }

    static readonly Lazy<File_> Loaded = new(() =>
    {
        var path = Path.Combine(AppContext.BaseDirectory, "deviations.json");
        return JsonSerializer.Deserialize<File_>(System.IO.File.ReadAllText(path),
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;
    });

    /// <summary>Our token to the upstream classes it stands in for.</summary>
    public static IReadOnlyDictionary<string, string[]> TokenSubstitutions =>
        Loaded.Value.Tokens
            .Where(kv => !kv.Key.StartsWith('$'))
            .ToDictionary(kv => kv.Key, kv => kv.Value.EnumerateArray().Select(e => e.GetString()!).ToArray());

    /// <summary>
    /// Classes a slot has because it renders another component of this library, as upstream
    /// does. They belong to that component, so they are subtracted rather than compared.
    /// </summary>
    public static IReadOnlyList<string> ComposedFor(string slot) =>
        Loaded.Value.Composed.TryGetValue(slot, out var v) && v.ValueKind == JsonValueKind.Object
        && v.TryGetProperty("classes", out var c)
            ? c.EnumerateArray().Select(e => e.GetString()!).ToArray()
            : [];

    public static IReadOnlyList<string> AddedFor(string slot) =>
        Loaded.Value.Added.TryGetValue(slot, out var e) ? e.Classes : [];

    public static IReadOnlyList<string> DroppedFor(string slot) =>
        Loaded.Value.Dropped.TryGetValue(slot, out var e) ? e.Classes : [];

    /// <summary>
    /// The data-slot that carries a component's classes, when it is not the first element the
    /// component renders. Same map the generator uses, so the two always look at one element.
    /// </summary>
    public static string? SubjectSlot(string component) =>
        Loaded.Value.Subject.TryGetValue(component, out var v) && v.ValueKind == JsonValueKind.String
            ? v.GetString()
            : null;

    /// <summary>
    /// Slots where shadcn wraps a Button with <c>asChild</c>, so the element wears the button
    /// recipe instead of classes of its own. Blazor has no cloneElement, so the trigger IS the
    /// button.
    /// </summary>
    /// <returns>The button variant and size it renders, or null when it is not one of these.</returns>
    public static IReadOnlyDictionary<string, string>? AsChildButton(string slot) =>
        Loaded.Value.AsChildButton.TryGetValue(slot, out var v) && v.ValueKind == JsonValueKind.Object
            ? v.EnumerateObject().ToDictionary(p => p.Name, p => p.Value.GetString()!)
            : null;

    /// <summary>
    /// A component whose default rendering is not cva's default — a pagination link is a ghost
    /// button until it is the current page, and shadcn passes that at the call site where cva
    /// cannot see it. Keyed by component, because three of them render pagination-link and only
    /// one is icon-sized.
    /// </summary>
    public static IReadOnlyDictionary<string, string> DefaultVariantFor(string component) =>
        Loaded.Value.DefaultVariant.TryGetValue(component, out var v) && v.ValueKind == JsonValueKind.Object
            ? v.EnumerateObject().ToDictionary(p => p.Name, p => p.Value.GetString()!)
            : new Dictionary<string, string>();
}
