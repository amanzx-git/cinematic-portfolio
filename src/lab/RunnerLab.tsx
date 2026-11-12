import { Component, useEffect, useRef, useState, type ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { AxesHelper, GridHelper, Group, OrthographicCamera, Vector3 } from 'three'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { SceneCanvas } from '../rendering/SceneCanvas'
import { initializeRenderer, type Graphics } from '../rendering/renderer'
import { clips, disposeRunner, RunnerPlayback, type Clip } from './RunnerPlayback'
import './runner.css'

type Camera = 'Front' | 'Side' | 'Back' | 'Three-quarter'
type Settings = { paused: boolean; speed: number; fade: number; inPlace: boolean; camera: Camera }
class Boundary extends Component<{ children: ReactNode }, { error: string }> {
  state = { error: '' }
  static getDerivedStateFromError(error: Error) { return { error: error.message } }
  render() { return this.state.error ? <p role="alert">Runner rendering failed: {this.state.error}</p> : this.props.children }
}
function RunnerScene({ playback, settings, output }: { playback: RunnerPlayback; settings: Settings; output: React.RefObject<HTMLOutputElement | null> }) {
  const { camera, size } = useThree()
  const wrapper = useRef<Group>(null)
  const [helpers] = useState(() => ({ grid: new GridHelper(14, 28, '#7b9dba', '#344756'), axes: new AxesHelper(0.65) }))
  const counter = useRef({ time: 0, frames: 0 })
  const displacement = useRef(new Vector3()).current
  useEffect(() => () => { helpers.grid.dispose(); helpers.axes.dispose() }, [helpers])
  useEffect(() => {
    const positions = { Front: [0, 2.5, 9], Side: [9, 2.5, 2], Back: [0, 2.5, -7], 'Three-quarter': [7, 4, 9] }
    camera.position.fromArray(positions[settings.camera])
    camera.lookAt(0, 1, 2)
    const ortho = camera as OrthographicCamera
    ortho.zoom = Math.min(size.width / 12, size.height / 5)
    ortho.updateProjectionMatrix()
  }, [camera, size, settings.camera])
  useFrame((_, delta) => {
    if (!settings.paused) playback.update(delta * settings.speed, settings.fade)
    displacement.copy(playback.hips.position).sub(playback.origin)
    wrapper.current!.position.set(settings.inPlace ? -displacement.x : 0, 0, settings.inPlace ? -displacement.z : 0)
    const count = counter.current
    count.time += delta; count.frames++
    if (count.time >= 0.25 && output.current) {
      const action = playback.actions[playback.current]
      const active = Object.values(playback.actions).filter(action => action.isRunning() && action.getEffectiveWeight() > 0).length
      output.current.textContent = `${playback.current} | duration ${action.getClip().duration.toFixed(3)} s | time ${action.time.toFixed(3)} s | ${settings.speed.toFixed(2)}× | root delta XYZ ${displacement.toArray().map(value => value.toFixed(3)).join(', ')} m | ~${Math.round(count.frames / count.time)} FPS | active actions ${active} | mixers 1${playback.sequence ? ' | transition test running' : ''}`
      count.time = 0; count.frames = 0
    }
  })
  return <>
    <color attach="background" args={['#101b27']} />
    <ambientLight intensity={1.5} /><directionalLight position={[4, 7, 5]} intensity={3} />
    <primitive object={helpers.grid} /><primitive object={helpers.axes} />
    <group ref={wrapper}><primitive object={playback.asset.scene} dispose={null} /></group>
  </>
}
export default function RunnerLab() {
  const [graphics, setGraphics] = useState<Graphics | null>(null)
  const [playback, setPlayback] = useState<RunnerPlayback | null>(null)
  const [error, setError] = useState('')
  const [settings, setSettings] = useState<Settings>({ paused: false, speed: 1, fade: 0.15, inPlace: false, camera: 'Three-quarter' })
  const output = useRef<HTMLOutputElement>(null)
  useEffect(() => {
    let cancelled = false
    let ownedGraphics: Graphics | undefined
    let ownedPlayback: RunnerPlayback | undefined
    let ownedAsset: GLTF | undefined
    initializeRenderer(new URLSearchParams(location.search).get('backend') === 'webgl').then(result => {
      if (cancelled) result.renderer.dispose()
      else { ownedGraphics = result; setGraphics(result) }
    }).catch(error => { if (!cancelled) setError(String(error)) })
    new GLTFLoader().loadAsync('/assets/characters/runner/runner.glb').then(asset => {
      if (cancelled) { disposeRunner(asset); return }
      ownedAsset = asset
      ownedPlayback = new RunnerPlayback(asset)
      setPlayback(ownedPlayback)
    }).catch(error => { if (!cancelled) setError(String(error)) })
    return () => {
      cancelled = true
      ownedPlayback?.dispose()
      // R3F releases its scene before renderer/resource disposal.
      setTimeout(() => { if (ownedAsset) disposeRunner(ownedAsset); ownedGraphics?.renderer.dispose() }, 600)
    }
  }, [])
  function play(name: Clip) { if (playback) { playback.sequence = false; playback.play(name, settings.fade) } }
  return <main className="runner-lab">
    <header><h1>Animated runner playground</h1><a href="/lab">Rendering lab</a></header>
    <p>F2B.2 · source-motion prototype · {graphics?.backend ?? 'Initializing graphics'}</p>
    <div className="runner-viewport">
      {error ? <p role="alert">Unable to load runner: {error}</p> : graphics && playback ? <Boundary><SceneCanvas graphics={graphics} cap={1.5}><RunnerScene playback={playback} settings={settings} output={output} /></SceneCanvas></Boundary> : <p role="status">Loading runner and graphics…</p>}
    </div>
    <fieldset disabled={!playback || !!error}><legend>Animation</legend>
      {clips.map(name => <button key={name} onClick={() => play(name)}>{name}</button>)}
      <button onClick={() => { if (playback) { playback.play('Idle', 0); playback.sequence = true; setSettings({ ...settings, paused: false }) } }}>Test transitions</button>
      <button onClick={() => setSettings({ ...settings, paused: !settings.paused })}>{settings.paused ? 'Resume' : 'Pause'}</button>
      <button onClick={() => { if (playback) { playback.sequence = false; playback.play(playback.current, 0) } }}>Restart</button>
      <label>Speed <input aria-label="Playback speed" type="number" min="0.1" max="2" step="0.1" value={settings.speed} onChange={event => setSettings({ ...settings, speed: Math.max(0.1, Math.min(2, Number(event.target.value) || 1)) })} /></label>
      <label>Crossfade (s) <input aria-label="Crossfade seconds" type="number" min="0" max="0.3" step="0.05" value={settings.fade} onChange={event => setSettings({ ...settings, fade: Math.max(0, Math.min(0.3, Number(event.target.value))) })} /></label>
      <label><input type="checkbox" checked={settings.inPlace} onChange={event => setSettings({ ...settings, inPlace: event.target.checked })} /> In-place preview (horizontal only)</label>
    </fieldset>
    <fieldset><legend>Camera</legend>{(['Front', 'Side', 'Back', 'Three-quarter'] as Camera[]).map(name => <button key={name} aria-pressed={settings.camera === name} onClick={() => setSettings({ ...settings, camera: name })}>{name}</button>)}</fieldset>
    <output ref={output} aria-label="Runner diagnostics">Waiting for animation…</output>
    <p>Grid spacing 0.5 m. Origin axes: X red, Y green, Z blue. Root delta measures local Hips translation from the selected clip’s first pose, including during blends.</p>
    <p>All clips repeat for inspection. Source travel resets at loop seams; Jump to Land has an unedited phase mismatch. Crossfades may show sliding or position snaps. In-place preview offsets a parent horizontally; source tracks and vertical motion are preserved. This 49,112-triangle mannequin is a technical asset, not final character art.</p>
  </main>
}
