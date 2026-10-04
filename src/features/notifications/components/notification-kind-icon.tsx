import {
  ArrowRightLeft,
  BookX,
  CircleCheck,
  CirclePause,
  CircleX,
  Hand,
  type LucideIcon,
  MessageSquareText,
  OctagonX,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'

import type { NotificationKind } from '@/lib/contracts'
import { cn } from '@/lib/utils'

/**
 * Every kind's icon and status color: waiting on you = violet, broken = failed,
 * done = passed, paused = cancelled. A `Record`, so a new kind fails typecheck.
 */
const KIND_ICONS: Record<NotificationKind, { icon: LucideIcon; className: string }> = {
  gate_waiting: { icon: Hand, className: 'text-status-waiting' },
  review_ready: { icon: MessageSquareText, className: 'text-status-waiting' },
  shift_handoff_ready: { icon: ArrowRightLeft, className: 'text-status-waiting' },
  run_failed: { icon: CircleX, className: 'text-status-failed' },
  ci_failed: { icon: OctagonX, className: 'text-status-failed' },
  shift_stuck: { icon: TriangleAlert, className: 'text-status-failed' },
  knowledge_sync_failed: { icon: BookX, className: 'text-status-failed' },
  run_succeeded: { icon: CircleCheck, className: 'text-status-passed' },
  ci_passed: { icon: ShieldCheck, className: 'text-status-passed' },
  dispatcher_paused: { icon: CirclePause, className: 'text-status-cancelled' },
}

export function NotificationKindIcon({
  kind,
  className,
}: {
  kind: NotificationKind
  className?: string
}) {
  const { icon: Icon, className: color } = KIND_ICONS[kind]
  return <Icon aria-hidden="true" className={cn('size-4 shrink-0', color, className)} />
}
