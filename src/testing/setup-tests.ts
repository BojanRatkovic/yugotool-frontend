import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom has no layout engine; React Flow measures the pane on mount and needs
// these to exist at all. They are stubs, not measurements — anything that
// depends on real geometry (contrast, target size) belongs in browser mode.
// Stubbing a browser global is inherently a narrowing assertion, which is why
// `no-unsafe-type-assertion` is disabled for src/testing/** in .oxlintrc.json.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver
globalThis.DOMMatrixReadOnly ??= class {
  m22 = 1
} as unknown as typeof DOMMatrixReadOnly

afterEach(() => {
  cleanup()
})
