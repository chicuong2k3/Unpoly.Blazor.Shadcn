// Tailwind 4 applies stacked variants left to right; Tailwind 3 applies them
// right to left. So `data-[direction=start]:[&_svg]:rotate-180` — "an svg
// inside an element whose data-direction is start" in v4 — comes out of v3 as
// `.x svg[data-direction="start"]`: the attribute lands on the svg, which never
// carries it, and the rule matches nothing. A carousel arrow in RTL and the
// message scroller's jump-to-start button both kept pointing the wrong way.
//
// For every class whose attribute variant precedes an arbitrary [&…] variant,
// move the attribute back onto the element the class is on. One rule for the
// whole shape rather than one plugin per component, and it fails closed: a
// class with that shape whose attribute is nowhere in its selector throws.
function splitTopLevel(name) {
  const parts = []; let depth = 0, start = 0;
  for (let i = 0; i < name.length; i++) {
    const c = name[i];
    if (c === '[' || c === '(') depth++;
    else if (c === ']' || c === ')') depth--;
    else if (c === ':' && depth === 0) { parts.push(name.slice(start, i)); start = i + 1; }
  }
  parts.push(name.slice(start));
  return parts;
}
function attributeFor(variant) {
  const m = variant.match(/^(data|aria)-\[([\w-]+)=([^\]]+)\]$/);
  return m ? `[${m[1]}-${m[2]}="${m[3]}"]` : null;
}
function stackedVariantCompat() {
  return { postcssPlugin: 'shadcn-stacked-variant-compat', OnceExit(root) {
    root.walkRules(rule => {
      rule.selectors = rule.selectors.map(selector => {
        const token = selector.match(/^\.((?:\\.|[^\s.:\[>+~,()])+)/);
        if (!token) return selector;
        const variants = splitTopLevel(token[1].replace(/\\(.)/g, '$1')).slice(0, -1);
        const arbitrary = variants.findIndex(v => v.startsWith('[&'));
        if (arbitrary < 1) return selector;
        let fixed = selector; const at = token[0].length;
        for (const attribute of variants.slice(0, arbitrary).map(attributeFor).filter(Boolean)) {
          const found = fixed.indexOf(attribute, at);
          if (found === at) continue;
          if (found < 0) throw Error(`Stacked variant attribute ${attribute} missing from ${selector}`);
          fixed = fixed.slice(0, at) + attribute + fixed.slice(at, found) + fixed.slice(found + attribute.length);
        }
        return fixed;
      });
    });
  } };
}
module.exports = { stackedVariantCompat };
