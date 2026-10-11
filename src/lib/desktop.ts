function isBridge(value: unknown): value is YugoToolDesktop {
  return (
    typeof value === 'object' &&
    value !== null &&
    'pickFolder' in value &&
    typeof value.pickFolder === 'function'
  )
}

/**
 * The desktop shell's bridge, or null in a browser (or when the preload
 * exposes something unexpected). Read it through this, never `window` directly.
 */
export function desktopBridge(
  target: { yugotoolDesktop?: unknown } | undefined = typeof window === 'undefined'
    ? undefined
    : window,
): YugoToolDesktop | null {
  const bridge = target?.yugotoolDesktop
  return isBridge(bridge) ? bridge : null
}

/**
 * Tells the desktop shell which theme the app resolved to, so the native
 * window chrome follows. No-op in a browser, for an older shell without
 * `setTheme`, or before next-themes has resolved a theme.
 */
export function syncDesktopTheme(
  resolvedTheme: string | undefined,
  bridge: YugoToolDesktop | null = desktopBridge(),
): void {
  if (resolvedTheme !== 'dark' && resolvedTheme !== 'light') return
  if (typeof bridge?.setTheme !== 'function') return
  bridge.setTheme(resolvedTheme)
}
