import { AnimationMixer, LoopRepeat, Vector3, type AnimationAction, type Object3D } from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'

const sequenceClips = ['Idle', 'Run', 'Jump', 'Land'] as const
export const clips = [...sequenceClips, 'Slide'] as const
export type Clip = typeof clips[number]

// One owner/mixer per loaded scene. Fades are explicitly retired, including interrupted fades.
export class RunnerPlayback {
  readonly mixer: AnimationMixer
  readonly actions: Record<Clip, AnimationAction>
  readonly hips: Object3D
  readonly origin = new Vector3()
  current: Clip = 'Idle'
  remaining = 0
  sequence = false
  elapsed = 0
  readonly asset: GLTF
  constructor(asset: GLTF) {
    this.asset = asset
    this.mixer = new AnimationMixer(asset.scene)
    this.hips = (asset.scene.getObjectByName('mixamorigHips') ?? asset.scene.getObjectByName('mixamorig:Hips'))!
    if (!this.hips) throw Error('Runner Hips joint is missing')
    this.actions = Object.fromEntries(clips.map(name => {
      const clip = asset.animations.find(clip => clip.name === name)
      if (!clip) throw Error(`Missing runner clip: ${name}`)
      return [name, this.mixer.clipAction(clip).setLoop(LoopRepeat, Infinity)]
    })) as Record<Clip, AnimationAction>
    this.play('Idle', 0)
  }
  play(name: Clip, fade: number) {
    const previous = this.actions[this.current]
    for (const action of Object.values(this.actions)) {
      action.stopFading()
      if (action !== previous) action.stop()
    }
    const next = this.actions[name]
    if (previous === next || fade === 0) this.mixer.stopAllAction()
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play()
    if (previous !== next && fade > 0) previous.crossFadeTo(next, fade, false)
    this.current = name
    this.remaining = fade
    this.elapsed = 0
    // Reference is clip time zero, never a modification of source tracks.
    const track = next.getClip().tracks.find(track => track.name === `${this.hips.name}.position`)
    if (track) this.origin.fromArray(track.values)
    this.mixer.update(0)
  }
  update(dt: number, fade: number) {
    this.mixer.update(dt)
    this.elapsed += dt
    this.remaining = Math.max(0, this.remaining - dt)
    if (this.remaining === 0) for (const name of clips) if (name !== this.current) this.actions[name].stop()
    if (this.sequence && this.elapsed >= this.actions[this.current].getClip().duration - fade) {
      const index = sequenceClips.findIndex(name => name === this.current)
      if (index === sequenceClips.length - 1) this.sequence = false
      this.play(sequenceClips[(index + 1) % sequenceClips.length], fade)
    }
  }
  dispose() {
    this.mixer.stopAllAction()
    this.mixer.uncacheRoot(this.asset.scene)
  }
}

export function disposeRunner(asset: GLTF) {
  const resources = new Set<{ dispose(): void }>()
  asset.scene.traverse(object => {
    const mesh = object as import('three').SkinnedMesh
    if (mesh.geometry) resources.add(mesh.geometry)
    if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) resources.add(material)
    if (mesh.skeleton) resources.add(mesh.skeleton)
  })
  resources.forEach(resource => resource.dispose())
}
