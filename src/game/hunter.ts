import { course, barriers } from './course.ts'
import type { Simulation } from './simulation.ts'

export const hunterRules = {
  activationX: 0, separation: 3.2, speed: 4.8, alertDuration: .25,
  softSeparation: 7, catchupRange: 3, catchupSpeed: 6.4,
  captureSpeed: 12, captureDuration: 1.1, captureHold: .45, recoveryGrace: .45,
  width: 1.2, height: 1.05, warningGap: 3.6, disengageDuration: .4,
}
export type HunterState = 'dormant' | 'alert' | 'pursuing' | 'capturing' | 'disengaged'
type Runner = Pick<Simulation, 'phase' | 'x' | 'y' | 'colliderHeight'> & Partial<Pick<Simulation, 'grounded' | 'slideTime' | 'landTime'>>
type Pose = { x: number; y: number; grounded: boolean; slideTime: number | null; height: number }

/** Follow the player's proven path, rather than inventing enemy routes through gaps. */
export class Hunter {
  state: HunterState = 'dormant'
  x = 0
  previousX = 0
  y = 0
  previousY = 0
  grounded = true
  slideTime: number | null = null
  height = hunterRules.height
  waiting = false
  captureContact = false
  alertTime = 0
  gaitTime = 0
  poseTime = 0
  captureTime = 0
  disengageTime = 0
  private recoveryTime = 0
  private path: Pose[] = []
  private cursor = 0

  reset() {
    this.state = 'dormant'
    this.x = this.previousX = this.y = this.previousY = 0
    this.alertTime = this.gaitTime = this.poseTime = this.captureTime = this.disengageTime = 0
    this.recoveryTime = 0
    this.grounded = true; this.slideTime = null; this.height = hunterRules.height
    this.waiting = this.captureContact = false
    this.path = []; this.cursor = 0
  }
  overlaps(runner: Pick<Simulation, 'x' | 'y' | 'colliderHeight'>, runnerWidth: number) {
    return Math.abs(this.x - runner.x) < (hunterRules.width + runnerWidth) / 2 &&
      runner.y < this.y + this.height && runner.y + runner.colliderHeight > this.y
  }
  private clearContact(runner: Runner, runnerWidth: number) {
    if (!this.grounded || runner.grounded === false || Math.abs(this.y - runner.y) > .05) return false
    const left = Math.min(this.x, runner.x), right = Math.max(this.x, runner.x)
    if (course.gaps.some(gap => gap.start < right && gap.end > left)) return false
    const top = Math.max(this.y + this.height, runner.y + runner.colliderHeight)
    const blocked = barriers.some(barrier => barrier.start < right && barrier.end > left &&
      barrier.bottom < top && barrier.top > Math.min(this.y, runner.y))
    return !blocked && this.overlaps(runner, runnerWidth)
  }
  update(dt: number, runner: Runner, runnerWidth: number) {
    this.previousX = this.x; this.previousY = this.y
    if (runner.phase !== 'running' && runner.phase !== 'capturing') {
      if (this.state !== 'dormant') this.state = 'disengaged'
      if (this.state === 'disengaged') {
        const advance = Math.min(dt, hunterRules.disengageDuration - this.disengageTime)
        this.disengageTime += advance; this.poseTime += advance
      }
      return false
    }
    if (this.state === 'dormant') {
      if (runner.grounded === false) return false
      const desired = runner.x - hunterRules.separation
      const platform = course.platforms.find(([start, end, top]) => desired >= start + hunterRules.width / 2 && desired <= end && Math.abs(top - runner.y) < .05)
      const current = course.platforms.find(([start, end, top]) => runner.x >= start && runner.x <= end && Math.abs(top - runner.y) < .05)
      if (!platform && !current) return false
      const spawn = platform ? desired : Math.max(current![0] + hunterRules.width / 2, desired)
      if (runner.x - spawn < 1.4) return false
      this.state = 'alert'
      this.x = this.previousX = spawn
      this.y = this.previousY = runner.y
      this.path = [
        { x: spawn, y: runner.y, grounded: true, slideTime: null, height: runner.colliderHeight },
        { x: runner.x, y: runner.y, grounded: true, slideTime: runner.slideTime ?? null, height: runner.colliderHeight },
      ]
      return false
    }
    const tail = this.path.at(-1)
    if (!tail || runner.x > tail.x + 1e-8) this.path.push({ x: runner.x, y: runner.y,
      grounded: runner.grounded !== false, slideTime: runner.slideTime ?? null, height: runner.colliderHeight })
    this.poseTime += dt
    this.recoveryTime = (runner.landTime ?? 0) > 0 ? hunterRules.recoveryGrace : Math.max(0, this.recoveryTime - dt)
    if (runner.phase === 'capturing') { this.state = 'capturing'; this.captureTime += dt }
    if (this.state === 'alert') {
      this.alertTime += dt
      if (this.alertTime + 1e-10 >= hunterRules.alertDuration) this.state = 'pursuing'
      return false
    }
    this.waiting = this.grounded && this.state !== 'capturing' &&
      (this.recoveryTime > 0 || (runner.grounded === false && runner.y < this.y - .2))
    if (!this.waiting && !this.captureContact) {
      const blend = Math.max(0, Math.min(1, (runner.x - this.x - hunterRules.softSeparation) / hunterRules.catchupRange))
      const speed = this.state === 'capturing' ? hunterRules.captureSpeed : hunterRules.speed + (hunterRules.catchupSpeed - hunterRules.speed) * blend
      const target = Math.min(runner.x - .05, this.x + speed * dt)
      if (target > this.x) {
        while (this.cursor + 1 < this.path.length - 1 && this.path[this.cursor + 1].x < target) this.cursor++
        const a = this.path[this.cursor], b = this.path[this.cursor + 1] ?? a
        const t = Math.max(0, Math.min(1, (target - a.x) / Math.max(1e-8, b.x - a.x)))
        this.x = target; this.y = a.y + (b.y - a.y) * t
        this.grounded = t >= 1 ? b.grounded : a.grounded && b.grounded
        this.height = Math.min(hunterRules.height, a.height + (b.height - a.height) * t)
        this.slideTime = a.slideTime !== null && b.slideTime !== null ? a.slideTime + (b.slideTime - a.slideTime) * t : a.slideTime ?? b.slideTime
        this.gaitTime += dt
        if (this.cursor > 128) { this.path.splice(0, this.cursor); this.cursor = 0 }
      }
    }
    const contact = this.recoveryTime === 0 && this.clearContact(runner, runnerWidth)
    if (this.state === 'capturing') this.captureContact ||= contact
    return contact
  }
}
