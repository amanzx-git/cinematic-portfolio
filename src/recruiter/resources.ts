import { loadAssets } from '../website/assetLoading'

export const RECRUITER_MODEL = '/assets/characters/recruiter/male.glb'
export const FALLBACK_RECRUITER_MODEL = '/assets/characters/recruiter/recruiter.glb'
export const SECURITY_MODEL = '/assets/characters/runner/runner.glb'
const models = new Map<string, Promise<ArrayBuffer>>()
let bundle: Promise<typeof import('./RecruiterExperience')> | undefined

export function loadRecruiterBundle() {
  return bundle ??= import('./RecruiterExperience').catch(error => {
    bundle = undefined
    throw error
  })
}

/** Retain source bytes, while mounted games own and dispose their parsed scenes. */
export function loadCharacterBytes(url: string) {
  let pending = models.get(url)
  if (!pending) {
    pending = fetch(url).then(async response => {
      if (!response.ok) throw Error(`Character could not load (${response.status})`)
      const bytes = await response.arrayBuffer()
      if (bytes.byteLength < 12 || new DataView(bytes).getUint32(0, true) !== 0x46546c67) {
        throw Error('Invalid character GLB')
      }
      return bytes
    }).catch(error => {
      models.delete(url)
      throw error
    })
    models.set(url, pending)
  }
  return pending
}

export function prepareRecruiter(signal: AbortSignal) {
  // Shared requests may finish into cache after navigation, with stale consumers cancelled.
  return loadAssets([
    { id: 'recruiter-bundle', load: () => loadRecruiterBundle().then(() => {}) },
    { id: RECRUITER_MODEL, load: () => loadCharacterBytes(RECRUITER_MODEL).catch(() => loadCharacterBytes(FALLBACK_RECRUITER_MODEL)).then(() => {}) },
    { id: SECURITY_MODEL, load: () => loadCharacterBytes(SECURITY_MODEL).then(() => {}) },
  ], signal)
}
