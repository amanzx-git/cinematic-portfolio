import { useEffect, useRef, useState, type RefObject } from 'react'
import { useReducedMotion } from './useReducedMotion'
import './video-background.css'

export type VideoBackgroundConfig = { source: string | null; poster?: string; playback: 'ambient' | 'scroll' }

// No dedicated section footage is supplied. Keep each architectural CSS background.
export const pageBackgrounds: Record<'about' | 'skills' | 'projects' | 'contact', VideoBackgroundConfig> = {
  about: { source: null, playback: 'scroll' },
  skills: { source: null, playback: 'ambient' },
  projects: { source: null, playback: 'ambient' },
  contact: { source: null, playback: 'ambient' },
}

export function VideoBackground({ config, scrollRoot, active = true }: {
  config: VideoBackgroundConfig; scrollRoot: RefObject<HTMLElement | null>; active?: boolean
}) {
  const reduced = useReducedMotion()
  if (!config.source || reduced) return config.poster ? <div className="section-video-background" aria-hidden="true">
    <img src={config.poster} alt="" loading="lazy" /><div className="section-video-overlay" />
  </div> : null
  return <BackgroundPlayback key={`${config.source}-${config.playback}`} config={config} scrollRoot={scrollRoot} active={active} />
}

function BackgroundPlayback({ config, scrollRoot, active }: {
  config: VideoBackgroundConfig; scrollRoot: RefObject<HTMLElement | null>; active: boolean
}) {
  const container = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const [visible, setVisible] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const element = container.current!
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return }
    const observer = new IntersectionObserver(entries => setVisible(entries[0].isIntersecting))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const element = video.current
    if (!element || !active || !visible || failed) return
    let disposed = false
    let frame = 0
    const update = () => {
      frame = 0
      if (disposed) return
      if (document.hidden) { element.pause(); return }
      if (config.playback === 'ambient') {
        void element.play().catch(() => { if (!disposed) setFailed(true) })
      } else {
        element.pause()
        const bounds = scrollRoot.current?.getBoundingClientRect()
        if (!bounds || !Number.isFinite(element.duration) || element.seeking) return
        const progress = Math.max(0, Math.min(1, -bounds.top / Math.max(1, bounds.height - window.innerHeight)))
        const time = progress * Math.max(0, element.duration - .04)
        if (Math.abs(element.currentTime - time) > .035) element.currentTime = time
      }
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
    element.muted = true
    element.src = config.source!
    element.addEventListener('loadedmetadata', schedule)
    if (config.playback === 'scroll') {
      window.addEventListener('scroll', schedule, { passive: true })
      window.addEventListener('resize', schedule)
      element.addEventListener('seeked', schedule)
    }
    document.addEventListener('visibilitychange', schedule)
    schedule()
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      document.removeEventListener('visibilitychange', schedule)
      element.removeEventListener('loadedmetadata', schedule)
      element.removeEventListener('seeked', schedule)
      element.pause()
      element.removeAttribute('src')
      element.load()
    }
  }, [config, scrollRoot, active, visible, failed])
  return <div ref={container} className="section-video-background" aria-hidden="true">
    <video ref={video} muted playsInline loop={config.playback === 'ambient'} preload="none" poster={config.poster}
      hidden={failed} onError={() => setFailed(true)} />
    {failed && config.poster && <img src={config.poster} alt="" loading="lazy" />}
    <div className="section-video-overlay" />
  </div>
}
