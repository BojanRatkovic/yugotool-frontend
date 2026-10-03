/** True when a keystroke belongs to a text field or an open overlay, not to app shortcuts. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return target.closest('[role="dialog"],[role="listbox"],[role="menu"]') !== null
}

export const IS_MAC =
  typeof navigator !== 'undefined' && /Mac|iP(hone|ad)/.test(navigator.platform)
