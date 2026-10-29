# Creative media primitives

Issues #7, #8 and #9. Demo route: `/components/creative-media` in Web and MAUI.
These components contain presentation state only. Storage, queries, generation, credits,
autosave and authorization belong to the consuming application.

## Composition

- `ImageCanvas` defines a source image coordinate space (`Width`/`Height`, 1–8192).
  Put `MaskBrush`, `DraggableOverlay` and image layers in its `ChildContent`.
  Additional images should fill the image plane; their coordinates match the declared source size.
  The view fits on resize; pan by pointer or arrows, zoom with buttons, +/- or Ctrl+wheel.
- `MaskBrush` requires an ancestor `ImageCanvas`. Its toolbar is mounted in the canvas toolbar
  and restored on disposal. Image-space strokes are independent of CSS scale and device pixel ratio;
  PNG exports always use the declared source dimensions. Transparent means unmasked, white means
  masked, alpha is brush opacity. Erase uses destination-out. Undo/redo is stroke based.
  Focus the canvas: arrows move the brush, Space paints a dot, Shift+arrows paints a segment,
  Alt+arrows uses one-image-pixel steps. Pointer cancellation discards the unfinished stroke.
- `DraggableOverlay` requires a positioned parent (the canvas plane provides one). Coordinates and
  sizes use fractions of that parent, in [0,1]; default snap .01. Move/Resize handles support
  pointer/pen/touch and arrows, Shift for 10 steps. The resulting rectangle stays in bounds.
- `MediaTimeline` receives `MediaClip` records; start/duration/snap are seconds, tracks are zero based.
  Move and trim handles support horizontal arrows/pointer, Shift for 10 steps. Up/down changes the
  track when moving; on a trim handle they do nothing and stay with the page. Pointer vertical
  distance changes tracks at 80px per track. Clips cannot extend outside the timeline or become
  shorter than Snap. Overlapping clips are allowed; the application owns collision rules, playback
  and encoding. Up to 100 tracks (0–99). The selected clip's move button carries
  `aria-current="true"`; `data-selected` on the clip is only a style hook.
- `MediaGrid` renders only the caller's current page, with lazy thumbnails and no video prefetch.
  Supply `NextPageHref` for server pagination (Unpoly attributes can be attached to the root or link
  composed in ChildContent). It is not a virtualized storage client. `SelectedIds` marks selections.
  `LightboxTarget` points to a `MediaLightbox.Id`; preview opens that asset directly. The root is a
  `role="group"` named by `Label`. A video without `ThumbnailSrc` gets a decorative placeholder tile,
  never an `<img>` without a source.
- `MediaLightbox` composes the existing `Dialog`. Only its current asset is loaded; previous video
  playback and source are released. Use a `DialogTrigger`, the grid target, or the open event below.
  Arrows, navigation buttons and horizontal swipes (touch, pen or mouse) navigate; stepping past the
  first or last asset keeps the current one loaded and emits nothing. A swipe that starts on a video
  is left to its controls. Escape and focus return use the native dialog/library behavior. Videos use
  native controls and do not intercept media keyboard controls.
- `AssetPicker` composes `Dialog`, `MediaGrid`, `Checkbox` and `Button`. Supply `FilterContent` for
  app-owned filtering. Selected IDs outside the visible page are retained. Persist `SelectedIds`
  in the application when replacing the entire picker across pages. A grid-only swap inside the
  same picker retains the selection Set, and the swapped-in checkboxes are set from it, because the
  server rendered them from its own `SelectedIds`. Confirm is cancelable with `preventDefault()`.
- `MediaLightbox` and `AssetPicker` name their dialog from `Label`. `Dialog` puts splatted attributes
  on its panel, where a label names nothing, so the compiler moves it to the `<dialog>` element.

