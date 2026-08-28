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

// What the samples submit to.
// ------------------------------------------------------------------------------------------
// Every interactive sample posts somewhere or links to a file, and none of those routes
// existed: the form submitted, the server answered 404, Unpoly had nothing to swap, and the
// control looked dead. "The attachment trigger doesn't work" and "the quick-reply bubbles do
// nothing" were both this, not the components.
//
// MIDDLEWARE, not endpoints. A `MapPost("/{**path}")` catch-all matches the PATH for every
// method, so routing answered `GET /_content/Unpoly.Blazor.Shadcn/ui.js` with 405 Method Not
// Allowed — ui.js never loaded, no compiler ran, and every scripted component on the page went
// quiet at once. That was a worse bug than the one being fixed, and it is exactly the kind a
// catch-all invites.
app.Use(async (ctx, next) =>
{
    var path = ctx.Request.Path.Value ?? "/";

    // A file an attachment can open: real bytes and a real content type, so the trigger has
    // something to fetch rather than a 404 to fall into.
    if (HttpMethods.IsGet(ctx.Request.Method) && path.StartsWith("/files/"))
    {
        await Results.Text($"This stands in for {path["/files/".Length..]}.\n",
                           "text/plain; charset=utf-8").ExecuteAsync(ctx);
        return;
    }

    // Anything a sample posts. The reply is a `.preview` fragment, which is what the samples
    // target and what <Example> renders a slot for — the point is not the answer, it is that a
    // reader can press the thing and watch it really submit, with no JavaScript taking part.
    if (HttpMethods.IsPost(ctx.Request.Method) && !path.StartsWith("/_"))
    {
        var form = ctx.Request.HasFormContentType ? await ctx.Request.ReadFormAsync() : null;
        var fields = form is null || form.Count == 0
            ? "no fields"
            : string.Join(", ", form.Where(f => f.Key != "__RequestVerificationToken")
                                    .Select(f => $"{f.Key}={f.Value}"));

        ctx.Response.ContentType = "text/html; charset=utf-8";
        await ctx.Response.WriteAsync(
            "<div class=\"preview mt-2 rounded-md border border-dashed px-3 py-2 text-sm "
            + "text-muted-foreground\">POST " + System.Net.WebUtility.HtmlEncode(path) + " — "
            + System.Net.WebUtility.HtmlEncode(fields) + "</div>");
        return;
    }

    await next();
});

app.MapRazorComponents<App>();

app.Run();

/// <summary>Named so the Playwright suite can boot this host as its fixture.</summary>
public partial class DemoHost;
