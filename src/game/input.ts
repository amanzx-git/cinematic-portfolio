import { useEffect } from 'react'
import type { GameSession } from './session'

export function useGameInput(session: GameSession, publish: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) { session.clearInput(); return }
    return bindGameInput(session, publish)
  }, [session, publish, enabled])
}

export function bindGameInput(session: GameSession, publish: () => void) {
  const keydown = (event: KeyboardEvent) => {
    if (event.target instanceof HTMLElement &&
      (event.target.isContentEditable || event.target.closest('button, a, input, select, textarea, summary'))) return
    if (!['Space', 'ArrowUp', 'ArrowDown', 'KeyS', 'KeyR', 'Escape', 'ShiftLeft', 'ShiftRight'].includes(event.code)) return
    event.preventDefault()
    if (event.repeat || document.hidden) return
    if (event.code === 'KeyR') { session.restart(); publish(); return }
    if (event.code === 'Escape') { session.togglePause(); publish(); return }
    if (!session.canMove) return
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') { session.holdSprint(event.code, true); publish() }
    else if (event.code === 'ArrowDown' || event.code === 'KeyS') session.sim.requestSlide()
    else session.sim.requestJump()
  }
  const keyup = (event: KeyboardEvent) => {
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') { session.holdSprint(event.code, false); publish() }
  }
  const clear = () => session.clearInput()
  window.addEventListener('keydown', keydown)
  window.addEventListener('keyup', keyup)
  window.addEventListener('blur', clear)
  document.addEventListener('visibilitychange', clear)
  return () => {
    window.removeEventListener('keydown', keydown)
    window.removeEventListener('keyup', keyup)
    window.removeEventListener('blur', clear)
    document.removeEventListener('visibilitychange', clear)
    clear()
  }
}
