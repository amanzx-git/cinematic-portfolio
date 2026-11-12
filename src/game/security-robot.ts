import { AnimationMixer, LoopOnce, BoxGeometry, Group, Mesh, MeshBasicMaterial, VectorKeyframeTrack, type Material } from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { hunterRules, type Hunter } from './hunter.ts'
import { VISUAL_OFFSETS } from './animation.ts'
import { RunStride, runSoleLift, slideSoleLift } from './run-contact.ts'

/** Presentation only. Hunter simulation remains the authority for travel and time. */
export class SecurityRobot {
  readonly root = new Group()
  readonly mixer: AnimationMixer
  readonly stride: RunStride
  readonly actions
  readonly sensor: Mesh
  private readonly visual = new Group()
  private readonly geometry = new BoxGeometry()
  private readonly armor = new MeshBasicMaterial({ color: '#30353a', toneMapped: false })
  private readonly joints = new MeshBasicMaterial({ color: '#151719', toneMapped: false })
  private readonly optic = new MeshBasicMaterial({ color: '#E53935', toneMapped: false })
  private readonly warning = new MeshBasicMaterial({ color: '#E53935', transparent: true, opacity: .07, depthWrite: false, toneMapped: false })
  private readonly originals: { mesh: Mesh; material: Material | Material[] }[] = []
  private current: 'Idle' | 'Run' | 'Jump' | 'Slide' = 'Idle'
  private resetVersion = -1
  private lastX = 0
  private lastTime = 0
  private readonly asset: GLTF

  constructor(asset: GLTF) {
    this.asset = asset
    const hips = asset.scene.getObjectByName('mixamorigHips')
    const head = asset.scene.getObjectByName('mixamorigHead')
    if (!hips || !head) throw Error('Security Robot rig is missing Hips or Head')
    const run = asset.animations.find(clip => clip.name === 'Run')
    const rootTrack = run?.tracks.find(track => track.name === `${hips.name}.position`)
    if (!run || !rootTrack) throw Error('Security Robot Run root motion is missing')
    this.stride = new RunStride(rootTrack.times, rootTrack.values)
    this.mixer = new AnimationMixer(asset.scene)
    const makeAction = (name: 'Idle' | 'Run' | 'Jump' | 'Slide') => {
      const source = asset.animations.find(clip => clip.name === name)
      if (!source) throw Error(`Security Robot ${name} clip is missing`)
      const clip = source.clone()
      const index = clip.tracks.findIndex(track => track.name === `${hips.name}.position`)
      if (index >= 0) {
        const track = clip.tracks[index]
        const values = new Float32Array(track.values)
        for (let frame = 0; frame < track.times.length; frame++) {
          values[frame * 3] = hips.position.x
          values[frame * 3 + 2] = hips.position.z
          if (name === 'Jump') values[frame * 3 + 1] = hips.position.y
          if (name === 'Run') values[frame * 3 + 1] += runSoleLift(track.times[frame])
          if (name === 'Slide') values[frame * 3 + 1] += slideSoleLift(track.times[frame])
        }
        clip.tracks[index] = new VectorKeyframeTrack(track.name, track.times.slice(), values)
      }
      const action = this.mixer.clipAction(clip)
      if (name === 'Jump' || name === 'Slide') { action.setLoop(LoopOnce, 1); action.clampWhenFinished = true }
      return action
    }
    this.actions = { Idle: makeAction('Idle'), Run: makeAction('Run'), Jump: makeAction('Jump'), Slide: makeAction('Slide') }
    asset.scene.traverse(object => {
      if (!(object instanceof Mesh)) return
      this.originals.push({ mesh: object, material: object.material })
      object.material = this.originals.length === 1 ? this.joints : this.armor
    })
    asset.scene.updateMatrixWorld(true)
    this.sensor = new Mesh(this.geometry, this.optic)
    this.sensor.name = 'SecuritySensor'
    this.sensor.scale.set(.016, .028, .08)
    this.sensor.position.set(-.079, 1.695, .015)
    asset.scene.add(this.sensor)
    head.attach(this.sensor)
    this.visual.rotation.y = Math.PI / 2
    this.visual.add(asset.scene)
    this.root.add(this.visual)
    const warning = new Mesh(this.geometry, this.warning)
    warning.position.y = .004
    warning.scale.set(1.4, .008, .9)
    this.root.add(warning)
    this.root.visible = false
    this.actions.Idle.play()
    this.mixer.update(0)
  }

  update(hunter: Hunter, resetVersion: number, alpha: number, reducedMotion: boolean, playerX = Infinity) {
    if (resetVersion !== this.resetVersion) {
      this.resetVersion = resetVersion
      this.mixer.stopAllAction()
      this.actions.Idle.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play()
      this.current = 'Idle'
      this.lastX = hunter.x
      this.lastTime = 0
    }
    const moving = (hunter.state === 'pursuing' || hunter.state === 'capturing') && !hunter.waiting && !hunter.captureContact
    const next = moving ? !hunter.grounded ? 'Jump' : hunter.slideTime !== null ? 'Slide' : 'Run' : 'Idle'
    const dt = Math.max(0, hunter.poseTime - this.lastTime)
    if (next !== this.current) {
      const previous = this.actions[this.current]
      const action = this.actions[next]
      action.stopFading().reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play()
      action.paused = false
      previous.stopFading().crossFadeTo(action, .12, false)
      this.current = next
    }
    if (next === 'Run') {
      const distance = Math.max(0, hunter.x - this.lastX)
      const advance = this.stride.advanceTime(this.actions.Run.time, distance)
      this.actions.Run.setEffectiveTimeScale(dt > 0 ? advance / dt : 0)
    }
    if (next === 'Slide') { this.actions.Slide.time = hunter.slideTime ?? 0; this.actions.Slide.paused = true }
    this.mixer.update(dt)
    this.lastX = hunter.x
    this.lastTime = hunter.poseTime
    this.root.visible = hunter.state !== 'dormant'
    this.root.position.set(hunter.previousX + (hunter.x - hunter.previousX) * alpha, hunter.previousY + (hunter.y - hunter.previousY) * alpha, 0)
    this.visual.position.y = VISUAL_OFFSETS[next]
    const settling = hunter.state === 'disengaged' ? hunter.disengageTime / hunterRules.disengageDuration : 0
    this.optic.color.set('#E53935').multiplyScalar(1 - settling * .75)
    const close = playerX - hunter.x < hunterRules.warningGap
    this.warning.opacity = close || hunter.state === 'alert'
      ? (reducedMotion ? .07 : .07 + Math.sin(hunter.gaitTime * 5) * .025) * (1 - settling) : 0
  }

  dispose() {
    this.mixer.stopAllAction()
    this.mixer.uncacheRoot(this.asset.scene)
    this.sensor.removeFromParent()
    this.asset.scene.removeFromParent()
    for (const { mesh, material } of this.originals) mesh.material = material
    this.geometry.dispose()
    this.armor.dispose(); this.joints.dispose(); this.optic.dispose(); this.warning.dispose()
  }
}
