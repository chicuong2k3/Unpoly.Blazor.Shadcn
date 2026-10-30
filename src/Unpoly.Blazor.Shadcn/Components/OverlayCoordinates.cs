namespace Unpoly.Blazor.Shadcn.Components;

/// <summary>A rectangle in normalized or application-defined overlay coordinates.</summary>
public readonly record struct OverlayRectangle(double X, double Y, double Width, double Height);

/// <summary>Converts overlay rectangles between normalized fractions and a logical coordinate space.</summary>
public readonly record struct OverlayCoordinates
{
    /// <summary>Width of the logical coordinate space.</summary>
    public double Width { get; }
    /// <summary>Height of the logical coordinate space.</summary>
    public double Height { get; }

    /// <summary>Creates a conversion for the given positive logical dimensions.</summary>
    public OverlayCoordinates(double width, double height)
    {
        if (!double.IsFinite(width) || width <= 0) throw new ArgumentOutOfRangeException(nameof(width));
        if (!double.IsFinite(height) || height <= 0) throw new ArgumentOutOfRangeException(nameof(height));
        Width = width;
        Height = height;
    }

    /// <summary>Converts a rectangle in logical units to normalized fractions.</summary>
    public OverlayRectangle ToNormalized(OverlayRectangle rectangle)
    {
        Validate(rectangle, Width, Height);
        return new(rectangle.X / Width, rectangle.Y / Height, rectangle.Width / Width, rectangle.Height / Height);
    }

    /// <summary>Converts a normalized rectangle to logical units.</summary>
    public OverlayRectangle ToLogical(OverlayRectangle rectangle)
    {
        Validate(rectangle, 1, 1);
        if (Width <= 0 || Height <= 0) throw new InvalidOperationException("Coordinate dimensions must be positive.");
        return new(rectangle.X * Width, rectangle.Y * Height, rectangle.Width * Width, rectangle.Height * Height);
    }

    private static void Validate(OverlayRectangle rectangle, double width, double height)
    {
        if (width <= 0 || height <= 0) throw new InvalidOperationException("Coordinate dimensions must be positive.");
        if (!double.IsFinite(rectangle.X) || !double.IsFinite(rectangle.Y) || !double.IsFinite(rectangle.Width) || !double.IsFinite(rectangle.Height) || rectangle.X < 0 || rectangle.Y < 0 || rectangle.Width <= 0 || rectangle.Height <= 0 || rectangle.X + rectangle.Width > width || rectangle.Y + rectangle.Height > height)
            throw new ArgumentOutOfRangeException(nameof(rectangle), "Rectangle must be finite and inside the coordinate space.");
    }
}
