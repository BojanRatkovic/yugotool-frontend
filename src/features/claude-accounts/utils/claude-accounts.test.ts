import { describe, expect, it } from 'vitest'

import {
  accountDetail,
  addableDirs,
  planLabel,
  projectAccount,
  shortEmail,
  shortPath,
} from '@/features/claude-accounts/utils/claude-accounts'
import type { ClaudeAccount } from '@/lib/contracts'

function account(patch: Partial<ClaudeAccount>): ClaudeAccount {
  return {
    id: crypto.randomUUID(),
    label: 'Work',
    kind: 'config_dir',
    configDir: '/Users/bojan/.claude',
    apiKeyHint: null,
    email: 'bojan@acme.io',
    orgName: 'Acme',
    subscriptionType: 'team',
    managed: false,
    isDefault: false,
    status: 'signed_in',
    createdAt: '2026-10-11T12:00:00.000Z',
    ...patch,
  }
}

describe('claude account rows (spec 0016)', () => {
  it('names the plan', () => {
    expect(planLabel('max')).toBe('Max plan')
    expect(planLabel(null)).toBeNull()
  })

  it('describes a login by who, org, plan and dir; a key by its hint', () => {
    expect(accountDetail(account({}))).toBe('bojan@acme.io · Acme · Team plan · ~/.claude')
    expect(
      accountDetail(
        account({ kind: 'api_key', configDir: null, apiKeyHint: 'sk-ant-…x7Qd', email: null }),
      ),
    ).toBe('API key · sk-ant-…x7Qd')
  })

  it('shortens home paths only', () => {
    expect(shortPath('/Users/me/.zastava/accounts/a')).toBe('~/.zastava/accounts/a')
    expect(shortPath('/home/me')).toBe('~')
    expect(shortPath('/opt/claude')).toBe('/opt/claude')
  })

  it('offers only signed-in dirs that are not added yet', () => {
    const found = [
      {
        configDir: '/u/.claude',
        loggedIn: true,
        email: 'a',
        orgName: null,
        subscriptionType: null,
        accountId: 'x',
      },
      {
        configDir: '/u/.claude-p',
        loggedIn: true,
        email: 'b',
        orgName: null,
        subscriptionType: null,
        accountId: null,
      },
      {
        configDir: '/u/.claude-e',
        loggedIn: false,
        email: null,
        orgName: null,
        subscriptionType: null,
        accountId: null,
      },
    ]
    expect(addableDirs(found).map((d) => d.configDir)).toEqual(['/u/.claude-p'])
  })
})

describe('project account chip (spec 0016)', () => {
  it('shortens an email to user@domain', () => {
    expect(shortEmail('ana@acme.io')).toBe('ana@acme')
    expect(shortEmail('nobody')).toBe('nobody')
  })

  it('shows only an account that is not the default', () => {
    const own = account({ id: 'a' })
    const fallback = account({ id: 'b', isDefault: true })
    expect(projectAccount([own, fallback], 'a')).toBe(own)
    expect(projectAccount([own, fallback], 'b')).toBeNull()
    expect(projectAccount([own, fallback], null)).toBeNull()
    expect(projectAccount([own, fallback], 'gone')).toBeNull()
  })
})
