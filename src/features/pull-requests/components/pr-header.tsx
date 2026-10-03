import {
  Check,
  Copy,
  ExternalLink,
  GitBranch,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft,
  Maximize2,
  Minimize2,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { TONE_SOFT, TONE_TEXT, type Tone } from '@/components/status/status'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { PrAvatar } from '@/features/pull-requests/components/pr-avatar'
import { shortAge } from '@/features/pull-requests/utils/columns'
import { prSize, sizeLabel } from '@/features/pull-requests/utils/size'
import type { PullRequestDetail } from '@/lib/contracts'
import { cn } from '@/lib/utils'

type PrState = 'open' | 'draft' | 'merged' | 'closed'

const STATE: Record<PrState, { label: string; tone: Tone; Icon: LucideIcon }> = {
  open: { label: 'Open', tone: 'running', Icon: GitPullRequest },
  draft: { label: 'Draft', tone: 'queued', Icon: GitPullRequestDraft },
  merged: { label: 'Merged', tone: 'passed', Icon: GitMerge },
  closed: { label: 'Closed', tone: 'cancelled', Icon: GitPullRequestClosed },
}

export function prState(pr: Pick<PullRequestDetail, 'state' | 'isDraft'>): PrState {
  return pr.state === 'open' && pr.isDraft ? 'draft' : pr.state
}

function copyText(text: string, what: string, onDone?: () => void) {
  navigator.clipboard.writeText(text).then(
    () => {
      toast.success(`${what} copied.`)
      onDone?.()
      return undefined
    },
    () => toast.error("Couldn't copy to the clipboard."),
  )
}

/** A branch that copies its name on click. */
function CopyBranch({ branch }: { branch: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      title={`Copy ${branch}`}
      onClick={() =>
        copyText(branch, 'Branch name', () => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        })
      }
      className="inline-flex h-5 max-w-56 min-w-0 shrink items-center gap-1 rounded-sm bg-muted px-1.5 font-mono text-[0.6875rem] whitespace-nowrap text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      {copied ? (
        <Check aria-hidden="true" className="size-3 shrink-0 text-status-passed" />
      ) : (
        <GitBranch aria-hidden="true" className="size-3 shrink-0" />
      )}
      <span className="truncate">{branch}</span>
    </button>
  )
}

function IconAction({
  label,
  hint,
  onClick,
  children,
}: {
  label: string
  hint?: React.ReactNode
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{hint ?? label}</TooltipContent>
    </Tooltip>
  )
}

/**
 * The PR panel's header: title, state, branches, author, age and size, with
 * the situational actions (`actions`) and the panel controls on the right.
 */
export function PrHeader({
  pr,
  full,
  actions,
  onToggleFull,
  onClose,
}: {
  pr: PullRequestDetail
  full: boolean
  /** Review / Ready for review / Merge, depending on whose PR it is. */
  actions?: React.ReactNode
  onToggleFull: () => void
  onClose: () => void
}) {
  const state = STATE[prState(pr)]
  const size = prSize(pr.additions, pr.deletions)
  return (
    <header className="flex items-start gap-3 border-b px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h2 className="text-base leading-6 font-semibold break-words">
          {pr.title}{' '}
          <span className="font-mono text-sm font-normal text-muted-foreground">
            #{pr.number}
          </span>
        </h2>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span
            className={cn(
              'inline-flex h-5 items-center gap-1 rounded-full px-2 font-medium',
              TONE_SOFT[state.tone],
              TONE_TEXT[state.tone],
            )}
          >
            <state.Icon aria-hidden="true" className="size-3" />
            {state.label}
          </span>
          <CopyBranch branch={pr.headRefName} />
          <span aria-hidden="true">→</span>
          <span className="sr-only">into</span>
          <CopyBranch branch={pr.baseRefName} />
          <span className="flex items-center gap-1">
            <PrAvatar actor={pr.author} />
            {pr.author.login}
          </span>
          <span title={new Date(pr.createdAt).toLocaleString()}>
            opened {shortAge(pr.createdAt)} ago
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- reveals +additions −deletions
                tabIndex={0}
                className="rounded-sm bg-muted px-1 font-mono text-[0.6875rem] outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {size}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {sizeLabel(pr.additions, pr.deletions)} · {pr.changedFiles} file
              {pr.changedFiles === 1 ? '' : 's'}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {actions}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" asChild>
              <a
                href={pr.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open on GitHub"
              >
                <ExternalLink aria-hidden="true" />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open on GitHub</TooltipContent>
        </Tooltip>
        <IconAction label="Copy link" onClick={() => copyText(pr.url, 'Link')}>
          <Copy aria-hidden="true" />
        </IconAction>
        <IconAction
          label={full ? 'Show as panel' : 'Expand to full page'}
          onClick={onToggleFull}
        >
          {full ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
        </IconAction>
        <IconAction
          label="Close pull request"
          hint={
            <>
              Close <span className="font-mono">Esc</span>
            </>
          }
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </IconAction>
      </div>
    </header>
  )
}
