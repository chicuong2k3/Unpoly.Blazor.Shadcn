using Bunit;
using Microsoft.AspNetCore.Components;
using Unpoly.Blazor.Shadcn.Components;

namespace Unpoly.Blazor.Shadcn.Tests;

[Trait("Layer", "Component")]
public sealed class FolderPickerTests : BunitContext
{
    [Fact]
    public async Task Successful_pick_publishes_selected_path()
    {
        string? selected = null;
        var picker = Render<FolderPicker>(parameters => parameters
            .Add(component => component.Value, @"C:\Backups")
            .Add(component => component.ValueChanged,
                EventCallback.Factory.Create<string?>(this, value => selected = value))
            .Add(component => component.PickAsync, () => Task.FromResult<string?>(@"D:\Cloud\Backups")));

        Assert.Equal(@"C:\Backups", picker.Find("input").GetAttribute("value"));

        await picker.Find("button").ClickAsync(new());

        Assert.Equal(@"D:\Cloud\Backups", selected);
    }

    [Fact]
    public async Task Cancelled_pick_does_not_change_value()
    {
        var changes = 0;
        var picker = Render<FolderPicker>(parameters => parameters
            .Add(component => component.Value, @"C:\Backups")
            .Add(component => component.ValueChanged,
                EventCallback.Factory.Create<string?>(this, _ => changes++))
            .Add(component => component.PickAsync, () => Task.FromResult<string?>(null)));

        await picker.Find("button").ClickAsync(new());

        Assert.Equal(0, changes);
    }

    [Fact]
    public async Task Picker_failure_is_announced_and_reported()
    {
        Exception? reported = null;
        var picker = Render<FolderPicker>(parameters => parameters
            .Add(component => component.ErrorMessage, "Choose another folder.")
            .Add(component => component.PickAsync, () => Task.FromException<string?>(new IOException("Unavailable")))
            .Add(component => component.OnError,
                EventCallback.Factory.Create<Exception>(this, exception => reported = exception)));

        await picker.Find("button").ClickAsync(new());

        Assert.Equal("alert", picker.Find("[data-slot='field-error']").GetAttribute("role"));
        Assert.Equal("Choose another folder.", picker.Find("[data-slot='field-error']").TextContent);
        Assert.IsType<IOException>(reported);
    }
}
