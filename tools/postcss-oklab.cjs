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
postcss([oklab({ preserve: true })])
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
