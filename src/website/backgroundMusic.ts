export const MUSIC_VOLUME = 0.35
export const MUTE_STORAGE_KEY = 'aman.portfolio.muted'
export type MusicStatus = 'idle' | 'playing' | 'muted' | 'blocked' | 'unavailable'

export function readMutePreference(): boolean {
  try { return localStorage.getItem(MUTE_STORAGE_KEY) === 'true' } catch { return false }
}
export function saveMutePreference(muted: boolean) {
  try { localStorage.setItem(MUTE_STORAGE_KEY, String(muted)) } catch { /* Storage is optional. */ }
}

/** Owns one native element; frame-by-frame fades never update React state. */
export class BackgroundMusic {
  private frame = 0
  private revision = 0
  private consented = false
  private disposed = false
  private desiredMuted = true
  private error = () => {
    ++this.revision
    this.cancelFade()
    this.audio.muted = true
    this.audio.pause()
    this.report('unavailable')
  }
  constructor(private audio: HTMLAudioElement, private report: (status: MusicStatus) => void) {
    audio.loop = true
    audio.preload = 'none'
    audio.muted = true
    audio.volume = 0
    audio.addEventListener('error', this.error)
  }
  private cancelFade() { cancelAnimationFrame(this.frame); this.frame = 0 }
  private fade(target: number, duration: number, done?: () => void) {
    this.cancelFade()
    const from = this.audio.volume, start = performance.now()
    const step = (now: number) => {
      // A callback's frame timestamp can precede performance.now() sampled
      // later in that same frame. Clamp both ends before touching native volume.
      const ratio = Math.max(0, Math.min(1, (now - start) / duration))
      this.audio.volume = from + (target - from) * ratio
      if (ratio < 1) this.frame = requestAnimationFrame(step)
      else { this.frame = 0; done?.() }
    }
    this.frame = requestAnimationFrame(step)
  }
  // Called synchronously from Enter/unmute, preserving browser user activation.
  start(muted: boolean) {
    if (this.disposed) return
    this.consented = true
    this.desiredMuted = muted
    const revision = ++this.revision
    this.cancelFade()
    if (muted) { this.audio.muted = true; this.audio.pause(); this.report('muted'); return }
    if (!this.audio.getAttribute('src')) this.audio.src = '/media/audio/ambient.mp3'
    this.audio.loop = true
    this.audio.volume = 0
    this.audio.muted = false
    this.audio.play().then(() => {
      if (this.disposed || revision !== this.revision || this.desiredMuted) return
      this.report('playing')
      this.fade(MUSIC_VOLUME, 650)
    }).catch(error => {
      if (this.disposed || revision !== this.revision) return
      this.audio.muted = true
      this.report(error?.name === 'NotAllowedError' ? 'blocked' : 'unavailable')
    })
  }
  setMuted(muted: boolean) {
    this.desiredMuted = muted
    if (!this.consented || this.disposed) return
    if (muted) {
      this.audio.muted = true // Immediate silence takes priority over a perceptible fade.
      this.stop()
      this.report('muted')
    } else this.start(false) // play() resumes currentTime; never seeks/replaces the track.
  }
  stop() {
    if (this.disposed) return
    ++this.revision
    this.fade(0, 300, () => this.audio.pause())
  }
  dispose() {
    this.disposed = true
    ++this.revision
    this.cancelFade()
    this.audio.removeEventListener('error', this.error)
    // Teardown cannot wait for a fade (page close/unmount); silence immediately.
    this.audio.muted = true
    this.audio.pause()
    this.audio.removeAttribute('src')
    this.audio.load()
  }
}
