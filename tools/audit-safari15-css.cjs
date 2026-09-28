#!/usr/bin/env node
// Inventory CSS constructs not natively available in Safari 15.0 (not a
// compatibility certificate). Use on the ACTUAL compiled CSS for each demo.
// A construct under @supports can be harmless when a working fallback exists;
// this report deliberately does not infer that the fallback works.
const fs = require('node:fs');
const postcss = require('postcss');
const selectorParser = require('postcss-selector-parser');

const unsupportedAtRules = new Map([
  ['container', 'containerQueries'],
  ['property', 'registeredProperties'],
  ['layer', 'cascadeLayers'],
  ['starting-style', 'startingStyle'],
  ['scope', 'scope'],
]);

function inspect(css, file = '<css>') {
  const sheet = postcss.parse(css, { from: file });
  const samples = {};
  const counts = {};
  function record(type, node) {
    counts[type] = (counts[type] || 0) + 1;
    if (!samples[type]) samples[type] = [];
    if (samples[type].length < 4) samples[type].push({
      line: node.source?.start?.line ?? null,
      context: node.type === 'atrule' ? `@${node.name} ${node.params}` :
        node.type === 'rule' ? node.selector : `${node.prop}: ${node.value}`,
    });
  }
  sheet.walkAtRules(node => {
    const category = unsupportedAtRules.get(node.name.toLowerCase());
    if (category) record(category, node);
  });
  sheet.walkRules(rule => {
    if (!rule.selector.includes(':has(')) return;
    selectorParser(selectors => selectors.walkPseudos(node => {
      if (node.value === ':has') record('hasSelectors', rule);
    })).processSync(rule.selector);
  });
  sheet.walkDecls(decl => {
    if (/\bcolor-mix\(/i.test(decl.value)) record('colorMixDeclarations', decl);
    if (/\b(?:oklch|oklab|rgb|hsl)\(\s*from\b/i.test(decl.value)) record('relativeColorDeclarations', decl);
  });
  return { file, counts, samples };
}

if (require.main === module) {
  const [file, format] = process.argv.slice(2);
  if (!file || (format && format !== '--json')) {
    console.error('usage: node tools/audit-safari15-css.cjs <compiled.css> [--json]');
    process.exitCode = 2;
  } else {
    try {
      const result = inspect(fs.readFileSync(file, 'utf8'), file);
      console.log(format === '--json' ? JSON.stringify(result, null, 2) :
        Object.entries(result.counts).map(([name, count]) => `${name}: ${count}`).join('\n'));
    } catch (error) {
      console.error(error);
      process.exitCode = 2;
    }
  }
}
module.exports = { inspect };
