using Bunit;
using Unpoly.Blazor.Shadcn.Components;

namespace Unpoly.Blazor.Shadcn.Tests;

public class CodeBlockPrismTests : BunitContext
{
    [Fact]
    public void CodeBlock_adds_language_class_for_prism()
    {
        var cut = Render<CodeBlock>(p => p.Add(c => c.Code, "var x=1;").Add(c => c.Language, "csharp"));
        var code = cut.Find("[data-slot=\"code-block-code\"]");
        Assert.Contains("language-csharp", code.ClassName);
        Assert.Equal("csharp", code.GetAttribute("data-language"));
    }

    [Fact]
    public void CodeBlock_normalizes_razor_to_cshtml()
    {
        var cut = Render<CodeBlock>(p => p.Add(c => c.Code, "<div/>").Add(c => c.Language, "razor"));
        Assert.Contains("language-cshtml", cut.Find("[data-slot=\"code-block-code\"]").ClassName);
    }

    [Theory]
    [InlineData("js", "javascript")]
    [InlineData("ts", "typescript")]
    [InlineData("sh", "bash")]
    [InlineData("yml", "yaml")]
    public void CodeBlock_normalizes_aliases(string alias, string expected)
    {
        var cut = Render<CodeBlock>(p => p.Add(c => c.Code, "x").Add(c => c.Language, alias));
        Assert.Contains($"language-{expected}", cut.Find("[data-slot=\"code-block-code\"]").ClassName);
    }

    [Fact]
    public void CodeBlock_show_line_numbers_adds_class_to_pre()
    {
        var cut = Render<CodeBlock>(p => p.Add(c => c.Code, "a\nb").Add(c => c.Language, "csharp").Add(c => c.ShowLineNumbers, true));
        Assert.Contains("line-numbers", cut.Find("[data-slot=\"code-block-pre\"]").ClassName);
    }

    [Fact]
    public void CodeBlock_without_language_gets_no_language_class()
    {
        var cut = Render<CodeBlock>(p => p.Add(c => c.Code, "plain"));
        Assert.DoesNotContain("language-", cut.Find("[data-slot=\"code-block-code\"]").ClassName);
    }

    [Fact]
    public void CodeBlock_keeps_copy_button_hidden_until_clipboard()
    {
        var cut = Render<CodeBlock>(p => p.Add(c => c.Code, "x"));
        Assert.True(cut.Find("[data-slot=\"code-block-copy\"]").HasAttribute("hidden"));
    }

    [Fact]
    public void CodeBlock_pre_is_keyboard_reachable()
    {
        var cut = Render<CodeBlock>(p => p.Add(c => c.Code, "x"));
        Assert.Equal("0", cut.Find("[data-slot=\"code-block-pre\"]").GetAttribute("tabindex"));
    }
}
