import type { MouseEvent } from 'react'

export const RECRUITER_ROUTE = '/play/recruiter'
export const MODES_ROUTE = '/play'
export function navigate(path: string, state: unknown = null) {
  history.pushState(state, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}
export function openRecruiter(event: MouseEvent<HTMLAnchorElement>) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  history.replaceState(null, '', MODES_ROUTE)
  navigate(RECRUITER_ROUTE, { fromModes: true })
}
export function backToModes(event: MouseEvent<HTMLAnchorElement>) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  if (history.state?.fromModes) history.back()
  else navigate(MODES_ROUTE)
}
