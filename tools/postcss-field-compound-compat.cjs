// Experimental Tailwind 3 bridge for BOTH Field compound utilities that v3
// cannot generate. Matches the compiled Tailwind v4 selector/declaration,
// including its second (descendant, not direct-child) radio branch.
// Wired into the opt-in v3 preview only, NOT v4/POS/Portal. Compare with v4
// and verify Safari before enabling by default.
const postcss = require('postcss');
const selectorParser = require('postcss-selector-parser');
const className = '@md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px';
const escaped = String.raw`.\@md\/field-group\:has-\[\>\[data-slot\=field-content\]\]\:\[\&\>\[role\=checkbox\]\,\[role\=radio\]\]\:mt-px`;
const selector = `${escaped}:has( > [data-slot=field-content]) > [role=checkbox], ${escaped}:has( > [data-slot=field-content]) [role=radio]`;
const horizontalClassName = 'has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px';
const horizontalEscaped = escaped.replace(String.raw`.\@md\/field-group\:`, '.');
const horizontalSelector = selector.replaceAll(escaped, horizontalEscaped);
function splitBranches(value) {
  const result = [];
  selectorParser(selectors => selectors.each(branch => result.push(branch.toString().trim()))).processSync(value);
  return result;
}
const branches = splitBranches(selector);
const horizontalBranches = splitBranches(horizontalSelector);
function matchingRules(css, target = className) {
  const found = [];
  css.walkRules(rule => {
    if (!rule.selector.includes('field-content')) return;
    let matches = false;
    selectorParser(selectors => selectors.walkClasses(node => { if (node.value === target) matches = true; })).processSync(rule.selector);
    if (matches) found.push(rule);
  });
  return found;
}
function fieldCompoundCompat() {
  return {
    postcssPlugin: 'shadcn-field-compound-v3-prototype',
    Once(root) {
      for (const [target, combined, parts, responsive] of [
        [className, selector, branches, true],
        [horizontalClassName, horizontalSelector, horizontalBranches, false],
      ]) {
        const existing = matchingRules(root, target);
        if (existing.length) {
          if (!((existing.length === 1 && existing[0].selector === combined) ||
                (existing.length === 2 && parts.every((part, i) => existing[i].selector === part))) ||
              existing.some(rule => (responsive
                ? rule.parent.name !== 'container' ||
                  !/field-group \((?:min-width:\s*28rem|width >= 28rem)\)/.test(rule.parent.params)
                : !((rule.parent.type === 'atrule' && rule.parent.name === 'layer' && rule.parent.params === 'utilities') ||
                    rule.parent.type === 'root')) ||
                rule.nodes.length !== 1 || rule.nodes[0].prop !== 'margin-top' ||
                rule.nodes[0].value !== '1px')) {
            throw existing[0].error(`Unexpected existing ${target} rule; cannot safely alias`);
          }
          continue;
        }
        const parent = responsive
          ? postcss.atRule({ name: 'container', params: 'field-group (min-width: 28rem)' })
          : root;
        // Keep branches as separate rules. css-has-pseudo's runtime misses the
        // radio branch when the two :has selectors share a comma-separated rule.
        for (const part of parts) {
          const rule = postcss.rule({ selector: part });
          rule.append(postcss.decl({ prop: 'margin-top', value: '1px' }));
          parent.append(rule);
        }
        if (responsive) root.append(parent);
      }
    },
  };
}
module.exports = { fieldCompoundCompat, className, selector, branches, matchingRules,
  horizontalClassName, horizontalSelector, horizontalBranches };
