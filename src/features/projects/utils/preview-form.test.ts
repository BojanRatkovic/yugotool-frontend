import { describe, expect, it } from 'vitest'

import {
  PREVIEW_DEFAULTS,
  applyDetectedPreview,
  parsePreviewValues,
  toPreviewValues,
} from '@/features/projects/utils/preview-form'
import type { Preview } from '@/lib/contracts'

const preview: Preview = {
  install: 'pnpm install',
  start: 'pnpm dev --port $PORT',
  readyPath: '/',
  readyTimeoutSec: 60,
  env: { VITE_MOCKS: '1' },
  baseUrlPath: '/app',
  themeInit: null,
  host: null,
}

describe('preview form', () => {
  it('round-trips a saved config', () => {
    expect(parsePreviewValues(toPreviewValues(preview))).toEqual({ ok: true, preview })
  })

  it('starts from the API defaults', () => {
    const parsed = parsePreviewValues({ ...PREVIEW_DEFAULTS, start: 'node server.js' })
    expect(parsed).toEqual({
      ok: true,
      preview: {
        install: null,
        start: 'node server.js',
        readyPath: '/',
        readyTimeoutSec: 120,
        env: {},
        baseUrlPath: '/',
        themeInit: null,
        host: null,
      },
    })
  })

  it('skips blank env rows and rejects bad or duplicate names', () => {
    const base = { ...PREVIEW_DEFAULTS, start: 'x' }
    const blank = parsePreviewValues({ ...base, env: [{ key: '', value: '' }] })
    expect(blank.ok && blank.preview.env).toEqual({})
    const bad = parsePreviewValues({ ...base, env: [{ key: '1X', value: 'a' }] })
    expect(bad.ok ? null : bad.errors.env).toMatch(/valid variable name/)
    const twice = parsePreviewValues({
      ...base,
      env: [
        { key: 'A', value: '1' },
        { key: 'A', value: '2' },
      ],
    })
    expect(twice.ok ? null : twice.errors.env).toBe('A is set twice.')
  })

  it('reports field errors', () => {
    const parsed = parsePreviewValues({
      ...PREVIEW_DEFAULTS,
      readyPath: 'health',
      readyTimeoutSec: '2',
    })
    expect(parsed.ok ? null : Object.keys(parsed.errors).toSorted()).toEqual([
      'readyPath',
      'readyTimeoutSec',
      'start',
    ])
  })

  it('saves a host lowercased, empty as localhost, and rejects scheme or port', () => {
    const base = { ...PREVIEW_DEFAULTS, start: 'x' }
    const named = parsePreviewValues({ ...base, host: ' App.Example.localhost ' })
    expect(named.ok && named.preview.host).toBe('app.example.localhost')
    const empty = parsePreviewValues({ ...base, host: '  ' })
    expect(empty.ok && empty.preview.host).toBeNull()
    for (const host of [
      'http://app.localhost',
      'app.localhost:3000',
      'app.localhost/x',
      '-a',
    ]) {
      const bad = parsePreviewValues({ ...base, host })
      expect(bad.ok ? null : bad.errors.host).toMatch(/host name/)
    }
  })
})

describe('applyDetectedPreview', () => {
  const detected: Preview = {
    install: null,
    start: 'npm run start',
    readyPath: '/',
    readyTimeoutSec: 120,
    env: {},
    baseUrlPath: '/',
    themeInit: null,
    host: null,
  }

  it('fills an empty form from the detection', () => {
    expect(applyDetectedPreview({ ...PREVIEW_DEFAULTS, env: [] }, detected)).toEqual({
      ...PREVIEW_DEFAULTS,
      start: 'npm run start',
      env: [],
    })
  })

  it('replaces commands but keeps env rows, the init script and the host', () => {
    const current = toPreviewValues({ ...preview, themeInit: 'seed()', host: 'app.localhost' })
    const next = applyDetectedPreview(current, {
      ...detected,
      install: 'pnpm install --frozen-lockfile',
      env: { VITE_MOCKS: '0', HOST: '127.0.0.1' },
    })
    expect(next.install).toBe('pnpm install --frozen-lockfile')
    expect(next.start).toBe('npm run start')
    expect(next.baseUrlPath).toBe('/')
    expect(next.readyTimeoutSec).toBe('120')
    expect(next.themeInit).toBe('seed()')
    expect(next.host).toBe('app.localhost')
    expect(next.env).toEqual([
      { key: 'VITE_MOCKS', value: '0' },
      { key: 'HOST', value: '127.0.0.1' },
    ])
  })

  it('round-trips into a valid config', () => {
    expect(parsePreviewValues(applyDetectedPreview(PREVIEW_DEFAULTS, detected))).toEqual({
      ok: true,
      preview: detected,
    })
  })
})
