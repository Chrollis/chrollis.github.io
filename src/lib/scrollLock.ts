import { useEffect } from 'react'

/**
 * One scroll lock for the whole document, shared by everything that needs one.
 *
 * There used to be two independent locks - the boot overlay and the mobile drawer - each
 * doing "read the current inline value, write `hidden`, write the old value back on
 * cleanup". That is only correct while the two never overlap. Overlap them and a stale
 * value gets restored: open the drawer during the boot and the overlay's cleanup releases
 * the drawer's lock, then the drawer's cleanup writes `hidden` back with nothing left to
 * release it. The document stays unscrollable until a reload, which on a phone is
 * indistinguishable from "swiping does nothing".
 *
 * A counter instead. The first lock records what the page had, the last one restores it,
 * and anything that happens in between is a no-op. Counted rather than boolean so that
 * StrictMode's double-invoked effects (mount, unmount, mount) still balance out.
 */
let locks = 0
let restore = ''

export const lockScroll = () => {
  if (typeof document === 'undefined') return
  if (locks === 0) {
    restore = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  locks += 1
}

export const unlockScroll = () => {
  if (typeof document === 'undefined' || locks === 0) return
  locks -= 1
  if (locks === 0) document.body.style.overflow = restore
}

/** Locks the document while `active`, and releases it on unmount. */
export const useScrollLock = (active: boolean) => {
  useEffect(() => {
    if (!active) return
    lockScroll()
    return unlockScroll
  }, [active])
}
