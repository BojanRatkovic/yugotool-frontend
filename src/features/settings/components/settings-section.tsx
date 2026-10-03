import { Eye, EyeOff } from 'lucide-react'
import { useState, type ComponentProps, type ReactNode } from 'react'

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'

function firstError(errors: readonly unknown[]): string | null {
  const first = errors[0]
  if (typeof first === 'string') return first
  if (typeof first === 'object' && first !== null && 'message' in first) {
    return String(first.message)
  }
  return null
}

export function Section({
  title,
  description,
  children,
}: {
  title: string
  description: ReactNode
  children: ReactNode
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-[0.8125rem] text-muted-foreground">{description}</p>
      </div>
      <div className="divide-y rounded-lg border bg-card">{children}</div>
    </section>
  )
}

/** One setting: label + help on the left, control on the right, error under the control. */
export function Row({
  id,
  label,
  help,
  errors = [],
  children,
  after,
}: {
  id: string
  label: string
  help?: ReactNode
  errors?: readonly unknown[]
  children: ReactNode
  /** Rendered under the error, e.g. a "Send test" button. */
  after?: ReactNode
}) {
  const error = firstError(errors)
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,20rem)] items-start gap-6 px-4 py-3">
      <div className="flex min-w-0 flex-col gap-0.5 pt-1">
        <Label htmlFor={id} className="text-[0.8125rem]">
          {label}
        </Label>
        {help === undefined ? null : <p className="text-xs text-muted-foreground">{help}</p>}
      </div>
      <div className="flex min-w-0 flex-col items-end gap-1">
        {children}
        {error === null ? null : (
          <p id={`${id}-error`} className="text-xs text-destructive">
            {error}
          </p>
        )}
        {after}
      </div>
    </div>
  )
}

export function invalidProps(id: string, errors: readonly unknown[]) {
  return firstError(errors) === null
    ? {}
    : { 'aria-invalid': true as const, 'aria-describedby': `${id}-error` }
}

/** Password input with a show/hide toggle; `what` names it for the toggle's label. */
export function SecretInput({
  id,
  value,
  onChange,
  onBlur,
  placeholder,
  what = 'token',
  inputProps,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  placeholder?: string
  what?: string
  inputProps?: ComponentProps<'input'>
}) {
  const [revealed, setRevealed] = useState(false)
  return (
    <InputGroup className="h-8">
      <InputGroupInput
        id={id}
        type={revealed ? 'text' : 'password'}
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className="font-mono text-xs"
        {...inputProps}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-xs"
          aria-label={revealed ? `Hide ${what}` : `Show ${what}`}
          aria-pressed={revealed}
          onClick={() => setRevealed((shown) => !shown)}
        >
          {revealed ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}
