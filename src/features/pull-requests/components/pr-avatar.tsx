import type { PrActor } from '@/lib/contracts'
import { cn } from '@/lib/utils'

/** A GitHub avatar; the login's initial when there is no image (ghost, teams). */
export function PrAvatar({
  actor,
  className,
}: {
  actor: Pick<PrActor, 'login' | 'avatarUrl'>
  className?: string
}) {
  const base = cn('size-4 shrink-0 rounded-full bg-muted', className)
  if (actor.avatarUrl === '') {
    return (
      <span
        aria-hidden="true"
        className={cn(
          base,
          'flex items-center justify-center text-[0.5625rem] font-semibold uppercase',
        )}
      >
        {actor.login.charAt(0)}
      </span>
    )
  }
  return <img src={actor.avatarUrl} alt="" loading="lazy" className={base} />
}
