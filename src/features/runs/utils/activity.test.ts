import { describe, expect, it } from 'vitest'

import {
  activityItems,
  compareCaption,
  parseBrowserCall,
  logTail,
  parseImageEvent,
  splitErrorMessage,
  splitSystemMessage,
  parseToolCall,
  relativize,
  toolInputJson,
  turnsFromResult,
} from '@/features/runs/utils/activity'
import type { RunEvent } from '@/lib/contracts'

const WT = '/Users/me/.yugotool/worktrees/abc'

describe('parseToolCall', () => {
  it('relativizes file paths', () => {
    expect(parseToolCall(`Read {"file_path":"${WT}/src/math.js"}`, WT)).toEqual({
      tool: 'Read',
      summary: 'src/math.js',
    })
  })

  it('reads the command from Bash', () => {
    expect(parseToolCall('Bash {"command":"npm test"}', WT)).toEqual({
      tool: 'Bash',
      summary: 'npm test',
    })
  })

  it('survives truncated JSON', () => {
    const message = `Edit {"replace_all":false,"file_path":"${WT}/math.js","old_string":"export function add(a, b) {\\n  ret`
    expect(parseToolCall(message, WT)).toEqual({ tool: 'Edit', summary: 'math.js' })
  })

  it('treats checks commands as shell', () => {
    expect(parseToolCall('$ npm test', WT)).toEqual({ tool: '$', summary: 'npm test' })
  })

  it('summarizes the QA plan instead of showing its JSON', () => {
    const plan =
      'StructuredOutput {"screens":[{"name":"About page","path":"/about.html","reason":"Verify the \\"About\\" heading"},{"name":"Home","path":"/","reason":"no regression"}],"scenarios":[]}'
    expect(parseToolCall(plan, WT).summary).toBe(
      'Planned 2 screens: About page (/about.html), Home (/)',
    )
    // Truncated by the worker: the complete screens still count.
    expect(
      parseToolCall('StructuredOutput {"screens":[{"name":"Home","path":"/","reason":"lo', WT)
        .summary,
    ).toBe('Planned 1 screen: Home (/)')
  })

  it('summarizes structured verdicts', () => {
    expect(parseToolCall('StructuredOutput {"verdict":"pass","summary":"ok', WT).summary).toBe(
      'verdict: pass',
    )
  })
})

describe('relativize', () => {
  it('replaces the bare root with a dot', () => {
    expect(relativize(`Workspace ready: ${WT} (branch)`, WT)).toBe(
      'Workspace ready: . (branch)',
    )
  })
})

describe('turnsFromResult', () => {
  it('extracts the turn count', () => {
    expect(turnsFromResult('success · 8 turns · $0.0757')).toBe(8)
    expect(turnsFromResult('error')).toBeNull()
  })
})

describe('parseBrowserCall', () => {
  it('condenses Playwright MCP calls', () => {
    expect(
      parseBrowserCall('mcp__playwright__browser_click {"element":"Submit button","ref":"e5"}'),
    ).toEqual({ action: 'click', target: 'Submit button' })
    expect(
      parseBrowserCall('mcp__playwright__browser_navigate {"url":"http://localhost:4300/"}'),
    ).toEqual({ action: 'open', target: '/' })
    expect(
      parseBrowserCall('mcp__playwright__browser_take_screenshot {"filename":"a.png"}'),
    ).toEqual({ action: 'screenshot', target: '' })
    expect(
      parseBrowserCall(
        'mcp__playwright__browser_type {"element":"Email","ref":"e2","text":"a@b.co"}',
      ),
    ).toEqual({ action: 'type', target: 'Email · “a@b.co”' })
  })

  it('reads selector targets as text', () => {
    expect(
      parseBrowserCall('mcp__playwright__browser_click {"target":"a:has-text(\\"About\\")"}'),
    ).toEqual({ action: 'click', target: 'About' })
    expect(parseBrowserCall('mcp__playwright__browser_hover {"target":"#menu"}')).toEqual({
      action: 'hover',
      target: '#menu',
    })
  })

  it('survives truncated JSON and unknown tools', () => {
    expect(
      parseBrowserCall(
        'mcp__playwright__browser_navigate {"url":"http://x.test/settings?tab=a',
      ),
    ).toEqual({ action: 'open', target: '/settings?tab=a' })
    expect(parseBrowserCall('mcp__playwright__browser_tab_list')).toEqual({
      action: 'tab list',
      target: '',
    })
  })

  it('ignores every other tool', () => {
    expect(parseBrowserCall('Read {"file_path":"a.ts"}')).toBeNull()
  })
})

