import test from 'node:test'
import assert from 'node:assert/strict'
import { Simulation, STEP, course } from '../src/game/simulation.ts'
import { GameSession } from '../src/game/session.ts'
import { SLIDE_DURATION } from '../src/game/slide.ts'
import { hazardState, activeHazardInterval } from '../src/game/hazards.ts'
import { rooftopInstances } from '../src/game/environment-data.ts'

const zone = course.zones.find(zone => zone.environment === 'electrical')
const arc = zone.barriers.find(barrier => barrier.pulse)
const spawn = x => {
  const sim = new Simulation()
  Object.assign(sim, { phase: 'running', x, previousX: x, y: -1.4, previousY: -1.4, airbornePeak: -1.4,
    supportingPlatform: course.platforms.findIndex(([start, end]) => x >= start && x < end) })
  return sim
}
const advanceUntil = (sim, predicate, frames = 240, fps = 120) => {
  for (let frame = 0; frame < frames && !predicate(sim); frame++) sim.advance(1 / fps)
  assert.ok(predicate(sim))
}

test('electrical extension preserves construction surfaces and uses continuous supported slabs', () => {
  assert.equal(zone.end - 4, 279)
  assert.deepEqual(course.zones[1].platforms, [[151, 170, 0], [172.2, 183, .8], [183, 190, .8], [192.3, 203, 1.4], [204.5, 227, -1.4]])
  assert.deepEqual(zone.platforms, [[227, 245, -1.4], [245, 264, -1.4], [264, 283, -1.4]])
  assert.equal(course.gaps.filter(gap => gap.start >= zone.start && gap.end <= zone.end).length, 0)
  const roof = rooftopInstances(course.platforms)
  for (const platform of zone.platforms) {
    const surface = roof.surfaces[course.platforms.indexOf(platform)]
    assert.ok(Math.abs(surface.position[1] + surface.scale[1] / 2 - platform[2]) < 1e-9)
    assert.equal(surface.scale[0], platform[1] - platform[0])
  }
})

test('ground cable fails standing contact, permits a fair jump and uses existing automatic retry', () => {
  const standing = spawn(238.7)
  advanceUntil(standing, sim => sim.phase === 'fallen')
  assert.equal(standing.failure, 'electrical')
  assert.equal(standing.timer, 1.1)
  advanceUntil(standing, sim => sim.restarts === 1)
  assert.equal(standing.x, 0)
  assert.equal(standing.phase, 'ready')
  for (const x of [237.1, 237.5, 237.9]) {
    const sim = spawn(x)
    sim.requestJump()
    advanceUntil(sim, sim => sim.x > 241 && sim.grounded)
    assert.equal(sim.failure, null)
    assert.equal(sim.jumps, 1)
    assert.equal(sim.landings, 1)
    assert.equal(sim.hardLandings, 0)
  }
})

test('overhead conduit permits pose-timed Slide and rejects standing, early and late activation', () => {
  for (const x of [250.7, 251, 251.3]) {
    const sim = spawn(x)
    sim.requestSlide()
    advanceUntil(sim, sim => sim.x > 259)
    assert.equal(sim.failure, null)
    assert.equal(sim.sliding, false)
    assert.equal(sim.colliderHeight, 1.8)
  }
  for (const x of [249, 252]) {
    const sim = spawn(x)
    sim.requestSlide()
    advanceUntil(sim, sim => sim.phase === 'fallen')
    assert.equal(sim.failure, 'electrical')
  }
  const standing = spawn(252.7)
  advanceUntil(standing, sim => sim.phase === 'fallen')
  assert.equal(standing.failure, 'electrical')
  assert.equal(SLIDE_DURATION, 46 / 30)
})

