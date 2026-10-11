import { Check, Plus, TriangleAlert, X } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { ProjectSkill } from '@/lib/contracts'
import { skillGroup } from '@/lib/skill-autocomplete'

/**
 * "Always load" skills of an agent station (spec 0015): chips plus a
 * searchable picker. A saved skill the project no longer has stays visible,
 * flagged, so it can be removed.
 */
export function StationSkills({
  id,
  value,
  skills,
  onChange,
}: {
  id: string
  value: readonly string[]
  skills: readonly ProjectSkill[]
  onChange: (next: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const known = new Set(skills.map((s) => s.invocation))
  const groups = new Map<string, ProjectSkill[]>()
  for (const skill of skills)
    groups.set(skillGroup(skill), [...(groups.get(skillGroup(skill)) ?? []), skill])
  const toggle = (invocation: string) =>
    onChange(
      value.includes(invocation)
        ? value.filter((s) => s !== invocation)
        : [...value, invocation],
    )

  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-label`} className="flex flex-col gap-0.5 text-sm font-medium">
        Always load skills
        <span className="text-xs font-normal text-muted-foreground">
          Every session of this station loads these first. For one work order, type{' '}
          <kbd className="rounded border px-1 font-mono">/</kbd> in its description instead.
        </span>
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((invocation) =>
          known.has(invocation) ? (
            <span
              key={invocation}
              className="inline-flex items-center gap-1 rounded-md bg-secondary py-0.5 pr-0.5 pl-1.5 font-mono text-xs text-secondary-foreground"
            >
              {invocation}
              <button
                type="button"
                aria-label={`Remove ${invocation}`}
                className="rounded p-0.5 hover:bg-foreground/10"
                onClick={() => toggle(invocation)}
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </span>
          ) : (
            <span
              key={invocation}
              title="This project has no skill by this name; sessions skip it"
              className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 py-0.5 pr-0.5 pl-1.5 font-mono text-xs text-amber-700 dark:text-amber-400"
            >
              <TriangleAlert className="size-3" aria-hidden="true" />
              {invocation} · not in this project
              <button
                type="button"
                aria-label={`Remove ${invocation}`}
                className="rounded p-0.5 hover:bg-foreground/10"
                onClick={() => toggle(invocation)}
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </span>
          ),
        )}
        <Popover modal open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id={id}
              type="button"
              variant="outline"
              size="sm"
              aria-labelledby={`${id}-label`}
              disabled={skills.length === 0}
              className="h-7 gap-1 text-xs"
            >
              <Plus aria-hidden="true" />
              {skills.length === 0 ? 'No skills in this project' : 'Add skill'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-96 p-0" align="start">
            <Command>
              <CommandInput placeholder="Search skills…" />
              <CommandList className="max-h-72">
                <CommandEmpty>No skill matches.</CommandEmpty>
                {[...groups].map(([group, items]) => (
                  <CommandGroup key={group} heading={group}>
                    {items.map((skill) => (
                      <CommandItem
                        key={skill.invocation}
                        value={`${skill.invocation} ${skill.description}`}
                        onSelect={() => toggle(skill.invocation)}
                        className="items-start"
                      >
                        <Check
                          aria-hidden="true"
                          className={
                            value.includes(skill.invocation)
                              ? 'mt-0.5 opacity-100'
                              : 'mt-0.5 opacity-0'
                          }
                        />
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="font-mono text-xs">{skill.invocation}</span>
                          {skill.description ? (
                            <span className="truncate text-xs text-muted-foreground">
                              {skill.description}
                            </span>
                          ) : null}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
