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
    // /uploads is excluded because it is a REAL endpoint below, not a sample's target: this
    // echo runs before routing and would otherwise answer the file upload with a fragment.
    if (HttpMethods.IsPost(ctx.Request.Method) && !path.StartsWith("/_") && path != "/uploads")
    {
        var form = ctx.Request.HasFormContentType ? await ctx.Request.ReadFormAsync() : null;
        var fields = form is null || form.Count == 0
            ? "no fields"
            : string.Join(", ", form.Where(f => f.Key != "__RequestVerificationToken")
                                    .Select(f => $"{f.Key}={f.Value}"));

        // Answer with the element the client asked for. Unpoly needs the target to exist in
        // BOTH the page and the response, and each sample now targets its own #preview-… slot,
        // so the reply has to carry that id — the id is read from X-Up-Target rather than
        // guessed. The root keeps the shape the page started with and the styling goes on the
        // child, so a second submit swaps the same element as the first.
        var id = ctx.UpTargets().Select(t => t.Trim())
                    .FirstOrDefault(t => t.StartsWith('#'))?[1..] ?? "";

        ctx.Response.ContentType = "text/html; charset=utf-8";
        await ctx.Response.WriteAsync(
            $"<div id=\"{System.Net.WebUtility.HtmlEncode(id)}\" class=\"preview\">"
            + "<div class=\"mt-2 rounded-md border border-dashed px-3 py-2 text-sm "
            + "text-muted-foreground\">POST " + System.Net.WebUtility.HtmlEncode(path) + " — "
            + System.Net.WebUtility.HtmlEncode(fields) + "</div></div>");
        return;
    }

    await next();
});

app.MapRazorComponents<App>();

// The FileUpload page needs somewhere to post to. It keeps nothing: the file is read and
// thrown away, and the answer is a data: URL of what was sent — so the demo shows a real
// round trip, with a real preview, and stores nothing at all.
app.MapPost("/uploads", async (HttpRequest request) =>
{
    var file = request.Form.Files["file"];
    if (file is null || file.Length == 0) return Results.BadRequest(new { error = "no file" });

    using var memory = new MemoryStream();
    await file.CopyToAsync(memory);
    var url = $"data:{file.ContentType};base64,{Convert.ToBase64String(memory.ToArray())}";
    return Results.Ok(new { url });
}).DisableAntiforgery();

app.Run();

/// <summary>Named so the Playwright suite can boot this host as its fixture.</summary>
public partial class DemoHost;
