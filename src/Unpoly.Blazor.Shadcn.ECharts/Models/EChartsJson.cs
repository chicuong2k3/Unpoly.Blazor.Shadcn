using System.Text.Json;
using System.Text.Json.Serialization;

namespace Unpoly.Blazor.Shadcn.ECharts.Models;

/// <summary>
/// Serializes ECharts options to the JSON the <c>echarts.js</c> compiler reads from
/// <c>data-options</c>. One place, one set of settings.
/// </summary>
public static class EChartsJson
{
    public static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        WriteIndented = false,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) }
    };

    public static string Serialize(object? value)
        => value is null ? "{}" : JsonSerializer.Serialize(value, Options);

    public static string SerializeRaw(string? json)
        => string.IsNullOrWhiteSpace(json) ? "{}" : json.Trim();
}
