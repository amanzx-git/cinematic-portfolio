import { useEffect, useRef, useState } from 'react'

// Screen size is stable as browser chrome expands; a narrow mouse window is not mobile.
export function isMobileLayout() {
  return navigator.maxTouchPoints > 0 && matchMedia('(any-pointer: coarse)').matches &&
    Math.min(screen.width, screen.height) <= 1024
}

type LockableOrientation = ScreenOrientation & { lock?: (orientation: 'landscape') => Promise<void> }

export function useMobileLandscape() {
  const container = useRef<HTMLElement>(null)
  const requested = useRef(false)
  const [mobile, setMobile] = useState(isMobileLayout)
  const [portrait, setPortrait] = useState(() => matchMedia('(orientation: portrait)').matches)
  const [fallback, setFallback] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const cancelled = useRef(false)
  const unlock = () => { try { if (requested.current) screen.orientation?.unlock?.() } catch { /* optional API */ } }

  useEffect(() => {
    const orientation = matchMedia('(orientation: portrait)')
    const pointer = matchMedia('(any-pointer: coarse)')
    const update = () => { setMobile(isMobileLayout()); setPortrait(orientation.matches) }
    const changed = () => {
      setFullscreen(document.fullscreenElement === container.current)
      if (!document.fullscreenElement) { cancelled.current = true; unlock() }
    }
    orientation.addEventListener('change', update)
    pointer.addEventListener('change', update)
    document.addEventListener('fullscreenchange', changed)
    return () => {
      orientation.removeEventListener('change', update)
      pointer.removeEventListener('change', update)
      document.removeEventListener('fullscreenchange', changed)
      cancelled.current = true
      unlock()
    }
  }, [])

  function request() {
    if (!mobile || requested.current) return
    requested.current = true
    cancelled.current = false
    const lock = () => {
      if (cancelled.current) return
      try { void (screen.orientation as LockableOrientation | undefined)?.lock?.('landscape').catch(() => {}) } catch { /* manual rotation */ }
    }
    // Invoke fullscreen in the Enter gesture; lock after fullscreen settles on browsers
    // that require it. Without fullscreen, invoke lock directly in the gesture.
    try {
      if (container.current?.requestFullscreen && document.fullscreenEnabled) {
        void container.current.requestFullscreen().then(lock, lock)
      } else lock()
    } catch { lock() }
  }
  function exit() {
    cancelled.current = true
    unlock()
    try { if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}) } catch { /* browser already exited */ }
  }
  function continuePortrait() { setFallback(true); exit() }
  return { container, mobile, portrait, fallback, fullscreen, request, exit, continuePortrait }
}
