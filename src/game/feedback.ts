import type { Simulation } from './simulation'

export type PuffKind = 'land' | 'slide' | 'failure' | 'finish'
export const PUFF_COUNT = 16
export class MovementFeedback {
  readonly particles = Array.from({ length: PUFF_COUNT }, () => ({
    x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 0, size: 0, kind: 'land' as PuffKind,
  }))
  readonly events = { land: 0, slide: 0, failure: 0, finish: 0 }
  failurePulse = 0
  private cursor = 0
  private restarts = -1
  private hardLandings = 0
  private phase: Simulation['phase'] = 'ready'
  private sliding = false
  private frictionTime = 0
  get activeCount() { return this.particles.reduce((count, puff) => count + Number(puff.age < puff.life), 0) }
  private burst(kind: PuffKind, x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const puff = this.particles[this.cursor]
      this.cursor = (this.cursor + 1) % this.particles.length
      const direction = (i % 2 ? 1 : -1)
      puff.x = x + direction * 0.05
      puff.y = y + 0.04
      puff.vx = direction * (0.18 + i * 0.04)
      puff.vy = kind === 'finish' ? 0.5 + i * 0.04 : 0.16 + i * 0.025
      puff.age = 0
      puff.life = kind === 'finish' ? 0.55 : 0.3 + i * 0.015
      puff.size = kind === 'finish' ? 0.035 : 0.04 + i * 0.008
      puff.kind = kind
    }
  }
  clear() {
    this.cursor = 0
    for (const puff of this.particles) { puff.age = 0; puff.life = 0 }
    this.failurePulse = this.frictionTime = 0
  }
  update(dt: number, sim: Simulation, enabled: boolean) {
    const reset = this.restarts !== sim.restarts
    if (reset || !enabled) {
      this.clear()
      if (reset) for (const kind of ['land', 'slide', 'failure', 'finish'] as const) this.events[kind] = 0
    }
    for (const puff of this.particles) puff.age = Math.min(puff.life, puff.age + dt)
    this.failurePulse = Math.max(0, this.failurePulse - dt)
    if (enabled && !reset) {
      if (sim.hardLandings > this.hardLandings && sim.grounded) {
        this.events.land++
        this.burst('land', sim.x, sim.y, 6)
      }
      if (sim.sliding && !this.sliding) this.events.slide++
      if (sim.sliding && sim.colliderHeight <= 0.9) {
        this.frictionTime += dt
        if (this.frictionTime >= 0.14) {
          this.frictionTime -= 0.14
          this.burst('slide', sim.x - 0.12, sim.y, 2)
        }
      } else this.frictionTime = 0
      if (sim.phase === 'fallen' && this.phase !== 'fallen') {
        this.events.failure++
        this.failurePulse = 0.18
        this.burst('failure', sim.x, sim.y + 0.2, 4)
      }
      if (sim.phase === 'finished' && this.phase !== 'finished') {
        this.events.finish++
        this.burst('finish', sim.x, sim.y + 0.12, 6)
      }
    }
    this.restarts = sim.restarts
    this.hardLandings = sim.hardLandings
    this.phase = sim.phase
    this.sliding = sim.sliding
  }
}
