export type StoryChapter = {
  id: string
  label: string
  title: string
  meta?: string
  body?: string
  tagline?: string
  facts?: readonly string[]
  metrics?: readonly { value: string; label: string }[]
}

export const ABOUT_CHAPTERS: readonly StoryChapter[] = [
  { id: 'identity', label: 'Identity', title: 'Aman Yadav.',
    body: 'A software engineering graduate interested in full-stack development, problem-solving and creative technology.',
    tagline: 'BRIDGING THE GAP BETWEEN CODE & CREATIVITY' },
  { id: 'foundation', label: 'Foundation', title: 'B.Tech in Computer Science & IoT',
    meta: '2022–2026', body: 'Institute of Technology and Management, Gwalior' },
  { id: 'experience', label: 'Experience', title: 'Software Engineering Intern',
    meta: 'Career Craftly · January–July 2025', facts: [
      'React frontend and Django backend integration',
      'Working with RESTful APIs',
      'Cross-functional collaboration',
      'Building responsive web applications',
    ] },
  { id: 'leadership', label: 'Leadership', title: 'GDG Management Lead', metrics: [
    { value: '10+', label: 'workshops organized' },
    { value: '15', label: 'volunteers led' },
    { value: '500+', label: 'students engaged' },
  ] },
  { id: 'next-chapter', label: 'Next chapter', title: 'Building what comes next.',
    body: 'I want to build reliable software and keep exploring the possibilities of creative technology.' },
]
