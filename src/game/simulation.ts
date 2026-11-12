import { SLIDE_DURATION, STANDING_HEIGHT, slideHeightAt } from './slide.ts'
import { course, barriers, zoneAt } from './course.ts'
import { activeHazardInterval, hazardState } from './hazards.ts'
import { Hunter, hunterRules } from './hunter.ts'
import { Drone } from './drone.ts'
export { course, barriers } from './course.ts'
export type { Platform } from './course.ts'

export const STEP = 1 / 120
export const sprintRules = { speed: 6, acceleration: 12.5, deceleration: 15 }
// Feet-centred AABB, independent of the animated mesh. Z is always zero.
export const collider = { width: 0.44, height: STANDING_HEIGHT, depth: 0.5 }
export const CONTACT_EPSILON = 1e-5
function overlapsBarrier(x: number, feet: number, height: number, time: number) {
  return barriers.some(barrier =>
    hazardState(barrier.pulse, time) === 'active' &&
    x + collider.width / 2 > barrier.start + CONTACT_EPSILON &&
    x - collider.width / 2 < barrier.end - CONTACT_EPSILON &&
    feet < barrier.top - CONTACT_EPSILON &&
    feet + height > barrier.bottom + CONTACT_EPSILON
  )
}
export function supportAt(x: number) {
  return course.platforms.findIndex(([start, end]) => x + collider.width / 2 > start + CONTACT_EPSILON && x - collider.width / 2 < end - CONTACT_EPSILON)
}
export type Phase = 'ready' | 'running' | 'capturing' | 'fallen' | 'finished'
export const defaultLandingRules = { minFallDistance: 2.5, minImpactSpeed: 10 }
export type LandingRules = typeof defaultLandingRules
export class Simulation {
  readonly hunter = new Hunter()
  readonly drones = course.zones.flatMap(zone => (zone.drones ?? []).map(encounter => {
    const platform = zone.platforms.find(([start, end]) => encounter.x >= start && encounter.x < end)!
    return new Drone(encounter, platform[2])
  }))
  readonly landingRules: LandingRules
  constructor(rules: Partial<LandingRules> = {}) {
    this.landingRules = { ...defaultLandingRules, ...rules }
  }
  x = 0
  y = 0
  previousX = 0
  previousY = 0
  vy = 0
  grounded = true
  supportingPlatform = 0
  blocked = false
  speed = course.speed
  private readonly sprintInputs = new Set<string>()
  get sprintHeld() { return this.sprintInputs.size > 0 }
  setSprint(held: boolean, source = 'keyboard') {
    if (held && this.phase === 'running') this.sprintInputs.add(source)
    else this.sprintInputs.delete(source)
  }
  clearSprint() { this.sprintInputs.clear() }
  phase: Phase = 'ready'
  timer = 0.65
  recoverySpeed = 0
  landTime = 0
  restarts = 0
  jumps = 0
  landings = 0
  hardLandings = 0
  airbornePeak = 0
  lastFallDistance = 0
  lastImpactSpeed = 0
  accumulator = 0
  hazardTicks = 0
  get hazardTime() { return this.hazardTicks * STEP }
  jumpQueued = false
  slideTime: number | null = null
  slideQueued = false
  failure: 'fall' | 'barrier' | 'electrical' | 'hunter' | 'drone' | null = null
  get sliding() { return this.slideTime !== null }
  get colliderHeight() { return this.slideTime === null ? collider.height : slideHeightAt(this.slideTime) }
  get standingClearance() { return !overlapsBarrier(this.x, this.y, collider.height, this.hazardTime) }
  requestSlide() {
    if (this.phase !== 'running' || !this.grounded || this.landTime > 0 || this.sliding) return
    this.slideQueued = true
    this.jumpQueued = false
  }
  requestJump() {
    if (this.phase === 'running' && this.grounded && this.landTime === 0 && !this.sliding && !this.slideQueued) this.jumpQueued = true
  }
  completeLanding() { this.landTime = 0; this.recoverySpeed = 0 }
  restart() {
    this.restarts++
    this.x = this.y = this.previousX = this.previousY = this.vy = this.landTime = this.accumulator = 0
    this.recoverySpeed = 0
    this.speed = course.speed
    this.clearSprint()
    this.grounded = true; this.phase = 'ready'; this.timer = 0.65; this.jumpQueued = false
    this.supportingPlatform = 0; this.blocked = false
    this.slideTime = null; this.failure = null; this.slideQueued = false
    this.hazardTicks = 0
    this.hunter.reset()
    this.drones.forEach(drone => drone.reset())
    this.airbornePeak = this.lastFallDistance = this.lastImpactSpeed = 0
  }
  testHighDrop() {
    // Isolated debug reset above the starting platform; the course is unchanged.
    this.restart()
    this.y = this.previousY = this.airbornePeak = 3
    this.phase = 'running'; this.grounded = false
    this.supportingPlatform = -1
  }
  advance(delta: number, tick?: (dt: number) => void) {
    // Drop hidden-tab/long-stall time: never run a catch-up spiral or launch through a gap.
    this.accumulator += Math.min(0.1, Math.max(0, Number.isFinite(delta) ? delta : 0))
    while (this.accumulator + 1e-10 >= STEP) {
      this.accumulator -= STEP
      this.previousX = this.x; this.previousY = this.y
      this.step(STEP)
      if (this.hunter.update(STEP, this, collider.width) && this.phase === 'running') {
        this.phase = 'fallen'; this.failure = 'hunter'; this.timer = 1.1; this.vy = 0
        this.blocked = true; this.slideQueued = false; this.slideTime = null
        this.hunter.state = 'disengaged'
      }
      for (const drone of this.drones) {
        if (drone.update(STEP, this, collider.width)) {
          this.phase = this.grounded ? 'capturing' : 'fallen'; this.failure = 'drone'; this.timer = this.grounded ? hunterRules.captureDuration : 1.1; this.vy = 0
          this.blocked = true; this.slideQueued = false; this.slideTime = null
        }
      }
      if (this.phase !== 'running') this.clearSprint()
      tick?.(STEP)
    }
  }
  step(dt: number) {
    if (this.phase === 'capturing') {
      this.timer -= dt
      this.jumpQueued = this.slideQueued = false
      if (this.timer <= 0 || (this.hunter.captureContact && this.hunter.captureTime >= hunterRules.captureHold)) {
        this.phase = 'fallen'; this.timer = 1.1
      }
      return
    }
    if (this.phase === 'ready' || this.phase === 'fallen') {
      this.timer -= dt
      this.jumpQueued = false
      if (this.timer <= 0) { if (this.phase === 'fallen') this.restart(); else this.phase = 'running' }
      return
    }
    if (this.phase === 'finished') { this.jumpQueued = false; return }
    const targetSpeed = this.sprintHeld ? sprintRules.speed : course.speed
    const rate = this.sprintHeld ? sprintRules.acceleration : sprintRules.deceleration
    this.speed += Math.sign(targetSpeed - this.speed) * Math.min(Math.abs(targetSpeed - this.speed), rate * dt)
    const hazardTime = this.hazardTime
    // Local simulation time removes arrival-phase variation from earlier landings.
    if (zoneAt(this.x).environment === 'electrical') this.hazardTicks++
    if (this.landTime > 0) {
      this.jumpQueued = false
      if (this.recoverySpeed === 0) return
    }
    if (this.slideQueued && this.grounded && !this.sliding) this.slideTime = 0
    this.slideQueued = false
    if (this.jumpQueued && this.grounded && !this.sliding) {
      this.vy = course.jumpVelocity; this.grounded = false; this.airbornePeak = this.y; this.jumps++
      this.supportingPlatform = -1
    }
    this.jumpQueued = false
    const oldX = this.x
    const distance = this.speed * dt * (this.landTime > 0 ? this.recoverySpeed : 1)
    const horizontalSpeed = distance / dt
    const heightAt = (time: number) => this.slideTime === null ? collider.height : slideHeightAt(this.slideTime + time)
    for (const barrier of barriers) {
      // Sweep the body's full footprint through the duct during this tick.
      const enter = Math.max(0, (barrier.start - collider.width / 2 + CONTACT_EPSILON - oldX) / (distance / dt))
      const exit = Math.min(dt, (barrier.end + collider.width / 2 - CONTACT_EPSILON - oldX) / (distance / dt))
      if (enter >= exit) continue
      const interval = activeHazardInterval(barrier.pulse, hazardTime, enter, exit)
      if (!interval) continue
      const [activeEnter, activeExit] = interval
      const feet = (time: number) => this.grounded ? this.y : this.y + this.vy * time - 0.5 * course.gravity * time * time
      const low = Math.min(feet(activeEnter), feet(activeExit))
      // Collider keys are on the fixed-step lattice. While sliding the feet
      // are grounded and the height is linear over this swept interval.
      const high = feet(Math.max(activeEnter, Math.min(activeExit, this.vy / course.gravity))) + Math.max(heightAt(activeEnter), heightAt(activeExit))
      if (low < barrier.top - CONTACT_EPSILON && high > barrier.bottom + CONTACT_EPSILON) {
        this.phase = this.grounded ? 'capturing' : 'fallen'; this.failure = barrier.electrical ? 'electrical' : 'barrier'; this.timer = this.grounded ? hunterRules.captureDuration : 1.1; this.vy = 0
        this.blocked = true; this.slideQueued = false; this.slideTime = null
        return
      }
    }
    if (this.slideTime !== null) {
      const end = this.slideTime + dt
      this.slideTime = end >= SLIDE_DURATION - 1e-9 ? null : end
    }
    this.x += distance
    this.blocked = false
    const support = supportAt(this.x)
    if (this.grounded && support < 0) { this.grounded = false; this.slideTime = null; this.airbornePeak = this.y; this.supportingPlatform = -1 }
    else if (this.grounded) { this.y = course.platforms[support][2]; this.supportingPlatform = support }
    if (!this.grounded) {
      this.supportingPlatform = -1
      const oldY = this.y
      const oldVy = this.vy
      this.y += this.vy * dt - 0.5 * course.gravity * dt * dt
      this.vy -= course.gravity * dt
      this.airbornePeak = Math.max(this.airbornePeak, this.y)
      // Sweep the body against platform front faces. No depenetration/edge snapping.
      // Forward-only controller; the course has no ceilings or moving platforms.
      for (const [start, , top] of course.platforms) {
        const face = start - collider.width / 2
        if (oldX <= face + CONTACT_EPSILON && this.x > face) {
          const fraction = Math.max(0, (face - oldX) / distance)
          const time = dt * fraction
          const bottom = oldY + oldVy * time - 0.5 * course.gravity * time * time
          if (bottom < top - CONTACT_EPSILON && bottom + collider.height > top - 1 + CONTACT_EPSILON) {
            this.x = Math.max(oldX, face); this.blocked = true
          }
        }
      }
      let landingSupport = -1
      const destination = supportAt(this.x)
      const top = destination < 0 ? -Infinity : course.platforms[destination][2]
      if (oldY >= top - CONTACT_EPSILON && this.y <= top && this.vy < 0) {
        const fall = Math.max(0, oldY - top)
        const contactTime = (oldVy + Math.sqrt(oldVy * oldVy + 2 * course.gravity * fall)) / course.gravity
        // The feet must overlap the destination at the crossing as well as at tick end.
        const contactX = Math.min(this.x, oldX + horizontalSpeed * Math.min(dt, contactTime))
        if (supportAt(contactX) === destination) landingSupport = destination
      }
      if (landingSupport >= 0) {
        // Evaluate impact relative to the landing surface.
        this.lastFallDistance = this.airbornePeak - top
        this.lastImpactSpeed = Math.sqrt(oldVy * oldVy + 2 * course.gravity * Math.max(0, oldY - top))
        const hard = this.lastFallDistance >= this.landingRules.minFallDistance && this.lastImpactSpeed >= this.landingRules.minImpactSpeed
        this.landTime = hard ? Infinity : 0 // Initialized with clip-derived remaining time on this tick.
        if (hard) this.hardLandings++
        this.y = top; this.vy = 0; this.grounded = true; this.landings++
        this.supportingPlatform = landingSupport
      }
    }
    if (this.y < zoneAt(this.x).fallY) { this.phase = 'fallen'; this.failure = 'fall'; this.timer = 1.1; this.vy = 0; this.slideQueued = false }
    else if (this.x >= course.finish && this.grounded && this.landTime === 0) {
      // Stop on the line when running across it, never pull an airborne overshoot back.
      if (oldX <= course.finish) this.x = course.finish
      this.phase = 'finished'
    }
  }
}
