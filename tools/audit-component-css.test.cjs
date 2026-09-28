const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const postcss = require('postcss');
const { report, tokens, slotRules, expectedSnippetRules } = require('./audit-component-css.cjs');

test('attributes quoted default/variant classes to each source and reports missing per head', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shadcn-component-audit-'));
  try {
    const components = path.join(dir, 'Components');
    fs.mkdirSync(components);
    fs.writeFileSync(path.join(components, 'Bubble.razor'), 'const string Base = "group/bubble bg-primary";\n"dark:bg-primary/90"');
    fs.writeFileSync(path.join(components, 'Button.razor'), 'string Classes => ButtonVariants.Of(Variant, Size);');
    fs.writeFileSync(path.join(components, 'Plain.razor'), '<div class="@Classes" />');
    const web = path.join(dir, 'web.css');
    const maui = path.join(dir, 'maui.css');
    const v3 = path.join(dir, 'v3.css');
    fs.writeFileSync(web, '.group\\/bubble{} .bg-primary{} .dark\\:bg-primary\\/90{} .font-bold{}');
    fs.writeFileSync(maui, '.group\\/bubble{} .bg-primary{} .font-bold{}');
    fs.writeFileSync(v3, '.group\\/bubble{} .font-bold{}');
    const result = report(components, {
      web: { baseline: web, candidate: v3 },
      maui: { baseline: maui, candidate: v3 },
    }, { 'ButtonVariants.Of(': '"font-bold"' });
    assert.deepEqual(result.web.missing, [{ component: 'Bubble', missing: ['bg-primary', 'dark:bg-primary/90'] }]);
    assert.deepEqual(result.maui.missing, [{ component: 'Bubble', missing: ['bg-primary'] }]);
    assert.equal(result.web.sourceAttributed, 2);
    assert.deepEqual(result.web.uninspectable, ['Plain']);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('Razor nested Cn list is read even when its attribute consumes the first quote', () => {
  const source = '<div class="@Cn("group/avatar-group flex dark:bg-primary/90", Class)">';
  assert.ok(tokens(source).has('group/avatar-group'));
  assert.ok(tokens(source).has('dark:bg-primary/90'));
});

test('slot-rule comparison catches dropped/changed declarations without calling layers equal', () => {
  const baseline = postcss.parse('@layer components { [data-slot="snippet"] { color: red } }');
  const sameRulesDifferentLayer = postcss.parse('[data-slot="snippet"] { color: red }');
  const broken = postcss.parse('[data-slot="snippet"] { color: blue }');
  assert.deepEqual(slotRules(baseline, 'snippet'), slotRules(sameRulesDifferentLayer, 'snippet'));
  assert.deepEqual(slotRules(postcss.parse('[data-slot=snippet] { color: red }'), 'snippet'),
    slotRules(baseline, 'snippet'));
  assert.notDeepEqual(slotRules(baseline, 'snippet'), slotRules(broken, 'snippet'));
  assert.deepEqual(slotRules(broken, 'absent'), []);
});

test('Snippet audit accepts only the two explicitly restored computed v4 utility winners', () => {
  const v4 = postcss.parse('[data-slot="snippet"] > [data-slot="tabs"] { gap: 0 } [data-slot="snippet"] [data-slot="tabs-trigger"] { font-size: 0.75rem; color: red }');
  const corrected = postcss.parse('[data-slot="snippet"] > [data-slot="tabs"] { gap: calc(var(--spacing) * 2) } [data-slot="snippet"] [data-slot="tabs-trigger"] { font-size: var(--control-text); color: red }');
  assert.deepEqual(expectedSnippetRules(slotRules(v4, 'snippet')), slotRules(corrected, 'snippet'));
  assert.notDeepEqual(expectedSnippetRules(slotRules(v4, 'snippet')),
    slotRules(postcss.parse('[data-slot="snippet"] > [data-slot="tabs"] { gap: 0 } [data-slot="snippet"] [data-slot="tabs-trigger"] { font-size: var(--control-text); color: red }'), 'snippet'));
  assert.throws(() => expectedSnippetRules(slotRules(corrected, 'snippet')), /Unexpected v4 Snippet/);
});

test('quoted token scan is intentionally not a dynamic Razor expression evaluator', () => {
  assert.deepEqual([...tokens('class="@Classes" @code { var x = "bg-primary"; }')].sort(), ['@Classes', 'bg-primary']);
});
