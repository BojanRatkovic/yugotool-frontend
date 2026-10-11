import { TriangleAlertIcon, XIcon } from 'lucide-react'
import { flushSync } from 'react-dom'
import { Fragment, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { Textarea } from '@/components/ui/textarea'
import { caretPosition } from '@/lib/caret-position'
import { skillMentions, type ProjectSkill } from '@/lib/contracts'
import {
  filterSkills,
  insertSkill,
  removeMention,
  skillGroup,
  slashToken,
  unknownMentions,
  type SlashToken,
} from '@/lib/skill-autocomplete'
import { cn } from '@/lib/utils'

/** Matches the menu's max-h-72 + footer, to decide whether it fits below the caret. */
const MENU_HEIGHT = 320
const MENU_WIDTH = 384

interface Menu {
  token: SlashToken
  /** Caret line, relative to the textarea's top-left. */
  top: number
  left: number
  lineHeight: number
  /** Not enough room below the caret: open above it. */
  above: boolean
}

type SkillTextareaProps = Omit<React.ComponentProps<'textarea'>, 'value' | 'onChange'> & {
  value: string
  onValueChange: (value: string) => void
  /** The project's skills; undefined while loading (plain textarea until then). */
  skills: readonly ProjectSkill[] | undefined
}

/**
 * A textarea where `/` offers the project's skills (spec 0015): typed at the
 * start or after a space, it opens a menu at the caret; Enter or Tab inserts
 * `/plugin:skill`, Esc closes. Below it, the skills the text will load.
 */
export function SkillTextarea({
  value,
  onValueChange,
  skills,
  ref,
  onKeyDown,
  onBlur,
  className,
  ...props
}: SkillTextareaProps) {
  const inner = useRef<HTMLTextAreaElement | null>(null)
  const [menu, setMenu] = useState<Menu | null>(null)
  const [active, setActive] = useState(0)
  const listId = useId()

  const results = useMemo(
    () => (menu && skills ? filterSkills(skills, menu.token.query) : []),
    [menu, skills],
  )
  const open = menu !== null && results.length > 0
  const known = useMemo(() => (skills ?? []).map((s) => s.invocation), [skills])
  const mentioned = useMemo(() => skillMentions(value, known), [value, known])
  const unknown = useMemo(
    () => (skills ? unknownMentions(value, known) : []),
    [value, known, skills],
  )

  useLayoutEffect(() => {
    if (open)
      document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active, listId])

  // Esc closes the menu, not the dialog around it: Radix listens on document in
  // the capture phase, so this has to run earlier, on window.
  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.target !== inner.current) return
      event.stopPropagation()
      event.preventDefault()
      setMenu(null)
    }
    if (open) window.addEventListener('keydown', onEscape, { capture: true })
    return () => window.removeEventListener('keydown', onEscape, { capture: true })
  }, [open])

  function track(el: HTMLTextAreaElement) {
    const caret = el.selectionStart
    const token =
      skills && skills.length > 0 && caret === el.selectionEnd
        ? slashToken(el.value, caret)
        : null
    if (!token) {
      setMenu(null)
      return
    }
    if (token.query !== menu?.token.query || token.start !== menu.token.start) setActive(0)
    const at = caretPosition(el, token.start)
    const box = el.getBoundingClientRect()
    setMenu({
      token,
      top: at.top,
      left: Math.max(0, Math.min(at.left, el.clientWidth - MENU_WIDTH)),
      lineHeight: at.height,
      above:
        box.top + at.top + at.height + MENU_HEIGHT > window.innerHeight &&
        box.top + at.top > MENU_HEIGHT,
    })
  }

  function choose(skill: ProjectSkill) {
    const el = inner.current
    if (!menu || !el) return
    const next = insertSkill(value, menu.token, el.selectionStart, skill.invocation)
    // Render the new value now, so the caret lands after the skill before the next keystroke.
    flushSync(() => {
      setMenu(null)
      onValueChange(next.text)
    })
    el.setSelectionRange(next.caret, next.caret)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <Textarea
          {...props}
          ref={(el) => {
            inner.current = el
            if (typeof ref === 'function') ref(el)
            else if (ref) ref.current = el
          }}
          value={value}
          className={className}
          aria-autocomplete="list"
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open ? `${listId}-${active}` : undefined}
          onChange={(event) => {
            onValueChange(event.target.value)
            track(event.target)
          }}
          onSelect={(event) => track(event.currentTarget)}
          onBlur={(event) => {
            setMenu(null)
            onBlur?.(event)
          }}
          onKeyDown={(event) => {
            if (open && !event.nativeEvent.isComposing) {
              const plain = !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault()
                const step = event.key === 'ArrowDown' ? 1 : -1
                setActive((i) => (i + step + results.length) % results.length)
                return
              }
              if ((event.key === 'Enter' || event.key === 'Tab') && plain) {
                event.preventDefault()
                const skill = results[active]
                if (skill) choose(skill)
                return
              }
            }
            onKeyDown?.(event)
          }}
        />
        {open && menu ? (
          // Keep focus (and the caret) in the textarea while picking with the mouse.
          // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- only stops the textarea losing focus
          <div
            className="absolute z-50 flex w-96 max-w-full flex-col overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-md"
            style={{
              left: menu.left,
              ...(menu.above
                ? { bottom: `calc(100% - ${menu.top}px + 4px)` }
                : { top: menu.top + menu.lineHeight + 4 }),
            }}
            onMouseDown={(event) => event.preventDefault()}
          >
            <div
              id={listId}
              // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a listbox the textarea drives (aria-activedescendant); a <select> can't
              role="listbox"
              aria-label="Skills"
              className="max-h-72 overflow-y-auto p-1"
            >
              {results.map((skill, index) => {
                const group = skillGroup(skill)
                const previous = results[index - 1]
                // Unfiltered, the list is in group order: headings. Filtered it is by
                // relevance, so each row names its group instead.
                const heading =
                  !menu.token.query &&
                  (previous === undefined || skillGroup(previous) !== group)
                return (
                  <Fragment key={skill.invocation}>
                    {heading ? (
                      <div
                        aria-hidden="true"
                        className="px-2 pt-1.5 pb-1 text-xs font-medium text-muted-foreground"
                      >
                        {group}
                      </div>
                    ) : null}
                    {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role, jsx-a11y/click-events-have-key-events, jsx-a11y/interactive-supports-focus -- keys and focus stay in the textarea (aria-activedescendant) */}
                    <div
                      id={`${listId}-${index}`}
                      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- see the listbox
                      role="option"
                      aria-selected={index === active}
                      className={cn(
                        'flex cursor-pointer flex-col gap-0.5 rounded-md px-2 py-1.5',
                        index === active && 'bg-accent text-accent-foreground',
                      )}
                      onMouseMove={() => setActive(index)}
                      onClick={() => choose(skill)}
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="font-mono text-xs">/{skill.invocation}</span>
                        {menu.token.query ? (
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {group}
                          </span>
                        ) : null}
                      </span>
                      {skill.description ? (
                        <span className="truncate text-xs text-muted-foreground">
                          {skill.description}
                        </span>
                      ) : null}
                    </div>
                  </Fragment>
                )
              })}
            </div>
            <div className="border-t px-2 py-1 text-[11px] text-muted-foreground">
              ↑↓ to move · Enter to insert · Esc to close
            </div>
          </div>
        ) : null}
      </div>
      {skills && skills.length > 0 ? (
        <SkillChips
          mentioned={mentioned}
          unknown={unknown}
          onRemove={(invocation) => onValueChange(removeMention(value, invocation))}
        />
      ) : null}
    </div>
  )
}

/** What the text will load, or how to add a skill when it names none. */
function SkillChips({
  mentioned,
  unknown,
  onRemove,
}: {
  mentioned: string[]
  unknown: string[]
  onRemove: (invocation: string) => void
}) {
  if (mentioned.length === 0 && unknown.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Type <kbd className="rounded border px-1 font-mono">/</kbd> to add a skill
      </p>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">Loads</span>
      {mentioned.map((invocation) => (
        <span
          key={invocation}
          className="inline-flex items-center gap-1 rounded-md bg-secondary py-0.5 pr-0.5 pl-1.5 font-mono text-secondary-foreground"
        >
          {invocation}
          <button
            type="button"
            aria-label={`Remove /${invocation}`}
            className="rounded p-0.5 hover:bg-foreground/10"
            onClick={() => onRemove(invocation)}
          >
            <XIcon className="size-3" />
          </button>
        </span>
      ))}
      {unknown.map((invocation) => (
        <span
          key={invocation}
          title="No skill by this name in this project; it will be ignored"
          className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-1.5 py-0.5 font-mono text-amber-700 dark:text-amber-400"
        >
          <TriangleAlertIcon className="size-3" />
          {invocation} · not in this project
        </span>
      ))}
    </div>
  )
}
