import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Group, Mesh, OrthographicCamera, Vector3 } from 'three'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { normalizeMaleCharacter, disposePlayerCharacter } from '../recruiter/maleCharacter'
import { loadCharacterBytes, RECRUITER_MODEL, FALLBACK_RECRUITER_MODEL, SECURITY_MODEL } from '../recruiter/resources'
import { SceneCanvas } from '../rendering/SceneCanvas'
import { initializeRenderer, type Graphics } from '../rendering/renderer'
import { disposeRunner } from '../lab/RunnerPlayback'
import { Simulation, STEP, course, collider } from './simulation'
import { SLIDE_DURATION } from './slide'
import { zoneAt } from './course'
import { FollowCamera, framingHeight, compositionLead } from './camera'
import { GameAnimation } from './animation'
import { useGameInput } from './input'
import { NightEnvironment } from './NightEnvironment'
import { ElectricalHazards } from './ElectricalHazards'
import { HunterView } from './HunterView'
import { DroneView } from './DroneView'
import { hazardState } from './hazards'
import { MovementFeedback } from './feedback'
import { FeedbackView } from './FeedbackView'
import { useReducedMotion } from './useReducedMotion'
import { GameSession, type GameScreen } from './session'
import { GameOverlay } from './GameOverlay'
import { SprintButton } from './SprintButton'
import { backToModes, MODES_ROUTE } from '../recruiterNavigation'
import './game.css'

