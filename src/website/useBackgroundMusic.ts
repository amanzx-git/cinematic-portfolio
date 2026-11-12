import { useEffect, useRef, useState } from 'react'
import { BackgroundMusic, readMutePreference, saveMutePreference, type MusicStatus } from './backgroundMusic'

const ambientSession = { consented: false, position: 0 }

export function useBackgroundMusic(resumeMenu = false) {
  const audio = useRef<HTMLAudioElement>(null)
  const controller = useRef<BackgroundMusic | null>(null)
  const [muted, setMuted] = useState(readMutePreference)
  const [consented, setConsented] = useState(false)
  const [status, setStatus] = useState<MusicStatus>('idle')
  useEffect(() => {
    const element = audio.current!
    const music = new BackgroundMusic(element, setStatus)
    controller.current = music
    if (resumeMenu && ambientSession.consented) {
      music.start(readMutePreference(), 500)
      element.currentTime = ambientSession.position
      setConsented(true)
    }
    return () => {
      ambientSession.position = element.currentTime
      controller.current = null
      music.dispose()
    }
  }, [])
  function start() {
    controller.current?.start(muted)
    ambientSession.consented = true
    setConsented(true)
  }
  function toggle() {
    if (!consented) {
      controller.current?.start(false)
      ambientSession.consented = true
      setConsented(true)
      saveMutePreference(false)
      setMuted(false)
      return
    }
    const next = !muted
    controller.current?.setMuted(next)
    saveMutePreference(next)
    setMuted(next)
  }
  return { audio, controller, muted, consented, status, start, toggle }
}
