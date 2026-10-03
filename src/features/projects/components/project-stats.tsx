import { useQuery } from '@tanstack/react-query'

import { Cost } from '@/components/cost'
import { statsQueries } from '@/features/projects/api/stats-queries'
import type { AuthSource } from '@/lib/contracts'

/** "$1.63 est. · 5 runs · 2 done". Silent while loading or when the endpoint fails. */
export function ProjectStats({
  projectId,
  authSource,
}: {
  projectId: string
  authSource: AuthSource | undefined
}) {
  const { data } = useQuery(statsQueries.project(projectId))
  if (data === undefined) return null
  return (
    <p className="flex shrink-0 items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground">
      <Cost usd={data.costUsd} authSource={authSource} className="text-foreground" />
      <span aria-hidden="true">·</span>
      <span className="tabular-nums">
        {data.runs} {data.runs === 1 ? 'run' : 'runs'}
      </span>
      <span aria-hidden="true">·</span>
      <span className="tabular-nums">{data.done} done</span>
    </p>
  )
}
