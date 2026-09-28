// Experimental, v3-only selector correction. Tailwind 3's custom variants
// currently select generic `.group` rather than the named group after `/`.
// Retain v3 declarations (Safari-compatible RGB channels, spacing, etc).
const selectorParser = require('postcss-selector-parser');
const ordinary = new Map([
  ['group-has-data-[size=lg]/avatar-group:size-10', ['size', 'lg', 'avatar-group', ['width', 'height']]],
  ['group-has-data-[size=sm]/avatar-group:size-6', ['size', 'sm', 'avatar-group', ['width', 'height']]],
  ['group-has-data-[size=lg]/avatar-group:[&>svg]:size-5', ['size', 'lg', 'avatar-group', ['width', 'height']]],
  ['group-has-data-[size=sm]/avatar-group:[&>svg]:size-3', ['size', 'sm', 'avatar-group', ['width', 'height']]],
  ['group-has-data-[slot=message-footer]/message:-translate-y-8', ['slot', 'message-footer', 'message', ['--tw-translate-y', 'transform']]],
  ['group-has-data-[variant=ghost]/message:px-0', ['variant', 'ghost', 'message', ['padding-left', 'padding-right']]],
  ['group-has-data-[sidebar=menu-action]/menu-item:pe-8', ['sidebar', 'menu-action', 'menu-item', ['padding-inline-end']]],
]);
const combo = 'group-data-empty/combobox-content:flex';
const nested = 'sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2';
const nestedV3 = String.raw`.group\/alert-dialog-content[data-size="default"] .group:has([data-slot=alert-dialog-media]) .sm\:group-data-\[size\=default\]\/alert-dialog-content\:group-has-data-\[slot\=alert-dialog-media\]\/alert-dialog-content\:col-start-2`;
const nestedV4 = String.raw`.sm\:group-data-\[size\=default\]\/alert-dialog-content\:group-has-data-\[slot\=alert-dialog-media\]\/alert-dialog-content\:col-start-2:is(:where(.group\/alert-dialog-content)[data-size="default"] *):is(:where(.group\/alert-dialog-content):has([data-slot="alert-dialog-media"]) *)`;
function selectorInfo(className, escaped) {
  if (ordinary.has(className)) {
    const [attribute, value, name, properties] = ordinary.get(className);
    const suffix = className.includes('[&>svg]') ? '>svg' : '';
    return {
      v3: `.group:has([data-${attribute}=${value}]) ${escaped}${suffix}`,
      v4: `${escaped}:is(:where(.group\\/${name}):has([data-${attribute}="${value}"]) *)${suffix ? ' > svg' : ''}`,
      properties,
    };
  }
  if (className === combo) return {
    v3: `.group[data-empty] ${escaped}`,
    v4: `${escaped}:is(:where(.group\\/combobox-content)[data-empty] *)`,
    properties: ['display'],
  };
  if (className === nested) return { v3: nestedV3, v4: nestedV4, properties: ['grid-column-start'] };
  return null;
}
function namedGroupCompat() {
  return {
    postcssPlugin: 'shadcn-v3-named-group-prototype',
    Rule(rule) {
      if (!rule.selector.includes('group-')) return;
      let target, escaped;
      selectorParser(selectors => selectors.walkClasses(node => {
        if (ordinary.has(node.value) || node.value === combo || node.value === nested) {
          if (target) throw rule.error('Multiple named-group targets in one rule');
          target = node.value; escaped = node.toString();
        }
      })).processSync(rule.selector);
      if (!target) return;
      const { v3, v4, properties } = selectorInfo(target, escaped);
      if (rule.selector !== v3 && rule.selector !== v4) {
        throw rule.error(`Unexpected named group selector for ${target}: ${rule.selector}`);
      }
      const declarations = rule.nodes.filter(node => node.type === 'decl');
      // v4 baseline has different properties for translate and px-0; skip
      // declaration comparison on a v4 sheet, but never rewrite that sheet.
      if (rule.selector === v3 &&
          (declarations.length !== properties.length ||
            declarations.some((node, index) => node.prop !== properties[index]))) {
        throw rule.error(`Unexpected declarations for ${target}`);
      }
      if (rule.selector === v3) rule.selector = v4;
    },
  };
}
module.exports = { namedGroupCompat, selectorInfo, ordinary, combo, nested };
