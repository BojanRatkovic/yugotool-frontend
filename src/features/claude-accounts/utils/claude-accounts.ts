import type { ClaudeAccount, ClaudeAccountStatus, DiscoveredAccount } from '@/lib/contracts'

/** "team" → "Team plan"; null when unknown. */
export function planLabel(subscriptionType: string | null): string | null {
  if (subscriptionType === null || subscriptionType === '') return null
  return `${subscriptionType.charAt(0).toUpperCase()}${subscriptionType.slice(1)} plan`
}

/** The second line of an account row: who it is, and where it signs in. */
export function accountDetail(account: ClaudeAccount): string {
  if (account.kind === 'api_key')
    return ['API key', account.apiKeyHint].filter(Boolean).join(' · ')
  const who = [account.email, account.orgName, planLabel(account.subscriptionType)]
  return [...who, account.configDir === null ? null : shortPath(account.configDir)]
    .filter(Boolean)
    .join(' · ')
}

export const STATUS_LABEL: Record<ClaudeAccountStatus, string> = {
  signed_in: 'Signed in',
  signed_out: 'Signed out',
  key_rejected: 'Key rejected',
  unknown: 'Unknown',
}

/** `/Users/me/.claude-personal` → `~/.claude-personal` when it is under a home dir. */
export function shortPath(dir: string): string {
  return dir.replace(/^\/(?:Users|home)\/[^/]+(?=\/|$)/, '~')
}

/** Signed-in dirs on this machine that are not added yet: one click adds them. */
export function addableDirs(found: DiscoveredAccount[]): DiscoveredAccount[] {
  return found.filter((dir) => dir.loggedIn && dir.accountId === null)
}
