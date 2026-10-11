/**
 * The Shiki highlighter — imported lazily (see `use-highlighter.ts`) so the
 * grammars stay out of the initial bundle. Fine-grained core + JS regex
 * engine (no WASM) + only the languages Activity needs. One theme made of CSS
 * variables (`--shiki-*` in index.css), so light/dark is a stylesheet concern.
 */
import {
  createCssVariablesTheme,
  createHighlighterCore,
  type HighlighterCore,
} from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'

export const THEME = 'yugotool'

export function createHighlighter(): Promise<HighlighterCore> {
  return createHighlighterCore({
    themes: [
      createCssVariablesTheme({ name: THEME, variablePrefix: '--shiki-', fontStyle: true }),
    ],
    langs: [
      import('shiki/langs/diff.mjs'),
      import('shiki/langs/json.mjs'),
      import('shiki/langs/shellscript.mjs'),
      import('shiki/langs/typescript.mjs'),
      import('shiki/langs/tsx.mjs'),
      import('shiki/langs/javascript.mjs'),
      import('shiki/langs/css.mjs'),
      import('shiki/langs/html.mjs'),
      import('shiki/langs/markdown.mjs'),
      import('shiki/langs/yaml.mjs'),
    ],
    engine: createJavaScriptRegexEngine(),
  })
}
