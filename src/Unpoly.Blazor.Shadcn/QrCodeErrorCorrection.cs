namespace Unpoly.Blazor.Shadcn;

/// <summary>QR error correction — maps to QRCode.CorrectLevel (L=1, M=0, Q=3, H=2 in qrcode.js).</summary>
public enum QrCodeErrorCorrection
{
    Low,
    Medium,
    Quartile,
    High
}
