// Experimental v4 `p-(--token)` spelling bridge for Tailwind 3.4.
// Tailwind 3 understands `p-[var(--token)]` but emits a different class
// selector. Discover names from the consumer's sources, safelist their v3
// equivalents, then restore the original class names in the compiled CSS.
// Variant-prefixed spellings in quoted class lists can also be discovered,
// but only variants actually supported by Tailwind 3 will produce rules.
// Always verify selector/context equivalence before wiring this into demos.
const fs = require('node:fs');
const path = require('node:path');
const selectorParser = require('postcss-selector-parser');

function discover(files) {
  const aliases = new Map();
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    // Only inspect quoted class lists, not arbitrary prose or C# expressions.
    for (const quoted of source.matchAll(/["'`]([^"'`\r\n]*)["'`]/g)) {
      for (const token of quoted[1].split(/\s+/)) {
        // A prefix may include named groups and arbitrary variants; the v4
        // runtime-variable utility must appear at the end of this class.
        if (!/(?:^|:)-?[a-z][a-z0-9-]*-\(--[a-z0-9-]+\)$/.test(token)) continue;
        const v3 = token.replace(/-\((--[a-z0-9-]+)\)$/, '-[var($1)]');
        aliases.set(v3, token);
      }
    }
  }
  return aliases;
}

// Tailwind v4 accepts `p-0!`; Tailwind v3 uses `!p-0`. Discover only
// terminal important utilities from quoted class lists, then safelist the
// v3 spelling and restore its source class through rename().
function discoverImportant(files) {
  const aliases = new Map();
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    // Razor class="@Cn("...")" nests a quoted C# string inside the
    // markup attribute. Its opening quote is consumed by the generic regex.
    const quotedLists = [
      ...source.matchAll(/["'`]([^"'`\r\n]*)["'`]/g),
      ...source.matchAll(/\bCn\(\s*["']([^"'\r\n]*)["']/g),
    ];
    for (const quoted of quotedLists) {
      for (const token of quoted[1].split(/\s+/)) {
        const utility = token.match(/(?:^|:)([a-z][a-z0-9/-]*)!$/)?.[1];
        // Fail closed on prose such as "awesome!" found in demo examples.
        if (!utility || !/^(?:absolute|flex|(?:m|p|size)-[0-9]+|h-full|min-h-full|text-destructive)$/.test(utility)) continue;
        const v3 = token.replace(/(^|:)([a-z][a-z0-9/-]*)!$/, '$1!$2');
        aliases.set(v3, token);
      }
    }
  }
  return aliases;
}

// v4 places the static CardHeader spacing after its variable fallback;
// v3 safelisted arbitrary values sort AFTER the static spacing. Without this
// small cascade fix, a card with both classes uses the wrong padding.
const cardSpacingPairs = [
  ['[.border-b]:pb-(--card-spacing)', '[.border-b]:pb-3', 'padding-bottom'],
  ['[.border-t]:pt-(--card-spacing)', '[.border-t]:pt-3', 'padding-top'],
];
function rename(aliases) {
  return {
    postcssPlugin: 'tailwind3-restore-runtime-variable-classes',
    Rule(rule) {
      if (!rule.selector.includes('.')) return;
      try {
        rule.selector = selectorParser(selectors => selectors.walkClasses(node => {
          const original = aliases.get(node.value);
          if (original) node.value = original;
        })).processSync(rule.selector);
      } catch (error) {
        throw rule.error(error.message);
      }
    },
    OnceExit(root) {
      for (const [variable, staticClass, prop] of cardSpacingPairs) {
        if (![...aliases.values()].includes(variable)) continue;
        let variableRule, staticRule;
        root.walkRules(rule => {
          if (!rule.selector.includes('border-')) return;
          selectorParser(selectors => selectors.walkClasses(node => {
            if (node.value === variable) variableRule = rule;
            if (node.value === staticClass) staticRule = rule;
          })).processSync(rule.selector);
        });
        if (!variableRule || !staticRule) continue;
        if (variableRule.parent !== staticRule.parent ||
            variableRule.nodes.filter(node => node.type === 'decl').length !== 1 ||
            variableRule.nodes[0].prop !== prop ||
            variableRule.nodes[0].value !== 'var(--card-spacing)' ||
            !staticRule.nodes.some(node => node.prop === prop)) {
          throw variableRule.error(`Cannot safely order ${variable} before ${staticClass}`);
        }
        // Insert before even if already sorted: safe and idempotent.
        staticRule.before(variableRule);
      }
    },
  };
}

module.exports = { discover, discoverImportant, rename };
