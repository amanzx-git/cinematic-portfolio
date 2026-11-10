import { useEffect, useRef } from 'react'
import { SoundControl } from './SoundControl'

export function OrientationGate({ onContinue, onExit, fullscreen, muted, onToggle }: {
  onContinue: () => void; onExit: () => void; fullscreen: boolean; muted: boolean; onToggle: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const element = dialog.current!
    element.showModal()
    return () => { element.close(); if (previous?.isConnected) previous.focus() }
  }, [])
  return <dialog ref={dialog} className="orientation-gate" aria-labelledby="rotate-title" aria-describedby="rotate-description"
    onCancel={event => { event.preventDefault(); onContinue() }}>
    <svg className="rotate-phone" width="100" height="86" viewBox="0 0 100 86" fill="none" aria-hidden="true">
      <rect x="35" y="13" width="32" height="58" rx="6" stroke="currentColor" strokeWidth="2" transform="rotate(35 51 42)" />
      <path d="M13 39a38 38 0 0 1 63-27m0-9v10H66M87 47a38 38 0 0 1-63 27m0 9V73h10" stroke="currentColor" strokeWidth="2" />
    </svg>
    <p className="eyebrow">A WIDER PERSPECTIVE</p>
    <h2 id="rotate-title">Rotate Your Phone</h2>
    <p id="rotate-description">Turn your device sideways to continue. If needed, turn off rotation lock in your device settings.</p>
    <p>Your place is saved. The experience resumes in landscape.</p>
    <button className="enter-button" onClick={onContinue}>Continue in portrait</button>
    <div className="orientation-controls"><SoundControl muted={muted} consented onToggle={onToggle} />
      {fullscreen && <button className="text-control" onClick={onExit}>Exit fullscreen</button>}</div>
  </dialog>
}
