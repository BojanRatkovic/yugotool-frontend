// Pure helpers behind `/` skill autocomplete (spec 0015).
import type { ProjectSkill } from '@/lib/contracts'

/** The `/word` being typed at the caret: where its `/` is and what follows. */
export interface SlashToken {
  start: number
  query: string
}

/**
 * The `/` token the caret ends, when it starts the text or follows
 * whitespace (so `src/app` or a URL never opens the menu). Null otherwise.
 */
export function slashToken(text: string, caret: number): SlashToken | null {
  const before = text.slice(0, caret)
  const match = /(?:^|\s)\/([\w.:-]*)$/.exec(before)
  if (!match) return null
  const query = match[1] ?? ''
  return { start: caret - query.length - 1, query }
}

/**
 * Skills matching `query`, best first: name starts with it, then any part
 * (plugin or name) does, then it appears in the invocation or description.
 */
export function filterSkills(skills: readonly ProjectSkill[], query: string): ProjectSkill[] {
  const q = query.toLowerCase()
  if (!q) return [...skills]
  const rank = (skill: ProjectSkill): number => {
    const invocation = skill.invocation.toLowerCase()
    const name = invocation.split(':').pop() ?? invocation
    if (name.startsWith(q)) return 0
    if (invocation.startsWith(q) || invocation.split(/[:-]/).some((part) => part.startsWith(q)))
      return 1
    if (invocation.includes(q)) return 2
    if (skill.description.toLowerCase().includes(q)) return 3
    return -1
  }
  return skills
    .map((skill) => ({ skill, rank: rank(skill) }))
    .filter((entry) => entry.rank >= 0)
    .toSorted((a, b) => a.rank - b.rank)
    .map((entry) => entry.skill)
}

/** `/invocation ` in place of the token; the caret lands after the space. */
export function insertSkill(
  text: string,
  token: SlashToken,
  caret: number,
  invocation: string,
): { text: string; caret: number } {
  const inserted = `/${invocation} `
  // Swallow a space already after the caret so we never leave two.
  const rest = text.slice(caret).replace(/^ /, '')
  return {
    text: text.slice(0, token.start) + inserted + rest,
    caret: token.start + inserted.length,
  }
}

/** Removes every `/invocation` mention (and one space after it). */
export function removeMention(text: string, invocation: string): string {
  const escaped = invocation.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
  return text.replaceAll(
    new RegExp(String.raw`(^|\s)/${escaped}(?![\w/:-]|\.[\w-]) ?`, 'g'),
    '$1',
  )
}

/**
 * `/plugin:skill` mentions this project has no skill for (a renamed or
 * removed one). Only the `plugin:skill` form counts: a bare `/health` is
 * just as likely an endpoint as a skill.
 */
export function unknownMentions(text: string, known: readonly string[]): string[] {
  const names = new Set(known)
  const found: string[] = []
  for (const match of text.matchAll(
    /(?:^|\s)\/([\w-]+(?:\.[\w-]+)*:[\w-]+(?:\.[\w-]+)*)(?![\w/:-]|\.[\w-])/g,
  )) {
    const name = match[1]
    if (name !== undefined && !names.has(name) && !found.includes(name)) found.push(name)
  }
  return found
}

/** The menu heading a skill sits under. */
export function skillGroup(skill: ProjectSkill): string {
  if (skill.source === 'hub') return 'Hub'
  return skill.repo === null ? 'This repo' : `Repo · ${skill.repo}`
}
