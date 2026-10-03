import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError, apiClient } from '@/lib/api-client'

function respond(body: string | null, status: number) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(body, { status }))),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('apiClient bodies', () => {
  it('resolves an empty 202 to undefined', async () => {
    respond('', 202)
    await expect(apiClient.post('/runs/x/shifts/handoff-now')).resolves.toBeUndefined()
  })

  it('resolves 204 to undefined', async () => {
    respond(null, 204)
    await expect(apiClient.post('/runs/x/gates/review')).resolves.toBeUndefined()
  })

  it('resolves an empty 200 to undefined', async () => {
    respond('  ', 200)
    await expect(apiClient.get('/x')).resolves.toBeUndefined()
  })

  it('parses a JSON body', async () => {
    respond('{"ok":true}', 202)
    await expect(apiClient.post('/x')).resolves.toEqual({ ok: true })
  })

  it('rejects malformed JSON with an ApiError', async () => {
    respond('{nope', 200)
    await expect(apiClient.get('/x')).rejects.toBeInstanceOf(ApiError)
  })

  it('still turns error statuses into ApiError with the code', async () => {
    respond('{"error":{"code":"shift_not_running","message":"No shift is running."}}', 409)
    await expect(apiClient.post('/x')).rejects.toMatchObject({
      status: 409,
      code: 'shift_not_running',
      message: 'No shift is running.',
    })
  })
})
