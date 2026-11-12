import test from 'node:test'
import assert from 'node:assert/strict'
import { Drone } from '../src/game/drone.ts'
import { Simulation, collider, course, STEP } from '../src/game/simulation.ts'
import { GameSession } from '../src/game/session.ts'

const encounters = course.zones.flatMap(zone => zone.drones ?? [])
const runner = (x, y = 0) => ({ phase: 'running', x, y, colliderHeight: collider.height })

test('two zone-authored drones occupy uninterrupted runway and preserve the existing course', () => {
  assert.equal(course.finish, 384)
  assert.deepEqual(encounters.map(encounter => encounter.x), [160, 234])
  for (const encounter of encounters) {
    const platform = course.platforms.find(([start, end]) => encounter.x >= start && encounter.x <= end)
    assert.ok(platform[0] < encounter.triggerX)
    assert.ok(encounter.x + encounter.width / 2 + collider.width / 2 + 2 < platform[1])
    assert.ok(encounter.width > course.speed * STEP + collider.width, 'fixed ticks cannot skip the scan region')
    const lowestDronePart = encounter.height + .28 - .21 - .035
    assert.ok(lowestDronePart > collider.height + course.jumpVelocity ** 2 / (2 * course.gravity), 'a jump cannot clip the aircraft')
    const enter = (encounter.x - (encounter.width + collider.width) / 2 - encounter.triggerX) / (encounter.x === 160 ? 6 : course.speed)
    const exit = (encounter.x + (encounter.width + collider.width) / 2 - encounter.triggerX) / (encounter.x === 160 ? 6 : course.speed)
    assert.ok(encounter.x === 160 ? exit < 1.4 : enter > 1.1 && exit < 4)
  }
})

test('Idle, warning and active scanning are deterministic and warning contact is harmless', () => {
  const drone = new Drone(encounters[0], 0)
  drone.update(STEP, runner(152), collider.width)
  assert.equal(drone.state, 'idle')
  for (let tick = 0; tick < 60; tick++) assert.equal(drone.update(STEP, runner(160), collider.width), false)
  assert.equal(drone.state, 'scanning')
  assert.equal(drone.scanPhase, 'warning')
  let detected = false
  for (let tick = 0; tick < 140 && !detected; tick++) detected = drone.update(STEP, runner(160), collider.width)
  assert.equal(detected, true)
  assert.equal(drone.state, 'alert')
  for (let tick = 0; tick < 45; tick++) assert.equal(drone.update(STEP, { ...runner(160), phase: 'fallen' }, collider.width), false)
  assert.equal(drone.state, 'reset')
})

test('active detection requires actual horizontal and vertical overlap, including the current Slide collider', () => {
  for (const target of [runner(160), { ...runner(160), colliderHeight: .8 }]) {
    const drone = new Drone(encounters[0], 0)
    drone.state = 'scanning'; drone.time = 1.5
    assert.equal(drone.update(STEP, target, collider.width), true)
  }
  for (const target of [runner(160.821), runner(160, 3.401), runner(160, -1.801)]) {
    const drone = new Drone(encounters[0], 0)
    drone.state = 'scanning'; drone.time = 1.5
    assert.equal(drone.update(STEP, target, collider.width), false)
  }
  const inactive = new Drone(encounters[0], 0)
  inactive.state = 'scanning'; inactive.time = 2.2
  assert.equal(inactive.update(STEP, runner(160), collider.width), false)
})

test('confirmed detection reuses readable failure timing and resets once on automatic retry', () => {
  const sim = new Simulation(), session = new GameSession(sim)
  session.testConstruction()
  sim.x = sim.previousX = 160
  sim.landTime = Infinity; sim.recoverySpeed = 0
  for (let tick = 0; tick < 240 && sim.phase === 'running'; tick++) sim.advance(STEP)
  assert.equal(sim.failure, 'drone')
  assert.equal(sim.timer, 1.1)
  assert.equal(sim.drones[0].state, 'alert')
  sim.advance(.1)
  assert.ok(sim.timer < 1.1)
  while (sim.restarts === 1) sim.advance(STEP)
  assert.equal(sim.restarts, 2)
  assert.ok(sim.drones.every(drone => drone.state === 'idle' && drone.time === 0))
})

test('Pause freezes scan time, Restart and Replay reset both encounters, and Finish ends scanning', () => {
  const sim = new Simulation(), session = new GameSession(sim)
  session.testConstruction()
  while (sim.drones[0].state === 'idle') sim.advance(STEP)
  session.togglePause()
  const time = sim.drones[0].time
  for (let frame = 0; frame < 60; frame++) if (!session.paused) sim.advance(1 / 60)
  assert.equal(sim.drones[0].time, time)
  session.togglePause()
  sim.advance(STEP)
  assert.ok(sim.drones[0].time > time)
  session.restart()
  assert.ok(sim.drones.every(drone => drone.state === 'idle' && drone.time === 0))
  sim.drones[0].state = 'scanning'
  session.replay()
  assert.equal(sim.drones[0].state, 'idle')
  sim.drones[0].state = 'scanning'
  sim.phase = 'finished'
  sim.advance(STEP)
  assert.equal(sim.drones[0].state, 'reset')
})

test('Sprint then release counterplay allows consistent safe crossing at 30/60/144 Hz', () => {
  for (const encounter of encounters) {
    const outcomes = []
    for (const fps of [30, 60, 144]) {
      const sim = new Simulation(), session = new GameSession(sim)
      if (encounter.x === 160) session.testConstruction()
      else session.testElectrical()
      const drone = sim.drones.find(drone => drone.encounter.id === encounter.id)
      sim.setSprint(true)
      const stop = encounter.x + 3
      for (let frame = 0; frame < fps * 5 && sim.x < stop && sim.phase === 'running'; frame++) {
        if (encounter.x === 234 && drone.time >= .1) sim.setSprint(false)
        sim.advance(1 / fps)
      }
      assert.ok(sim.x >= stop)
      assert.equal(sim.phase, 'running')
      assert.equal(sim.failure, null)
      assert.equal(drone.state, 'reset')
      assert.equal(sim.restarts, 1)
      outcomes.push([sim.failure, drone.state])
    }
    assert.deepEqual(outcomes[0], outcomes[1])
    assert.deepEqual(outcomes[1], outcomes[2])
  }
})

test('active overlap detection is frame-rate independent', () => {
  for (const fps of [30, 60, 144]) {
    const sim = new Simulation(), session = new GameSession(sim)
    session.testConstruction()
    sim.x = sim.previousX = 160
    sim.drones[0].state = 'scanning'; sim.drones[0].time = 1.5
    for (let frame = 0; frame < 2 && sim.failure === null; frame++) sim.advance(1 / fps)
    assert.equal(sim.failure, 'drone')
    assert.equal(sim.drones[0].state, 'alert')
  }
})

test('normal speed misses Drone 1 window and held Sprint misses Drone 2 window', () => {
  for (const encounter of encounters) {
    const sim = new Simulation(), session = new GameSession(sim)
    if (encounter.x === 160) session.testConstruction()
    else { session.testElectrical(); sim.setSprint(true) }
    for (let tick = 0; tick < 480 && sim.phase === 'running' && sim.x < encounter.x + 3; tick++) sim.advance(STEP)
    assert.equal(sim.failure, 'drone')
  }
})
