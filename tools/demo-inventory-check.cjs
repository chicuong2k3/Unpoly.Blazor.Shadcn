// Focused Web/MAUI component regression for the two formerly uncovered visual primitives.
// Both demo hosts use the same examples; no fake option markup or synthetic CSS fixtures.
async function checkInventory(page, navigate, css) {
  await navigate('/components/native-select');
  const wrapped = page.locator('#preview-native-select-wrapper-example').locator('xpath=preceding-sibling::div[1]');
  const enabled = wrapped.locator('[data-slot="native-select-wrapper"]').first();
  const disabled = wrapped.locator('[data-slot="native-select-wrapper"]').nth(2);
  await enabled.locator('select').waitFor({ state: 'visible', timeout: 30000 });
  await enabled.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  const before = await wrapped.evaluate(el => {
    const wrappers = [...el.querySelectorAll('[data-slot="native-select-wrapper"]')];
    return wrappers.map(w => ({ opacity: Number(getComputedStyle(w).opacity), width: w.getBoundingClientRect().width }));
  });
  if (before.length !== 4 || !(before[0].width > 0) || !(before[2].width > 0) || before[0].opacity !== 1 || before[2].opacity !== 0.5)
    throw Error(`${css}: NativeSelectWrapper enabled/disabled state invalid: ${JSON.stringify(before)}`);
  await enabled.locator('select').selectOption('south');
  if (await enabled.locator('select').inputValue() !== 'south' || !await disabled.locator('select').isDisabled())
    throw Error(`${css}: NativeSelectWrapper value/disabled mismatch`);
  await navigate('/components/select');
  const box = page.locator('#preview-select-item-indicator-example').locator('xpath=preceding-sibling::div[1]');
  const indicator = box.locator('[data-slot="select-item-indicator"][aria-hidden="true"]');
  await indicator.waitFor({ state: 'visible', timeout: 30000 });
  await box.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  const state = await indicator.evaluate(el => ({ hidden: el.getAttribute('aria-hidden'), position: getComputedStyle(el).position,
    width: Math.round(el.getBoundingClientRect().width), icon: !!el.querySelector('svg[aria-hidden="true"]') }));
  if (state.hidden !== 'true' || state.position !== 'absolute' || state.width !== 14 || !state.icon)
    throw Error(`${css}: SelectItemIndicator mismatch: ${JSON.stringify(state)}`);
  await box.locator('[data-slot="select-trigger"]').click();
  await page.locator('[data-slot="select-content"]:popover-open [data-slot="select-item"]').filter({ hasText: 'Shoes' }).click();
  await page.waitForFunction(() => {
    const s = document.querySelector('#si-indicator-example');
    return s?.value === 'shoes' && s.parentElement?.querySelector('[data-slot="select-value"]')?.textContent.trim() === 'Shoes';
  }, null, { timeout: 15000 });
  if (await indicator.getAttribute('aria-hidden') !== 'true') throw Error(`${css}: decorative indicator became accessible`);
  console.log(`${css} NativeSelectWrapper + SelectItemIndicator: disabled CSS, selected value, decorative icon, enhanced Select passed`);
}
module.exports = { checkInventory };
