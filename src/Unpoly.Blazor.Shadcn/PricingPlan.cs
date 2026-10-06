namespace Unpoly.Blazor.Shadcn;

/// <summary>One plan in a PricingTable: its name and what it costs billed monthly and billed
/// yearly. The name is also the value the form submits as <c>plan</c>.</summary>
public sealed record PricingPlan(string Name, decimal MonthlyPrice, decimal YearlyPrice)
{
    /// <summary>Marks the plan to recommend: it carries a badge, and is the one selected when the
    /// table is given no selection of its own.</summary>
    public bool Popular { get; init; }
}

/// <summary>One row of a PricingTable's comparison: a feature and the first plan that includes
/// it. Plans are tiers, so every plan after that one includes it too.</summary>
public sealed record PricingFeature(string Name, string IncludedFrom);
