import { useEffect, useRef, useState } from 'react'
import { openSiteLink } from './navigation'
import { useScrollStory } from './useScrollStory'
import { VideoBackground, pageBackgrounds } from './VideoBackground'
import './skills.css'

const departments = [
  { id: 'languages', name: 'Languages', technologies: ['Python', 'JavaScript', 'SQL', 'HTML5', 'CSS3'] },
  { id: 'frontend', name: 'Frontend', technologies: ['React'] },
  { id: 'backend', name: 'Backend', technologies: ['Django', 'Django REST Framework', 'Flask'] },
  { id: 'data', name: 'Data', technologies: ['PostgreSQL', 'Oracle SQL', 'Redis'] },
  { id: 'devops', name: 'DevOps & Cloud', technologies: ['Linux', 'Shell Scripting', 'Git', 'GitHub', 'GitHub Actions', 'Docker', 'AWS'] },
]

export default function SkillsPage({ onPresented }: { onPresented?: () => void }) {
  const root = useRef<HTMLElement>(null)
  const [selected, setSelected] = useState<string | null>('languages')
  useScrollStory(root)
  useEffect(() => { onPresented?.() }, [onPresented])

  return <article ref={root} className="skills-systems" aria-labelledby="skills-title">
    <div className="skills-infrastructure" aria-hidden="true"><div /><div /><div /><VideoBackground config={pageBackgrounds.skills} scrollRoot={root} /></div>
    <header className="skills-heading" data-story-chapter>
      <p className="eyebrow">SKILLS</p>
      <h1 id="skills-title" data-route-heading tabIndex={-1}>The Systems.</h1>
      <p>Select a department to explore its technologies.</p>
    </header>
    <div className="skills-network" data-story-chapter>
      <div className="skills-core">
        <svg viewBox="0 0 1000 180" preserveAspectRatio="none" aria-hidden="true">
          <path d="M500 0V55 M100 180V105H900V180 M300 180V105 M500 55V180 M700 180V105" />
          {[100, 300, 500, 700, 900].map(x => <circle key={x} cx={x} cy="105" r="4" />)}
        </svg>
        <span>Engineering Core</span>
      </div>
      <div className="skills-departments">
        {departments.map(department => <section key={department.id} className="skills-department" data-selected={selected === department.id}>
          <h2><button type="button" id={`${department.id}-control`} aria-expanded={selected === department.id}
            aria-controls={`${department.id}-technologies`}
            onClick={() => setSelected(selected === department.id ? null : department.id)}>
            {department.name}<span aria-hidden="true">{selected === department.id ? '−' : '+'}</span>
          </button></h2>
          <div id={`${department.id}-technologies`} className="skills-reveal" role="region"
            aria-labelledby={`${department.id}-control`} hidden={selected !== department.id}>
            <ul>{department.technologies.map(technology => <li key={technology}>{technology}</li>)}</ul>
          </div>
        </section>)}
      </div>
    </div>
    <a className="section-home" href="/" onClick={openSiteLink}>← Back to Home</a>
  </article>
}
