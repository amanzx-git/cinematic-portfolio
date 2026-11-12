import type { ReactNode } from 'react'
import { destinations, openSiteLink } from './navigation'
import { SoundControl } from './SoundControl'
import './site-header.css'

export function SiteHeader({ active, navigation, muted, consented, onToggle, allowConsent, controls }: {
  active?: string; navigation: boolean; muted: boolean; consented: boolean
  onToggle: () => void; allowConsent: boolean; controls?: ReactNode
}) {
  const links = destinations.map(destination => <a key={destination.id} href={destination.path}
    aria-current={active === destination.id ? 'page' : undefined} onClick={openSiteLink}>{destination.label}</a>)
  return <div className={navigation ? 'site-header-space' : undefined}>
    <header className={`cinema-header${navigation ? ' site-header' : ''}`}>
      <a className="wordmark" href="/" onClick={openSiteLink} aria-label="Aman portfolio home">AMAN<i> / </i>PORTFOLIO</a>
      {navigation && <nav className="site-desktop-nav" aria-label="Main navigation">{links}</nav>}
      <div className="header-controls">
        {!navigation && <span className="edition">AN INTERACTIVE DEVELOPER PORTFOLIO</span>}
        {controls}
        <SoundControl muted={muted} consented={consented} onToggle={onToggle} allowConsent={allowConsent} />
        {navigation && <details key={active} className="site-mobile-menu" onKeyDown={event => {
          if (event.key === 'Escape') {
            event.currentTarget.open = false
            event.currentTarget.querySelector('summary')?.focus()
          }
        }}>
          <summary>Menu</summary>
          <nav aria-label="Mobile navigation">{links}</nav>
        </details>}
      </div>
    </header>
  </div>
}
