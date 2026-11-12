import test from 'node:test'
import assert from 'node:assert/strict'
import { ABOUT_CHAPTERS } from '../src/website/aboutContent.ts'
import { storyScrollState } from '../src/website/useScrollStory.ts'

test('About chapters preserve the supplied identity, education and internship facts', () => {
  assert.deepEqual(ABOUT_CHAPTERS.map(chapter => chapter.id), ['identity', 'foundation', 'experience', 'leadership', 'next-chapter'])
  const [identity, foundation, experience] = ABOUT_CHAPTERS
  assert.equal(identity.title, 'Aman Yadav.')
  assert.equal(identity.tagline, 'BRIDGING THE GAP BETWEEN CODE & CREATIVITY')
  assert.match(identity.body, /software engineering graduate.*full-stack development.*problem-solving.*creative technology/)
  assert.equal(foundation.title, 'B.Tech in Computer Science & IoT')
  assert.equal(foundation.body, 'Institute of Technology and Management, Gwalior')
  assert.equal(foundation.meta, '2022–2026')
  assert.equal(experience.title, 'Software Engineering Intern')
  assert.equal(experience.meta, 'Career Craftly · January–July 2025')
  assert.equal(experience.facts.length, 4)
  for (const phrase of ['React', 'Django', 'RESTful APIs', 'Cross-functional', 'responsive web applications']) assert.ok(experience.facts.some(fact => fact.includes(phrase)))
})

test('leadership metrics match the resume and closing language is aspirational', () => {
  const leadership = ABOUT_CHAPTERS[3], closing = ABOUT_CHAPTERS[4]
  assert.equal(leadership.title, 'GDG Management Lead')
  assert.deepEqual(leadership.metrics, [
    { value: '10+', label: 'workshops organized' },
    { value: '15', label: 'volunteers led' },
    { value: '500+', label: 'students engaged' },
  ])
  assert.match(closing.body, /^I want to build reliable software.*creative technology/)
})

test('scroll state tracks actual chapter geometry and clamps progress at both ends', () => {
  assert.deepEqual(storyScrollState(100, 5000, 1000, [1100, 2100, 3100, 4100, 5100]), { progress: 0, active: 0 })
  assert.deepEqual(storyScrollState(-1500, 5000, 1000, [-500, 500, 1500, 2500, 3500]), { progress: .375, active: 1 })
  assert.deepEqual(storyScrollState(-4500, 5000, 1000, [-3500, -2500, -1500, -500, 500]), { progress: 1, active: 4 })
  assert.equal(storyScrollState(-400, 3000, 600, [-40, 120, 900, 1800, 2500]).active, 2)
  assert.deepEqual(storyScrollState(0, 400, 900, []), { progress: 0, active: 0 })
})
