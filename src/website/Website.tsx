import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { loadOpening, type MediaConfig } from './resources'
import { useReducedMotion } from './useReducedMotion'
import { PlayExperience, type PlayStage } from './PlayExperience'
import { HomepageBackground } from './HomepageBackground'
import { useBackgroundMusic } from './useBackgroundMusic'
import { INFORMATION_VOLUME, MUSIC_VOLUME } from './backgroundMusic'
import { SiteHeader } from './SiteHeader'
import { useMobileLandscape } from './useMobileLandscape'
import { OrientationGate } from './OrientationGate'
import { destinations, openSiteLink, sectionForPath } from './navigation'
import { navigate } from '../recruiterNavigation'
import './website.css'

const SectionPage = lazy(() => import('./SectionPage'))
let enteredThisSession = false

type OpeningState = 'LOADING' | 'AWAITING_ENTER' | 'ENTRANCE_ANIMATION' | 'HOME_MENU' | PlayStage

export function Website({ initialModeSelection = false, routePath = initialModeSelection ? '/play' : '/', onPresented }: { initialModeSelection?: boolean; routePath?: string; onPresented?: () => void }) {
  const section = sectionForPath(routePath)
  const resumeHome = !!section || (enteredThisSession && !!history.state?.homeMenu)
  const previousPath = useRef(routePath)
  const [state, setState] = useState<OpeningState>(initialModeSelection ? 'MODE_SELECTION' : resumeHome ? 'HOME_MENU' : 'LOADING')
  const [media, setMedia] = useState<MediaConfig>({ entrance: null, idle: null, playIntro: null })
  const music = useBackgroundMusic(initialModeSelection || resumeHome)
  const audioController = music.controller
  useEffect(() => {
    audioController.current?.setAmbientVolume(section ? INFORMATION_VOLUME : MUSIC_VOLUME)
  }, [section, audioController])
  const changePlayStage = useCallback((stage: PlayStage) => {
    if (stage === 'MODE_SELECTION') { history.replaceState({ ...history.state, playIntro: false }, '', location.href); audioController.current?.resumeAmbient() }
    setState(stage)
  }, [audioController])
  const landscape = useMobileLandscape()
  const hasEntered = state !== 'LOADING' && state !== 'AWAITING_ENTER'
  const gated = !section && hasEntered && landscape.mobile && landscape.portrait && !landscape.fallback
  const simplified = hasEntered && landscape.mobile && landscape.portrait && landscape.fallback
  const [paused, setPaused] = useState(false)
  const [notice, setNotice] = useState('')
  const [idleFailed, setIdleFailed] = useState(false)
  const enter = useRef<HTMLButtonElement>(null)
  const firstMenu = useRef<HTMLAnchorElement>(null)
  const reduced = useReducedMotion()
  const entered = state === 'ENTRANCE_ANIMATION' || state === 'HOME_MENU'
  const playing = !section && (state === 'PLAY_INTRO' || state === 'MODE_SELECTION')
  const finishEntrance = () => { enteredThisSession = true; history.replaceState({ ...history.state, homeMenu: true }, '', location.href); setState('HOME_MENU') }

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
  useEffect(() => {
    if (previousPath.current === routePath) return
    const previous = previousPath.current
    previousPath.current = routePath
    if (/^\/play\/?$/.test(routePath)) {
      if (history.state?.playIntro) { audioController.current?.enterIntro(); setState('PLAY_INTRO') }
      else { audioController.current?.resumeAmbient(); setState('MODE_SELECTION') }
    } else {
      if (previous === '/play') audioController.current?.resumeAmbient()
      enteredThisSession = true
      setState('HOME_MENU')
    }
  }, [routePath, audioController])
  useEffect(() => {
    if (!section && !/^\/play\/?$/.test(routePath) && state !== 'LOADING') onPresented?.()
  }, [section, routePath, state, onPresented])
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
    enteredThisSession = true
    music.start()
    landscape.request()
    if (reduced || !media.entrance) finishEntrance()
    else setState('ENTRANCE_ANIMATION')
  }


  return <main ref={landscape.container} className="cinema" data-section={section ?? undefined} data-state={state} data-mobile={landscape.mobile} data-simplified={simplified}>
    <audio ref={music.audio} data-testid="background-music" loop preload="none" />
    <div className="cinema-backdrop" aria-hidden="true">
      {!reduced && entered && <HomepageBackground phase={state === 'ENTRANCE_ANIMATION' ? 'entrance' : 'idle'}
        entrance={media.entrance} idle={idleFailed ? null : media.idle} paused={paused || gated || section === 'about'}
        onComplete={finishEntrance} onFailure={kind => {
          setNotice('Video playback is unavailable. Showing the static background.')
          if (kind === 'entrance') finishEntrance()
          else setIdleFailed(true)
        }} />}
    </div>
    <div className="cinema-shade" aria-hidden="true" />
    <SiteHeader active={section ?? (state === 'MODE_SELECTION' ? 'play' : undefined)} navigation={!!section || state === 'MODE_SELECTION'}
      muted={music.muted} consented={music.consented} onToggle={music.toggle} allowConsent={initialModeSelection || resumeHome}
      controls={landscape.fullscreen && <button className="text-control" onClick={landscape.exit}>Exit fullscreen</button>} />

    {!playing && !section && <div className={`cinema-content ${state === 'ENTRANCE_ANIMATION' ? 'cinema-entering' : ''}`}>
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
        {destinations.map((destination, index) =>
          <a key={destination.id} href={destination.path} ref={index === 0 ? firstMenu : undefined}
            data-section={destination.label} onClick={openSiteLink}>
            {destination.label}<span className="menu-arrow" aria-hidden="true">↗</span>
          </a>)}
      </nav>}
    </div>}

    {playing && <PlayExperience stage={state} onStageChange={changePlayStage} source={media.playIntro} audioController={audioController} onPresented={onPresented}
      reduced={reduced} paused={gated}
      onBack={() => { if (history.state?.fromHome) history.back(); else navigate('/', { homeMenu: true }) }} />}

    {state === 'ENTRANCE_ANIMATION' && <button className="skip-opening" onClick={finishEntrance} autoFocus>Skip opening →</button>}

    {section && <Suspense fallback={null}><SectionPage section={section} onPresented={onPresented} /></Suspense>}

    <footer className="cinema-footer">
      <span>CODE · MOTION · PROGRESS</span>
      {!playing && !section && <div className="cinema-controls">
        {entered && !reduced && media.idle && state === 'HOME_MENU' && !idleFailed &&
          <button onClick={() => setPaused(value => !value)}>{paused ? 'Resume motion' : 'Pause motion'}</button>}
      </div>}
      <span className="city-coordinate">A QUIET PLACE TO BEGIN / 01</span>
    </footer>
    {gated && <OrientationGate onContinue={landscape.continuePortrait} onExit={landscape.exit}
      fullscreen={landscape.fullscreen} muted={music.muted} onToggle={music.toggle} />}
    <p className="media-notice" role="status">{notice}</p>
    <p className="media-notice" role="status">{music.status === 'unavailable' ? 'Background music is unavailable. You can continue without sound.'
      : music.status === 'blocked' ? 'Music playback was blocked. Toggle sound to try again.'
      : music.status === 'intro-blocked' ? 'Intro audio was blocked. Toggle sound off and on to try again.' : ''}</p>
  </main>
}
