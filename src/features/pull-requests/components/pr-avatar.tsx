import { useState } from 'react'

import type { PrActor } from '@/lib/contracts'
import { cn } from '@/lib/utils'

/** A GitHub avatar; the login's initial when there is no image or it fails to load. */
export function PrAvatar({
  actor,
  className,
}: {
  actor: Pick<PrActor, 'login' | 'avatarUrl'>
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const base = cn('size-4 shrink-0 rounded-full bg-muted', className)
  if (actor.avatarUrl === '' || failed) {
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
  return (
    <img
      src={actor.avatarUrl}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={base}
    />
  )
}
