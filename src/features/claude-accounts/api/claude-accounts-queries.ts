import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'

import { apiClient } from '@/lib/api-client'
import {
  claudeAccountLoginSchema,
  claudeAccountSchema,
  discoveredAccountSchema,
  type ClaudeAccount,
  type ClaudeAccountLogin,
  type CreateClaudeAccount,
  type DiscoveredAccount,
  type StartClaudeLogin,
} from '@/lib/contracts'
import { queryKeys } from '@/lib/query-keys'

async function getAccounts(): Promise<ClaudeAccount[]> {
  return z.array(claudeAccountSchema).parse(await apiClient.get('/claude-accounts'))
}

async function getDiscovered(): Promise<DiscoveredAccount[]> {
  return z
    .array(discoveredAccountSchema)
    .parse(await apiClient.get('/claude-accounts/discover'))
}

async function getLogin(id: string): Promise<ClaudeAccountLogin> {
  return claudeAccountLoginSchema.parse(await apiClient.get(`/claude-accounts/logins/${id}`))
}

export const claudeAccountQueries = {
  /** Each row runs `claude auth status`, so it is not refetched on every focus. */
  list: () =>
    queryOptions({
      queryKey: [...queryKeys.claudeAccounts(), 'list'] as const,
      queryFn: getAccounts,
      staleTime: 30_000,
      retry: 1,
    }),
  discovered: () =>
    queryOptions({
      queryKey: [...queryKeys.claudeAccounts(), 'discovered'] as const,
      queryFn: getDiscovered,
      staleTime: 60_000,
      retry: 1,
    }),
  /** Polled while the person finishes in the browser. */
  login: (id: string) =>
    queryOptions({
      queryKey: [...queryKeys.claudeAccounts(), 'login', id] as const,
      queryFn: () => getLogin(id),
      refetchInterval: (query) => (query.state.data?.state === 'pending' ? 1_000 : false),
      retry: 1,
    }),
}

/** Accounts decide what sessions bill against: the auth chip, usage and the doctor follow. */
function useRefreshAccounts() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.claudeAccounts() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.system() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dispatcher() }),
    ])
}

export function useCreateClaudeAccount() {
  const refresh = useRefreshAccounts()
  return useMutation({
    mutationFn: async (body: CreateClaudeAccount) =>
      claudeAccountSchema.parse(await apiClient.post('/claude-accounts', body)),
    onSuccess: refresh,
  })
}

export function useRemoveClaudeAccount() {
  const queryClient = useQueryClient()
  const refresh = useRefreshAccounts()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/claude-accounts/${id}`),
    // Its projects fall back to the default account.
    onSuccess: () =>
      Promise.all([
        refresh(),
        queryClient.invalidateQueries({ queryKey: queryKeys.projects() }),
      ]),
  })
}

export function useSetDefaultClaudeAccount() {
  const refresh = useRefreshAccounts()
  return useMutation({
    mutationFn: (accountId: string | null) =>
      apiClient.put('/claude-accounts/default', { accountId }),
    onSuccess: refresh,
  })
}

export function useStartClaudeLogin() {
  return useMutation({
    mutationFn: async (body: StartClaudeLogin) =>
      claudeAccountLoginSchema.parse(await apiClient.post('/claude-accounts/logins', body)),
  })
}

export function useSubmitLoginCode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, code }: { id: string; code: string }) =>
      claudeAccountLoginSchema.parse(
        await apiClient.post(`/claude-accounts/logins/${id}/code`, { code }),
      ),
    onSuccess: (login) =>
      queryClient.invalidateQueries({
        queryKey: claudeAccountQueries.login(login.id).queryKey,
      }),
  })
}

export function useCancelLogin() {
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/claude-accounts/logins/${id}`),
  })
}

/** The account a project's sessions run on; null = the default (spec 0016). */
export function useSetProjectAccount(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (claudeAccountId: string | null) =>
      apiClient.patch(`/projects/${projectId}`, { claudeAccountId }),
    // The projects collection is backed by this key.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.projects() }),
  })
}
