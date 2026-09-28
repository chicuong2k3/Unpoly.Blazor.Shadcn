#!/usr/bin/env node
// Check class-selector coverage, not just whether a Tailwind build exits successfully.
// Usage: node tools/audit-css-classes.cjs <known-good.css> <candidate.css> [--json]
// This is a necessary (not sufficient) gate: it does not check computed style,
// at-rule conditions, pseudo-class semantics, component behavior or Safari support.
const fs = require('node:fs');
const postcss = require('postcss');
const selectorParser = require('postcss-selector-parser');

function classes(css, file = '<css>') {
  const found = new Set();
  const sheet = postcss.parse(css, { from: file });
  sheet.walkRules(rule => {
    // Non-selector rules (e.g. @keyframes steps) carry no utility class.
    if (!rule.selector.includes('.')) return;
    selectorParser(selectors => selectors.walkClasses(node => found.add(node.value)))
      .processSync(rule.selector);
  });
  return found;
}

function compare(baseline, candidate) {
  const missing = [...baseline].filter(value => !candidate.has(value)).sort();
  const added = [...candidate].filter(value => !baseline.has(value)).sort();
  return { baselineCount: baseline.size, candidateCount: candidate.size, missing, added };
}

if (require.main === module) {
  const [baselinePath, candidatePath, format] = process.argv.slice(2);
  if (!baselinePath || !candidatePath || (format && format !== '--json')) {
    console.error('usage: node tools/audit-css-classes.cjs <known-good.css> <candidate.css> [--json]');
    process.exitCode = 2;
  } else {
    try {
      const report = compare(
        classes(fs.readFileSync(baselinePath, 'utf8'), baselinePath),
        classes(fs.readFileSync(candidatePath, 'utf8'), candidatePath),
      );
      if (format === '--json') console.log(JSON.stringify(report, null, 2));
      else {
        console.log(`${report.baselineCount} baseline, ${report.candidateCount} candidate, ${report.missing.length} missing, ${report.added.length} added class selectors`);
        for (const name of report.missing) console.log(`MISSING ${name}`);
      }
      if (report.missing.length) process.exitCode = 1;
    } catch (error) {
      console.error(error);
      process.exitCode = 2;
    }
  }
}

module.exports = { classes, compare };
