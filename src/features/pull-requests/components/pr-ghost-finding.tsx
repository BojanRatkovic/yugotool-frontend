import { LoaderCircle, ScanSearch, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { usePostZastavaFindings } from '@/features/pull-requests/api/pr-mutations'
import { ReviewText } from '@/features/pull-requests/components/review-text'
import { errorMessage } from '@/lib/api-client'
import type { ReviewFinding } from '@/lib/contracts'
import { cn } from '@/lib/utils'

const SEVERITY_TEXT: Record<ReviewFinding['severity'], string> = {
  critical: 'text-status-failed',
  important: 'text-status-waiting',
  minor: 'text-muted-foreground',
}

/**
 * A ZASTAVA finding not posted yet, drawn under its line like a comment
 * (spec 0009): dashed until you add it to your pending review or dismiss it.
 */
export function PrGhostFinding({
  projectId,
  number,
  finding,
  onDismiss,
}: {
  projectId: string
  number: number
  finding: ReviewFinding
  onDismiss: () => void
}) {
  const post = usePostZastavaFindings(projectId, number)
  return (
    <article
      aria-label={`ZASTAVA finding: ${finding.title}`}
      className="flex flex-col gap-1.5 rounded-md border border-dashed bg-card/60 px-3 py-2 font-sans text-[0.8125rem]"
    >
      <header className="flex items-center gap-2">
        <ScanSearch aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
        <span className={cn('text-[0.6875rem] font-medium', SEVERITY_TEXT[finding.severity])}>
          {finding.severity}
        </span>
        <span className="min-w-0 flex-1 truncate font-medium">{finding.title}</span>
        <Button
          size="xs"
          variant="outline"
          disabled={post.isPending}
          onClick={() =>
            post.mutate(
              {
                findings: [
                  {
                    id: finding.id,
                    title: finding.title,
                    body: finding.body,
                    suggestion: finding.suggestion,
                  },
                ],
              },
              {
                onSuccess: () => toast.success('Added to your pending review.'),
                onError: (error) => toast.error(errorMessage(error)),
              },
            )
          }
        >
          {post.isPending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
          Add to review
        </Button>
        <Button size="icon-xs" variant="ghost" aria-label="Dismiss finding" onClick={onDismiss}>
          <X aria-hidden="true" />
        </Button>
      </header>
      <ReviewText text={finding.body} className="text-muted-foreground" />
      {finding.suggestion === null ? null : (
        <pre className="overflow-x-auto rounded-sm bg-muted px-2 py-1 font-mono text-xs">
          {finding.suggestion}
        </pre>
      )}
    </article>
  )
}
