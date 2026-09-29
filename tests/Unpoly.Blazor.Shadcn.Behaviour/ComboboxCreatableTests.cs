using Microsoft.Playwright;

namespace Unpoly.Blazor.Shadcn.Behaviour;

/// <summary>
/// A creatable chips combobox: typed text becomes a chip that posts like a chosen row.
/// </summary>
/// <remarks>
/// Every assertion reads the hidden inputs, not the chip text, because the hidden inputs are what
/// the form posts — a chip that looks right and posts nothing is the failure worth catching.
/// </remarks>
[Collection(DemoCollection.Name)]
[Trait("Module", "Forms")]
public class ComboboxCreatableTests(DemoFixture fixture) : DemoPage(fixture)
{
    const string Preview = "preview-combobox-creatable";

    async Task<ILocator> InputAsync()
    {
        await GoAsync("/components/combobox");
        var box = await ShowAsync(Preview);
        var input = box.Locator("#cb-creatable-input");
        await input.ClickAsync();
        return input;
    }

    // The preview slot is the example's sibling, not its parent, so the chips are found from the
    // input's own combobox rather than from the preview id.
    Task<string> PostedAsync() => Page.EvaluateAsync<string>("""
        () => [...document.getElementById('cb-creatable-input').closest('[data-slot="combobox"]')
            .querySelectorAll('[data-slot="combobox-chip"] input[type="hidden"]')]
          .map((i) => i.name + '=' + i.value).join('&')
        """);

    [SkippableFact]
    public async Task Enter_turns_unmatched_text_into_a_chip_that_posts_under_the_chips_name()
    {
        RequireDemo();
        var input = await InputAsync();

        await input.PressSequentiallyAsync("rust");
        await input.PressAsync("Enter");

        Assert.Equal("tags=blazor&tags=rust", await PostedAsync());
        Assert.Equal("", await input.InputValueAsync());
        AssertQuiet();
    }

    [SkippableFact]
    public async Task A_comma_ends_a_tag_without_landing_in_it()
    {
        RequireDemo();
        var input = await InputAsync();

        await input.PressSequentiallyAsync("go,");

        Assert.Equal("tags=blazor&tags=go", await PostedAsync());
        Assert.Equal("", await input.InputValueAsync());
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Text_that_names_a_row_chooses_the_row_rather_than_inventing_a_lookalike()
    {
        RequireDemo();
        var input = await InputAsync();

        await input.PressSequentiallyAsync("UNPOLY");
        await input.PressAsync("Enter");

        Assert.Equal("tags=blazor&tags=unpoly", await PostedAsync());
        AssertQuiet();
    }

    [SkippableFact]
    public async Task A_tag_typed_twice_in_another_case_is_added_once()
    {
        RequireDemo();
        var input = await InputAsync();

        await input.PressSequentiallyAsync("rust");
        await input.PressAsync("Enter");
        await input.PressSequentiallyAsync("RUST");
        await input.PressAsync("Enter");

        Assert.Equal("tags=blazor&tags=rust", await PostedAsync());
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Backspace_in_the_empty_box_removes_the_last_chip()
    {
        RequireDemo();
        var input = await InputAsync();

        await input.PressSequentiallyAsync("rust");
        await input.PressAsync("Enter");
        await input.PressAsync("Backspace");

        Assert.Equal("tags=blazor", await PostedAsync());
        AssertQuiet();
    }
}
