import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { Website } from './website/Website'
import { destinations, openSiteLink, sectionForPath } from './website/navigation'
import { loadAssets, type AssetResource } from './website/assetLoading'
import { loadRecruiterBundle, prepareRecruiter } from './recruiter/resources'
import './route-transition.css'

const loadLaboratory = () => import('./app/App')
const loadRunner = () => import('./lab/RunnerLab')
const loadGame = () => import('./game/GameLab')
const loadRecruiter = loadRecruiterBundle
const Laboratory = lazy(() => loadLaboratory().then(module => ({ default: module.App })))
const RunnerLaboratory = lazy(loadRunner)
const GameLaboratory = lazy(loadGame)
const RecruiterExperience = lazy(loadRecruiter)

class RouteBoundary extends Component<{ route: string; onFailure: () => void; children: ReactNode }, { route: string; failed: boolean }> {
  state = { route: this.props.route, failed: false }
  static getDerivedStateFromProps(props: { route: string }, state: { route: string }) {
    return props.route !== state.route ? { route: props.route, failed: false } : null
  }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onFailure() }
  render() { return this.state.failed ? null : this.props.children }
}

function Routes() {
  const [path, setPath] = useState(location.pathname)
  const cleanPath = path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path
  const [loading, setLoading] = useState(!location.pathname.startsWith('/lab'))
  const [failed, setFailed] = useState(false)
  const [preparedPath, setPreparedPath] = useState<string | null>(null)
  const target = useRef(path)
  const focusFrame = useRef(0)
  const presented = useCallback(() => {
    if (target.current !== path) return
    setLoading(false)
    cancelAnimationFrame(focusFrame.current)
    focusFrame.current = requestAnimationFrame(() => document.querySelector<HTMLElement>(
      '[data-route-heading], .recruiter-primary, .game-primary, .mode-recruiter, .home-menu a, .enter-button'
    )?.focus({ preventScroll: true }))
  }, [path])
  useEffect(() => {
    const change = () => {
      const next = location.pathname
      if (next === target.current) return
      cancelAnimationFrame(focusFrame.current)
      target.current = next
      setFailed(false)
      setLoading(!next.startsWith('/lab'))
      setPath(next)
    }
    window.addEventListener('popstate', change)
    return () => { window.removeEventListener('popstate', change); cancelAnimationFrame(focusFrame.current) }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    const resources: AssetResource<void>[] = []
    if (sectionForPath(path)) resources.push({ id: 'section-pages', load: () => import('./website/SectionPage').then(() => {}) })
    if (cleanPath === '/play') void prepareRecruiter(controller.signal).catch(() => {})
    if (cleanPath === '/play/recruiter') resources.push({ id: 'recruiter-route', load: signal => prepareRecruiter(signal).then(() => {}) })
    loadAssets(resources, controller.signal).then(() => {
      if (!controller.signal.aborted && target.current === path) setPreparedPath(path)
    }).catch(() => {
      if (!controller.signal.aborted && target.current === path) setFailed(true)
    })
    return () => controller.abort()
  }, [path])
  const destination = destinations.find(item => item.path === cleanPath) ?? destinations[0]
  const laboratory = path.startsWith('/lab')
  let content
  if (cleanPath === '/play/recruiter') content = preparedPath === path ? <Suspense fallback={null}><RecruiterExperience onPresented={presented} /></Suspense> : null
  else if (laboratory) content = <OtherRoute path={cleanPath} />
  else content = <Website routePath={cleanPath} initialModeSelection={cleanPath === '/play'} onPresented={presented} />
  return <>
    <RouteBoundary route={path} onFailure={() => setFailed(true)}>
      <div inert={loading || failed}>{content}</div>
    </RouteBoundary>
    <div className="route-curtain" data-phase={loading || failed ? 'loading' : 'idle'} data-identity={destination.identity} aria-hidden={!loading && !failed}>
      {failed ? <div className="route-message" role="alert">
        <p>This destination could not load.</p>
        <button autoFocus onClick={() => location.reload()}>Retry</button>
        <a href="/" onClick={openSiteLink}>Back to Home</a>
      </div> : loading && <div className="route-message" role="status">
        <span className="route-emblem" aria-hidden="true" /><p>{path.startsWith('/play/recruiter') ? 'Preparing rooftops…' : destination.loading}</p>
      </div>}
    </div>
  </>
}
function OtherRoute({ path }: { path: string }) {
  if (path === '/lab/game') return <Suspense fallback={<p>Loading game prototype...</p>}><GameLaboratory /></Suspense>
  if (path === '/lab/runner') return <Suspense fallback={<p>Loading runner playground...</p>}><RunnerLaboratory /></Suspense>
  return <Suspense fallback={<p>Loading rendering laboratory...</p>}><Laboratory /></Suspense>
}
createRoot(document.getElementById('root')!).render(<Routes />)
