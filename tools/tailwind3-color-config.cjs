// Experimental Tailwind 3 theme colors; pair with postcss-color-channels.cjs.
// The channels are COMMA-separated for Safari 15's rgba(r,g,b,a) syntax.
// Do not use `rgb(var(--name-rgb) / alpha)` with comma channels: browsers
// discard that entire declaration even though the selector exists.
const names = require('./color-tokens.cjs');
function createColorConfig() {
  return Object.fromEntries(names.map(name => [name, ({ opacityValue } = {}) =>
    opacityValue === undefined ? `var(--${name})` :
      `rgba(var(--${name}-rgb), calc(var(--${name}-alpha, 1) * ${opacityValue}))`]));
}
module.exports = { createColorConfig };
