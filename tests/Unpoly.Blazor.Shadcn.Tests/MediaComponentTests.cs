using Bunit;
using Unpoly.Blazor.Shadcn.Components;

namespace Unpoly.Blazor.Shadcn.Tests;

public class MediaComponentTests : BunitContext
{
    [Fact]
    public void Image_crop_exposes_configuration_to_the_cropper_compiler()
    {
        var root = Render<ImageCrop>(p => p
            .Add(x => x.Src, "/photo.png")
            .Add(x => x.AspectRatio, 1.5)
            .Add(x => x.Circular, true)
            .Add(x => x.MaxImageSize, 2048)).Find("[data-slot=image-crop]");

        Assert.Equal("/photo.png", root.QuerySelector("img")?.GetAttribute("src"));
        Assert.Equal("1.5", root.GetAttribute("data-aspect-ratio"));
        Assert.Equal("true", root.GetAttribute("data-circular"));
        Assert.Equal("2048", root.GetAttribute("data-max-image-size"));
    }
}
