# Creative Media component audit

This audit exercises all nine media components on the actual SSR/Unpoly host and native MAUI WebView2. It uses the same `tools/creative-media-audit.cjs` assertions in both engines, with local SVG/WebM fixtures at `/components/creative-media/audit`.

## Matrix

- CSS: v3 and v4.
- Theme: light and dark.
- Viewport: 320×740, 768×1024, 1280×900, 740×360 (short landscape).
- Hosts: Web Chromium and Windows MAUI/WebView2.
- Outputs: per-check JSON plus PNG captures and an `index.html` gallery in CI artifacts. The sticky documentation header is hidden only during component captures; measurements use the unchanged page.

| Component | Style/layout/position checks | Functional checks |
|---|---|---|
| ImageCanvas | Frame containment, grouped view controls, fitted plane | Zoom, keyboard pan, fit; existing pen/touch/DPR checks |
| MaskBrush | Toolbar containment and overlap, active mode, sliders, history/export glyphs | Draw, erase, undo/redo, source-size PNG export; existing serialization/disposal tests |
| DraggableOverlay | Source-space bounds; 24px physical move/resize handles after canvas fitting | Pointer move; existing keyboard resize, bounds, cancellation, normalized serialization and teardown |
| MediaTimeline | Time ruler, separate tracks, trim handles anchored at opposite clip edges | Keyboard trim, track movement; existing pointer, snapping, cancellation, no-op and teardown tests |
| MediaGrid | Tile sizing/captions/selection; loading, empty, error and broken thumbnail | Checkbox selection, fallback preview, no full video prefetch |
| MediaLightbox | Portrait containment and navigation; viewport-bounded dialog in short landscape | Navigation, error/retry, empty state, real local video load/release; existing swipe and focus behavior |
| AssetPicker | Scroll region, visible summary/actions, mobile footer | Selection/clear/confirm/loading; existing off-page selection and grid replacement tests |
| ImageCompare | Horizontal and vertical layer sizing, round grip, reduced-motion rules | Keyboard boundaries, pointer divider movement, controlled value; existing lifecycle tests |
| ImageCrop | Bounded stage, grouped controls, ratio selector, circular mode | Free east/south edge independence, explicit 4:3 lock, Blob/coordinate export and circular alpha |

## Corrections found in the audit

- Creative Media and standalone crop examples silently started with locked ratios. They now start Free. The component shows the active ratio and lets users choose Free, 1:1, 4:3 or 16:9; custom configured ratios stay available. Circular crop stays locked to 1:1. Dragging a fixed-ratio edge intentionally changes the other dimension; Free does not.
- Overlay handles inherited the image's scale and shrank below their 24px source dimensions. Their hit areas now counter-scale with the viewport; the annotation rectangle and serialized coordinates stay in source space.
- Gallery thumbnails exposed browser broken-image rendering. A failed thumbnail now has a labeled fallback; the full media preview can still be opened independently.
- Lightbox error state had no retry path and its stage could dominate short viewports. The stage and navigation now share a bounded grid; Retry starts a new request.
- The comparison vendor's second-layer wrapper had no height. With the existing wrapper slots and an explicit vertical height, its image could size to intrinsic height instead of the frame. The bundled vendor CSS now gives that internal wrapper `height:100%`.
- At the narrowest width, canvas and brush groups needed an explicit compact arrangement rather than relying on flex wrapping.

## Scope of evidence

The matrix checks the deterministic fixtures and the behavior listed above, with automated geometry plus representative screenshot review. Existing interaction suites also run. It is not a claim that every possible application stylesheet, arbitrary layer content, physical input device or assistive-technology combination has been tested. Physical device and screen-reader checks remain separate. Very short or overlapping user clips still require application-specific inspection at an appropriate timeline scale.

Reference layout mapping and intentional differences are documented in [creative-media.md](creative-media.md#reference-layout-alignment). CI artifact links and final counts are recorded in the pull request after the audit runs.
