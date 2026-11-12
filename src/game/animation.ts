import { AnimationMixer, LoopOnce, LoopRepeat, VectorKeyframeTrack, type AnimationAction } from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { course, type Simulation } from './simulation.ts'
import { LAND_RUN_CONTACT_TIME, SLIDE_RUN_CONTACT_TIME, RUN_CONTACT_TIMES, RunStride, runSoleLift, slideSoleLift } from './run-contact.ts'

import { SLIDE_DURATION } from './slide.ts'

const states = ['Idle', 'Run', 'Jump', 'Land', 'Slide'] as const
type State = typeof states[number]
export const LAND_CONTACT_TIME = 0.3
export const LAND_EXIT_FADE = 0.08
export const LAND_MOVEMENT_START = 0.82
// CPU-skinned sole measurements, in metres; no per-frame skin readback/IK.
export const VISUAL_OFFSETS = { Idle: -0.0015, Run: 0, Jump: -0.0646, Land: -0.07, Slide: 0 }
export class GameAnimation {
  readonly mixer: AnimationMixer
  readonly actions: Record<State, AnimationAction>
  current: State = 'Idle'
  fadeRemaining = 0
  landFinished = false
  landCompletions = 0
  completedLandTime = 0
  readonly runPlaybackRate: number
  readonly runStride: RunStride
  private landingRunStarted = false
  private runPhase = 0
  private resetVersion = 0
  private readonly maleRecruiter: boolean
  private readonly maleOffsets: { Jump: number; Land: number }
  private readonly landContactTime: number
  private readonly landMovementStart: number
  get visualOffsetY() {
    let offset = 0, total = 0
    for (const name of states) {
      const action = this.actions[name]
      const weight = action.enabled && action.isScheduled() ? action.getEffectiveWeight() : 0
      const correction = this.maleRecruiter ? (name === 'Jump' || name === 'Land' ? this.maleOffsets[name] : 0) : VISUAL_OFFSETS[name]
      offset += correction * weight; total += weight
    }
    return total ? offset / total : this.maleRecruiter ? 0 : VISUAL_OFFSETS.Idle
  }
  private activeSimulation: Simulation | undefined
  private onFinished = (event: { action: AnimationAction }) => {
    if (event.action === this.actions.Land && this.current === 'Land') {
      this.landFinished = true
      this.landCompletions++
      this.completedLandTime = event.action.time
    }
  }
  constructor(asset: GLTF) {
    this.maleRecruiter = asset.scene.userData.maleRecruiter === true
    this.mixer = new AnimationMixer(asset.scene)
    const hips = asset.scene.getObjectByName('mixamorigHips') ?? asset.scene.getObjectByName('mixamorig:Hips')
    if (!hips) throw Error('Runner Hips joint missing')
    const anchor = hips.position.toArray()
    const jumpRoot = asset.animations.find(clip => clip.name === 'Jump')?.tracks.find(track => track.name === `${hips.name}.position`)
    const landRoot = asset.animations.find(clip => clip.name === 'Land')?.tracks.find(track => track.name === `${hips.name}.position`)
    this.maleOffsets = { Jump: (jumpRoot?.values[1] ?? anchor[1]) - anchor[1], Land: (landRoot?.values[landRoot.values.length - 2] ?? anchor[1]) - anchor[1] }
    // Male Land includes a longer airborne lead-in and roll before standing.
    // Skin sampling places contact at frame 20 and recovery runway at frame 50.
    this.landContactTime = this.maleRecruiter ? 20 / 30 : LAND_CONTACT_TIME
    this.landMovementStart = this.maleRecruiter ? 50 / 30 : LAND_MOVEMENT_START
    const runSource = asset.animations.find(clip => clip.name === 'Run')
    const runRoot = runSource?.tracks.find(track => track.name === `${hips.name}.position`)
    if (!runSource || !runRoot) throw Error('Run root motion is required for stride calibration')
    this.runStride = new RunStride(runRoot.times, runRoot.values)
    const travel = this.runStride.length
    this.runPlaybackRate = course.speed / (travel / runSource.duration)
    if (!Number.isFinite(this.runPlaybackRate) || this.runPlaybackRate <= 0) throw Error('Invalid Run stride speed')
    // Runtime clones anchor horizontal travel. Grounded clips retain canonical
    // vertical articulation, while Jump leaves ballistics to the simulation.
    this.actions = Object.fromEntries(states.map(name => {
      const source = asset.animations.find(clip => clip.name === name)
      if (!source) throw Error(`Missing ${name} animation`)
      if (name === 'Slide' && Math.abs(source.duration - SLIDE_DURATION) > 1e-5) throw Error('Slide clip and collider timing differ')
      const clip = source.clone()
      const rootTrack = clip.tracks.find(track => track.name === `${hips.name}.position`)
      clip.tracks = clip.tracks.filter(track => track !== rootTrack)
      if (name !== 'Jump' && rootTrack) {
        // Land keeps its approved settled-pelvis anchor. Run and Slide use
        // measured sole lifts, preserving the source vertical articulation.
        // X/Z stay anchored to the gameplay actor. All tracks are runtime clones.
        const values = Array.from(rootTrack.values)
        const settledY = values[values.length - 2]
        for (let i = 0; i < values.length; i += 3) {
          values[i] = anchor[0]
          if (name === 'Land') values[i + 1] = anchor[1] + values[i + 1] - settledY
          if (name === 'Run' && !this.maleRecruiter) values[i + 1] += runSoleLift(rootTrack.times[i / 3])
          if (name === 'Slide' && !this.maleRecruiter) values[i + 1] += slideSoleLift(rootTrack.times[i / 3])
          values[i + 2] = anchor[2]
        }
        clip.tracks.push(new VectorKeyframeTrack(`${hips.name}.position`, rootTrack.times, values))
      } else clip.tracks.push(new VectorKeyframeTrack(`${hips.name}.position`, [0, clip.duration], [...anchor, ...anchor]))
      const action = this.mixer.clipAction(clip)
      action.setLoop(name === 'Run' || name === 'Idle' ? LoopRepeat : LoopOnce, name === 'Run' || name === 'Idle' ? Infinity : 1)
      action.clampWhenFinished = true
      return [name, action]
    })) as Record<State, AnimationAction>
    this.actions.Idle.play()
    this.mixer.addEventListener('finished', this.onFinished)
  }
  update(dt: number, sim: Simulation) {
    const reset = this.resetVersion !== sim.restarts
    if (reset) {
      this.runPhase = 0
      this.landingRunStarted = false
      this.resetVersion = sim.restarts
      this.mixer.stopAllAction()
      this.actions.Idle.reset().play()
      this.current = 'Idle'
      this.fadeRemaining = 0
    }
    this.activeSimulation = sim
    if (sim.landTime === 0) this.landFinished = false
    // Jump remains active for all airborne motion (including descent/clamped tail).
    // Only a physics-classified hard impact sets landTime; normal contacts go to Run.
    const next: State = sim.phase !== 'running' ? 'Idle'
      : !sim.grounded ? 'Jump'
      : sim.landTime > 0 && !this.landFinished ? 'Land'
      : sim.sliding ? 'Slide' : 'Run'
    if (next !== this.current) {
      if (this.current === 'Run' && !reset) this.runPhase = this.actions.Run.time
      // Explicitly retire any interrupted fade; at most one outgoing action.
      const previous = this.actions[this.current]
      const continueRecoveryRun = this.current === 'Land' && next === 'Run' && this.landingRunStarted
      for (const action of Object.values(this.actions)) {
        action.stopFading()
        if (action !== previous && !(continueRecoveryRun && action === this.actions.Run)) action.stop()
      }
      const action = this.actions[next]
      if (!continueRecoveryRun) action.reset().setEffectiveWeight(1).play()
      if (next === 'Land') {
        this.landFinished = false
        action.time = this.landContactTime // Skip only the measured airborne lead-in.
        action.setEffectiveTimeScale(1)
      }
      // Advance the final fixed tick before starting the exit blend, so the
      // complete authored recovery is sampled at normal playback speed.
      if (this.current === 'Slide' && next === 'Run') previous.time = previous.getClip().duration
      if (next === 'Run') {
        if (!continueRecoveryRun) {
          if (this.current === 'Jump') this.runPhase = this.closestRunContact(this.runPhase)
          if (this.current === 'Slide') this.runPhase = SLIDE_RUN_CONTACT_TIME
          action.time = this.runPhase
        }
        action.setEffectiveTimeScale(this.runPlaybackRate)
      }
      const fade = this.current === 'Land' && next === 'Run' ? LAND_EXIT_FADE
        : this.current === 'Jump' && next === 'Run' ? 0.08 : 0.06
      if (continueRecoveryRun) {
        previous.setEffectiveWeight(0)
        action.setEffectiveWeight(1)
      } else previous.crossFadeTo(action, fade, false)
      this.landingRunStarted = false
      this.fadeRemaining = fade
      this.current = next
    }
    if (this.current === 'Land') {
      const land = this.actions.Land
      const time = Math.min(land.getClip().duration, land.time + dt)
      if (time >= this.landMovementStart) {
        const run = this.actions.Run
        if (!this.landingRunStarted) {
          run.reset().setEffectiveTimeScale(this.runPlaybackRate).setEffectiveWeight(0).play()
          run.time = LAND_RUN_CONTACT_TIME
          this.landingRunStarted = true
        }
        const weight = Math.max(0, Math.min(1, (time - this.landMovementStart) / (land.getClip().duration - this.landMovementStart)))
        land.setEffectiveWeight(1 - weight)
        run.setEffectiveWeight(weight)
      }
    }
    const run = this.actions.Run
    if (dt > 0 && run.isScheduled() && run.enabled && !run.paused) {
      const distance = sim.phase === 'running' ? Math.max(0, sim.x - sim.previousX) : 0
      run.setEffectiveTimeScale(this.runStride.advanceTime(run.time, distance) / dt)
    }
    this.mixer.update(dt)
    this.fadeRemaining = Math.max(0, this.fadeRemaining - dt)
    if (sim.landTime > 0) {
      const time = this.actions.Land.time
      const duration = this.actions.Land.getClip().duration
      sim.recoverySpeed = this.current === 'Land'
        ? Math.max(0, Math.min(1, (time - this.landMovementStart) / (duration - this.landMovementStart)))
        : 1
      sim.landTime = this.current === 'Land'
        ? Math.max(0, this.actions.Land.getClip().duration - this.actions.Land.time) + LAND_EXIT_FADE
        : this.fadeRemaining
      if (this.current === 'Run' && this.fadeRemaining === 0) sim.completeLanding()
    }
    if (!this.fadeRemaining) {
      for (const [name, action] of Object.entries(this.actions)) {
        if (name !== this.current && !(this.landingRunStarted && name === 'Run')) action.stop()
      }
    }
  }
  private closestRunContact(time: number) {
    const duration = this.actions.Run.getClip().duration
    let closest: number = RUN_CONTACT_TIMES[0]
    let distance = Infinity
    for (const contact of RUN_CONTACT_TIMES) {
      const delta = Math.abs(time - contact)
      const wrapped = Math.min(delta, duration - delta)
      if (wrapped < distance) {
        closest = contact
        distance = wrapped
      }
    }
    return closest
  }
  dispose() { this.mixer.removeEventListener('finished', this.onFinished); this.activeSimulation?.completeLanding(); this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.mixer.getRoot()) }
}
