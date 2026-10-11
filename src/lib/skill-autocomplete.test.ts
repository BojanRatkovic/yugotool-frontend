import { describe, expect, it } from 'vitest'

import { skillMentions, type ProjectSkill } from '@/lib/contracts'
import {
  filterSkills,
  insertSkill,
  removeMention,
  skillGroup,
  slashToken,
  unknownMentions,
} from '@/lib/skill-autocomplete'

const skill = (
  invocation: string,
  description = '',
  repo: string | null = null,
): ProjectSkill => ({
  invocation,
  description,
  source: invocation.includes(':') ? 'hub' : 'repo',
  repo,
})
const skills = [
  skill('work:development', 'Git worktree workflow'),
  skill('repos:rails-way', 'Rails idioms'),
  skill('copy', 'Microcopy rules', 'frontend'),
]

describe('/ skill autocomplete (spec 0015)', () => {
  it('opens only for a / that starts the text or follows whitespace', () => {
    expect(slashToken('/', 1)).toEqual({ start: 0, query: '' })
    expect(slashToken('Fix it. /rai', 12)).toEqual({ start: 8, query: 'rai' })
    expect(slashToken('see\n/work:dev', 13)).toEqual({ start: 4, query: 'work:dev' })
    expect(slashToken('src/app', 7)).toBeNull()
    expect(slashToken('https://x.io/a', 14)).toBeNull()
    expect(slashToken('/rails done', 11)).toBeNull()
  })

  it('ranks name prefixes first, then parts, then descriptions', () => {
    expect(filterSkills(skills, '').map((s) => s.invocation)).toEqual([
      'work:development',
      'repos:rails-way',
      'copy',
    ])
    expect(filterSkills(skills, 'rai').map((s) => s.invocation)).toEqual(['repos:rails-way'])
    expect(filterSkills(skills, 'repos').map((s) => s.invocation)).toEqual(['repos:rails-way'])
    expect(filterSkills(skills, 'microcopy').map((s) => s.invocation)).toEqual(['copy'])
    expect(filterSkills(skills, 'zzz')).toEqual([])
  })

  it('inserts the invocation with one trailing space and puts the caret after it', () => {
    const text = 'Use /rai please'
    const token = slashToken(text, 8)!
    expect(insertSkill(text, token, 8, 'repos:rails-way')).toEqual({
      text: 'Use /repos:rails-way please',
      caret: 21,
    })
    expect(insertSkill('/', slashToken('/', 1)!, 1, 'copy')).toEqual({
      text: '/copy ',
      caret: 6,
    })
  })

  it('finds, removes and flags mentions', () => {
    const known = skills.map((s) => s.invocation)
    const text = 'Follow /work:development and /copy, not src/copy or /gone:skill or /health.'
    expect(skillMentions(text, known)).toEqual(['work:development', 'copy'])
    expect(unknownMentions(text, known)).toEqual(['gone:skill'])
    expect(removeMention(text, 'work:development')).toBe(
      'Follow and /copy, not src/copy or /gone:skill or /health.',
    )
    expect(skillMentions('Follow /copy. Then /work:development, and /copy.md', known)).toEqual([
      'copy',
      'work:development',
    ])
    expect(unknownMentions('See /gone:skill.', known)).toEqual(['gone:skill'])
    expect(skillGroup(skills[0])).toBe('Hub')
    expect(skillGroup(skills[2])).toBe('Repo · frontend')
    expect(skillGroup(skill('copy'))).toBe('This repo')
  })
})
