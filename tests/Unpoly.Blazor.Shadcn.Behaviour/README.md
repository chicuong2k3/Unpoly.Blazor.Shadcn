# Behaviour tests

What a component **does**, in a real browser, against the real demo.

The suite next door proves a component *renders* shadcn's classes. It cannot prove the panel
closes, the sidebar collapses, the arrow key moves the right way or the toast's Undo is
reachable — and every one of those has been broken here while the whole class-parity suite
stayed green. That is what these are for.

```bash
dotnet test tests/Unpoly.Blazor.Shadcn.Behaviour
```

The demo is started for you on a free port and stopped afterwards. Two environment variables
change that:

| Variable | Effect |
|---|---|
| `BEHAVIOUR_URL` | drive an app you already have running, and start nothing |
| `BEHAVIOUR_BROWSER` | path to a real installed browser — the run is then headed |
| `BEHAVIOUR_CSS` | `v4` substitutes the retained Web `app.css` only in test pages via Playwright; unset uses demo-default v3. Build the demo, then run tests with `--no-build`. Missing asset or missing injected CSS marker fails rather than passing/skipping. This does not establish Safari support. |
| `SAFARI15_SIM` | `1` removes selected APIs to exercise compatibility polyfills in Chromium. This is NOT Safari 15 browser evidence; some CSS feature gaps cannot be simulated. |

`BEHAVIOUR_BROWSER` is not a convenience. Several faults in this repository only ever appeared
in one engine, and a report that says "it does not close in Opera" is answered by running the
suite in Opera:

```bash
BEHAVIOUR_BROWSER="C:/Users/.../opera.exe" dotnet test tests/Unpoly.Blazor.Shadcn.Behaviour
```

In the Safari simulation a polyfilled popover stays inside transformed ancestors instead of joining the native top layer. The shared `ui.js` positioning code compensates its measured offset without affecting native popovers. The sidebar and six overlay tests cover this path; a full simulated v3 run timed out. A MessageScroller aggregate failed 1/15 before the bounded layout chase/test wait change; the complete MessageScroller class subsequently passed 15/15 under simulation. An early full simulated run was 65/67 because two FileUpload tests checked an asynchronous POST after a fixed 1200ms; polling actual upload completion brought focused FileUpload to 7/7 and full simulated v3 Behaviour to 67/67 (zero skips). Earlier failures were not passes. Real MAUI WebView2 has a focused v4/v3 smoke in `tools/maui-webview-smoke.cjs`, not full component parity; Safari 15 real-device testing remains open.

A WebView2 MAUI route crawl found a pre-existing v4 `ReferenceError: onHighlight is not defined` when Context Menu was disposed during navigation. Its compiler cleanup removed an event listener that it never registered. The stray removal was deleted. `NavigationTests.Leaving_context_menu_cleans_up_without_page_errors` now opens the Context Menu, closes it with Escape and navigates away, then asserts no browser error; focused Web Chromium v4 and substituted v3 both passed 1/1, as did the two-style MAUI Context Menu→Data Table route probes. These focused checks do not certify the full suite or component paint parity.

## Three things worth knowing before adding one

**The demo runs in Development, deliberately.** `UseStaticWebAssets` is wired only there, and it
is what maps `/_content/Unpoly.Blazor.Shadcn/…` to the library's `wwwroot` from a build output.
Anywhere else `ui.js` and `app.css` both 404 — every component is unstyled and inert, which looks
exactly like a component that does not work.

**One behaviour per test, named as a sentence.** A failure should say what stopped being true
without anyone opening the file.

**Assert relations, not pixels.** Every placement fault this library has had was of one shape —
the panel opened somewhere unrelated to the control that opened it. `dx` from the trigger catches
that; a coordinate catches a font change.

## Console errors are failures

Every test ends with `AssertQuiet()`. Half the faults found while writing these announced
themselves in the console first — `toast.info is not a function` was there for weeks — and
nobody was listening.
