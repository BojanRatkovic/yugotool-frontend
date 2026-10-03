import type { ReactNode } from 'react'

import { Label } from '@/components/ui/label'

/** Label + control + first validation error. Shared by every TanStack Form field. */
export function FormField({
  id,
  label,
  errors,
  children,
}: {
  id: string
  label: string
  errors: readonly unknown[]
  children: ReactNode
}) {
  const first = errors[0]
  const message =
    typeof first === 'string'
      ? first
      : typeof first === 'object' && first !== null && 'message' in first
        ? String(first.message)
        : null
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {message === null ? null : (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {message}
        </p>
      )}
    </div>
  )
}
