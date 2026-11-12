import type { DroneEncounter } from './course.ts'
import type { Simulation } from './simulation.ts'
import { hazardState } from './hazards.ts'

export type DroneState = 'idle' | 'scanning' | 'alert' | 'reset'

/** A fixed scan volume with an encounter-local simulation clock. */
export class Drone {
  readonly encounter: DroneEncounter
  readonly floor: number
  state: DroneState = 'idle'
  time = 0
  alertTime = 0
  constructor(encounter: DroneEncounter, floor: number) { this.encounter = encounter; this.floor = floor }
  get scanPhase() { return this.state === 'scanning' ? hazardState(this.encounter.timing, this.time) : this.state === 'alert' ? 'active' : 'inactive' }
  reset() { this.state = 'idle'; this.time = this.alertTime = 0 }
  overlaps(runner: Pick<Simulation, 'x' | 'y' | 'colliderHeight'>, width: number) {
    return Math.abs(runner.x - this.encounter.x) < (this.encounter.width + width) / 2 &&
      runner.y < this.floor + this.encounter.height && runner.y + runner.colliderHeight > this.floor
  }
  update(dt: number, runner: Pick<Simulation, 'x' | 'y' | 'colliderHeight' | 'phase'>, width: number) {
    if (this.state === 'alert') {
      this.alertTime += dt
      if (this.alertTime >= .35) this.state = 'reset'
      return false
    }
    if (runner.phase !== 'running') {
      if (this.state === 'scanning') this.state = 'reset'
      return false
    }
    if (this.state === 'idle' && runner.x >= this.encounter.triggerX) this.state = 'scanning'
    if (this.state !== 'scanning') return false
    this.time += dt
    if (runner.x - width / 2 > this.encounter.x + this.encounter.width / 2 + 2) { this.state = 'reset'; return false }
    if (this.scanPhase === 'active' && this.overlaps(runner, width)) {
      this.state = 'alert'
      this.alertTime = 0
      return true
    }
    return false
  }
}