All own classes are caller supplied; existing Shadcn controls supply the visual recipes.
Additional CSS in `ui.behavior.css` expresses only media geometry, touch behavior and focus.
No new lazy script is needed; existing crop/compare assets retain their loading paths on both hosts.
Use `@key` or replace the fragment when changing canvas dimensions, source assets or timeline data.
Use the set/restore events below for edits to an existing mounted instance.

## DOM event contract (both hosts)

Listen on the component root; events bubble. Blazor interactive consumers can attach a JS listener
and forward completed changes through coarse .NET interop. Pointer frames never call .NET.
Serialize the `detail` of change events in application state for reload recovery; the library
makes no localStorage writes. Version 1 is the serialization version, not the package version.

A change event means something changed. A key at an edge, a press without movement, a cancelled
gesture and a set to the current value emit nothing, so an autosaving consumer is not woken for
them. Computed positions and sizes are rounded to nine decimals before they are stored or emitted:
binary floating point would otherwise serialize .5700000000000001 for 57 grid steps of .01, and
.9999999999999999 for ten steps of .1.

| Event | Detail |
|---|---|
| `image-canvas:change` / send `image-canvas:restore` | `{version:1, scale, x, y, width, height}`; view x/y use CSS pixels, source dimensions use image pixels |
| `mask-brush:change` / send `mask-brush:restore` | `{version:1,width,height,strokes:[{mode:'draw'\|'erase',size,opacity,points:[{x,y}]}]}`; source pixels; restore requires matching dimensions |
| `mask-brush:export` | `{blob,width,height}`; PNG Blob, no data URL copy |
| `mask-brush:error` | `{reason}` |
| `draggable-overlay:change` / send `draggable-overlay:set` | `{version:1,x,y,width,height}`; normalized fractions |
| `media-timeline:select` | `{id}` |
| `media-timeline:change` / send `media-timeline:set` | `{version:1,id,start,duration,track}`; seconds |
| `media-grid:selection` | `{ids}` on the visible page |
| `media-grid:preview` | `{id}` |
| send `media-lightbox:open` | `{id}` (omitting ID uses current index) |
| `media-lightbox:change` | `{id,index}` |
| `asset-picker:confirm` | `{ids}`, cancelable |
| `image-compare:change` | `{value}` in 0–100; set `data-position` on the wrapper to control it |
| `image-compare:error` | `{reason:'load'}` |
| `image-crop:change` / send `image-crop:set` | `{crop:{x,y,width,height,...}}` in original image pixels |
| `image-crop:apply` | `{dataUrl,blob,crop,width,height}`; legacy `dataUrl` preserved |
| `image-crop:error` | `{reason:'image'\|'load'\|'bounds'\|'size'\|'cors'\|'export'}` |

Exported Blobs can be passed to FormData directly. Create an object URL only if needed and revoke
it after use. Crop export requires same-origin or CORS-enabled images. `MaxImageSize` is a hard
PNG byte limit, not a compression target; invalid ratios and negative limits are rejected.

## References and deliberate differences

