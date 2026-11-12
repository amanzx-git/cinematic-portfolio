import { openRecruiter, RECRUITER_ROUTE } from '../recruiterNavigation'
import { useRef } from 'react'
import { useScrollStory } from './useScrollStory'

export function ModeSelection() {
  const root = useRef<HTMLDivElement>(null)
  useScrollStory(root)
  return <div ref={root} className="mode-selection">
    <p className="eyebrow">THE NEXT STEP / YOUR PERSPECTIVE</p>
    <h2 id="play-title">Choose your{' '}<br /><em>perspective.</em></h2>
    <p className="play-description">Three ways forward. A new experience in the making.</p>
    <div className="mode-list" aria-label="Game modes" data-story-chapter>
      <a href={RECRUITER_ROUTE} onClick={openRecruiter} className="mode-option mode-recruiter" aria-labelledby="recruiter-title">
        <span className="mode-number" aria-hidden="true">01</span>
        <div><h3 id="recruiter-title">Play as Recruiter</h3>
          <p>Escape across the corporate rooftops.</p></div>
        <span className="mode-status">Play</span>
      </a>
      <article className="mode-option" aria-labelledby="aman-title">
        <span className="mode-number" aria-hidden="true">02</span>
        <div><h3 id="aman-title">Play as Aman</h3><p>A future perspective.</p></div>
        <span className="mode-status">Coming Soon</span>
      </article>
      <article className="mode-option" aria-labelledby="friend-title">
        <span className="mode-number" aria-hidden="true">03</span>
        <div><h3 id="friend-title">Play with Friend</h3><p>A future shared experience.</p></div>
        <span className="mode-status">Coming Soon</span>
      </article>
    </div>
    <p className="mode-note">Choose Recruiter to begin the rooftop escape.</p>
  </div>
}
