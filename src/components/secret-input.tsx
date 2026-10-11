import { Eye, EyeOff } from 'lucide-react'
import { useState, type ComponentProps } from 'react'

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'

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
