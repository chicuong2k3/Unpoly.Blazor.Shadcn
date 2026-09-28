// v4 orders Attachment's has-data media p-* after content px-*/py-*.
// v3 reverses that order, leaving a vertical thumbnail with 10px horizontal
// padding instead of 8px when it has both media and content children.
function attachmentPaddingCompat() {
  return {
    postcssPlugin: 'shadcn-v3-attachment-padding-compat',
    Once(root) {
      const media = [], content = [];
      root.walkRules(rule => {
        if (/^\.has-data-\\\[slot\\=attachment-media\\\]\\:p-(?:1|1\\\.5|2):has\(\[data-slot=attachment-media\]\)$/.test(rule.selector)) media.push(rule);
        if (/^\.has-data-\\\[slot\\=attachment-content\\\]\\:py-(?:1|1\\\.5|2):has\(\[data-slot=attachment-content\]\)$/.test(rule.selector)) content.push(rule);
      });
      if (media.length !== 3 || content.length !== 3) throw root.error(`Expected 3 Attachment media and 3 content padding rules, found ${media.length}/${content.length}`);
      const anchor = content.at(-1);
      for (const rule of media.reverse()) { rule.remove(); anchor.after(rule); }
    },
  };
}
module.exports = { attachmentPaddingCompat };
