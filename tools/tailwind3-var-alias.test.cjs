const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const postcss = require('postcss');
const { discover, discoverImportant, rename } = require('./tailwind3-var-alias.cjs');
const { classes } = require('./audit-css-classes.cjs');

test('discovers positive and negative runtime utility spellings without capturing prose', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shadcn-var-alias-'));
  try {
    const file = path.join(dir, 'fixture.razor');
    fs.writeFileSync(file, '<div class="gap-(--card-spacing) -mb-(--card-spacing) group-data-[state=open]:w-(--anchor-width)" />\n// prose-not-a-class-(--example)');
    assert.deepEqual([...discover([file])].sort(), [
      ['-mb-[var(--card-spacing)]', '-mb-(--card-spacing)'],
      ['gap-[var(--card-spacing)]', 'gap-(--card-spacing)'],
      ['group-data-[state=open]:w-[var(--anchor-width)]', 'group-data-[state=open]:w-(--anchor-width)'],
    ]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('discovers terminal-important v4 classes and maps only the utility suffix', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shadcn-important-alias-'));
  try {
    const file = path.join(dir, 'fixture.razor');
    fs.writeFileSync(file, '<div class="group-data-[collapsible=icon]:p-0! [&_[data-slot=sidebar-container]]:absolute! text-ordinary" Class="@Cn("relative m-0!", Class)" />\n"awesome!"');
    assert.deepEqual([...discoverImportant([file])].sort(), [
      ['!m-0', 'm-0!'],
      ['[&_[data-slot=sidebar-container]]:!absolute', '[&_[data-slot=sidebar-container]]:absolute!'],
      ['group-data-[collapsible=icon]:!p-0', 'group-data-[collapsible=icon]:p-0!'],
    ].sort());
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('restores escaped v4 class selectors while leaving CSS properties and other classes untouched', async () => {
  const aliases = new Map([
    ['gap-[var(--card-spacing)]', 'gap-(--card-spacing)'],
    ['group-hover:gap-[var(--card-spacing)]', 'group-hover:gap-(--card-spacing)'],
  ]);
  const css = String.raw`.gap-\[var\(--card-spacing\)\] { gap: var(--card-spacing) }
    .group:hover .group-hover\:gap-\[var\(--card-spacing\)\] { gap: var(--card-spacing) }`;
  const result = (await postcss([rename(aliases)]).process(css, { from: undefined })).css;
  const found = classes(result);
  assert.ok(found.has('gap-(--card-spacing)'));
  assert.ok(found.has('group-hover:gap-(--card-spacing)'));
  assert.match(result, /gap: var\(--card-spacing\)/);
});

test('restores v4 CardHeader border-spacing precedence without changing unrelated rules', async () => {
  const baseline = postcss.parse(fs.readFileSync(path.join(__dirname, '../demo/Unpoly.Blazor.Shadcn.Demo/wwwroot/app.css'), 'utf8'));
  const pairs = [
    ['[.border-b]:pb-(--card-spacing)', '[.border-b]:pb-3', 'pb'],
    ['[.border-t]:pt-(--card-spacing)', '[.border-t]:pt-3', 'pt'],
  ];
  const original = pairs.map(([variable, numeric, utility]) =>
    String.raw`.\[\.border-${utility === 'pb' ? 'b' : 't'}\]\:${utility}-3:is(.border-${utility === 'pb' ? 'b' : 't'}) { padding-${utility === 'pb' ? 'bottom' : 'top'}: .75rem }
    .\[\.border-${utility === 'pb' ? 'b' : 't'}\]\:${utility}-\[var\(--card-spacing\)\]:is(.border-${utility === 'pb' ? 'b' : 't'}) { padding-${utility === 'pb' ? 'bottom' : 'top'}: var(--card-spacing) }`).join('\n');
  const aliases = new Map(pairs.map(([variable, , utility]) =>
    [`[.border-${utility === 'pb' ? 'b' : 't'}]:${utility}-[var(--card-spacing)]`, variable]));
  const result = (await postcss([rename(aliases)]).process(original, { from: undefined })).css;
  const names = pairs.flatMap(([variable, numeric]) => [variable, numeric]);
  const order = css => {
    const positions = new Map(); let index = 0;
    postcss.parse(css).walkRules(rule => {
      index++;
      if (!rule.selector.includes('border-')) return;
      require('postcss-selector-parser')(selectors => selectors.walkClasses(node => {
        if (names.includes(node.value)) positions.set(node.value, index);
      })).processSync(rule.selector);
    });
    return positions;
  };
  const expected = order(baseline.toString());
  const actual = order(result);
  for (const [variable, numeric] of pairs) {
    assert.ok(expected.get(variable) < expected.get(numeric), `v4 ${variable} precedence changed`);
    assert.ok(actual.get(variable) < actual.get(numeric), `v3 ${variable} precedence differs`);
  }
});

test('does not rename class fragments or arbitrary selectors not in the discovered source', async () => {
  const aliases = new Map([['w-[var(--anchor-width)]', 'w-(--anchor-width)']]);
  const result = (await postcss([rename(aliases)]).process(
    String.raw`.w-\[var\(--anchor-width\)\]:hover, .w-\[var\(--other-width\)\] { width: var(--anchor-width) }`,
    { from: undefined },
  )).css;
  assert.deepEqual([...classes(result)].sort(), ['w-(--anchor-width)', 'w-[var(--other-width)]']);
});
