namespace Unpoly.Blazor.Shadcn.ECharts.Models;

/// <summary>Lumeo-compatible series container: name + values along Categories.</summary>
public sealed class ChartSeriesData
{
    public string Name { get; set; } = "Series";
    public double[] Values { get; set; } = [];
    public string? Stack { get; set; }
    public string? Color { get; set; }

    public ChartSeriesData() { }
    public ChartSeriesData(string name, double[] values) { Name = name; Values = values; }
}
