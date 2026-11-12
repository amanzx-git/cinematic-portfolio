export type StoryStage = 'opening' | 'gameplay-ready' | 'escape' | 'reunion' | 'completion'
export type StoryEvent = 'opening-finished' | 'start' | 'escape-finished' | 'reunion-finished' | 'replay'
export const STORY_VIDEOS = {
  opening: '/media/recruiter/opening.mp4',
  reunion: '/media/recruiter/reunion.mp4',
}

export function storyTransition(stage: StoryStage, event: StoryEvent): StoryStage {
  if (event === 'replay' && stage === 'completion') return 'opening'
  if (event === 'opening-finished' && stage === 'opening') return 'gameplay-ready'
  if (event === 'start' && stage === 'gameplay-ready') return 'escape'
  if (event === 'escape-finished' && stage === 'escape') return 'reunion'
  if (event === 'reunion-finished' && stage === 'reunion') return 'completion'
  return stage
}

/** Cache missing files across Replay and route re-entry. Never probe a video repeatedly. */
export function createVideoAvailability(request: typeof fetch) {
  const results = new Map<string, Promise<boolean>>()
  return (path: string) => {
    let result = results.get(path)
    if (!result) {
      result = request(path, { method: 'HEAD', signal: AbortSignal.timeout(5000) })
        .then(response => response.ok && !!response.headers.get('content-type')?.startsWith('video/'))
        .catch(() => false)
      results.set(path, result)
    }
    return result
  }
}
