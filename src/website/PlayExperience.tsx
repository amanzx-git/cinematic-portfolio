import { useCallback, useEffect, useRef, useState } from 'react'
import type { ComponentType, RefObject } from 'react'
import type { BackgroundMusic } from './backgroundMusic'
import { ShadowBackground } from './ShadowBackground'
import './play.css'

export type PlayStage = 'PLAY_INTRO' | 'MODE_SELECTION'
const captions = ['A new perspective.', 'One step at a time.', 'Choose your next move.']
type Transition = 'intro' | 'darkening' | 'waiting' | 'revealing' | 'ready'

export function PlayExperience({ stage, onStageChange, onBack, source, reduced, paused = false, audioController, onPresented }: {
  onPresented?: () => void
  audioController: RefObject<BackgroundMusic | null>
  stage: PlayStage
  onStageChange: (stage: PlayStage) => void
  onBack: () => void
  source: string | null
  reduced: boolean
  paused?: boolean
}) {
  const [Destination, setDestination] = useState<ComponentType | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [finished, setFinished] = useState(stage === 'MODE_SELECTION')
  const [failedVideo, setFailedVideo] = useState(false)
  const [caption, setCaption] = useState(0)
  const [videoReady, setVideoReady] = useState(false)
  const [transition, setTransition] = useState<Transition>(stage === 'MODE_SELECTION' ? 'ready' : 'intro')
  const [shadowReady, setShadowReady] = useState(false)
  const [shadowFailed, setShadowFailed] = useState(false)
  const requested = useRef(false)
  const requestModes = useCallback(() => {
    if (requested.current) return
    requested.current = true
    audioController.current?.silenceIntro()
    setFinished(true)
  }, [audioController])
  const heading = useRef<HTMLElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const hasVideo = !!source && !failedVideo && !reduced
  const showIntroLayer = stage === 'PLAY_INTRO' && hasVideo && transition !== 'ready'
  const showingVideo = hasVideo && !finished && stage === 'PLAY_INTRO'

  const resourcesReady = !!Destination && (shadowReady || shadowFailed || reduced)
  const readyMilestones = Number(!!Destination) + Number(shadowReady || shadowFailed || reduced)
  useEffect(() => {
    if (stage === 'MODE_SELECTION' && (resourcesReady || loadError)) onPresented?.()
  }, [stage, resourcesReady, loadError, onPresented])

  useEffect(() => { if (stage === 'PLAY_INTRO' && (videoReady || !hasVideo)) onPresented?.() }, [stage, videoReady, hasVideo, onPresented])
  useEffect(() => { if (reduced) setShadowReady(false) }, [reduced])

  useEffect(() => {
    const element = video.current
    return () => { if (element) { element.pause(); element.removeAttribute('src'); element.load() } }
  }, [showIntroLayer])

  useEffect(() => {
    let active = true
    setLoadError(false)
    // Only the website destination module; no game or renderer dependency.
    import('./ModeSelection').then(module => {
      if (active) setDestination(() => module.ModeSelection)
    }).catch(() => { if (active) setLoadError(true) })
    return () => { active = false }
  }, [])
  useEffect(() => { heading.current?.focus() }, [stage, finished])
  useEffect(() => {
    if (finished && resourcesReady && transition === 'intro' && !paused) setTransition('darkening')
  }, [finished, resourcesReady, transition, paused])
  useEffect(() => {
    if (!paused && transition === 'waiting' && (shadowReady || shadowFailed || reduced)) setTransition('revealing')
  }, [transition, shadowReady, shadowFailed, reduced, paused])
  useEffect(() => {
    if (paused) return
    if (transition !== 'darkening' && transition !== 'revealing') return
    const timer = window.setTimeout(() => {
      if (transition === 'darkening') setTransition('waiting')
      else { setTransition('ready'); onStageChange('MODE_SELECTION') }
    }, reduced ? 0 : 450)
    return () => clearTimeout(timer)
  }, [transition, reduced, paused, onStageChange])
  useEffect(() => {
    if (shadowReady || shadowFailed || reduced || paused) return
    const timer = window.setTimeout(() => setShadowFailed(true), 15000)
    return () => clearTimeout(timer)
  }, [transition, shadowReady, shadowFailed, reduced, paused])
  useEffect(() => {
    if (paused || stage !== 'PLAY_INTRO' || showingVideo || reduced || finished) return
    // Editorial caption pacing, independent of destination loading/readiness.
    const timer = window.setTimeout(() => {
      if (caption < captions.length - 1) setCaption(value => value + 1)
      else requestModes()
    }, 2200)
    return () => clearTimeout(timer)
  }, [stage, showingVideo, reduced, finished, caption, paused, requestModes])
  useEffect(() => {
    const element = video.current
    if (!element || !showingVideo) return
    if (paused) { element.pause(); return }
    let active = true
    audioController.current?.playIntro(element).catch(() => { if (active) setFailedVideo(true) })
    return () => { active = false; audioController.current?.detachIntro(element) }
  }, [showingVideo, paused, audioController])
  useEffect(() => {
    const element = video.current
    if (!showingVideo || paused || !element) return
    // Detect lack of playback progress, never impose a cinematic duration.
    let lastTime = element.currentTime
    let timer: number
    const arm = () => { clearTimeout(timer); timer = window.setTimeout(() => setFailedVideo(true), 20000) }
    const progress = () => {
      if (element.currentTime !== lastTime) { lastTime = element.currentTime; arm() }
    }
    arm()
    element.addEventListener('timeupdate', progress)
    return () => { clearTimeout(timer); element.removeEventListener('timeupdate', progress) }
  }, [showingVideo, paused])

  return <section className="play-experience" data-transition={transition} ref={heading} tabIndex={-1} aria-labelledby="play-title"
    onKeyDown={event => { if (event.key === 'Escape') onBack() }}>
    {/* Retain the outgoing frame until the shadow transition finishes. */}
    {showIntroLayer && <video className={`play-intro-video ${videoReady && (transition === 'intro' || transition === 'darkening') ? 'is-visible' : ''}`} ref={video} src={source!}
      playsInline preload="auto" poster="/media/website/city-poster.svg" aria-hidden="true"
      onLoadedData={() => setVideoReady(true)}
      onEnded={requestModes} onError={() => setFailedVideo(true)} />}
    {!reduced && !shadowFailed && <ShadowBackground paused={paused}
      visible={transition !== 'intro' && transition !== 'darkening' && shadowReady} onReady={() => setShadowReady(true)} onFailure={() => setShadowFailed(true)} />}
    <div className="shadow-transition" aria-hidden="true" />
    {stage === 'MODE_SELECTION' && Destination ? <Destination /> : <div className="play-intro">
      <div className={hasVideo ? 'cinematic-copy' : undefined}>
      <p className="eyebrow">A MOMENT BEFORE THE NEXT STEP</p>
      <h2 id="play-title">A different<br /><em>way forward.</em></h2>
      <div className="intro-captions" aria-live="polite" aria-atomic="true">
        {reduced ? captions.map(text => <p key={text}>{text}</p>)
          : <p key={showingVideo ? 'video' : caption} className="intro-caption">{showingVideo ? 'Find your next perspective.' : captions[caption]}</p>}
      </div>
      </div>
      {failedVideo && <p className="play-notice" role="status">The video is unavailable. Continuing with the caption introduction.</p>}
      {loadError && <div className="play-notice" role="alert">
        <p>Mode selection could not load. Return to the homepage or reload to try again.</p>
        <button className="text-control" onClick={() => location.reload()}>Reload website</button>
      </div>}
    </div>}
    {stage === 'MODE_SELECTION' && shadowFailed && <p className="play-notice" role="status">The nighttime video is unavailable. Showing the static background.</p>}
    {stage === 'PLAY_INTRO' && transition === 'intro' && !loadError && <div className="cinematic-loading">
      <span role="status">{resourcesReady ? 'Mode selection ready' : 'Preparing mode selection'} / {readyMilestones}/2 resources ready</span>
      <progress max={2} value={readyMilestones} aria-label="Mode selection resources ready" />
    </div>}
    <div className="play-controls">
      <button className="text-control" onClick={onBack}>← Back to homepage</button>
      {stage === 'PLAY_INTRO' && resourcesReady && <button className="enter-button cinematic-skip" disabled={finished} onClick={requestModes}>
        Skip intro <span aria-hidden="true">→</span>
      </button>}
    </div>
  </section>
}
