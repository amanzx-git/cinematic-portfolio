import { useCallback, useEffect, useRef, useState } from 'react'
import { INTRO_VOLUME, MUTE_STORAGE_KEY, readMutePreference, saveMutePreference } from '../website/backgroundMusic'
import { useReducedMotion } from '../website/useReducedMotion'
import { backToModes, MODES_ROUTE } from '../recruiterNavigation'
import { createVideoAvailability } from './story'
import { startStoryVideo } from './videoPlayback'

const available = createVideoAvailability((...args) => fetch(...args))

export function RecruiterCinematic({ source, title, onDone, onPresented }: {
  source: string; title: string; onDone: () => void; onPresented: () => void
}) {
  const video = useRef<HTMLVideoElement>(null)
  const first = useRef<HTMLButtonElement>(null)
  const finished = useRef(false)
  const [loaded, setLoaded] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [muted, setMuted] = useState(readMutePreference)
  const reduced = useReducedMotion()
  const finish = useCallback(() => {
    if (finished.current) return
    finished.current = true
    if (video.current) { video.current.muted = true; video.current.pause() }
    onDone()
  }, [onDone])
  useEffect(() => {
    let active = true
    if (reduced) finish()
    else void available(source).then(exists => { if (active) { if (exists) setLoaded(true); else finish() } })
    return () => { active = false }
  }, [source, reduced, finish])
  useEffect(() => {
    const element = video.current
    if (!element) return
    first.current?.focus({ preventScroll: true })
    const dispose = startStoryVideo(element, readMutePreference(), INTRO_VOLUME, () => { setBlocked(true); onPresented() })
    const timeout = window.setTimeout(() => { if (element.readyState < 2) finish() }, 12000)
    return () => {
      clearTimeout(timeout)
      dispose()
    }
  }, [loaded, finish, onPresented])
  useEffect(() => {
    if (video.current) video.current.muted = muted
    const update = (event: StorageEvent) => { if (event.key === MUTE_STORAGE_KEY || event.key === null) setMuted(readMutePreference()) }
    window.addEventListener('storage', update)
    return () => window.removeEventListener('storage', update)
  }, [muted, loaded])
  return <section className="recruiter-cinematic" aria-label={`${title} cinematic`}>
    {loaded ? <>
      <video ref={video} src={source} playsInline preload="auto" onLoadedData={onPresented} onEnded={finish} onError={finish} />
      <nav aria-label="Cinematic controls">
        {blocked && <button className="recruiter-primary" onClick={() => {
          void video.current?.play().then(() => setBlocked(false)).catch(() => setBlocked(true))
        }}>Play cinematic</button>}
        <button ref={first} className={blocked ? undefined : 'recruiter-primary'} onClick={finish}>Skip</button>
        <button aria-pressed={muted} onClick={() => { const next = !muted; saveMutePreference(next); setMuted(next) }}>{muted ? 'Unmute' : 'Mute'}</button>
        <a href={MODES_ROUTE} onClick={event => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0 && video.current) { video.current.muted = true; video.current.pause() } backToModes(event) }}>Back</a>
      </nav>
    </> : <span role="status">Preparing {title.toLowerCase()}…</span>}
  </section>
}
