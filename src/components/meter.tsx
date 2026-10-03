import { cn } from '@/lib/utils'

/**
 * Thin horizontal bar for usage/context/budget. Tone thresholds come from the
 * design brief: passed < warnAt, waiting from warnAt, failed from failAt.
 */
export function Meter({
  value,
  max = 100,
  label,
  warnAt = 70,
  failAt = 90,
  className,
}: {
  value: number
  max?: number
  /** Accessible name, e.g. "5-hour usage". */
  label: string
  warnAt?: number
  failAt?: number
  className?: string
}) {
  const percent = max <= 0 ? 0 : Math.min(100, Math.max(0, (value / max) * 100))
  const tone =
    percent >= failAt
      ? 'bg-status-failed'
      : percent >= warnAt
        ? 'bg-status-waiting'
        : 'bg-status-passed'
  return (
    <div
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- native <meter> can't be themed consistently across browsers
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
      className={cn('h-1 w-full overflow-hidden rounded-full bg-muted', className)}
    >
      <div className={cn('h-full rounded-full', tone)} style={{ width: `${percent}%` }} />
    </div>
  )
}
