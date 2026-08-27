using System.Reflection;
using Microsoft.AspNetCore.Components;
using Unpoly.Blazor.Shadcn;

namespace Unpoly.Blazor.Shadcn.Tests;

/// <summary>
/// Every component in the library, found by reflection rather than by a list.
/// </summary>
/// <remarks>
/// A hand-maintained list is the same lie as a hand-maintained API table: someone adds a
/// component, forgets the list, and the contract tests silently stop covering it. Reflection
/// cannot forget. What it *does* need is a value for every <c>[EditorRequired]</c> parameter,
/// which is what <see cref="Seed"/> supplies — and a component added without a seed fails
/// loudly here rather than quietly opting out.
/// </remarks>
public static class ComponentCatalog
{
    /// <summary>Parameters a component cannot render without, and anything else it needs to
    /// produce an element at all.</summary>
    static readonly Dictionary<string, Dictionary<string, object>> Seed = new()
    {
        ["Icon"] = new() { ["Name"] = "check" },
        ["Dialog"] = new() { ["Id"] = "d" },
        ["AlertDialog"] = new() { ["Id"] = "a" },
        ["Sheet"] = new() { ["Id"] = "sh" },
        ["SheetTrigger"] = new() { ["Target"] = "sh" },
        ["PopoverContent"] = new() { ["Id"] = "pop" },
        ["PopoverTrigger"] = new() { ["Target"] = "pop" },
        ["HoverCardContent"] = new() { ["Id"] = "hc" },
        ["HoverCardTrigger"] = new() { ["Target"] = "hc" },
        ["AlertDialogTrigger"] = new() { ["Target"] = "a" },
        ["DropdownMenuSubContent"] = new() { ["Id"] = "s" },
        ["DropdownMenuSubTrigger"] = new() { ["Target"] = "s" },
        ["DialogTrigger"] = new() { ["Target"] = "d" },
        ["DropdownMenuContent"] = new() { ["Id"] = "m" },
        ["DropdownMenuTrigger"] = new() { ["Target"] = "m" },
        ["TooltipContent"] = new() { ["Id"] = "t" },
        ["TooltipTrigger"] = new() { ["Target"] = "t" },
        // Renders nothing at all when there is no message — deliberately, so the grid gap does
        // not open a hole under every valid field.
        ["FormMessage"] = new() { ["Message"] = "x" },
    };

    public static IEnumerable<Type> All =>
        typeof(UiComponentBase).Assembly
            .GetTypes()
            .Where(t => t is { IsAbstract: false, IsPublic: true } && typeof(IComponent).IsAssignableFrom(t))
            .OrderBy(t => t.Name);

    /// <summary>xUnit member data: one row per component.</summary>
    public static TheoryData<string> Names
    {
        get
        {
            var data = new TheoryData<string>();
            foreach (var t in All) data.Add(t.Name);
            return data;
        }
    }

    public static Type Find(string name) =>
        All.FirstOrDefault(t => t.Name == name)
        ?? throw new InvalidOperationException($"no component named {name}");

    /// <summary>The parameters this component needs before it will render anything.</summary>
    public static IReadOnlyDictionary<string, object> SeedFor(string name) =>
        Seed.TryGetValue(name, out var seed) ? seed : new Dictionary<string, object>();

    /// <summary>True when the component has an <c>[EditorRequired]</c> parameter with no seed.</summary>
    public static IEnumerable<string> MissingSeeds(Type component) =>
        component.GetProperties()
            .Where(p => p.GetCustomAttribute<EditorRequiredAttribute>() is not null)
            .Select(p => p.Name)
            .Where(n => !SeedFor(component.Name).ContainsKey(n));
}
