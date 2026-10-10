import type { ProjectKind } from '@/lib/contracts'

export const SETTINGS_SECTIONS = [
  'repos',
  'preview',
  'routes',
  'delivery',
  'knowledge',
  'general',
] as const
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]

/**
 * The tabs a project shows. A hub project (spec 0014) sets base branch and
 * preview per repo in Repos; its routes are per repo later.
 */
export function visibleSections(kind: ProjectKind): readonly SettingsSection[] {
  return kind === 'hub'
    ? ['repos', 'delivery', 'knowledge', 'general']
    : ['preview', 'routes', 'delivery', 'knowledge', 'general']
}

/** The section to show: the asked one when this project has it, else its first. */
export function shownSection(
  kind: ProjectKind,
  section: SettingsSection | undefined,
): SettingsSection {
  const visible = visibleSections(kind)
  return section !== undefined && visible.includes(section)
    ? section
    : (visible[0] ?? 'general')
}
