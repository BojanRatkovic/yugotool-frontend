import { z } from 'zod'

import { ApiError } from '@/lib/api-client'
import { productiveOrganizationSchema, type ProductiveOrganization } from '@/lib/contracts'

const pickDetailsSchema = z.object({ organizations: z.array(productiveOrganizationSchema) })

/** The organizations to choose from when the API asks to pick one; null for any other error. */
export function organizationsToPick(error: unknown): ProductiveOrganization[] | null {
  if (!(error instanceof ApiError) || error.code !== 'productive_pick_organization') return null
  return pickDetailsSchema.safeParse(error.details).data?.organizations ?? null
}

/** Errors that belong under the token field rather than in a toast. */
export function tokenError(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null
  return error.code === 'productive_token_invalid' ||
    error.code === 'productive_organization_unknown' ||
    error.code === 'productive_forbidden'
    ? error.message
    : null
}

const STORAGE_KEY = 'yugotool:productive-project'

/** The Productive project last imported from, per YugoTool project (a browser convenience). */
export function rememberedProductiveProject(projectId: string): string | null {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    const value = z.record(z.string(), z.string()).safeParse(saved).data?.[projectId]
    return value ?? null
  } catch {
    return null
  }
}

export function rememberProductiveProject(
  projectId: string,
  productiveProjectId: string | null,
) {
  try {
    const saved = z
      .record(z.string(), z.string())
      .catch({})
      .parse(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'))
    if (productiveProjectId === null) delete saved[projectId]
    else saved[projectId] = productiveProjectId
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
  } catch {
    // Storage blocked (private window): the filter just isn't remembered.
  }
}
