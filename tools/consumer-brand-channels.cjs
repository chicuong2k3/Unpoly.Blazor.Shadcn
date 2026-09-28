// Resolve POS brand's root-only color aliases for Tailwind 3 alpha utilities.
// Diagnostic until the consuming-app pipeline and parity checks are integrated.
const postcss = require('postcss');
const names = require('./color-tokens.cjs');
const { channels } = require('./postcss-color-channels.cjs');
function brandChannels(css) {
  const tree = postcss.parse(css);
  const roots = tree.nodes.filter(node => node.type === 'rule' && node.selector === ':root');
  if (roots.length !== 1) throw Error(`Expected one brand :root rule, found ${roots.length}`);
  const root = roots[0];
  const values = new Map();
  root.walkDecls(/^--/, decl => {
    if (values.has(decl.prop)) throw Error(`Duplicate brand token ${decl.prop}`);
    values.set(decl.prop, decl.value.trim());
  });
  const resolve = (name, seen = new Set()) => {
    if (seen.has(name)) throw Error(`Cyclic brand token ${name}`);
    const value = values.get(name);
    if (!value) throw Error(`Unknown brand token ${name}`);
    if (!value.startsWith('var(')) return value;
    const match = /^var\((--[a-z0-9-]+)\)$/.exec(value);
    if (!match) throw Error(`Unsupported brand alias ${name}: ${value}`);
    return resolve(match[1], new Set([...seen, name]));
  };
  const overrides = [...names, 'positive', 'warning'].filter(name => values.has(`--${name}`));
  for (const name of overrides) {
    const { rgb, alpha } = channels(resolve(`--${name}`));
    root.append({ prop: `--${name}-rgb`, value: rgb });
    root.append({ prop: `--${name}-alpha`, value: alpha });
  }
  return { css: tree.toString(), overrides };
}
module.exports = { brandChannels };
