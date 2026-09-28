// Experimental fallback for the TWO named, 28rem Shadcn containers only.
// Keep native @container rules. Consumer must install container-fallback-runtime.js
// and pass the returned manifest. Never silently handle an unknown query.
const postcss = require('postcss');
const selectorParser = require('postcss-selector-parser');

function createContainerFallback({ force = false, removeNative = false } = {}) {
  if (removeNative && !force) throw new Error('Removing native @container rules is only allowed in forced browser tests');
  const manifest = { 'card-header': [], 'field-group': [] };
  const plugin = {
    postcssPlugin: 'shadcn-named-container-fallback-prototype',
    Once(root) {
      root.walkAtRules('container', atRule => {
        const match = /^(card-header|field-group)\s+\(min-width:\s*28rem\s*\)$/.exec(atRule.params);
        if (!match) throw atRule.error(`Unsupported Safari container query: ${atRule.params}`);
        const name = match[1];
        const clones = [];
        atRule.walkRules(rule => {
          if (rule.parent !== atRule) throw rule.error('Nested container rules need an explicit Safari fallback');
          const rewritten = [];
          selectorParser(selectors => selectors.each(selector => {
            let variant;
            selector.walkClasses(node => {
              if (node.value.startsWith(`@md/${name}:`)) variant ||= node.value;
            });
            if (!variant) throw rule.error(`Missing @md/${name} variant in container rule: ${selector}`);
            if (!manifest[name].includes(variant)) manifest[name].push(variant);
            rewritten.push(`:where([data-cq-md-${name}])${selector.toString()}`);
          })).processSync(rule.selector);
          clones.push(rule.clone({ selector: rewritten.join(', ') }));
        });
        const fallback = postcss.atRule({ name: 'supports', params: 'not (container-type: inline-size)' });
        fallback.append(clones);
        // Forced mode is for the browser test ONLY. Safari production CSS must
        // retain native rules so newer browsers keep native nearest-container semantics.
        if (force) atRule.after(clones);
        else atRule.after(fallback);
        if (removeNative) atRule.remove();
      });
    },
  };
  return { plugin, manifest };
}
module.exports = { createContainerFallback };