test('pulse timing exposes active, inactive and advance-warning phases with exact swept intersections', () => {
  assert.equal(hazardState(arc.pulse, 0), 'active')
  assert.equal(hazardState(arc.pulse, 1), 'inactive')
  assert.equal(hazardState(arc.pulse, 2.5), 'warning')
  assert.equal(hazardState(arc.pulse, 3.1), 'active')
  assert.equal(hazardState(arc.pulse, 7.1), 'active')
  assert.equal(activeHazardInterval(arc.pulse, 1, 0, STEP), null)
  const starts = activeHazardInterval(arc.pulse, 3 - STEP / 2, 0, STEP)
  assert.ok(Math.abs(starts[0] - STEP / 2) < 1e-10)
  const ends = activeHazardInterval(arc.pulse, .4 - STEP / 2, 0, STEP)
  assert.ok(Math.abs(ends[1] - STEP / 2) < 1e-10)
  assert.ok(arc.pulse.inactive > (arc.end - arc.start + .44) / course.speed + .5)
})

test('arc only fails active contact and catches activation while the body is inside', () => {
  const active = spawn(267.77)
  advanceUntil(active, sim => sim.phase === 'fallen')
  assert.equal(active.failure, 'electrical')
  const inactive = spawn(267.77)
  inactive.hazardTicks = 120
  advanceUntil(inactive, sim => sim.x > 269)
  assert.equal(inactive.failure, null)
  const warning = spawn(267.77)
  warning.hazardTicks = 300
  advanceUntil(warning, sim => sim.x > 269)
  assert.equal(warning.failure, null)
  const activates = spawn(268.1)
  activates.hazardTicks = 359
  advanceUntil(activates, sim => sim.phase === 'fallen')
  assert.equal(activates.failure, 'electrical')
})

test('electrical entry, Pause, Restart and Replay preserve deterministic hazard ownership', () => {
  const sim = new Simulation(), session = new GameSession(sim)
  session.testElectrical()
  assert.equal(sim.x, 227)
  assert.equal(sim.hazardTicks, 0)
  sim.advance(.1)
  assert.equal(sim.hazardTicks, 12)
  session.togglePause()
  const tick = sim.hazardTicks
  for (let frame = 0; frame < 60; frame++) if (!session.paused) sim.advance(1 / 60)
  assert.equal(sim.hazardTicks, tick)
  session.togglePause()
  sim.advance(STEP)
  assert.equal(sim.hazardTicks, tick + 1)
  session.restart()
  assert.equal(sim.hazardTicks, 0)
  session.replay()
  assert.equal(sim.hazardTicks, 0)
  sim.advance(.1)
  assert.equal(sim.hazardTicks, 0, 'earlier zones do not shift the electrical phase')
})

test('active-arc failure is frame-rate independent even when activation occurs during contact', () => {
  const results = []
  for (const fps of [30, 60, 144]) {
    const sim = spawn(268.1)
    sim.hazardTicks = 359
    advanceUntil(sim, sim => sim.phase === 'fallen', 20, fps)
    results.push([sim.x, sim.failure, sim.hazardTicks])
  }
  assert.deepEqual(results[0], results[1])
  assert.deepEqual(results[1], results[2])
})

test('electrical run has consistent safe crossing at 30/60/144 Hz', () => {
  const results = []
  for (const fps of [30, 60, 144]) {
    const sim = new Simulation(), session = new GameSession(sim)
    session.testElectrical()
    let crossing
    for (let frame = 0; frame < fps * 15 && sim.x < 279 && sim.phase === 'running'; frame++) {
      if (sim.x >= 237.5 && sim.x < 237.8) sim.requestJump()
      if (sim.x >= 251 && sim.x < 251.2) sim.requestSlide()
      sim.advance(1 / fps)
      if (sim.x > arc.start && !crossing) crossing = hazardState(arc.pulse, sim.hazardTime)
    }
    assert.equal(sim.phase, 'running')
    assert.ok(sim.x >= 279 && sim.x < 279.2)
    assert.equal(sim.jumps, 1)
    assert.equal(sim.landings, 1)
    assert.equal(sim.restarts, 1)
    assert.equal(crossing, 'inactive')
    results.push([sim.y, sim.jumps, sim.landings])
  }
  assert.deepEqual(results[0], results[1])
  assert.deepEqual(results[1], results[2])
})
