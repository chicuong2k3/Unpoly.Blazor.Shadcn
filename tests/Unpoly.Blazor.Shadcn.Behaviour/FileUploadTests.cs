using Microsoft.Playwright;

namespace Unpoly.Blazor.Shadcn.Behaviour;

/// <summary>
/// The drop zone: what it accepts, what it refuses, and what it leaves in the form.
/// </summary>
/// <remarks>
/// The whole point of the component is the last one. A plain file input posts BYTES, which forces
/// the surrounding form to be multipart and to handle the upload; this posts nothing and leaves a
/// URL in a hidden input, so the form stays an ordinary form. Every test here ends by looking at
/// that input, because that is the contract.
/// </remarks>
[Collection(DemoCollection.Name)]
[Trait("Module", "FileUpload")]
public class FileUploadTests(DemoFixture fixture) : DemoPage(fixture)
{
    // A one-pixel PNG, so a real image really is uploaded and really is previewed.
    static readonly byte[] Pixel = Convert.FromBase64String(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");

    static FilePayload Png(string name = "pixel.png") =>
        new() { Name = name, MimeType = "image/png", Buffer = Pixel };

    async Task<string> ValueAsync(string previewId) => await Page.EvaluateAsync<string>("""
        preview => {
          const b = document.getElementById(preview).previousElementSibling;
          return b.querySelector('[data-slot="file-upload-value"]').value;
        }
        """, previewId);

    async Task<string> StateAsync(string previewId) => await Page.EvaluateAsync<string>("""
        preview => {
          const b = document.getElementById(preview).previousElementSibling;
          const zone = b.querySelector('[data-slot="file-upload-zone"]');
          const shown = b.querySelector('[data-slot="file-upload-preview"]');
          const empty = b.querySelector('[data-slot="file-upload-empty"]');
          const clear = b.querySelector('[data-slot="file-upload-clear"]');
          return [zone.dataset.filled ?? '', shown ? !shown.hidden : false,
                  empty ? !empty.hidden : false, clear ? !clear.hidden : false].join('|');
        }
        """, previewId);

    [SkippableFact]
    public async Task An_empty_zone_shows_the_prompt_and_no_way_to_remove_anything()
    {
        RequireDemo();
        await GoAsync("/components/file-upload");
        await ShowAsync("preview-file-upload-example");

        Assert.Equal("", await ValueAsync("preview-file-upload-example"));
        Assert.Equal("false|false|true|false", await StateAsync("preview-file-upload-example"));
        AssertQuiet();
    }

    /// <summary>The contract: bytes go up, a URL stays behind.</summary>
    [SkippableFact]
    public async Task Choosing_a_file_uploads_it_and_leaves_the_url_in_the_form()
    {
        RequireDemo();
        await GoAsync("/components/file-upload");
        var box = await ShowAsync("preview-file-upload-example");

        await box.Locator("[data-slot=\"file-upload-input\"]").SetInputFilesAsync(Png());
        await Page.WaitForTimeoutAsync(1200);

        var url = await ValueAsync("preview-file-upload-example");
        Assert.StartsWith("data:image/png", url);
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Once_there_is_a_file_the_zone_shows_it_instead_of_the_prompt()
    {
        RequireDemo();
        await GoAsync("/components/file-upload");
        var box = await ShowAsync("preview-file-upload-example");

        await box.Locator("[data-slot=\"file-upload-input\"]").SetInputFilesAsync(Png());
        await Page.WaitForTimeoutAsync(1200);

        var state = await StateAsync("preview-file-upload-example");
        Assert.Equal("true|true|false|true", state);
        AssertQuiet();
    }

    [SkippableFact]
    public async Task Removing_it_empties_the_field_and_brings_the_prompt_back()
    {
        RequireDemo();
        await GoAsync("/components/file-upload");
        var box = await ShowAsync("preview-file-upload-example");
        await box.Locator("[data-slot=\"file-upload-input\"]").SetInputFilesAsync(Png());
        await Page.WaitForTimeoutAsync(1200);

        await box.Locator("[data-slot=\"file-upload-clear\"]").ClickAsync();
        await Page.WaitForTimeoutAsync(400);

        Assert.Equal("", await ValueAsync("preview-file-upload-example"));
        var state = await StateAsync("preview-file-upload-example");
        Assert.Equal("false|false|true|false", state);
        AssertQuiet();
    }

    /// <summary>
    /// A picker's `accept` is advice, and a file dragged onto the zone never went through it — so
    /// the check has to be here as well, before anything is sent.
    /// </summary>
    [SkippableFact]
    public async Task A_file_the_zone_does_not_accept_is_refused_before_it_is_sent()
    {
        RequireDemo();
        await GoAsync("/components/file-upload");
        var box = await ShowAsync("preview-file-upload-document");

        await box.Locator("[data-slot=\"file-upload-input\"]")
            .SetInputFilesAsync(new FilePayload { Name = "pixel.png", MimeType = "image/png", Buffer = Pixel });
        await Page.WaitForTimeoutAsync(800);

        Assert.Equal("", await ValueAsync("preview-file-upload-document"));
        var said = await box.Locator("[data-slot=\"file-upload-status\"]").InnerTextAsync();
        Assert.False(string.IsNullOrWhiteSpace(said), "it refused the file without saying so");
        AssertQuiet();
    }

    /// <summary>A field rendered with a value is already filled before any script runs.</summary>
    [SkippableFact]
    public async Task A_value_rendered_by_the_server_is_shown_as_the_file()
    {
        RequireDemo();
        await GoAsync("/components/file-upload");
        await ShowAsync("preview-file-upload-filled");

        Assert.NotEqual("", await ValueAsync("preview-file-upload-filled"));
        var state = await StateAsync("preview-file-upload-filled");
        Assert.Equal("true|true|false|true", state);
        AssertQuiet();
    }

    /// <summary>
    /// The zone is reachable and operable from the keyboard: it is the control, so Enter has to
    /// open the picker the way a click does.
    /// </summary>
    [SkippableFact]
    public async Task The_zone_is_a_control_the_keyboard_can_reach()
    {
        RequireDemo();
        await GoAsync("/components/file-upload");
        var box = await ShowAsync("preview-file-upload-example");
        var zone = box.Locator("[data-slot=\"file-upload-zone\"]");

        await zone.FocusAsync();
        var focused = await Page.EvaluateAsync<string>(
            "() => document.activeElement?.dataset?.slot ?? ''");

        Assert.Equal("file-upload-zone", focused);
        Assert.Equal("button", await zone.GetAttributeAsync("role"));
        AssertQuiet();
    }
}
