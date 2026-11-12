import { useEffect, useRef, useState, type RefObject } from 'react'
import { useReducedMotion } from './useReducedMotion.ts'

export function storyScrollState(top: number, height: number, viewport: number, chapterBottoms: readonly number[]) {
  const distance = Math.max(1, height - viewport)
  const progress = Math.max(0, Math.min(1, -top / distance))
  const index = chapterBottoms.findIndex(bottom => bottom > viewport * .45)
  return { progress, active: index < 0 ? Math.max(0, chapterBottoms.length - 1) : index }
}

/** Native scrolling with one scheduled frame, scoped observers and no input interception. */
export function useScrollStory(rootRef: RefObject<HTMLElement | null>) {
  const reduced = useReducedMotion()
  const [active, setActive] = useState(0)
  const current = useRef(0)
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const chapters = Array.from(root.querySelectorAll<HTMLElement>('[data-story-chapter]'))
    let frame = 0
    let disposed = false
    const measure = () => {
      if (disposed) return
      frame = 0
      const bounds = root.getBoundingClientRect()
      const state = storyScrollState(bounds.top, bounds.height, window.innerHeight, chapters.map(chapter => chapter.getBoundingClientRect().bottom))
      root.style.setProperty('--story-progress', String(state.progress))
      if (state.active !== current.current) { current.current = state.active; setActive(state.active) }
    }
    const schedule = () => { if (!disposed && !frame) frame = requestAnimationFrame(measure) }
    const observer = !reduced && typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(entries => {
      if (disposed) return
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed')
        observer?.unobserve(entry.target)
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: .12 }) : null
    root.dataset.motion = observer ? 'on' : 'off'
    chapters.forEach(chapter => observer?.observe(chapter))
    const resize = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null
    resize?.observe(root)
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    measure()
    return () => {
      disposed = true
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      cancelAnimationFrame(frame)
      observer?.disconnect()
      resize?.disconnect()
      delete root.dataset.motion
      root.style.removeProperty('--story-progress')
    }
  }, [rootRef, reduced])
  return active
}
