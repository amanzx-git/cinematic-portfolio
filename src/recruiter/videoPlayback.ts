/** Own one native video and ignore rejected play promises after navigation. */
export function startStoryVideo(video: HTMLVideoElement, muted: boolean, volume: number, onBlocked: () => void) {
  let active = true
  video.volume = volume
  video.muted = muted
  void video.play().catch(() => { if (active) onBlocked() })
  return () => {
    active = false
    video.muted = true
    video.pause()
    video.removeAttribute('src')
    video.load()
  }
}
