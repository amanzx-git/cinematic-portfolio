import { useEffect, useRef, type CSSProperties } from 'react'
import { ABOUT_CHAPTERS } from './aboutContent'
import { useScrollStory } from './useScrollStory'
import { openSiteLink } from './navigation'
import { VideoBackground, pageBackgrounds } from './VideoBackground'
import './about.css'

// Percentage X/width and viewport-height elevations keep the city lightweight.
const city = [
  { name: 'far', towers: [[-3, 12, 54], [10, 8, 65], [20, 11, 47], [33, 9, 70], [44, 13, 55], [59, 8, 66], [70, 12, 51], [84, 9, 72], [95, 10, 58]] },
  { name: 'middle', towers: [[-6, 15, 61], [13, 12, 80], [29, 10, 57], [42, 15, 86], [62, 11, 68], [77, 12, 78], [93, 13, 59]] },
  { name: 'near', towers: [[-8, 21, 66], [20, 15, 54], [48, 14, 63], [74, 18, 76], [98, 15, 57]] },
]

export default function AboutPage({ onPresented }: { onPresented?: () => void }) {
  const root = useRef<HTMLElement>(null)
  const active = useScrollStory(root)
  useEffect(() => { onPresented?.() }, [onPresented])
  return <article ref={root} className="about-story" aria-label="The Origin — Aman Yadav">
    <div className="about-city" aria-hidden="true">
      <VideoBackground config={pageBackgrounds.about} scrollRoot={root} />
      <div className="about-sky" />
      {city.map(layer => <div key={layer.name} className={`about-city-layer about-city-${layer.name}`}>
        {layer.towers.map(([left, width, height], index) => <div key={left} className={`about-tower about-tower-${index % 3}`}
          style={{ left: `${left}%`, width: `${width}%`, height: `${height}vh` } as CSSProperties} />)}
      </div>)}
      <div className="about-city-light" />
    </div>
    <nav className="about-progress" aria-label="Story chapters">
      <p>{String(active + 1).padStart(2, '0')} / 05</p>
      <ol>{ABOUT_CHAPTERS.map((chapter, index) => <li key={chapter.id}>
        <a href={`#${chapter.id}`} aria-label={`Chapter ${index + 1} — ${chapter.label}`} aria-current={index === active ? 'step' : undefined}>
          <span aria-hidden="true" />
        </a>
      </li>)}</ol>
      <span className="about-progress-title">{ABOUT_CHAPTERS[active].label}</span>
    </nav>
    {ABOUT_CHAPTERS.map((chapter, index) => <section key={chapter.id} id={chapter.id} className="about-chapter"
      data-story-chapter aria-labelledby={`${chapter.id}-title`}>
      <div className="about-chapter-copy">
        <p className="about-chapter-label">CHAPTER {String(index + 1).padStart(2, '0')} — {chapter.label.toUpperCase()}</p>
        {index === 0 ? <h1 id={`${chapter.id}-title`} data-route-heading tabIndex={-1}>{chapter.title}</h1>
          : <h2 id={`${chapter.id}-title`}>{chapter.title}</h2>}
        {chapter.meta && <p className="about-meta">{chapter.meta}</p>}
        {chapter.body && <p className="about-body">{chapter.body}</p>}
        {chapter.tagline && <p className="about-tagline">{chapter.tagline}</p>}
        {chapter.facts && <ul className="about-experience">{chapter.facts.map(fact => <li key={fact}>{fact}</li>)}</ul>}
        {chapter.metrics && <dl className="about-metrics">{chapter.metrics.map(metric => <div key={metric.label}>
          <dt>{metric.value}</dt><dd>{metric.label}</dd>
        </div>)}</dl>}
        {index === 0 && <a className="about-scroll-link" href="#foundation">Discover the story <span aria-hidden="true">↓</span></a>}
        {index === ABOUT_CHAPTERS.length - 1 && <a className="section-home" href="/" onClick={openSiteLink}>← Back to Home</a>}
      </div>
    </section>)}
  </article>
}
