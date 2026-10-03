import {
  Bot,
  GitCommitHorizontal,
  Repeat,
  ScanEye,
  ShieldCheck,
  SquareTerminal,
  type LucideIcon,
} from 'lucide-react'

import { REPO_HOOKS_STATION_KEY, type Station } from '@/lib/contracts'
import { cn } from '@/lib/utils'

const ICON: Record<Station['kind'], LucideIcon> = {
  agent: Bot,
  gate: ShieldCheck,
  checks: SquareTerminal,
  shift: Repeat,
  qa: ScanEye,
}

export const STATION_KIND_LABEL: Record<Station['kind'], string> = {
  agent: 'Agent',
  gate: 'Gate',
  checks: 'Checks',
  shift: 'Shifts',
  qa: 'QA',
}

/** One line on what each station kind does (add buttons, board column headers). */
export const STATION_KIND_HINT: Record<Station['kind'], string> = {
  agent: 'One Claude session does a job (build, review, research).',
  shift: 'A long job in several sessions with handoffs between them.',
  gate: 'Waits for a human to approve, request changes or reject.',
  checks: 'Runs a shell command (tests, lint); fails the run on a non-zero exit.',
  qa: 'Boots the app on base and branch, screenshots both and judges the difference.',
}

/** Stations that run Claude sessions: they have a model, cost and a context window. */
export function runsSessions(kind: Station['kind']): kind is 'agent' | 'shift' | 'qa' {
  return kind === 'agent' || kind === 'shift' || kind === 'qa'
}

export function StationIcon({
  kind,
  stationKey,
  className,
}: {
  kind: Station['kind']
  /** The repo-hooks preflight (a synthesized `checks` step) gets its own icon. */
  stationKey?: string
  className?: string
}) {
  const Icon = stationKey === REPO_HOOKS_STATION_KEY ? GitCommitHorizontal : ICON[kind]
  return <Icon aria-hidden="true" className={cn('size-3.5 shrink-0', className)} />
}
