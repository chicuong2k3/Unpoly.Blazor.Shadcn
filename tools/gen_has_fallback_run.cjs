/**
 * Helper for tools/gen_has_fallback.py: run the reference css-has-pseudo
 * PostCSS plugin over built CSS and print ONLY the emitted fallback rules
 * (those scoped under .js-has-pseudo), preserving at-rule context.
 *
 * The fallback emission (encoding, specificity padding, scoping) is owned by
 * the plugin — reimplementing it by hand produced subtly wrong output twice.
 * This file does no parsing of its own beyond splitting top-level rules.
 *
 * Usage: node tools/gen_has_fallback_run.cjs <in.css>   (writes out.css)
 */
const fs = require("fs");
const postcss = require("postcss");
const hasPseudo = require("css-has-pseudo");

const [inFile, outFile] = process.argv.slice(2);
const css = fs.readFileSync(inFile, "utf8");

postcss([hasPseudo({ preserve: true })])
  .process(css, { from: inFile })
  .then((result) => {
    const kept = [];
    result.root.walkRules((rule) => {
      if (rule.selector.includes(".js-has-pseudo")) {
        // Rebuild the rule with its at-rule ancestry so gated fallbacks stay gated.
        let node = rule;
        const stack = [];
        let nestedInStyle = false;
        while (node.parent && node.parent.type !== "root") {
          node = node.parent;
          if (node.type === "atrule") stack.unshift(node);
          else if (node.type === "rule") nestedInStyle = true;
        }
        if (nestedInStyle) {
          // A fallback nested inside another style rule cannot be relocated
          // without its parent selector context — report and skip.
          console.error("SKIP nested-in-style fallback: " + rule.selector);
          return;
        }
        let text = rule.toString();
        for (const atrule of stack) {
          const params = atrule.params ? " " + atrule.params : "";
          text = `@${atrule.name}${params} {\n${text}\n}`;
        }
        kept.push(text);
      }
    });
    // process() is async because plugins may be; warnings surface here.
    for (const w of result.warnings()) {
      console.error("postcss warning: " + w.toString());
    }
    fs.writeFileSync(outFile, kept.join("\n\n") + (kept.length ? "\n" : ""));
    console.log(kept.length + " fallback rules from " + inFile);
  })
  .catch((err) => {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  });