function event(type: RunEvent['type'], message: string, seq: number): RunEvent {
  return {
    id: crypto.randomUUID(),
    runId: crypto.randomUUID(),
    stationRunId: null,
    seq,
    type,
    message,
    createdAt: '2026-10-03T10:00:00.000Z',
  }
}

const CHECK = '7f0f9a3e-3c34-4d0e-9a5e-3f5b8d6c1a01'
const OTHER = '7f0f9a3e-3c34-4d0e-9a5e-3f5b8d6c1a02'
const image = (role: string, checkId: string | null, caption = `Home · ${role}`) =>
  JSON.stringify({ file: `qa/1/home-${role}.png`, caption, role, checkId })

describe('activityItems', () => {
  it('folds base/pr/diff of one check into one row', () => {
    const items = activityItems([
      event('image', image('pr', CHECK), 1),
      event('image', image('base', CHECK), 2),
      event('image', image('diff', CHECK), 3),
      event('image', image('base', OTHER), 4),
      event('image', image('agent', null), 5),
      event('text', 'done', 6),
    ])
    expect(
      items.map((item) =>
        item.type === 'images' ? item.images.map((i) => i.role) : item.type,
      ),
    ).toEqual([['base', 'pr', 'diff'], ['base'], ['agent'], 'event'])
  })

  it('keeps an unparsable image as a plain event', () => {
    expect(activityItems([event('image', 'not json', 1)])[0]?.type).toBe('event')
  })

  it('drops the role word from a folded caption', () => {
    const items = activityItems([
      event('image', image('base', CHECK, 'Home · desktop · light · base'), 1),
    ])
    const first = items[0]
    expect(first?.type === 'images' ? compareCaption(first.images) : null).toBe(
      'Home · desktop · light',
    )
    expect(parseImageEvent(image('pr', CHECK))?.role).toBe('pr')
  })
})

describe('QA rows', () => {
  it('shortens artifact paths', () => {
    expect(
      parseToolCall(
        'Read {"file_path":"/Users/me/.yugotool/artifacts/387b6ede-fce3-446a-b4eb-df6cc3aae64c/qa/1/home-pr.png"}',
        WT,
      ).summary,
    ).toBe('qa/1/home-pr.png')
  })
})

describe('error messages', () => {
  it('keeps short errors whole and splits long ones', () => {
    expect(splitErrorMessage('Boom\nwhy')).toEqual({ head: 'Boom\nwhy', log: null })
    expect(splitErrorMessage('Boom\n\na\nb\nc')).toEqual({ head: 'Boom', log: 'a\nb\nc' })
  })

  it('reads the log tail after the first blank line', () => {
    expect(logTail('Preview failed: exit 1\n\n$ node server.js\nEADDRINUSE\n')).toBe(
      '$ node server.js\nEADDRINUSE',
    )
    expect(logTail('Preview failed: exit 1')).toBeNull()
  })
})

describe('splitSystemMessage', () => {
  it('keeps a plain line as the head', () => {
    expect(splitSystemMessage('Session abc · started')).toEqual({
      head: 'Session abc · started',
      notes: [],
      output: null,
    })
  })

  it('lifts labelled prose lines out of the output', () => {
    const message =
      'Changed: Projects · desktop · dark · 1.20% changed\nWhy: The diff touches the project list header.'
    expect(splitSystemMessage(message)).toEqual({
      head: 'Changed: Projects · desktop · dark · 1.20% changed',
      notes: ['Why: The diff touches the project list header.'],
      output: null,
    })
  })

  it('leaves log-like lines as output', () => {
    expect(splitSystemMessage('Install failed\n  at foo (bar.js:1)\nERR_X')).toEqual({
      head: 'Install failed',
      notes: [],
      output: '  at foo (bar.js:1)\nERR_X',
    })
  })
})

describe('toolInputJson', () => {
  it('pretty-prints multi-field inputs', () => {
    expect(toolInputJson('StructuredOutput {"verdict":"pass","summary":"ok"}')).toBe(
      '{\n  "verdict": "pass",\n  "summary": "ok"\n}',
    )
  })

  it('skips single-field inputs and non-JSON calls', () => {
    expect(toolInputJson('Read {"file_path":"a.ts"}')).toBeNull()
    expect(toolInputJson('$ npm test')).toBeNull()
  })

  it('returns long truncated JSON raw', () => {
    const truncated = `Edit {"file_path":"a.ts","old_string":"${'x'.repeat(100)}`
    expect(toolInputJson(truncated)).toBe(truncated.slice(5))
  })
})
