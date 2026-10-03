/** Pure follow-mode logic for live-appending lists; the hook wires it to the DOM. */

/** How close to the bottom (px) still counts as "at the bottom". */
export const NEAR_BOTTOM_PX = 48

export function isNearBottom(
  {
    scrollTop,
    scrollHeight,
    clientHeight,
  }: Pick<Element, 'scrollTop' | 'scrollHeight' | 'clientHeight'>,
  threshold = NEAR_BOTTOM_PX,
): boolean {
  return scrollHeight - scrollTop - clientHeight <= threshold
}

export interface FollowState {
  /** New rows scroll into view only while following. */
  following: boolean
  /** Rows appended while the reader was scrolled up. */
  unseen: number
}

export type FollowEvent =
  | { type: 'scrolled'; nearBottom: boolean }
  | { type: 'appended'; count: number }
  | { type: 'jumped' }

export const INITIAL_FOLLOW: FollowState = { following: false, unseen: 0 }

export function followReducer(state: FollowState, event: FollowEvent): FollowState {
  if (event.type === 'jumped') return { following: true, unseen: 0 }
  if (event.type === 'appended') {
    // While following, the hook scrolls instead; nothing is unseen.
    if (state.following || event.count <= 0) return state
    return { ...state, unseen: state.unseen + event.count }
  }
  if (event.nearBottom) {
    return state.following && state.unseen === 0 ? state : { following: true, unseen: 0 }
  }
  return state.following ? { ...state, following: false } : state
}
