namespace Unpoly.Blazor.Shadcn.Components;

/// <summary>A presentation-only media reference; callers own storage and pagination.</summary>
public sealed record MediaAsset(string Id, string Src, string Alt)
{
    /// <summary>Small preview URL; videos without a thumbnail render a text placeholder.</summary>
    public string? ThumbnailSrc { get; init; }
    /// <summary>Render a native video preview when opened in a lightbox.</summary>
    public bool IsVideo { get; init; }
}

/// <summary>Timeline positions use seconds, independent of viewport pixels.</summary>
public sealed record MediaClip(string Id, string Label, double Start, double Duration, int Track = 0);
