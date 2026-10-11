import { useEffect, useState, type RefObject } from 'react'

// One observer for every element: hundreds of log rows each asking would
// otherwise create hundreds of observers.
const callbacks = new WeakMap<Element, () => void>()
let observer: IntersectionObserver | null = null

function shared(): IntersectionObserver {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        callbacks.get(entry.target)?.()
      }
    },
    // A screen ahead, so rows are ready before they scroll in.
    { rootMargin: '100% 0px' },
  )
  return observer
}

/**
 * True once the element has come near the viewport, and stays true: for work
 * worth doing only for what is seen (highlighting a log row). Without
 * IntersectionObserver (tests) everything counts as seen.
 */
export function useSeen(ref: RefObject<Element | null>): boolean {
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const element = ref.current
    if (seen || element === null) return undefined
    const io = shared()
    callbacks.set(element, () => {
      setSeen(true)
      io.unobserve(element)
      callbacks.delete(element)
    })
    io.observe(element)
    return () => {
      io.unobserve(element)
      callbacks.delete(element)
    }
  }, [ref, seen])
  return seen
}
