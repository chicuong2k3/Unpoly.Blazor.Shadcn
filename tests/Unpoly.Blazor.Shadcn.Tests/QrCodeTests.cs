using Bunit;
using Microsoft.AspNetCore.Components;
using Unpoly.Blazor.Shadcn;
using Unpoly.Blazor.Shadcn.Components;

namespace Unpoly.Blazor.Shadcn.Tests;

public class QrCodeTests : BunitContext
{
    [Fact]
    public void QrCode_renders_data_slot_and_qrcode_marker()
    {
        var cut = Render<QrCode>(p => p.Add(c => c.Value, "https://example.com"));
        var div = cut.Find("[data-slot=\"qr-code\"]");
        Assert.NotNull(div);
        Assert.True(div.HasAttribute("data-qrcode"));
    }

    [Fact]
    public void QrCode_encodes_value_size_and_correct_level()
    {
        var cut = Render<QrCode>(p => p
            .Add(c => c.Value, "hello")
            .Add(c => c.Size, 180)
            .Add(c => c.ErrorCorrectionLevel, QrCodeErrorCorrection.High));
        var div = cut.Find("[data-slot=\"qr-code\"]");
        Assert.Equal("hello", div.GetAttribute("data-value"));
        Assert.Equal("180", div.GetAttribute("data-size"));
        Assert.Equal("H", div.GetAttribute("data-correct-level"));
    }

    [Fact]
    public void QrCode_correct_level_string_alias_takes_precedence()
    {
        var cut = Render<QrCode>(p => p.Add(c => c.Value, "x").Add(c => c.CorrectLevel, "L"));
        Assert.Equal("L", cut.Find("[data-slot=\"qr-code\"]").GetAttribute("data-correct-level"));
    }

    [Theory]
    [InlineData(QrCodeErrorCorrection.Low, "L")]
    [InlineData(QrCodeErrorCorrection.Medium, "M")]
    [InlineData(QrCodeErrorCorrection.Quartile, "Q")]
    [InlineData(QrCodeErrorCorrection.High, "H")]
    public void QrCode_maps_error_correction_enum_to_qrcodejs_level(QrCodeErrorCorrection level, string expected)
    {
        var cut = Render<QrCode>(p => p.Add(c => c.Value, "x").Add(c => c.ErrorCorrectionLevel, level));
        Assert.Equal(expected, cut.Find("[data-slot=\"qr-code\"]").GetAttribute("data-correct-level"));
    }

    [Fact]
    public void QrCode_applies_size_as_inline_style()
    {
        var cut = Render<QrCode>(p => p.Add(c => c.Value, "x").Add(c => c.Size, 200));
        var style = cut.Find("[data-slot=\"qr-code\"]").GetAttribute("style");
        Assert.Contains("width:200px", style);
        Assert.Contains("height:200px", style);
    }

    [Fact]
    public void QrCode_defaults_to_aria_label_from_value_and_allows_override()
    {
        var def = Render<QrCode>(p => p.Add(c => c.Value, "https://example.com"));
        Assert.Equal("https://example.com", def.Find("[data-slot=\"qr-code\"]").GetAttribute("aria-label"));

        var custom = Render<QrCode>(p => p.Add(c => c.Value, "https://example.com").Add(c => c.AriaLabel, "QR for example"));
        Assert.Equal("QR for example", custom.Find("[data-slot=\"qr-code\"]").GetAttribute("aria-label"));
    }

    [Fact]
    public void QrCode_sets_colors_and_margin_attributes()
    {
        var cut = Render<QrCode>(p => p.Add(c => c.Value, "x")
            .Add(c => c.ForegroundColor, "#111").Add(c => c.BackgroundColor, "#fff").Add(c => c.Margin, 8));
        var div = cut.Find("[data-slot=\"qr-code\"]");
        Assert.Equal("#111", div.GetAttribute("data-color-dark"));
        Assert.Equal("#fff", div.GetAttribute("data-color-light"));
        Assert.Equal("8", div.GetAttribute("data-margin"));
    }

    [Fact]
    public void QrCode_no_margin_sets_zero()
    {
        var cut = Render<QrCode>(p => p.Add(c => c.Value, "x").Add(c => c.ShowMargin, false));
        Assert.Equal("0", cut.Find("[data-slot=\"qr-code\"]").GetAttribute("data-margin"));
    }

    [Fact]
    public void QrCode_has_img_role()
    {
        var cut = Render<QrCode>(p => p.Add(c => c.Value, "x"));
        Assert.Equal("img", cut.Find("[data-slot=\"qr-code\"]").GetAttribute("role"));
    }

    [Fact]
    public void QrCode_merges_class_via_tailwind_merge()
    {
        // h-12 vs h-10 etc. not relevant; just verify Class is appended
        var cut = Render<QrCode>(p => p.Add(c => c.Value, "x").Add(c => c.Class, "my-qr"));
        Assert.Contains("my-qr", cut.Find("[data-slot=\"qr-code\"]").ClassName);
    }
}
