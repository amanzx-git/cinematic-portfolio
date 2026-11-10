import { Component, useEffect, useRef, useState, type ReactNode } from 'react'
import { SceneCanvas } from '../rendering/SceneCanvas'
import { initializeRenderer, type Graphics } from '../rendering/renderer'
import { FoundationScene } from '../scene/FoundationScene'
import { FrameDiagnostics } from '../ui/FrameDiagnostics'
import './styles.css'

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed ? <p role="alert">Rendering stopped. Reload or try the WebGL 2 backend.</p> : this.props.children
  }
}

export function App() {
  const [graphics, setGraphics] = useState<Graphics | null>(null)
  const [error, setError] = useState('')
  const [quality, setQuality] = useState('Balanced')
  const [diagnostics, setDiagnostics] = useState(true)
  const [effects, setEffects] = useState(true)
  const output = useRef<HTMLOutputElement>(null)
  const forced = new URLSearchParams(location.search).get('backend') === 'webgl'
  useEffect(() => {
    let cancelled = false
    let active: Graphics | undefined
    initializeRenderer(forced).then(result => {
      active = result
      if (cancelled) result.renderer.dispose()
      else setGraphics(result)
    }).catch(() => {
      if (!cancelled) setError('Graphics initialization failed. Enable hardware acceleration and use a browser with WebGL 2 support, then reload.')
    })
    return () => { cancelled = true; active?.renderer.dispose() }
  }, [forced])
  const cap = quality === 'Low' ? 1 : quality === 'Balanced' ? 1.5 : 2
  return <main>
    <header>
      <div><small>DEVELOPER PORTFOLIO / FOUNDATION</small><h1>Above the quiet city</h1></div>
      <span className="badge">F1.1</span>
    </header>
    <section className="viewport" aria-label="Rendering foundation scene">
      {error ? <p className="message" role="alert">{error}</p> : !graphics ? <p className="message" role="status">Initializing graphics…</p> :
        <SceneBoundary>
          <SceneCanvas graphics={graphics} cap={cap}>
            <FoundationScene effects={effects} />
            {diagnostics && <FrameDiagnostics output={output} />}
          </SceneCanvas>
        </SceneBoundary>}
    </section>
    <aside aria-label="Renderer controls">
      <div><small>ACTIVE BACKEND</small><strong data-testid="backend">{graphics?.backend ?? (error ? 'Unavailable' : 'Initializing')}</strong><span>{forced ? 'Forced fallback' : 'Automatic selection'}</span></div>
      <label>Quality <select value={quality} onChange={event => setQuality(event.target.value)}><option>Low</option><option>Balanced</option><option>High</option></select></label>
      <label className="checkbox"><input type="checkbox" checked={diagnostics} onChange={event => setDiagnostics(event.target.checked)} /> Frame diagnostics</label>
      <label className="checkbox"><input data-testid="effects" type="checkbox" checked={effects} onChange={event => setEffects(event.target.checked)} /> Atmospheric drift</label>
      <a href={forced ? '/lab' : '/lab?backend=webgl'}>{forced ? 'Use automatic backend' : 'Test WebGL 2 fallback'}</a>
    </aside>
    {diagnostics && <output ref={output}>Collecting frame samples…</output>}
    <footer>Rooftop study · orthographic camera · {effects ? 'drift on' : 'drift off'} <span>DPR cap {cap} · no postprocessing</span></footer>
  </main>
}
