import type { MouseEvent } from 'react'
import { navigate } from '../recruiterNavigation.ts'

export const destinations = [
  { id: 'play', label: 'Play', path: '/play', loading: 'Opening Play', identity: 'motion' },
  { id: 'about', label: 'About', path: '/about', loading: 'Opening About', identity: 'scan' },
  { id: 'skills', label: 'Skills', path: '/skills', loading: 'Opening Skills', identity: 'system' },
  { id: 'projects', label: 'Projects', path: '/projects', loading: 'Opening Projects', identity: 'blueprint' },
  { id: 'contact', label: 'Contact', path: '/contact', loading: 'Opening Contact', identity: 'signal' },
] as const
export type SectionId = Exclude<typeof destinations[number]['id'], 'play'>
export function sectionForPath(path: string): SectionId | null {
  const destination = destinations.find(item => item.path === path.replace(/\/$/, ''))
  return destination && destination.id !== 'play' ? destination.id : null
}
export function openSiteLink(event: MouseEvent<HTMLAnchorElement>) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  const path = event.currentTarget.getAttribute('href')!
  if (path === location.pathname) return
  const play = path === '/play'
  if (play && location.pathname === '/') history.replaceState({ ...history.state, homeMenu: true }, '', '/')
  navigate(path, play ? { playIntro: true, fromHome: location.pathname === '/' } : path === '/' ? { homeMenu: true } : null)
}
