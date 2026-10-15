import type { CommunityStandardItem, CommunityStandardKey } from '@/lib/contracts'

/** GitHub's label for each standard, matching its Community Standards page. */
export const COMMUNITY_LABELS: Record<CommunityStandardKey, string> = {
  description: 'Description',
  readme: 'README',
  code_of_conduct: 'Code of conduct',
  contributing: 'Contributing',
  license: 'License',
  security_policy: 'Security policy',
  issue_template: 'Issue templates',
  pull_request_template: 'Pull request template',
}

/** "6 of 8 complete", for the summary line above the checklist. */
export function communitySummary(items: Pick<CommunityStandardItem, 'present'>[]): string {
  const have = items.filter((item) => item.present).length
  return `${have} of ${items.length} complete`
}
