import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

const THEMES = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'Auto', Icon: Monitor },
] as const

/** Light, dark, or Auto (follows the system). Saved in this browser by next-themes. */
export function ThemePicker({ id }: { id?: string }) {
  const { theme, setTheme } = useTheme()
  return (
    <ToggleGroup
      id={id}
      type="single"
      aria-label="Color theme"
      variant="outline"
      size="sm"
      spacing={0}
      value={theme ?? 'dark'}
      // Clicking the selected item would clear it; a theme is always set.
      onValueChange={(value) => {
        if (value !== '') setTheme(value)
      }}
    >
      {THEMES.map(({ value, label, Icon }) => (
        <ToggleGroupItem key={value} value={value} className="gap-1.5 px-3">
          <Icon aria-hidden="true" />
          {label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
