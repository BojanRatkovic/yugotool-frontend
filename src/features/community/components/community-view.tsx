import { useQuery } from '@tanstack/react-query'
import { Circle, CircleCheck, ExternalLink } from 'lucide-react'

import { LoadError } from '@/components/data-state'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { communityQueries } from '@/features/community/api/community-queries'
import { COMMUNITY_LABELS, communitySummary } from '@/features/community/utils/community-items'
import type { CommunityStandards } from '@/lib/contracts'
import { cn } from '@/lib/utils'

/** GitHub's Community Standards checklist for the project's repo (spec 0020). Reports only. */
export function CommunityView({ projectId, repo }: { projectId: string; repo?: string }) {
  const standards = useQuery(communityQueries.standards(projectId, repo))

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        <div>
          <h2 className="text-sm font-medium">Community Standards</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            How this repo compares to GitHub&rsquo;s recommended community standards.
          </p>
        </div>
        {standards.isPending ? (
          <Skeleton className="h-64 w-full rounded-lg" />
        ) : standards.error !== null ? (
          <LoadError what="the community standards" message={standards.error.message} />
        ) : (
          <Checklist standards={standards.data} />
        )}
      </div>
    </div>
  )
}

function Checklist({ standards }: { standards: CommunityStandards }) {
  return (
    <>
      <div className="flex items-center gap-3">
        <div
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- native <progress> can't be themed consistently
          role="progressbar"
          aria-label="Community standards health"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={standards.healthPercentage}
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-status-passed transition-[width] duration-150"
            style={{ width: `${standards.healthPercentage}%` }}
          />
        </div>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {standards.healthPercentage}%
        </span>
      </div>

      <p className="text-[0.8125rem] font-medium">{communitySummary(standards.items)}</p>

      <ul className="flex flex-col divide-y rounded-lg border bg-card">
        {standards.items.map((item) => (
          <li key={item.key} className="flex items-center gap-3 px-3 py-2.5">
            {item.present ? (
              <CircleCheck aria-hidden="true" className="size-4 shrink-0 text-status-passed" />
            ) : (
              <Circle aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            )}
            <span className="sr-only">{item.present ? 'Present:' : 'Missing:'}</span>
            <span className="min-w-0 flex-1 truncate text-[0.8125rem]">
              {COMMUNITY_LABELS[item.key]}
            </span>
            {item.present ? (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`View ${COMMUNITY_LABELS[item.key]} on GitHub`}
                className={cn(
                  'shrink-0 rounded-sm p-1 text-muted-foreground hover:text-foreground',
                  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                )}
              >
                <ExternalLink aria-hidden="true" className="size-3.5" />
              </a>
            ) : (
              <Button asChild size="sm" variant="outline" className="shrink-0">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Add ${COMMUNITY_LABELS[item.key]} on GitHub`}
                >
                  Add
                </a>
              </Button>
            )}
          </li>
        ))}
      </ul>

      <p className="text-xs text-muted-foreground">
        Read-only. &ldquo;Add&rdquo; opens the file on GitHub, where you create it.
      </p>
    </>
  )
}
