using Bunit;
using Unpoly.Blazor.Shadcn.Components;

namespace Unpoly.Blazor.Shadcn.Tests;

public class FileUploadTests : BunitContext
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void Submission_mode_names_only_the_field_that_posts(bool native)
    {
        var upload = Render<FileUpload>(p => p.Add(c => c.Name, "image").Add(c => c.Action, "/uploads")
            .Add(c => c.SubmitWithForm, native));
        var picker = upload.Find("[data-slot=file-upload-input]");
        var value = upload.Find("[data-slot=file-upload-value]");

        Assert.Equal(native ? "image" : null, picker.GetAttribute("name"));
        Assert.Equal(native, value.HasAttribute("disabled"));
        Assert.Equal(native ? "true" : null, upload.Find("[data-slot=file-upload]").GetAttribute("data-submit-with-form"));
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void Required_maps_to_native_picker_validation(bool required)
    {
        var upload = Render<FileUpload>(p => p.Add(c => c.Name, "image").Add(c => c.Action, "")
            .Add(c => c.SubmitWithForm, true).Add(c => c.Required, required));

        Assert.Equal(required, upload.Find("[data-slot=file-upload-input]").HasAttribute("required"));
    }
}