- [shadcn.io comparison](https://www.shadcn.io/ui/comparison): enhance the existing
  `ImageCompare` web component instead of adding React's controlled component tree. Named slots
  each contain one image+label wrapper. Accessible slider value and discrete keyboard steps are
  maintained by the compiler; arrows, Home/End, PageUp/Down, Shift steps and reduced motion work
  without React state. Vendor teardown now disconnects its observer, stops animations and removes
  pointer/focus/keyboard listeners. InitialPosition is clamped to 0–100.
- [Kibo Image Crop](https://www.kibo-ui.com/components/image-crop): retain Cropper.js and the
  existing API; add numeric keyboard controls, zoom, coordinate events, Blob and error reporting.
  The file-size policy rejects oversized output rather than silently recompressing PNG.
- [dkmediaviewer](https://github.com/diklein/dkmediaviewer): image/video navigation and touch
  behavior, adapted to native Dialog and paged SSR instead of a React gallery dependency.
- [konva-drawboard](https://github.com/Oval17/konva-drawboard) and
  [free-drawing](https://github.com/fabienwnklr/free-drawing): draw/erase and replay concepts,
  implemented with native Canvas2D; no Konva/React dependency or infinite-canvas business engine.

## Validation

- `dotnet test tests/Unpoly.Blazor.Shadcn.Tests` — rendering, validation, contract and parity tests.
- Build Web, then `node --test tools/creative-media.test.cjs` (`DOTNET` overrides executable,
  `CREATIVE_MEDIA_URL` reuses a running demo, `CREATIVE_MEDIA_CONFIGURATION` selects Release). Uses actual SSR markup, jsdom and a native raster
  canvas to verify geometry, undo/redo, exports and disposal. This is not browser paint validation.
- `dotnet test tests/Unpoly.Blazor.Shadcn.Behaviour --filter FullyQualifiedName~CreativeMediaTests`
  exercises real browser navigation, mask pixel placement, crop export and narrow layout.
- Build and run `demo/Unpoly.Blazor.Shadcn.Maui` on Windows with the MAUI workload for native
  WebView QA. Linux cannot verify that host. Browser/MAUI touch, pen and accessibility-tree audits
  remain necessary before declaring every issue acceptance criterion verified.


### Windows automation

The `MAUI creative media` GitHub Actions workflow builds an unpackaged Windows demo with its
App SDK runtime, ensures Evergreen WebView2 is installed, and runs the existing WebView2 harness against v3 and v4. It also supports manual
`workflow_dispatch`. A failed native build, unavailable WebView2/CDP endpoint or failed assertion
fails the job; none is recorded as a skip/pass. Reports and screenshots are uploaded as
`maui-creative-media` when the app reaches the media checks.

To run locally on Windows after building Debug for win-x64:

```powershell
npm ci --prefix tools
$env:MAUI_MEDIA_REPORT_DIR = Join-Path $env:TEMP 'maui-media-reports'
node tools/maui-webview-smoke.cjs --creative-media-only
node tools/maui-webview-smoke.cjs --creative-media-only --baseline
```

Each run launches the native MAUI executable with a disposable WebView2 profile and loopback CDP
port. It checks gallery and asset selection, overlay resize, timeline trim, mask raster undo/redo,
pen input, touch emulation at DPR 2, crop Blob export, controlled comparison/reduced motion and
handler cleanup across Blazor navigation. Pen/touch are injected through the real WebView2 engine's
CDP interface; this does not certify physical touchscreen hardware, mobile native targets or a full
screen-reader/contrast audit. A report is evidence only for its recorded passing checks.

The smoke child sets `MAUI_SMOKE_LOG_PATH` to capture WinUI/MAUI startup, detected WebView2
version, initialization events and Blazor WebView trace logs. This logging is disabled for ordinary
app launches. Launch failures also upload host/session metadata and relevant Windows application
errors; a missing CDP endpoint remains a failure and is never counted as native coverage.

Windows Debug demos recognize the smoke child's validated `MAUI_SMOKE_CDP_PORT` (1024–65535)
and set loopback-only debugging through `BlazorWebViewInitializing.EnvironmentOptions`. This is
needed because elevated WebView2 hosts ignore `WEBVIEW2_*` environment overrides. The code
accepts no arbitrary browser arguments, uses a fresh temp profile, and is compiled out of Release.
Ordinary launches without the opt-in port do not enable debugging. See
[Microsoft's WebView2 flag guidance](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/webview-features-flags).

The hosted Windows job also scopes Microsoft's supported HKLM AdditionalBrowserArguments policy
to `Unpoly.Blazor.Shadcn.Maui.exe` on port 9222, with prior value/type restoration in `finally`.
It changes no wildcard policy. The smoke harness checks that the selected port is free; startup
failure reports include the last HTTP probe result and the disposable WebView process arguments.
This workflow policy is confined to the ephemeral runner and is not required for ordinary app use.
