import { Eye, EyeOff } from 'lucide-react'
import { useState, type ComponentProps, type ReactNode } from 'react'

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

function firstError(errors: readonly unknown[]): string | null {
  const first = errors[0]
  if (typeof first === 'string') return first
  if (typeof first === 'object' && first !== null && 'message' in first) {
    return String(first.message)
  }
  return null
}

/**
 * A settings page's column. `flush` drops the bottom padding for pages that end
 * in a sticky Save bar, which must sit on the scroll column's bottom edge.
 */
export function SettingsPage({
  flush = false,
  children,
}: {
  flush?: boolean
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'mx-auto flex min-h-full w-full max-w-3xl flex-col gap-8 px-4 pt-6 sm:px-6',
        !flush && 'pb-12',
      )}
    >
      {children}
    </div>
  )
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

/**
 * One setting: label + help on the left, control on the right, error under the
 * control. Under 640px the control drops below the label at full width, unless
 * `inline` (a switch) keeps it beside the label.
 */
export function Row({
  id,
  label,
  help,
  errors = [],
  children,
  after,
  labelIcon,
  inline = false,
}: {
  id: string
  label: string
  help?: ReactNode
  errors?: readonly unknown[]
  children: ReactNode
  /** Rendered under the error, e.g. a "Send test" button. */
  after?: ReactNode
  /** Small icon before the label. */
  labelIcon?: ReactNode
  /** A compact control (switch) that stays beside the label on narrow screens. */
  inline?: boolean
}) {
  const error = firstError(errors)
  return (
    <div
      className={cn(
        'grid items-start px-4 py-3',
        inline
          ? 'grid-cols-[minmax(0,1fr)_auto] gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] sm:gap-6'
          : 'grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] sm:gap-6',
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5 sm:pt-1">
        <Label htmlFor={id} className="text-[0.8125rem]">
          {labelIcon}
          {label}
        </Label>
        {help === undefined ? null : <p className="text-xs text-muted-foreground">{help}</p>}
      </div>
      <div
        className={cn(
          'flex min-w-0 flex-col gap-1',
          inline ? 'items-end pt-1 sm:pt-0' : 'items-start sm:items-end',
        )}
      >
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
