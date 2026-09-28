// Experimental named-container fallback, embedded only in opt-in v3 preview assets.
// The preview compiler supplies the manifest; v4, POS and Portal do not load it.
// Safari 15 supports ResizeObserver and :where(), but real Safari 15 is NOT tested.
(function (global) {
  'use strict';
  const names = ['card-header', 'field-group'];
  function start(manifest, { force = false } = {}) {
    if (!force && global.CSS?.supports?.('container-type', 'inline-size')) return () => {};
    if (!global.ResizeObserver || !global.MutationObserver) throw new Error('Named container fallback requires ResizeObserver and MutationObserver');
    if (!manifest || names.some(name => !Array.isArray(manifest[name]))) throw new Error('Missing named container query manifest');
    const document = global.document;
    let stopped = false;
    let pending = 0;
    const observed = new Set();
    const sizes = new WeakMap();
    const containerClass = name => `@container/${name}`;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const box = entry.contentBoxSize;
        sizes.set(entry.target, (Array.isArray(box) ? box[0] : box)?.inlineSize ?? entry.contentRect.width);
      }
      schedule();
    });
    function nearest(element, name) {
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        if (parent.classList.contains(containerClass(name))) return parent;
      }
      return null;
    }
    function measure(container) {
      if (sizes.has(container)) return sizes.get(container);
      const style = global.getComputedStyle(container);
      // Initial measurement before ResizeObserver's first content-box callback.
      return container.getBoundingClientRect().width -
        ['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth'].reduce(
          (sum, property) => sum + (parseFloat(style[property]) || 0), 0);
    }
    function update() {
      pending = 0;
      if (stopped) return;
      const threshold = 28 * parseFloat(global.getComputedStyle(document.documentElement).fontSize);
      const containers = new Set();
      const all = document.querySelectorAll('[class]');
      for (const element of all) {
        if (names.some(name => element.classList.contains(containerClass(name)))) {
          containers.add(element);
          if (!observed.has(element)) { observed.add(element); observer.observe(element); }
        }
      }
      for (const element of observed) {
        if (!containers.has(element)) { observer.unobserve(element); observed.delete(element); sizes.delete(element); }
      }
      for (const name of names) {
        const attr = `data-cq-md-${name}`;
        for (const element of all) {
          // The attribute belongs to the element bearing the @md variant, not
          // its ancestor: this avoids a wide outer container leaking into a
          // nested narrow container of the same name.
          const target = manifest[name].some(cls => element.classList.contains(cls));
          const closest = target && nearest(element, name);
          if (closest && measure(closest) >= threshold) element.setAttribute(attr, '');
          else element.removeAttribute(attr);
        }
      }
    }
    function schedule() { if (!stopped && !pending) pending = global.requestAnimationFrame(update); }
    const mutation = new MutationObserver(schedule);
    mutation.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style'] });
    global.addEventListener('resize', schedule);
    schedule();
    return () => {
      stopped = true;
      global.cancelAnimationFrame(pending);
      mutation.disconnect(); observer.disconnect();
      global.removeEventListener('resize', schedule);
      for (const name of names) document.querySelectorAll(`[data-cq-md-${name}]`).forEach(el => el.removeAttribute(`data-cq-md-${name}`));
    };
  }
  // css-has-pseudo MUST observe these attributes when both fallbacks run.
  // Otherwise a container resize cannot re-evaluate compound @md:has rules.
  global.shadcnContainerFallback = {
    start,
    observedAttributes: names.map(name => `data-cq-md-${name}`),
  };
})(typeof window === 'undefined' ? globalThis : window);
