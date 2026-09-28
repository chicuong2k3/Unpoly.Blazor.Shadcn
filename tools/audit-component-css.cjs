#!/usr/bin/env node
// Source-attributed CSS selector inventory. Necessary gate, never render or style parity.
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const { classes } = require('./audit-css-classes.cjs');

// These currently have no *own compiled utility class*. Do not report them
// as component parity passes: composition, slot CSS and browser-default
// elements still need rendered/state/interaction tests.
const delegates = new Set(['ComboboxInput', 'FieldTitle', 'FolderPicker', 'FormField']);
const slotCss = new Map([['ResizablePanel', 'resizable-panel'], ['SelectItem', 'select-item'], ['Snippet', 'snippet']]);
const noOwnUtility = new Set([
  'Accordion', 'AspectRatio', 'Breadcrumb', 'Collapsible', 'CollapsibleContent',
  'CollapsibleTrigger', 'ComboboxValue', 'ContextMenuGroup', 'ContextMenuTrigger',
  'DropdownMenuGroup', 'HoverCardTrigger', 'ImageCrop', 'InputOtpSeparator',
  'MenubarGroup', 'PaginationItem', 'PopoverAnchor', 'TableOfContents', 'VideoPlayer',
]);
const knownWithoutUtility = new Set([...delegates, ...slotCss.keys(), ...noOwnUtility]);

function slotRules(parsed, slot) {
  const found = [];
  parsed.walkRules(rule => {
    // Tailwind v4's minifier removes quotes from safe attribute values;
    // the v3 preview keeps them. Compare equivalent selectors, not bytes.
    const selector = rule.selector.replace(/\[data-slot=(?:"([\w-]+)"|'([\w-]+)'|([\w-]+))\]/g,
      (_, double, single, bare) => `[data-slot="${double || single || bare}"]`);
    if (!selector.includes(`[data-slot="${slot}"]`)) return;
    found.push(JSON.stringify([selector, rule.nodes.filter(x => x.type === 'decl')
      .map(x => [x.prop, x.value, x.important])]));
  });
  return found.sort();
}

// The preview intentionally restores the *computed* v4 Tabs utility winners,
// not the lower-priority v4 Snippet behaviour declarations. Fail closed if
// either source rule changes instead of globally ignoring Snippet differences.
function expectedSnippetRules(v4) {
  const replacements = new Map([
    ['[data-slot="snippet"] > [data-slot="tabs"]', ['gap', '0', 'calc(var(--spacing) * 2)']],
    ['[data-slot="snippet"] [data-slot="tabs-trigger"]', ['font-size', '0.75rem', 'var(--control-text)']],
  ]);
  return v4.map(serialized => {
    const [selector, declarations] = JSON.parse(serialized);
    const expected = replacements.get(selector);
    if (!expected) return serialized;
    const [property, before, after] = expected;
    const matches = declarations.filter(([name, value]) => name === property && value === before);
    if (matches.length !== 1) throw Error(`Unexpected v4 Snippet ${property} baseline`);
    return JSON.stringify([selector, declarations.map(([name, value, important]) =>
      [name, name === property ? after : value, important])]);
  }).sort();
}

