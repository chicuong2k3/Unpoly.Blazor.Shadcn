using Bunit;
using Unpoly.Blazor.Shadcn.Components;

namespace Unpoly.Blazor.Shadcn.Tests;

public class KiboCodeTests : BunitContext
{
    [Fact]
    public void Snippet_renders_commands_as_escaped_text()
    {
        var root = Render<Snippet>(p => p.Add(x => x.Items,
            new List<SnippetItem> { new("npm", "echo <unsafe>") })).Find("[data-slot=snippet]");

        Assert.Equal("echo <unsafe>", root.QuerySelector("[data-slot=snippet-code] code")?.TextContent);
        Assert.Null(root.QuerySelector("unsafe"));
    }

    [Fact]
    public void Snippet_hides_inactive_commands_on_initial_render()
    {
        var root = Render<Snippet>(p => p.Add(x => x.Items,
            new List<SnippetItem> { new("npm", "npm install"), new("pnpm", "pnpm add") })).Find("[data-slot=snippet]");

        Assert.False(root.QuerySelectorAll("[data-slot=tabs-content]")[0].HasAttribute("hidden"));
        Assert.True(root.QuerySelectorAll("[data-slot=tabs-content]")[1].HasAttribute("hidden"));
    }

    [Fact]
    public void Code_block_renders_each_file_with_a_separate_language()
    {
        var root = Render<CodeBlock>(p => p.Add(x => x.Code, "")
            .Add(x => x.Files, new List<CodeBlockFile> {
                new("a.cs", "csharp", "class A {}"), new("b.json", "json", "{}")
            })).Find("[data-slot=code-block]");

        var code = root.QuerySelectorAll("[data-slot=code-block-code]");
        Assert.Equal("language-csharp", code[0].GetAttribute("class"));
        Assert.Equal("language-json", code[1].GetAttribute("class"));
        Assert.True(root.QuerySelectorAll("[data-slot=code-block-pre]")[1].HasAttribute("hidden"));
    }
}
