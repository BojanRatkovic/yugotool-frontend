import { GitBranch } from 'lucide-react'

import { cn } from '@/lib/utils'

/** `⑂ main` — a git branch as a compact muted mono chip. Never wraps; long names truncate. */
export function BranchChip({ branch, className }: { branch: string; className?: string }) {
  return (
    <span
      title={branch}
      className={cn(
        'inline-flex h-5 max-w-48 min-w-0 shrink-0 items-center gap-1 rounded-sm bg-muted px-1.5 font-mono text-[0.6875rem] whitespace-nowrap text-muted-foreground',
        className,
      )}
    >
      <GitBranch aria-hidden="true" className="size-3 shrink-0" />
      <span className="truncate">{branch}</span>
    </span>
  )
}
