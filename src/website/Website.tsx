import { useEffect, useRef, useState } from 'react'
import { loadOpening, type MediaConfig } from './resources'
import { useReducedMotion } from './useReducedMotion'
import { PlayExperience, type PlayStage } from './PlayExperience'
import { HomepageBackground } from './HomepageBackground'
import { useBackgroundMusic } from './useBackgroundMusic'
import { SoundControl } from './SoundControl'
import { useMobileLandscape } from './useMobileLandscape'
import { OrientationGate } from './OrientationGate'
import './website.css'

type OpeningState = 'LOADING' | 'AWAITING_ENTER' | 'ENTRANCE_ANIMATION' | 'HOME_MENU' | PlayStage
type Section = 'About' | 'Projects' | 'Contact'

export function Website() {
  const [state, setState] = useState<OpeningState>('LOADING')
  const [media, setMedia] = useState<MediaConfig>({ entrance: null, idle: null, playIntro: null })
  const music = useBackgroundMusic()
  const landscape = useMobileLandscape()
  const hasEntered = state !== 'LOADING' && state !== 'AWAITING_ENTER'
  const gated = hasEntered && landscape.mobile && landscape.portrait && !landscape.fallback
  const simplified = hasEntered && landscape.mobile && landscape.portrait && landscape.fallback
  const [paused, setPaused] = useState(false)
  const [notice, setNotice] = useState('')
  const [section, setSection] = useState<Section | null>(null)
  const [idleFailed, setIdleFailed] = useState(false)
  const enter = useRef<HTMLButtonElement>(null)
  const firstMenu = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const entered = state === 'ENTRANCE_ANIMATION' || state === 'HOME_MENU'
  const playing = state === 'PLAY_INTRO' || state === 'MODE_SELECTION'
  const finishEntrance = () => setState('HOME_MENU')

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    // A network watchdog, never a minimum duration or simulated progress.
    const timeout = window.setTimeout(() => controller.abort(), 8000)
    loadOpening(controller.signal).then(result => {
      clearTimeout(timeout)
      if (!active) return
      setMedia(result.media)
      if (result.fallback) setNotice('Some visuals are unavailable. The static experience is ready.')
      setState(current => current === 'LOADING' ? 'AWAITING_ENTER' : current)
    })
    return () => { active = false; clearTimeout(timeout); controller.abort() }
  }, [])

  useEffect(() => {
    if (state === 'AWAITING_ENTER') enter.current?.focus()
    if (state === 'HOME_MENU') firstMenu.current?.focus()
  }, [state])
  useEffect(() => { if (section) panel.current?.focus() }, [section])
  useEffect(() => {
    if (reduced && state === 'ENTRANCE_ANIMATION') finishEntrance()
  }, [reduced, state])

  useEffect(() => {
    if (state !== 'ENTRANCE_ANIMATION' || gated) return
    // Prevent a stalled network/video from trapping visitors. Skip is also available.
    const timeout = window.setTimeout(() => {
      setNotice('The opening video did not finish. Continuing to the menu.')
      finishEntrance()
    }, 15000)
    return () => clearTimeout(timeout)
  }, [state, gated])

  function begin() {
    music.start()
    landscape.request()
    setState(reduced || !media.entrance ? 'HOME_MENU' : 'ENTRANCE_ANIMATION')
  }
  function closePanel() {
    setSection(null)
    document.querySelector<HTMLButtonElement>(`[data-section="${section}"]`)?.focus()
  }

  return <main ref={landscape.container} className="cinema" data-state={state} data-mobile={landscape.mobile} data-simplified={simplified}>
    <audio ref={music.audio} data-testid="background-music" loop preload="none" />
    <div className="cinema-backdrop" aria-hidden="true">
      {!reduced && entered && <HomepageBackground phase={state === 'ENTRANCE_ANIMATION' ? 'entrance' : 'idle'}
        entrance={media.entrance} idle={idleFailed ? null : media.idle} paused={paused || gated}
        onComplete={finishEntrance} onFailure={kind => {
          setNotice('Video playback is unavailable. Showing the static background.')
          if (kind === 'entrance') finishEntrance()
          else setIdleFailed(true)
        }} />}
    </div>
    <div className="cinema-shade" aria-hidden="true" />
    <header className="cinema-header">
      <a className="wordmark" href="/" aria-label="Aman portfolio home">AMAN<i> / </i>PORTFOLIO</a>
      <div className="header-controls"><span className="edition">AN INTERACTIVE DEVELOPER PORTFOLIO</span>
        {landscape.fullscreen && <button className="text-control" onClick={landscape.exit}>Exit fullscreen</button>}
        <SoundControl muted={music.muted} consented={music.consented} onToggle={music.toggle} />
      </div>
    </header>

    {!playing && <div className={`cinema-content ${state === 'ENTRANCE_ANIMATION' ? 'cinema-entering' : ''}`}>
      <p className="eyebrow"><span /> BRIDGING THE GAP BETWEEN CODE &amp; CREATIVITY</p>
      <h1><span>The Journey</span>{' '}<em>Is Just Beginning.</em></h1>
      <p className="cinema-description">Every line of code. Every leap forward.</p>
      {state === 'LOADING' && <div className="opening-action">
        <p role="status" className="loading-status"><span className="loading-mark" />Preparing the experience</p>
        <button className="text-control" onClick={() => {
          setState('AWAITING_ENTER')
          setNotice('Continuing with the static opening while resources finish loading.')
        }}>Continue with static visuals</button>
      </div>}
      {state === 'AWAITING_ENTER' && <div className="opening-action">
        <button ref={enter} className="enter-button" onClick={begin}>Enter <span aria-hidden="true">↗</span></button>
        <p className="action-caption">TAKE A MOMENT. THEN STEP INSIDE.</p>
      </div>}
      {state === 'HOME_MENU' && <nav className="home-menu" aria-label="Main navigation">
        {(['Play', 'About', 'Projects', 'Contact'] as const).map((item, index) =>
          <button key={item} ref={index === 0 ? firstMenu : undefined} data-section={item}
            aria-expanded={item === 'Play' ? undefined : section === item} aria-controls={item === 'Play' ? undefined : 'menu-detail'}
            onClick={() => {
              if (item === 'Play') { setSection(null); setState('PLAY_INTRO') }
              else setSection(item)
            }}>
            <span className="menu-index">0{index + 1}</span>{item}<span className="menu-arrow" aria-hidden="true">↗</span>
          </button>)}
      </nav>}
    </div>}

    {playing && <PlayExperience stage={state} onStageChange={setState} source={media.playIntro}
      reduced={reduced} paused={gated}
      onBack={() => setState('HOME_MENU')} />}

    {state === 'ENTRANCE_ANIMATION' && <button className="skip-opening" onClick={finishEntrance} autoFocus>Skip opening →</button>}

    {state === 'HOME_MENU' && section && <section id="menu-detail" className="menu-detail" ref={panel}
      tabIndex={-1} aria-labelledby="detail-title" onKeyDown={event => { if (event.key === 'Escape') closePanel() }}>
      <p className="eyebrow">EXPLORE / {section.toUpperCase()}</p>
      <h2 id="detail-title">{section}</h2>
      <p>{section === 'About' ? 'A developer portfolio taking shape at the intersection of code, movement and atmosphere.'
        : section === 'Projects' ? 'Selected work will appear here. This opening is the first piece.'
        : 'Contact details will be added here when the portfolio is ready.'}</p>
      <button className="text-control" onClick={closePanel}>Back to menu ←</button>
    </section>}

    <footer className="cinema-footer">
      <span>CODE · MOTION · PROGRESS</span>
      {!playing && <div className="cinema-controls">
        {entered && !reduced && media.idle && state === 'HOME_MENU' && !idleFailed &&
          <button onClick={() => setPaused(value => !value)}>{paused ? 'Resume motion' : 'Pause motion'}</button>}
      </div>}
      <span className="city-coordinate">A QUIET PLACE TO BEGIN / 01</span>
    </footer>
    {gated && <OrientationGate onContinue={landscape.continuePortrait} onExit={landscape.exit}
      fullscreen={landscape.fullscreen} muted={music.muted} onToggle={music.toggle} />}
    <p className="media-notice" role="status">{notice}</p>
    <p className="media-notice" role="status">{music.status === 'unavailable' ? 'Background music is unavailable. You can continue without sound.'
      : music.status === 'blocked' ? 'Music playback was blocked. Toggle sound to try again.' : ''}</p>
  </main>
}
