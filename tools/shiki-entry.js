// Kibo CodeBlock's Shiki defaults, bundled locally so both hosts work offline.
// Regenerate with `npm run build:shiki` from the repository root.
import { codeToHtml } from 'shiki'
import {
  transformerNotationDiff,
  transformerNotationErrorLevel,
  transformerNotationFocus,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from '@shikijs/transformers'

const transformers = [
  transformerNotationDiff({ matchAlgorithm: 'v3' }),
  transformerNotationHighlight({ matchAlgorithm: 'v3' }),
  transformerNotationWordHighlight({ matchAlgorithm: 'v3' }),
  transformerNotationFocus({ matchAlgorithm: 'v3' }),
  transformerNotationErrorLevel({ matchAlgorithm: 'v3' }),
]

window.shadcnShikiHighlight = (code, language, withNotations = true) =>
  codeToHtml(code, {
    lang: language || 'typescript',
    themes: { light: 'github-light', dark: 'github-dark-default' },
    transformers: withNotations ? transformers : [],
  })
