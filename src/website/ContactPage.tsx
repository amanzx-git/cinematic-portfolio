import { useEffect, useRef, useState } from 'react'
import { openSiteLink } from './navigation'
import { useScrollStory } from './useScrollStory'
import { VideoBackground, pageBackgrounds } from './VideoBackground'
import './contact.css'

const email = 'ay134111@gmail.com'

export default function ContactPage({ onPresented }: { onPresented?: () => void }) {
  const root = useRef<HTMLElement>(null)
  const mounted = useRef(false)
  const [copyState, setCopyState] = useState<'idle' | 'pending' | 'success' | 'error'>('idle')
  useScrollStory(root)
  useEffect(() => {
    mounted.current = true
    onPresented?.()
    return () => { mounted.current = false }
  }, [onPresented])

  async function copyEmail() {
    setCopyState('pending')
    try {
      await navigator.clipboard.writeText(email)
      if (mounted.current) setCopyState('success')
    } catch {
      if (mounted.current) setCopyState('error')
    }
  }

  return <article ref={root} className="contact-transmission" aria-labelledby="contact-title">
    <div className="contact-room" aria-hidden="true">
      <VideoBackground config={pageBackgrounds.contact} scrollRoot={root} />
      <div className="contact-room-frames" />
      <svg className="contact-signals" viewBox="0 0 1000 600" preserveAspectRatio="none">
        <path d="M0 140H210L270 200H530L590 140H1000 M0 390H160L240 310H640L720 390H1000 M120 600V480L200 400 M850 0V220L760 310" />
      </svg>
    </div>
    <header className="contact-heading" data-story-chapter>
      <p className="eyebrow">CONTACT</p>
      <h1 id="contact-title" data-route-heading tabIndex={-1}>The Transmission.</h1>
      <p>Let’s start a conversation.</p>
    </header>
    <section className="contact-terminal" aria-label="Contact channels" data-story-chapter>
      <div className="contact-email-channel">
        <h2>Email</h2>
        <p className="contact-address">{email}</p>
        <div className="contact-actions">
          <a href={`mailto:${email}`} className="contact-email-action">Email Me <span aria-hidden="true">↗</span></a>
          <button type="button" onClick={copyEmail} disabled={copyState === 'pending'}>{copyState === 'pending' ? 'Copying…' : 'Copy Email'}</button>
        </div>
        <p className="contact-feedback" role="status" aria-live="polite">
          {copyState === 'success' ? 'Email copied.' : copyState === 'error' ? 'Could not copy. Select the email address above to copy it manually.' : ''}
        </p>
      </div>
      <div className="contact-profile-channels">
        <a href="https://www.linkedin.com/in/aman-yadav-profile" target="_blank" rel="noopener noreferrer">
          <span>LinkedIn</span><span>aman-yadav-profile</span><span className="contact-new-tab">Opens in new tab ↗</span>
        </a>
        <a href="https://github.com/amanzx-git" target="_blank" rel="noopener noreferrer">
          <span>GitHub</span><span>amanzx-git</span><span className="contact-new-tab">Opens in new tab ↗</span>
        </a>
      </div>
    </section>
    <a className="section-home" href="/" onClick={openSiteLink}>← Back to Home</a>
  </article>
}
