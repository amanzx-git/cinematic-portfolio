import { useEffect, useRef, useState } from 'react'
import { BackgroundMusic, readMutePreference, saveMutePreference, type MusicStatus } from './backgroundMusic'

export function useBackgroundMusic() {
  const audio = useRef<HTMLAudioElement>(null)
  const controller = useRef<BackgroundMusic | null>(null)
  const [muted, setMuted] = useState(readMutePreference)
  const [consented, setConsented] = useState(false)
  const [status, setStatus] = useState<MusicStatus>('idle')
  useEffect(() => {
    const music = new BackgroundMusic(audio.current!, setStatus)
    controller.current = music
    return () => { controller.current = null; music.dispose() }
  }, [])
  function start() {
    controller.current?.start(muted)
    setConsented(true)
  }
  function toggle() {
    if (!consented) return
    const next = !muted
    controller.current?.setMuted(next)
    saveMutePreference(next)
    setMuted(next)
  }
  return { audio, muted, consented, status, start, toggle }
}
