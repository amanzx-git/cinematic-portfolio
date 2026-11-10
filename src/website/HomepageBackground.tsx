import { useEffect, useRef, useState } from 'react'

/** Two video layers retain the last entrance frame while idle decodes. */
export function HomepageBackground({ phase, entrance, idle, paused, onComplete, onFailure }: {
  phase: 'entrance' | 'idle'
  entrance: string | null
  idle: string | null
  paused: boolean
  onComplete: () => void
  onFailure: (kind: 'entrance' | 'idle') => void
}) {
  const entranceVideo = useRef<HTMLVideoElement>(null)
  const idleVideo = useRef<HTMLVideoElement>(null)
  const [idleVisible, setIdleVisible] = useState(false)
  const [idleFailed, setIdleFailed] = useState(false)
  const [entranceFailed, setEntranceFailed] = useState(false)
  const callbacks = useRef({ onComplete, onFailure })
  callbacks.current = { onComplete, onFailure }

  useEffect(() => {
    const opening = entranceVideo.current
    const loop = idleVideo.current
    let active = true
    let frame: number | undefined
    const fail = (kind: 'entrance' | 'idle') => {
      if (!active) return
      if (kind === 'idle') { setIdleFailed(true); setIdleVisible(false) }
      else setEntranceFailed(true)
      callbacks.current.onFailure(kind)
    }
    // Stop the outgoing audio before starting the next layer.
    if (phase === 'idle' && opening) { opening.pause(); opening.muted = true }
    if (phase === 'entrance' && opening && !entranceFailed) {
      opening.muted = true
      if (paused) opening.pause()
      else opening.play().catch(() => fail('entrance'))
    }
    if (phase === 'idle' && loop && !idleFailed) {
      loop.muted = true
      const reveal = () => { if (active) setIdleVisible(true) }
      const present = () => {
        if ('requestVideoFrameCallback' in loop) frame = loop.requestVideoFrameCallback(reveal)
        else reveal()
      }
      loop.addEventListener('playing', present)
      if (paused) {
        loop.pause()
        if (loop.readyState >= 2) reveal()
      } else loop.play().catch(() => fail('idle'))
      return () => {
        active = false
        loop.removeEventListener('playing', present)
        if (frame !== undefined) loop.cancelVideoFrameCallback(frame)
        loop.pause(); loop.muted = true
      }
    }
    return () => { active = false; opening?.pause(); if (opening) opening.muted = true }
  }, [phase, paused, entranceFailed, idleFailed])

  const entranceVisible = !entranceFailed && (phase === 'entrance' || !idleVisible)
  if (phase === 'idle' && idleFailed) return null
  return <>
    {entrance && !entranceFailed && <video ref={entranceVideo} className={`homepage-video ${entranceVisible ? 'is-visible' : ''}`}
      data-active={entranceVisible} data-media="entrance" src={entrance} muted playsInline preload="auto"
      poster="/media/website/city-poster.svg" onEnded={() => callbacks.current.onComplete()}
      onError={() => { setEntranceFailed(true); callbacks.current.onFailure('entrance') }} />}
    {idle && !idleFailed && <video ref={idleVideo} className={`homepage-video ${idleVisible ? 'is-visible' : ''}`}
      data-active={idleVisible} data-media="idle" src={idle} muted playsInline preload="auto" loop
      onLoadedData={() => { if (phase === 'idle' && paused) setIdleVisible(true) }}
      onError={() => { setIdleFailed(true); setIdleVisible(false); callbacks.current.onFailure('idle') }} />}
  </>
}
