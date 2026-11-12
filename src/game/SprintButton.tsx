import type { GameSession } from './session'

export function SprintButton({ session, publish, disabled, held }: {
  session: GameSession; publish: () => void; disabled: boolean; held: boolean
}) {
  const release = (source: string) => { session.holdSprint(source, false); publish() }
  return <button className="game-sprint" data-held={held} disabled={disabled} aria-label="Sprint (hold)"
    onPointerDown={event => {
      if (event.button !== 0 || !session.canMove || document.hidden) return
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      session.holdSprint(`pointer-${event.pointerId}`, true)
      publish()
    }}
    onPointerUp={event => release(`pointer-${event.pointerId}`)}
    onPointerCancel={event => release(`pointer-${event.pointerId}`)}
    onLostPointerCapture={event => release(`pointer-${event.pointerId}`)}
    onBlur={() => { session.sim.clearSprint(); publish() }}
    onKeyDown={event => {
      if (['Space', 'Enter', 'ShiftLeft', 'ShiftRight'].includes(event.code)) {
        event.preventDefault()
        if (!event.repeat && !document.hidden) { session.holdSprint(`sprint-button-${event.code}`, true); publish() }
      }
    }}
    onKeyUp={event => { if (['Space', 'Enter', 'ShiftLeft', 'ShiftRight'].includes(event.code)) { event.preventDefault(); release(`sprint-button-${event.code}`) } }}
  >Sprint</button>
}
