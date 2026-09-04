/**
 * Build step for both demo heads (invoked from each demo's `npm run css`):
 * downlevels oklch()/oklab() in the Tailwind-compiled stylesheet so Safari
 * 15.0-15.3 gets colors at all.
 *
 * @csstools/postcss-oklab-function with preserve:true emits a 3-tier stack
 * per color: a base sRGB rgb() every engine understands, a display-p3 tier
 * for wide-gamut screens, and the original oklch() gated behind
 * @supports (color: oklab(...)). Modern rendering is byte-identical in
 * effect (the oklch tier wins where supported); older engines fall back
 * down the stack instead of dropping the declaration.
 *
 * Dynamic oklch(from var(--x) ...) cannot be resolved statically and is left
 * as-is (accepted degradation: skeleton shimmer highlight only).
 *
 * Usage: node ../../tools/postcss-oklab.cjs ./wwwroot/app.css
 */
const fs = require("fs");
const postcss = require("postcss");
const oklab = require("@csstools/postcss-oklab-function");

const [inFile] = process.argv.slice(2);
if (!inFile) {
  console.error("usage: node tools/postcss-oklab.cjs <built.css>");
  process.exit(2);
}

const css = fs.readFileSync(inFile, "utf8");

// Safari 15 has no media-query range syntax (16.4+). Tailwind v4 emits
// `@media (width >= 40rem)`, which old WebKit drops whole — every md:/lg:/
// xl:/2xl: breakpoint dies and the page stops responding to screen width.
// Tailwind's max-* variant would emit `width < X`; none are in the source
// today, but the case is handled the same way lightningcss does: an open
// bound becomes a max-width just under the value.
const downlevelRanges = (text) =>
  text
    .replace(/\(\s*width\s*>=\s*([^\s)]+)\s*\)/g, "(min-width: $1)")
    .replace(/\(\s*([^\s)]+)\s*<=\s*width\s*\)/g, "(min-width: $1)")
    .replace(/\(\s*width\s*<\s*([^\s)]+)\s*\)/g, (match, value) => {
      const parsed = parseFloat(value);
      const unit = String(value).replace(/^-?[\d.]+/, "") || "px";
      if (Number.isNaN(parsed)) return match;
      return `(max-width: ${parsed - 0.02}${unit})`;
    });

const staticSrgbMixFallback = (value) => value.replace(
  /color-mix\(in srgb,\s*(#[0-9a-f]{3,8}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\))\s+(\d+(?:\.\d+)?)%\s*,\s*transparent\)/gi,
  (_, color, percentage) => {
    const channels = color.startsWith('#')
      ? color.replace(/^#/, '').match(/.{1,2}/g).map((channel) => parseInt(channel.length === 1 ? channel + channel : channel, 16))
      : color.match(/\d+/g).map(Number);
    const alpha = Number(percentage) / 100;
    return `rgba(${channels.slice(0, 3).join(', ')}, ${alpha})`;
  },
);

postcss([
  {
    postcssPlugin: "safari15-static-color-mix",
    Declaration(decl) {
      decl.value = staticSrgbMixFallback(decl.value);
    },
  },
  {
    postcssPlugin: "safari15-media-ranges",
    AtRule: {
      media(atRule) {
        const next = downlevelRanges(atRule.params);
        if (next !== atRule.params) atRule.params = next;
      },
    },
  },
  {
    // WebKit 15.4-15.6 fails to resolve custom properties declared inside a
    // cascade layer (part of why Tailwind v4 pins its Safari floor at 16.4):
    // structural utilities render but every var(--token) color comes out
    // empty. Hoisting the token definitions to the unlayered top restores
    // them on every engine — unlayered custom properties are the shadcn v3
    // architecture and lose to nothing here, since only themes define these.
    postcssPlugin: "hoist-token-rules",
    RuleExit(rule) {
      const parent = rule.parent;
      if (!parent || parent.type !== "atrule" || parent.name !== "layer") return;
      const decls = rule.nodes.filter((n) => n.type === "decl");
      if (decls.length === 0 || decls.length !== rule.nodes.length) return;
      if (!decls.every((d) => d.prop.startsWith("--"))) return;
      const layerRoot = parent.parent;
      if (!layerRoot || layerRoot.type !== "root") return;
      rule.remove();
      if (parent.nodes.length === 0) parent.remove();
      layerRoot.prepend(rule);
    },
  },
  oklab({ preserve: true }),
])
  .process(css, { from: inFile })
  .then((result) => {
    for (const w of result.warnings()) {
      console.error("postcss warning: " + w.toString());
    }
    fs.writeFileSync(inFile, result.css);
    const left = (result.css.match(/oklch\(/g) || []).length;
    console.log(`oklab pass: ${inFile} (${result.css.length} bytes, ${left} oklch() kept in gated tiers)`);
  })
  .catch((err) => {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  });
