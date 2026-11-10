import { useEffect, useRef } from 'react'

/** Prepares a renderable frame concurrently with the intro; retained for mode selection. */
export function ShadowBackground({ paused, visible, onReady, onFailure }: {
  paused: boolean; visible: boolean; onReady: () => void; onFailure: () => void
}) {
  const video = useRef<HTMLVideoElement>(null)
  const reported = useRef(false)
  const callbacks = useRef({ onReady, onFailure })
  callbacks.current = { onReady, onFailure }
  useEffect(() => {
    const element = video.current!
    return () => { element.pause(); element.removeAttribute('src'); element.load() }
  }, [])
  useEffect(() => {
    const element = video.current!
    let active = true
    let frame: number | undefined
    const ready = () => {
      if (active && !reported.current && element.readyState >= 2) {
        reported.current = true
        callbacks.current.onReady()
      }
    }
    const playing = () => {
      if (reported.current) return
      if ('requestVideoFrameCallback' in element) frame = element.requestVideoFrameCallback(ready)
      else ready()
    }
    element.addEventListener('playing', playing)
    if (paused) element.pause()
    else {
      element.muted = true
      element.play().catch(() => { if (active) callbacks.current.onFailure() })
    }
    return () => {
      active = false
      element.removeEventListener('playing', playing)
      if (frame !== undefined) element.cancelVideoFrameCallback(frame)
      element.pause()
    }
  }, [paused])
  return <video ref={video} className={`shadow-idle-video ${visible ? 'is-visible' : ''}`}
    src="/media/website/shadow-idle.mp4" muted loop playsInline preload="auto" aria-hidden="true"
    onError={() => callbacks.current.onFailure()} />
}
