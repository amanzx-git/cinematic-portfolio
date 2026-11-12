import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { openSiteLink } from './navigation'
import { useScrollStory } from './useScrollStory'
import { VideoBackground, pageBackgrounds } from './VideoBackground'
import './projects.css'

const projects = [
  { id: 'recipeapp', name: 'RecipeApp', facility: 'API Development Facility', status: null, github: null,
    description: 'Recipe management API with relational recipes, ingredients, and tags. Automated tests and code-quality checks.',
    technologies: ['Django REST Framework', 'Docker', 'GitHub Actions', 'Flake8', 'TDD'] },
  { id: 'splitter', name: 'Splitter', facility: 'Financial Systems Facility', status: 'In Development', github: null,
    description: 'Expense-sharing application featuring Quick Split, group expenses, and settlement workflows.',
    technologies: ['React', 'Django REST Framework', 'PostgreSQL'] },
  { id: 'portfolio', name: 'Cinematic Portfolio', facility: 'Interactive Experience Facility', status: 'In Development', github: 'https://github.com/amanzx-git/cinematic-portfolio',
    description: 'Cinematic navigation, interactive 2.5D gameplay, and responsive experiences.',
    technologies: ['React', 'TypeScript', 'Three.js', 'React Three Fiber'] },
]

export default function ProjectsPage({ onPresented }: { onPresented?: () => void }) {
  const root = useRef<HTMLElement>(null)
  const [selected, setSelected] = useState(0)
  useScrollStory(root)
  useEffect(() => { onPresented?.() }, [onPresented])

  return <article ref={root} className="projects-city" style={{ '--facility-focus': selected - 1 } as CSSProperties} aria-labelledby="projects-title">
    <div className="projects-atmosphere" aria-hidden="true">
      <VideoBackground config={pageBackgrounds.projects} scrollRoot={root} />
      <div className="projects-distant" /><div className="projects-midground" />
    </div>
    <header className="projects-heading" data-story-chapter>
      <p className="eyebrow">PROJECTS</p>
      <h1 id="projects-title" data-route-heading tabIndex={-1}>The City.</h1>
      <p>Explore three facilities. Select a building to look inside.</p>
    </header>
    <div className="projects-district" aria-label="Project facilities">
      {projects.map((project, index) => <button key={project.id} type="button" className={`project-building project-building-${index}`}
        id={`${project.id}-selector`} aria-expanded={selected === index} aria-controls={`${project.id}-details`}
        onClick={() => setSelected(index)}>
        <span className="project-building-roof" aria-hidden="true" />
        <span className="project-building-name">{project.name}</span>
        <span className="project-building-purpose">{project.facility}</span>
        {project.status && <span className="project-building-status">{project.status}</span>}
        <span className="project-building-lines" aria-hidden="true" />
      </button>)}
    </div>
    <div className="projects-detail-stage" data-story-chapter>
      {projects.map((project, index) => <section key={project.id} id={`${project.id}-details`} className="project-details"
        aria-labelledby={`${project.id}-selector`} hidden={selected !== index}>
        <p className="project-detail-purpose">{project.facility}</p>
        <h2>{project.name}</h2>
        <p className="project-description">{project.description}</p>
        <ul className="project-technologies" aria-label="Technologies">{project.technologies.map(technology => <li key={technology}>{technology}</li>)}</ul>
        {project.github && <a className="project-source" href={project.github} target="_blank" rel="noopener noreferrer">GitHub <span className="project-link-note">(opens in new tab)</span></a>}
      </section>)}
    </div>
    <a className="section-home" href="/" onClick={openSiteLink}>← Back to Home</a>
  </article>
}
