import { lazy, Suspense } from 'react'
import type { SectionId } from './navigation'
import './sections.css'

const AboutPage = lazy(() => import('./AboutPage'))
const SkillsPage = lazy(() => import('./SkillsPage'))
const ProjectsPage = lazy(() => import('./ProjectsPage'))
const ContactPage = lazy(() => import('./ContactPage'))

export default function SectionPage({ section, onPresented }: { section: SectionId; onPresented?: () => void }) {
  return <div className="section-foundation">
    {section === 'about' ? <Suspense fallback={null}><AboutPage onPresented={onPresented} /></Suspense> : section === 'skills' ? <Suspense fallback={null}><SkillsPage onPresented={onPresented} /></Suspense> : section === 'projects' ? <Suspense fallback={null}><ProjectsPage onPresented={onPresented} /></Suspense> : <Suspense fallback={null}><ContactPage onPresented={onPresented} /></Suspense>}
  </div>
}
