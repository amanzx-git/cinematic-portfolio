export const MUSIC_VOLUME = 0.35
export const INFORMATION_VOLUME = 0.07
export const MUTE_STORAGE_KEY = 'aman.portfolio.muted'
export type MusicStatus = 'idle' | 'playing' | 'muted' | 'blocked' | 'unavailable' | 'intro-blocked'
export const INTRO_VOLUME = 0.7

export function readMutePreference(): boolean {
  try { return localStorage.getItem(MUTE_STORAGE_KEY) === 'true' } catch { return false }
}
export function saveMutePreference(muted: boolean) {
  try { localStorage.setItem(MUTE_STORAGE_KEY, String(muted)) } catch { /* Storage is optional. */ }
}

/** Coordinates the persistent soundtrack and borrowed intro video; fades stay outside React. */
export class BackgroundMusic {
  private frame = 0
  private revision = 0
  private consented = false
  private disposed = false
  private desiredMuted = true
  private ambientVolume = MUSIC_VOLUME
  private owner: 'ambient' | 'intro' | 'silent' = 'ambient'
  private intro: HTMLVideoElement | null = null
  private videoRevision = 0
  private handoff: Promise<void> = Promise.resolve()
  private release: (() => void) | undefined
  private introReady = true
  private releaseHandoff() { this.introReady = true; this.release?.(); this.release = undefined }
  private error = () => {
    ++this.revision
    this.cancelFade()
    this.audio.muted = true
    this.audio.pause()
    this.releaseHandoff()
    if (this.owner === 'ambient') this.report('unavailable')
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
  start(muted: boolean, fadeIn = 650) {
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
      this.fade(this.ambientVolume, fadeIn)
    }).catch(error => {
      if (this.disposed || revision !== this.revision) return
      this.audio.muted = true
      this.report(error?.name === 'NotAllowedError' ? 'blocked' : 'unavailable')
    })
  }
  setAmbientVolume(volume: number, duration = 500) {
    const target = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0
    if (this.disposed || target === this.ambientVolume) return
    this.ambientVolume = target
    if (this.consented && !this.desiredMuted && this.owner === 'ambient' && !this.audio.paused) {
      this.fade(target, duration)
    }
  }
  setMuted(muted: boolean) {
    this.desiredMuted = muted
    if (!this.consented || this.disposed) return
    if (this.owner !== 'ambient') {
      if (muted) {
        this.audio.muted = true
        if (this.intro) this.intro.muted = true
        this.report('muted')
      } else if (this.owner === 'intro' && this.intro && this.introReady) {
        void this.playIntro(this.intro).catch(() => { /* Video fallback is owned by PlayExperience. */ })
      }
      return
    }
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
  enterIntro() {
    if (this.disposed) return
    this.releaseHandoff()
    this.silenceIntro()
    this.owner = 'intro'
    ++this.revision // Invalidate any pending ambient play/fade-in.
    this.cancelFade()
    this.introReady = false
    this.handoff = new Promise(resolve => { this.release = resolve })
    const done = () => {
      this.audio.volume = 0; this.audio.muted = true; this.audio.pause()
      this.releaseHandoff()
    }
    if (this.desiredMuted || this.audio.paused || this.audio.volume === 0) done()
    else this.fade(0, 250, done)
  }
  async playIntro(element: HTMLVideoElement) {
    const revision = ++this.videoRevision
    this.intro = element
    element.muted = true
    element.volume = INTRO_VOLUME
    await this.handoff
    const current = () => !this.disposed && this.owner === 'intro' && this.intro === element && revision === this.videoRevision
    if (!current()) return
    // A native video element owns both picture and embedded sound; no separate clock.
    this.audio.pause(); this.audio.muted = true
    element.muted = this.desiredMuted
    try {
      await element.play()
      if (current()) this.report(this.desiredMuted ? 'muted' : 'playing')
      else if (this.intro !== element || this.owner !== 'intro') { element.muted = true; element.pause() }
    } catch (error) {
      if (!current()) return
      if ((error as DOMException)?.name !== 'NotAllowedError' || this.desiredMuted) throw error
      // Keep the cinematic usable when audible autoplay is denied; never change saved mute.
      element.muted = true
      this.report('intro-blocked')
      await element.play()
      if (!current() && (this.intro !== element || this.owner !== 'intro')) { element.muted = true; element.pause() }
    }
  }
  detachIntro(element: HTMLVideoElement) {
    element.muted = true; element.pause()
    if (this.intro === element) { this.intro = null; ++this.videoRevision }
  }
  silenceIntro() {
    // Skip can arrive before the initial 250 ms handoff has finished.
    // Black transition silence takes priority over completing that fade.
    if (this.owner !== 'ambient') {
      ++this.revision
      this.cancelFade()
      this.audio.muted = true; this.audio.volume = 0; this.audio.pause()
      this.releaseHandoff()
    }
    this.owner = 'silent'
    ++this.videoRevision
    if (this.intro) { this.intro.muted = true; this.intro.pause() }
  }
  resumeAmbient() {
    if (this.disposed || this.owner === 'ambient') return
    this.silenceIntro()
    this.intro = null
    this.releaseHandoff()
    this.owner = 'ambient'
    if (this.consented) this.start(this.desiredMuted, 500)
  }
  dispose() {
    this.disposed = true
    this.silenceIntro(); this.intro = null; this.releaseHandoff()
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
