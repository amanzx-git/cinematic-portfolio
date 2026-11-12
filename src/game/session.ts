import type { Simulation } from './simulation'
import { course } from './course.ts'

export type GameScreen = 'ready' | 'playing' | 'paused' | 'capturing' | 'failed' | 'resetting' | 'complete'

/** Presentation ownership around the existing deterministic simulation. */
export class GameSession {
  started = false
  paused = false
  readonly sim: Simulation
  constructor(sim: Simulation) { this.sim = sim }
  get screen(): GameScreen {
    if (!this.started) return 'ready'
    if (this.sim.phase === 'finished') return 'complete'
    if (this.sim.phase === 'fallen') return 'failed'
    if (this.paused) return 'paused'
    if (this.sim.phase === 'capturing') return 'capturing'
    return this.sim.phase === 'ready' ? 'resetting' : 'playing'
  }
  get canMove() { return this.started && !this.paused && this.sim.phase === 'running' }
  get canPause() { return this.started && (this.sim.phase === 'ready' || this.sim.phase === 'running' || this.sim.phase === 'capturing') }
  clearInput() {
    this.sim.jumpQueued = this.sim.slideQueued = false
    this.sim.clearSprint()
    this.sim.accumulator = 0
  }
  holdSprint(source: string, held: boolean) {
    if (!held || this.canMove) this.sim.setSprint(held, source)
  }
  start() {
    if (this.started) return
    this.started = true
    this.paused = false
    this.clearInput()
    this.sim.phase = 'running'
    this.sim.timer = 0
  }
  restart() { this.clearInput(); this.sim.restart() }
  replay() {
    this.restart()
    this.started = false
    this.start()
  }
  togglePause() {
    if (!this.canPause) return
    this.clearInput()
    this.paused = !this.paused
  }
  testHighDrop() {
    this.started = true
    this.paused = false
    this.clearInput()
    this.sim.testHighDrop()
  }
  testConstruction() {
    this.testZone('construction')
  }
  testElectrical() {
    this.testZone('electrical')
  }
  testUnderground() {
    this.testZone('underground')
  }
  testHunter() {
    this.sim.restart()
    this.started = true
    this.paused = false
    const index = course.platforms.length - 1
    this.sim.x = this.sim.previousX = 343.8
    this.sim.y = this.sim.previousY = this.sim.airbornePeak = course.platforms[index][2]
    this.sim.supportingPlatform = index
    this.sim.phase = 'running'
  }
  private testZone(environment: 'construction' | 'electrical' | 'underground') {
    const zone = course.zones.find(zone => zone.environment === environment)!
    const platform = zone.platforms[0]
    this.sim.restart()
    this.started = true
    this.paused = false
    this.sim.x = this.sim.previousX = platform[0] + (environment === 'construction' ? 1 : 0)
    this.sim.y = this.sim.previousY = this.sim.airbornePeak = platform[2]
    this.sim.supportingPlatform = course.platforms.indexOf(platform)
    this.sim.phase = 'running'
  }
}
