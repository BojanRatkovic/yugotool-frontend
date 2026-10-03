import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MODELS, effortSchema, type Effort } from '@/lib/contracts'

/** Radix Select can't hold an empty value, so "inherit" gets a sentinel. */
const DEFAULT = '__default'

export function modelLabel(id: string): string {
  return MODELS.find((model) => model.id === id)?.label ?? id
}

/**
 * Model picker. With `defaultLabel`, null means "inherit" (shown under that
 * label); without it a model is required. An id outside MODELS stays selectable.
 */
export function ModelSelect({
  id,
  value,
  onChange,
  defaultLabel,
  disabled,
}: {
  id: string
  value: string | null
  onChange: (value: string | null) => void
  defaultLabel?: string
  disabled?: boolean
}) {
  const known = MODELS.some((model) => model.id === value)
  return (
    <Select
      value={value ?? DEFAULT}
      onValueChange={(next) => onChange(next === DEFAULT ? null : next)}
      disabled={disabled}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper">
        {defaultLabel === undefined ? null : (
          <SelectItem value={DEFAULT}>{defaultLabel}</SelectItem>
        )}
        {MODELS.map((model) => (
          <SelectItem key={model.id} value={model.id}>
            {model.label}
            <span className="font-mono text-xs text-muted-foreground">{model.id}</span>
          </SelectItem>
        ))}
        {value === null || known ? null : (
          <SelectItem value={value}>
            <span className="font-mono">{value}</span>
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  )
}

export function EffortSelect({
  id,
  value,
  onChange,
  defaultLabel,
  disabled,
}: {
  id: string
  value: Effort | null
  onChange: (value: Effort | null) => void
  defaultLabel: string
  disabled?: boolean
}) {
  return (
    <Select
      value={value ?? DEFAULT}
      onValueChange={(next) => onChange(next === DEFAULT ? null : effortSchema.parse(next))}
      disabled={disabled}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper">
        <SelectItem value={DEFAULT}>{defaultLabel}</SelectItem>
        {effortSchema.options.map((effort) => (
          <SelectItem key={effort} value={effort}>
            {effort}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** "" ↔ null for optional positive USD inputs. Returns undefined when unparsable. */
export function parseBudget(raw: string): number | null | undefined {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : undefined
}
