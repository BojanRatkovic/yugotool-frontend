import { useCallback, useEffect, useReducer, useRef, useState } from 'react'

import {
  followReducer,
  INITIAL_FOLLOW,
  isNearBottom,
  type FollowState,
} from '@/hooks/stick-to-bottom'

/** The nearest ancestor that scrolls vertically (the panel's tab body, usually). */
function scrollParent(element: HTMLElement): HTMLElement | null {
  let node = element.parentElement
  while (node !== null) {
    const { overflowY } = getComputedStyle(node)
    if (overflowY === 'auto' || overflowY === 'scroll') return node
    node = node.parentElement
  }
  return null
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function scrollToBottom(element: HTMLElement, smooth: boolean) {
  element.scrollTo({
    top: element.scrollHeight,
    behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto',
  })
}

/**
 * "Stick to bottom only when already at the bottom" for a live list. Attach
 * `attach` (a callback ref) to the list; it follows its scrolling ancestor. When rows arrive while
 * the reader is scrolled up, nothing moves and `unseen` counts them instead.
 * `jumpToBottom` (the "New activity" pill) re-enables follow mode.
 */
export function useStickToBottom(
  count: number,
  { startAtBottom }: { startAtBottom: boolean },
): FollowState & { attach: (element: HTMLElement | null) => void; jumpToBottom: () => void } {
  const [scroller, setScroller] = useState<HTMLElement | null>(null)
  const [state, dispatch] = useReducer(followReducer, INITIAL_FOLLOW)
  const prevCount = useRef(count)
  const startRef = useRef(startAtBottom)

  const attach = useCallback((element: HTMLElement | null) => {
    setScroller(element === null ? null : scrollParent(element))
  }, [])

  useEffect(() => {
    if (scroller === null) return undefined
    if (startRef.current) scrollToBottom(scroller, false)
    dispatch({ type: 'scrolled', nearBottom: isNearBottom(scroller) })
    const onScroll = () => dispatch({ type: 'scrolled', nearBottom: isNearBottom(scroller) })
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => scroller.removeEventListener('scroll', onScroll)
  }, [scroller])

  useEffect(() => {
    const added = count - prevCount.current
    prevCount.current = count
    if (added > 0 && scroller !== null) {
      if (state.following) scrollToBottom(scroller, false)
      else dispatch({ type: 'appended', count: added })
    }
  }, [count, scroller, state.following])

  const jumpToBottom = useCallback(() => {
    if (scroller !== null) scrollToBottom(scroller, true)
    dispatch({ type: 'jumped' })
  }, [scroller])

  return { ...state, attach, jumpToBottom }
}
