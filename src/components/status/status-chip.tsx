import {
  Ban,
  CircleCheck,
  CircleDashed,
  CircleMinus,
  CircleSlash,
  CircleX,
  Clock,
  LoaderCircle,
  MessageSquareReply,
  type LucideIcon,
} from 'lucide-react'

import {
  STATUS_LABEL,
  TONE,
  TONE_SOFT,
  TONE_TEXT,
  type AnyStatus,
} from '@/components/status/status'
import { cn } from '@/lib/utils'

const ICON: Record<AnyStatus, LucideIcon> = {
  backlog: CircleDashed,
  queued: CircleDashed,
  running: LoaderCircle,
  awaiting_approval: Clock,
  changes_requested: MessageSquareReply,
  done: CircleCheck,
  succeeded: CircleCheck,
  failed: CircleX,
  rejected: Ban,
  cancelled: CircleSlash,
  skipped: CircleMinus,
}

/** Status shape: icon only. Color is never the only signal — pair with a word or label. */
export function StatusIcon({
  status,
  className,
  label,
}: {
  status: AnyStatus
  className?: string
  /** Accessible name when the icon stands alone. */
  label?: string
}) {
  const Icon = ICON[status]
  return (
    <Icon
      aria-hidden={label === undefined ? true : undefined}
      aria-label={label}
      role={label === undefined ? undefined : 'img'}
      className={cn(
        'size-3.5 shrink-0',
        TONE_TEXT[TONE[status]],
        status === 'running' && 'animate-spin [animation-duration:1.6s]',
        className,
      )}
    />
  )
}

/** Icon + word + color: the one status vocabulary for work orders, runs and stations. */
export function StatusChip({
  status,
  label,
  className,
  variant = 'soft',
}: {
  status: AnyStatus
  /** Override the word (e.g. "Waiting" for a gate station). */
  label?: string
  className?: string
  /** `soft` = tinted chip; `plain` = icon + word, no fill (dense rows). */
  variant?: 'soft' | 'plain'
}) {
  const tone = TONE[status]
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center gap-1 rounded-full text-[0.6875rem] leading-none font-medium whitespace-nowrap',
        variant === 'soft' ? cn('px-1.5 pr-2', TONE_SOFT[tone]) : 'px-0',
        TONE_TEXT[tone],
        className,
      )}
    >
      <StatusIcon status={status} className="size-3" />
      {label ?? STATUS_LABEL[status]}
    </span>
  )
}