class Boundary extends Component<{ children: ReactNode; onFailure: () => void }, { error: string }> {
  state = { error: '' }
  static getDerivedStateFromError(error: Error) { return { error: error.message } }
  componentDidCatch() { this.props.onFailure() }
  render() { return this.state.error ? <p role="alert">Game rendering failed. {this.state.error}</p> : this.props.children }
}
type SceneProps = {
  sim: Simulation; animation: GameAnimation; asset: GLTF; robotAsset: GLTF; session: GameSession
  publish: () => void; progress: React.RefObject<HTMLProgressElement | null>
  hud: React.RefObject<HTMLOutputElement | null>; stage: React.RefObject<HTMLDivElement | null>
  showCollider: boolean; decorations: boolean; effects: boolean; reducedMotion: boolean
  onPresented: () => void
}
function GameScene({ sim, animation, asset, robotAsset, session, publish, progress, hud, stage, showCollider, decorations, effects, reducedMotion, onPresented }: SceneProps) {
  const { camera, size, scene } = useThree()
  useEffect(() => {
    const previous = scene.onAfterRender
    let reported = false
    let frame = 0
    const presented: typeof scene.onAfterRender = function (...args) {
      previous.apply(scene, args)
      if (!reported) { reported = true; frame = requestAnimationFrame(onPresented) }
    }
    scene.onAfterRender = presented
    return () => { cancelAnimationFrame(frame); if (scene.onAfterRender === presented) scene.onAfterRender = previous }
  }, [scene, onPresented])
  const actor = useRef<Group>(null), visual = useRef<Group>(null), body = useRef<Mesh>(null)
  const follow = useRef(new FollowCamera()).current
  const target = useRef(new Vector3()).current
  const feedback = useRef(new MovementFeedback()).current
  const elapsed = useRef(0)
  useEffect(() => {
    const ortho = camera as OrthographicCamera
    ortho.zoom = Math.min(size.width / 14, size.height / 6)
    ortho.updateProjectionMatrix()
  }, [camera, size])
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    if (session.started && !session.paused && !document.hidden) {
      sim.advance(delta, step => { animation.update(step, sim); feedback.update(step, sim, effects && !reducedMotion) })
    } else {
      sim.accumulator = 0
      animation.update(!session.started && !document.hidden ? dt : 0, sim)
      feedback.update(0, sim, effects && !reducedMotion)
    }
    publish()
    const alpha = Math.max(0, sim.accumulator / STEP)
    const x = sim.previousX + (sim.x - sim.previousX) * alpha
    const y = sim.previousY + (sim.y - sim.previousY) * alpha
    actor.current!.position.set(x, y, 0)
    visual.current!.position.y = animation.visualOffsetY
    body.current!.visible = showCollider
    body.current!.scale.y = sim.colliderHeight
    body.current!.position.y = sim.colliderHeight / 2
    const lead = compositionLead(x, reducedMotion)
    const cameraX = follow.update(x, dt, sim.restarts, framingHeight(x, course.platforms, y), lead)
    camera.position.set(cameraX, 3.6 + follow.y, 18)
    target.set(cameraX, 1.2 + follow.y, 0)
    camera.lookAt(target)
    elapsed.current += delta
    if (elapsed.current >= 0.05 && hud.current) {
      if (progress.current) {
        progress.current.value = Math.min(course.finish, Math.max(0, sim.x))
        progress.current.setAttribute('aria-valuetext', Math.floor(progress.current.value / course.finish * 100) + '% complete')
      }
      const section = course.sections.reduce<string>((name, [start, label]) => sim.x >= start ? label : name, 'Opening')
      hud.current.textContent = `${animation.current} | grounded ${sim.grounded} | x ${sim.x.toFixed(2)} | vy ${sim.vy.toFixed(2)} | restarts ${sim.restarts} | ${session.paused ? 'paused' : sim.phase} | ${section} | ${Math.floor(sim.x / course.finish * 100)}% | body ${collider.width} x ${sim.colliderHeight.toFixed(2)} x ${collider.depth} m | support ${sim.supportingPlatform < 0 ? 'none' : sim.supportingPlatform + 1} | feet ${sim.y.toFixed(3)} m`
      if (sim.landTime > 0) hud.current.textContent += ` | Land ${animation.actions.Land.time.toFixed(2)}/${animation.actions.Land.getClip().duration.toFixed(2)} s | recovery ${sim.landTime.toFixed(2)} s | impact ${sim.lastImpactSpeed.toFixed(1)} / drop ${sim.lastFallDistance.toFixed(1)}`
      if (sim.sliding) hud.current.textContent += ` | Slide ${sim.slideTime!.toFixed(2)}/${SLIDE_DURATION.toFixed(2)} s`
      Object.assign(hud.current.dataset, {
        phase: sim.phase, screen: session.screen, started: String(session.started), paused: String(session.paused),
        speed: String(sim.speed), sprintHeld: String(sim.sprintHeld),
        zone: zoneAt(sim.x).id,
        hunterState: sim.hunter.state, hunterX: String(sim.hunter.x), hunterY: String(sim.hunter.y), hunterGap: String(sim.x - sim.hunter.x),
        hunterDisengage: String(sim.hunter.disengageTime),
        droneState: sim.drones[0]?.state, dronePhase: sim.drones[0]?.scanPhase, droneTime: String(sim.drones[0]?.time ?? 0),
        hazardTime: String(sim.hazardTime), arcState: hazardState(course.barriers.find(barrier => barrier.pulse)?.pulse, sim.hazardTime),
        x: String(sim.x), y: String(sim.y), vy: String(sim.vy), grounded: String(sim.grounded),
        restarts: String(sim.restarts), jumps: String(sim.jumps), landings: String(sim.landings),
        animation: animation.current, cameraX: String(cameraX), actorX: String(x), cameraY: String(follow.y),
        movement: animation.current, bodyHeight: String(sim.colliderHeight), slideTime: String(sim.slideTime ?? 0),
        slideClipTime: String(animation.actions.Slide.time), standingClearance: String(sim.standingClearance),
        failure: sim.failure ?? '', support: String(sim.supportingPlatform), footHeight: String(sim.y),
        colliderWidth: String(collider.width), colliderHeight: String(sim.colliderHeight),
        visualOffset: String(animation.visualOffsetY), blocked: String(sim.blocked),
        runTime: String(animation.actions.Run.time), runRate: String(animation.actions.Run.getEffectiveTimeScale()),
        runMeanRate: String(animation.runPlaybackRate * sim.speed / course.speed), runWeight: String(animation.actions.Run.getEffectiveWeight()),
        effects: String(effects && !reducedMotion), reducedMotion: String(reducedMotion), cameraLead: String(lead),
        activePuffs: String(feedback.activeCount), landEffects: String(feedback.events.land),
        slideEffects: String(feedback.events.slide), failureEffects: String(feedback.events.failure), finishEffects: String(feedback.events.finish),
        landCompletions: String(animation.landCompletions), completedLandTime: String(animation.completedLandTime),
        landClipTime: String(animation.actions.Land.time), landDuration: String(animation.actions.Land.getClip().duration),
        landFinished: String(animation.landFinished), landSpeed: String(animation.actions.Land.getEffectiveTimeScale()),
        hardLandings: String(sim.hardLandings), recovery: String(sim.landTime), fallDistance: String(sim.lastFallDistance), impactSpeed: String(sim.lastImpactSpeed),
      })
      elapsed.current = 0
    }
  }, -2)
  return <>
    <FeedbackView feedback={feedback} stage={stage} enabled={effects && !reducedMotion} />
    <NightEnvironment platforms={course.platforms} decorations={decorations} reducedMotion={reducedMotion} reset={sim} diagnostics={hud} />
    <ElectricalHazards sim={sim} animated={effects && !reducedMotion} />
    <HunterView sim={sim} asset={robotAsset} reducedMotion={reducedMotion} />
    <DroneView sim={sim} reducedMotion={reducedMotion} />
    <group position={[course.finish, course.platforms[course.platforms.length - 1][2], 0]}>
      <mesh position={[0, 0.3, -1.02]}><boxGeometry args={[0.12, 0.6, 0.13]} /><meshStandardMaterial color="#555555" /></mesh>
      <mesh position={[0, 0.61, -1.02]}><boxGeometry args={[0.16, 0.07, 0.16]} /><meshBasicMaterial color="#91b9a9" /></mesh>
      <mesh position={[0, 0.004, 0]}><boxGeometry args={[0.065, 0.008, 2.3]} /><meshBasicMaterial color="#76a694" /></mesh>
    </group>
    <group ref={actor}>
      <group ref={visual} rotation={[0, Math.PI / 2, 0]}><primitive object={asset.scene} dispose={null} /></group>
      <mesh ref={body} visible={false}><boxGeometry args={[collider.width, 1, collider.depth]} /><meshBasicMaterial color="#6affd8" wireframe depthTest={false} /></mesh>
    </group>
  </>
}
export default function GameLab({ production = false, onPresented, onScreenChange, onReplay, completionVisible = true, inputEnabled = true }: {
  production?: boolean; onPresented?: () => void; onScreenChange?: (screen: GameScreen) => void
  onReplay?: () => void; completionVisible?: boolean; inputEnabled?: boolean
}) {
  const backHref = production ? MODES_ROUTE : '/lab'
  const onBack = production ? backToModes : undefined
  const [sim] = useState(() => new Simulation())
  const [session] = useState(() => new GameSession(sim))
  const [ready, setReady] = useState<{ graphics: Graphics; asset: GLTF; robotAsset: GLTF; animation: GameAnimation } | null>(null)
  const [error, setError] = useState('')
  const [presented, setPresented] = useState(false)
  const present = useCallback(() => { setPresented(true); onPresented?.() }, [onPresented])
  useEffect(() => { if (error) onPresented?.() }, [error, onPresented])
  const [screen, setScreen] = useState<GameScreen>('ready')
  const [sprinting, setSprinting] = useState(false)
  const sprintRef = useRef(false)
  useEffect(() => { onScreenChange?.(screen) }, [screen, onScreenChange])
  const screenRef = useRef<GameScreen>('ready')
  const [showCollider, setShowCollider] = useState(false)
  const [effects, setEffects] = useState(true)
  const [decorations, setDecorations] = useState(true)
  const reducedMotion = useReducedMotion()
  const hud = useRef<HTMLOutputElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const progress = useRef<HTMLProgressElement>(null)
  const debug = useRef<HTMLDetailsElement>(null)
  const publish = useCallback(() => {
    if (sprintRef.current !== sim.sprintHeld) { sprintRef.current = sim.sprintHeld; setSprinting(sim.sprintHeld) }
    if (screenRef.current === session.screen) return
    if (['playing', 'paused', 'complete'].includes(session.screen) && debug.current) debug.current.open = false
    screenRef.current = session.screen
    setScreen(session.screen)
  }, [session, sim])
  const modal = screen === 'paused' || screen === 'complete'
  const active = screen === 'playing'
  const act = (action: () => void) => { action(); publish() }
  useGameInput(session, publish, inputEnabled)
  useEffect(() => {
    let cancelled = false
    let graphics: Graphics | undefined
    let asset: GLTF | undefined
    let robotAsset: GLTF | undefined
    let animation: GameAnimation | undefined
    const graphicsTask = initializeRenderer(new URLSearchParams(location.search).get('backend') === 'webgl').then(value => {
      if (cancelled) { value.renderer.dispose(); throw Error('Cancelled') }
      graphics = value
      return value
    })
    const loadModel = async (url: string) => new GLTFLoader().parseAsync((await loadCharacterBytes(url)).slice(0), url.slice(0, url.lastIndexOf('/') + 1))
    const loadPlayer = async () => {
      const draco = new DRACOLoader().setDecoderPath('/assets/decoders/draco/').setWorkerLimit(1)
      let candidate: GLTF | undefined
      try {
        candidate = await new GLTFLoader().setDRACOLoader(draco).parseAsync((await loadCharacterBytes(RECRUITER_MODEL)).slice(0), '/assets/characters/recruiter/')
        normalizeMaleCharacter(candidate)
        // Validate controller compatibility before committing to the replacement.
        const check = new GameAnimation(candidate)
        check.dispose()
        return candidate
      } catch (error) {
        if (candidate) disposePlayerCharacter(candidate)
        console.warn('Male Recruiter unavailable. Using original Recruiter.', error)
        return loadModel(FALLBACK_RECRUITER_MODEL)
      } finally { draco.dispose() }
    }
    const assetTask = loadPlayer().then(value => {
      if (cancelled) { disposePlayerCharacter(value); throw Error('Cancelled') }
      asset = value
      return value
    })
    const robotTask = loadModel(SECURITY_MODEL).then(value => {
      if (cancelled) { disposeRunner(value); throw Error('Cancelled') }
      robotAsset = value
      return value
    })
    Promise.all([graphicsTask, assetTask, robotTask]).then(([graphics, asset, robotAsset]) => {
      animation = new GameAnimation(asset)
      setReady({ graphics, asset, robotAsset, animation })
    }).catch(error => { if (!cancelled) setError(String(error)) })
    return () => {
      cancelled = true
      animation?.dispose()
      // The installed R3F root delays unmount by 500 ms.
      setTimeout(() => { if (asset) disposePlayerCharacter(asset); if (robotAsset) disposeRunner(robotAsset); graphics?.renderer.dispose() }, 600)
    }
  }, [])
  return <main className="game-lab" data-screen={screen} data-sprinting={sprinting}>
    <header className="game-hud" inert={modal}>
      <div className="game-level"><h1>Rooftop escape</h1><progress ref={progress} max={course.finish} value={0} aria-label="Level progress" /></div>
      <nav aria-label="Gameplay controls">
        <button aria-haspopup="dialog" aria-controls="game-overlay-panel" disabled={!ready || !session.canPause} onClick={() => act(() => session.togglePause())}>Pause</button>
        <button disabled={!ready || !!error} onClick={() => act(() => session.restart())}>Restart</button>
        <a href={backHref} onClick={onBack}>Back</a>
      </nav>
    </header>
    <div ref={stage} className="game-stage" role="region" tabIndex={-1} aria-label="Rooftop escape course">
      {error ? <p role="alert">Unable to start. {error}</p> : ready ? <Boundary onFailure={present}><SceneCanvas graphics={ready.graphics} cap={1.5}><GameScene sim={sim} {...ready}
        session={session} publish={publish} progress={progress} hud={hud} showCollider={showCollider}
        decorations={decorations} effects={effects} reducedMotion={reducedMotion} stage={stage} onPresented={present} /></SceneCanvas></Boundary> : <p className="game-loading" role="status">Preparing the rooftops…</p>}
      <GameOverlay screen={screen} loaded={!!ready && !error && (!production || presented) && (screen !== 'complete' || completionVisible)} session={session} publish={publish} stage={stage} backHref={backHref} onBack={onBack} onReplay={onReplay} />
      {(screen === 'capturing' || screen === 'failed' || screen === 'resetting') && <div className="game-failure" role="status">
        <span>{screen === 'capturing' ? 'Security closing in' : screen === 'resetting' ? 'Back on the roof' : sim.failure === 'drone' ? 'Surveillance detected' : sim.failure === 'hunter' ? 'Caught by security' : sim.failure === 'electrical' ? 'Electrical contact' : sim.failure === 'barrier' ? 'Duct collision' : 'Missed the roof'}</span><small>{screen === 'capturing' ? 'Capture imminent' : 'Restarting…'}</small>
      </div>}
    </div>
    <footer className="game-bottom" inert={modal}>
      <div className="game-play-hints game-keyboard-hints"><kbd>Space / ↑</kbd> Jump <span>·</span> <kbd>S / ↓</kbd> Slide <span>·</span> <kbd className="game-sprint-hint">Shift</kbd> Hold to sprint <span>·</span> <kbd>R</kbd> Restart</div>
      <div className="game-controls" aria-label="Movement controls">
        <SprintButton session={session} publish={publish} disabled={!ready || !active} held={sprinting} />
        <button disabled={!ready || !active} onPointerDown={event => { if (event.button === 0 && session.canMove && !document.hidden) { event.preventDefault(); sim.requestJump() } }} onClick={event => { if (event.detail === 0 && session.canMove) sim.requestJump() }}>Jump</button>
        <button disabled={!ready || !active} onPointerDown={event => { if (event.button === 0 && session.canMove && !document.hidden) { event.preventDefault(); sim.requestSlide() } }} onClick={event => { if (event.detail === 0 && session.canMove) sim.requestSlide() }}>Slide</button>
      </div>
    </footer>
    <details hidden={production} ref={debug} className="game-debug" inert={modal}>
      <summary>Debug</summary>
      <div className="game-debug-panel">
        <span data-testid="backend">{ready?.graphics.backend ?? 'Loading'}</span>
        <button disabled={!ready || session.paused || !!error} onClick={() => { act(() => session.testHighDrop()); stage.current?.focus({ preventScroll: true }) }}>Test high drop</button>
        <button disabled={!ready || session.paused || !!error} onClick={() => { act(() => session.testConstruction()); stage.current?.focus({ preventScroll: true }) }}>Test construction</button>
        <button disabled={!ready || session.paused || !!error} onClick={() => { act(() => session.testElectrical()); stage.current?.focus({ preventScroll: true }) }}>Test electrical</button>
        <button disabled={!ready || session.paused || !!error} onClick={() => { act(() => session.testUnderground()); stage.current?.focus({ preventScroll: true }) }}>Test underground</button>
        <button disabled={!ready || session.paused || !!error} onClick={() => { act(() => session.testHunter()); stage.current?.focus({ preventScroll: true }) }}>Test Hunter</button>
        <label><input type="checkbox" checked={showCollider} onChange={event => setShowCollider(event.target.checked)} /> Collider</label>
        <label><input aria-label="Environment decorations" type="checkbox" checked={decorations} onChange={event => setDecorations(event.target.checked)} /> Decorations</label>
        <label><input aria-label="Presentation effects" type="checkbox" checked={effects} disabled={reducedMotion} onChange={event => setEffects(event.target.checked)} /> Effects{reducedMotion ? ' (reduced motion)' : ''}</label>
        <output ref={hud} aria-label="Game diagnostics" aria-live="off">Preparing course...</output>
      </div>
    </details>
  </main>
}
