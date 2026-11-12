import { useEffect, useRef, type KeyboardEvent, type MouseEvent } from 'react'
import type { GameScreen, GameSession } from './session'

export function GameOverlay({ screen, loaded, session, publish, stage, backHref = '/lab', onBack, onReplay }: {
  onReplay?: () => void
  backHref?: string
  onBack?: (event: MouseEvent<HTMLAnchorElement>) => void
  screen: GameScreen
  loaded: boolean
  session: GameSession
  publish: () => void
  stage: React.RefObject<HTMLDivElement | null>
}) {
  const panel = useRef<HTMLElement>(null)
  const first = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!loaded) return
    if (screen === 'ready' || screen === 'paused' || screen === 'complete') first.current?.focus({ preventScroll: true })
    if (screen === 'playing' || screen === 'resetting') stage.current?.focus({ preventScroll: true })
  }, [screen, loaded, stage])
  if (!loaded || !['ready', 'paused', 'complete'].includes(screen)) return null
  const modal = screen !== 'ready'
  const act = () => {
    if (screen === 'ready') session.start()
    else if (screen === 'complete') { if (onReplay) { onReplay(); return } session.replay() }
    else session.togglePause()
    publish()
  }
  const keydown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' && screen === 'paused') {
      event.preventDefault(); event.stopPropagation(); act()
    }
    if (!modal || event.key !== 'Tab') return
    const controls = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')
    if (!controls?.length) return
    const start = controls[0], end = controls[controls.length - 1]
    if (event.shiftKey && document.activeElement === start) { event.preventDefault(); end.focus() }
    else if (!event.shiftKey && document.activeElement === end) { event.preventDefault(); start.focus() }
  }
  return <div className="game-overlay">
    <section id="game-overlay-panel" ref={panel} className="game-panel" role={modal ? 'dialog' : 'region'}
      aria-modal={modal || undefined} aria-labelledby="game-panel-title" onKeyDown={keydown}>
      <h2 id="game-panel-title">{screen === 'ready' ? 'Ready to run' : screen === 'paused' ? 'Paused' : 'Route complete'}</h2>
      {screen === 'ready' ? <>
        <p>Reach the far rooftop. Running is automatic.</p>
        <div className="game-keyboard-hints"><p><kbd>Space / ↑</kbd> Jump</p><p><kbd>S / ↓</kbd> Slide</p><p><kbd>Shift</kbd> Hold to sprint</p></div>
        <p className="game-touch-hints">Tap Jump or Slide. Hold Sprint for speed.</p>
        <p className="game-route-hint">Amber floor marks jumps. Teal marks Slide timing.</p>
      </> : screen === 'complete' ? <p>You made it across.</p> : null}
      <div className="game-panel-actions">
        <button ref={first} className="game-primary" onClick={act}>{screen === 'ready' ? 'Start' : screen === 'complete' ? 'Replay' : 'Resume'}</button>
        {screen === 'paused' && <button onClick={() => { session.restart(); publish() }}>Restart</button>}
        <a href={backHref} onClick={onBack}>Back</a>
      </div>
    </section>
  </div>
}
