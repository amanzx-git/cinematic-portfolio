import { lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { Website } from './website/Website'

const Laboratory = lazy(() => import('./app/App').then(module => ({ default: module.App })))

createRoot(document.getElementById('root')!).render(
  /^\/lab\/?$/.test(location.pathname)
    ? <Suspense fallback={<p>Loading rendering laboratory…</p>}><Laboratory /></Suspense>
    : <Website />,
)
