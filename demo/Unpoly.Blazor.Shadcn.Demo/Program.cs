using Unpoly.Blazor;
using Unpoly.Blazor.Shadcn.Demo.Components;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddRazorComponents();

// Unpoly owns navigation. `.doc-main` is what every in-page link swaps, so moving between
// component pages keeps the scroll position of the nav and never re-runs the theme script.
builder.Services.AddUnpoly(o => o.MainTargets = [".doc-main"]);

var app = builder.Build();

app.UseStaticFiles();
app.UseUnpoly();                 // before UseAntiforgery: sets Vary, empties 204/304 bodies
app.UseAntiforgery();
app.MapRazorComponents<App>();

app.Run();

/// <summary>Named so the Playwright suite can boot this host as its fixture.</summary>
public partial class DemoHost;
