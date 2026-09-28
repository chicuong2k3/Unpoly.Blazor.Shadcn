// Tailwind v4 preflight sets select opacity:1, overriding the UA's disabled
// opacity. Tailwind v3 preflight does not. Restrict the preview correction to
// the library's native select; do not change the v4 default or arbitrary selects.
const postcss = require('postcss');
function nativeSelectOpacityCompat() {
  return {
    postcssPlugin: 'native-select-opacity-compat',
    OnceExit(root) {
      if (!root.toString().includes(':has(select:disabled)'))
        throw new Error('NativeSelect preview baseline missing');
      root.append(postcss.rule({ selector: 'select[data-slot="native-select"]:disabled', nodes: [
        postcss.decl({ prop: 'opacity', value: '1' }),
      ] }));
    },
  };
}
nativeSelectOpacityCompat.postcss = true;
module.exports = { nativeSelectOpacityCompat };
