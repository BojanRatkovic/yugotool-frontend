/** Languages the lazy highlighter bundles (`ansi` is Shiki's built-in terminal-colour mode). */
export const CODE_LANGS = [
  'diff',
  'json',
  'shellscript',
  'typescript',
  'tsx',
  'javascript',
  'css',
  'html',
  'markdown',
  'yaml',
] as const

export type GrammarLang = (typeof CODE_LANGS)[number]
export type CodeLang = GrammarLang | 'ansi'

const ALIASES: Record<string, CodeLang> = {
  diff: 'diff',
  patch: 'diff',
  json: 'json',
  jsonc: 'json',
  json5: 'json',
  sh: 'shellscript',
  bash: 'shellscript',
  zsh: 'shellscript',
  shell: 'shellscript',
  shellscript: 'shellscript',
  console: 'shellscript',
  ts: 'typescript',
  typescript: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  tsx: 'tsx',
  jsx: 'tsx',
  js: 'javascript',
  javascript: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  css: 'css',
  html: 'html',
  htm: 'html',
  xml: 'html',
  svg: 'html',
  md: 'markdown',
  markdown: 'markdown',
  yaml: 'yaml',
  yml: 'yaml',
  ansi: 'ansi',
}

/** A fence tag (```ts, ```Bash) → a bundled language; null for anything else (renders plain). */
export function normalizeLang(tag: string): CodeLang | null {
  return ALIASES[tag.trim().toLowerCase()] ?? null
}

// oxlint-disable-next-line no-control-regex -- matching terminal escapes is the point
const ANSI_ESCAPE = /\u001B\[[0-9;?]*[A-Za-z]/g

export function hasAnsi(text: string): boolean {
  return text.includes('\u001B[')
}

/** Terminal colour codes removed — what the text reads like without them. */
export function stripAnsi(text: string): string {
  return text.replaceAll(ANSI_ESCAPE, '')
}

function isUnifiedDiff(text: string): boolean {
  const lines = text.split('\n')
  const hunk = lines.some((line) => /^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/.test(line))
  const header =
    lines.some((line) => line.startsWith('diff --git ')) ||
    (lines.some((line) => line.startsWith('--- ')) &&
      lines.some((line) => line.startsWith('+++ ')))
  return hunk && header
}

function isJson(text: string): boolean {
  const trimmed = text.trim()
  if (!/^[{[]/.test(trimmed)) return false
  try {
    JSON.parse(trimmed)
    return true
  } catch {
    // The worker truncates long payloads: still JSON if it opens like an object/array of objects.
    return /^(?:\{\s*"|\[\s*[{["\d])/.test(trimmed)
  }
}

/**
 * The language of a raw output block, by shape: unified diff, JSON, a shell
 * transcript (`$ cmd`), terminal colours. Null = plain text.
 */
export function detectLanguage(text: string): CodeLang | null {
  if (isUnifiedDiff(text)) return 'diff'
  if (isJson(text)) return 'json'
  if (hasAnsi(text)) return 'ansi'
  if (/^\$ \S/.test(text.trimStart())) return 'shellscript'
  return null
}

export type TextPart =
  | { kind: 'text'; text: string }
  | { kind: 'code'; lang: CodeLang | null; code: string }

/**
 * Markdown prose split around fenced code blocks. An unclosed fence (a
 * truncated message) runs to the end.
 */
export function splitFences(text: string): TextPart[] {
  const parts: TextPart[] = []
  const lines = text.split('\n')
  let prose: string[] = []
  let index = 0
  const flushProse = () => {
    const joined = prose.join('\n')
    if (joined.trim() !== '')
      parts.push({ kind: 'text', text: joined.replace(/^\n+|\n+$/g, '') })
    prose = []
  }
  while (index < lines.length) {
    const line = lines[index] ?? ''
    const open = /^\s{0,3}(`{3,}|~{3,})\s*([\w+#.-]*)[^`]*$/.exec(line)
    if (open === null) {
      prose.push(line)
      index += 1
      continue
    }
    const fence = open[1] ?? '```'
    const tag = open[2] ?? ''
    const body: string[] = []
    index += 1
    while (index < lines.length) {
      const inner = lines[index] ?? ''
      if (
        inner.trim().startsWith(fence) &&
        inner.trim().replaceAll(fence[0] ?? '`', '') === ''
      ) {
        index += 1
        break
      }
      body.push(inner)
      index += 1
    }
    flushProse()
    const code = body.join('\n')
    parts.push({
      kind: 'code',
      lang: tag === '' ? detectLanguage(code) : normalizeLang(tag),
      code,
    })
  }
  flushProse()
  return parts
}