function tokens(source) {
  const found = new Set();
  // Quoted Razor attributes and C# class lists. A CSS selector baseline filters
  // out prose and values that are not compiled classes. This is deliberately
  // not a Razor parser: dynamic concatenations/JS and unquoted expressions
  // need separate tests and must not be reported as covered here.
  const quotedLists = [
    ...source.matchAll(/["'`]([^"'`\r\n]*)["'`]/g),
    // Razor class="@Cn("...")" consumes the inner opening quote in the
    // generic scan; pick up the C# string separately (also true for @Cn in code).
    ...source.matchAll(/\bCn\(\s*["']([^"'\r\n]*)["']/g),
  ];
  for (const match of quotedLists) {
    for (const token of match[1].split(/\s+/)) if (token) found.add(token);
  }
  return found;
}

function inventory(directory, baseline, candidate, helpers = {}) {
  const rows = [];
  for (const name of fs.readdirSync(directory).filter(x => x.endsWith('.razor')).sort()) {
    const file = path.join(directory, name);
    const stem = name.slice(0, -6);
    const source = fs.readFileSync(file, 'utf8') + (fs.existsSync(file + '.cs') ? '\n' + fs.readFileSync(file + '.cs', 'utf8') : '');
    const sourced = tokens(source);
    for (const [reference, helper] of Object.entries(helpers)) {
      if (source.includes(reference)) for (const token of tokens(helper)) sourced.add(token);
    }
    const used = [...sourced].filter(x => baseline.has(x)).sort();
    rows.push({ component: stem, source: name, baselineClasses: used.length,
      missing: used.filter(x => !candidate.has(x)),
      // Zero is unknown, NOT a successful check: some components delegate
      // classes to C# helpers or intentionally render no styled element.
      uninspectable: used.length === 0 });
  }
  return rows;
}

function report(directory, heads, helpers = {}) {
  const result = {};
  for (const [head, { baseline, candidate }] of Object.entries(heads)) {
    const before = classes(fs.readFileSync(baseline, 'utf8'), baseline);
    const after = classes(fs.readFileSync(candidate, 'utf8'), candidate);
    const components = inventory(directory, before, after, helpers);
    const unknown = components.filter(x => x.uninspectable).map(x => x.component);
    const slotRuleDifferences = [];
    const slotBaselineAbsent = [];
    const baselineCss = postcss.parse(fs.readFileSync(baseline, 'utf8'), { from: baseline });
    const candidateCss = postcss.parse(fs.readFileSync(candidate, 'utf8'), { from: candidate });
    for (const [component, slot] of slotCss) {
      const v4 = slotRules(baselineCss, slot);
      const v3 = slotRules(candidateCss, slot);
      if (!v4.length) slotBaselineAbsent.push(component);
      else if (JSON.stringify(component === 'Snippet' ? expectedSnippetRules(v4) : v4) !== JSON.stringify(v3)) slotRuleDifferences.push(component);
    }
    result[head] = {
      sourceFiles: components.length,
      baselineClasses: before.size,
      sourceAttributed: components.filter(x => !x.uninspectable).length,
      uninspectable: unknown,
      uncategorized: unknown.filter(x => !knownWithoutUtility.has(x)),
      delegated: unknown.filter(x => delegates.has(x)),
      slotStyled: unknown.filter(x => slotCss.has(x)),
      noOwnUtility: unknown.filter(x => noOwnUtility.has(x)),
      slotRuleDifferences,
      slotBaselineAbsent,
      missing: components.filter(x => x.missing.length).map(({ component, missing }) => ({ component, missing })),
      components,
    };
  }
  return result;
}

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const demo = name => path.join(root, 'demo', `Unpoly.Blazor.Shadcn.${name}`, 'wwwroot');
  const result = report(path.join(root, 'src/Unpoly.Blazor.Shadcn/Components'), {
    web: { baseline: path.join(demo('Demo'), 'app.css'), candidate: path.join(demo('Demo'), 'app.v3.css') },
    maui: { baseline: path.join(demo('Maui'), 'app.css'), candidate: path.join(demo('Maui'), 'app.v3.css') },
  }, { 'ButtonVariants.Of(': fs.readFileSync(path.join(root, 'src/Unpoly.Blazor.Shadcn/ButtonVariants.cs'), 'utf8') });
  if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
  else for (const [head, entry] of Object.entries(result)) {
    console.log(`${head}: ${entry.baselineClasses} v4 selector class names; ${entry.sourceAttributed}/${entry.sourceFiles} component sources with baseline classes; ${entry.missing.length} with missing v3 class names; ${entry.uninspectable.length} uninspectable`);
    for (const row of entry.missing) console.log(`MISSING ${row.component}: ${row.missing.join(', ')}`);
    console.log(`DELEGATED ${entry.delegated.join(', ')}`);
    console.log(`SLOT CSS SOURCE (only rules present in v4 compared; layer/cascade NOT compared) ${entry.slotStyled.join(', ')}`);
    console.log(`NO OWN UTILITY ${entry.noOwnUtility.join(', ')}`);
    console.log(`BASELINE HAS NO SLOT CSS ${entry.slotBaselineAbsent.join(', ')}`);
    console.log(`SLOT RULE DIFFERENCES ${entry.slotRuleDifferences.join(', ')}`);
    console.log(`UNCATEGORIZED ${entry.uncategorized.join(', ')}`);
  }
  // Pin the measured v4 input: an empty/truncated baseline must not produce
  // a misleading green report merely because no source token matched it.
  const expected = { web: 1622, maui: 1512 };
  if (Object.entries(result).some(([head, x]) => x.missing.length || x.baselineClasses !== expected[head] ||
      x.sourceFiles !== 319 || x.sourceAttributed !== 294 || x.uninspectable.length !== knownWithoutUtility.size ||
      x.uncategorized.length || x.slotRuleDifferences.length ||
      x.slotBaselineAbsent.length)) {
    console.error('Component CSS audit failed or baseline/source inventory changed; review before updating pins.');
    process.exitCode = 1;
  }
}
module.exports = { tokens, inventory, report, slotRules, expectedSnippetRules };
