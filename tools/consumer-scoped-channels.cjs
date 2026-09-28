// Diagnostic bridge for Portal's scoped palette layered after POS brand.css.
// An RGB channel computed only from :root cannot follow the portal-body override.
const postcss = require('postcss');
const { channels } = require('./postcss-color-channels.cjs');
const names = require('./color-tokens.cjs');
function scopedChannels(css) {
  const tree = postcss.parse(css);
  const rules = [];
  tree.walkRules(rule => { if (rule.selector === 'body.portal-body,.portal-shell') rules.push(rule); });
  if (rules.length !== 1) throw Error(`Expected one Portal palette rule, found ${rules.length}`);
  const rule = rules[0], seen = new Set(), overrides = [];
  rule.walkDecls(/^--/, decl => {
    const name = decl.prop.slice(2);
    if (!names.includes(name) && !['positive', 'warning'].includes(name)) return;
    if (seen.has(name)) throw decl.error(`Duplicate scoped token ${name}`);
    seen.add(name);
    if (/var\(/.test(decl.value)) throw decl.error(`Dynamic scoped token ${name} needs explicit runtime channel tracking`);
    const { rgb, alpha } = channels(decl.value.trim());
    rule.append({ prop: `--${name}-rgb`, value: rgb });
    rule.append({ prop: `--${name}-alpha`, value: alpha });
    overrides.push(name);
  });
  if (!overrides.includes('primary')) throw Error('Missing Portal primary palette');
  return { css: tree.toString(), overrides };
}
module.exports = { scopedChannels };
