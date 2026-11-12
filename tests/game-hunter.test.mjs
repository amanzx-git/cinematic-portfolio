import test from 'node:test'
import assert from 'node:assert/strict'
import { Simulation, collider, course, STEP } from '../src/game/simulation.ts'
import { GameSession } from '../src/game/session.ts'
import { Hunter, hunterRules } from '../src/game/hunter.ts'

function chase() {
  const sim = new Simulation(), session = new GameSession(sim)
  session.testHunter()
  return { sim, session }
}

test('Hunter stays dormant in Ready and spawns safely when gameplay starts', () => {
  const sim = new Simulation(), session = new GameSession(sim)
  assert.equal(sim.hunter.state, 'dormant')
  session.start()
  sim.advance(STEP)
  assert.equal(sim.hunter.state, 'alert')
  assert.ok(Math.abs(sim.x - sim.hunter.x - hunterRules.separation) < 1e-9)
  const [start, end, top] = course.platforms.find(([start, end]) => sim.hunter.x >= start && sim.hunter.x < end)
  assert.ok(sim.hunter.x - hunterRules.width / 2 > start)
  assert.ok(sim.hunter.x + hunterRules.width / 2 < end)
  assert.equal(sim.hunter.y, top)
})

test('Alert protects a short activation beat, then pursuit uses the configured robot speed', () => {
  const { sim } = chase()
  while (sim.hunter.state === 'dormant') sim.advance(STEP)
  const x = sim.hunter.x
  for (let tick = 0; tick < 29; tick++) sim.advance(STEP)
  assert.equal(sim.hunter.state, 'alert')
  assert.equal(sim.hunter.x, x)
  sim.advance(STEP)
  assert.equal(sim.hunter.state, 'pursuing')
  const before = sim.hunter.x
  sim.advance(STEP)
  assert.ok(Math.abs(sim.hunter.x - before - hunterRules.speed * STEP) < 1e-9)
})

test('flawless fixed-speed escape survives with consistent separation at 30/60/144 Hz', () => {
  const results = []
  for (const fps of [30, 60, 144]) {
    const { sim } = chase()
    for (let frame = 0; frame < fps * 12 && sim.phase === 'running'; frame++) {
      if (sim.x >= 364 && sim.x < 364.2) sim.requestSlide()
      sim.advance(1 / fps)
      if (sim.hunter.state === 'pursuing') {
        assert.ok(sim.x - sim.hunter.x > (hunterRules.width + collider.width) / 2)
        assert.ok(sim.x - sim.hunter.x < 6)
      }
      assert.equal(sim.failure, null)
    }
    assert.equal(sim.x, course.finish)
    assert.equal(sim.phase, 'finished')
    assert.equal(sim.hunter.state, 'disengaged')
    results.push([sim.hunter.x, sim.hunter.gaitTime])
  }
  assert.deepEqual(results[0], results[1])
  assert.deepEqual(results[1], results[2])
})

test('Pause freezes alert and pursuing state, while Restart and Replay reset the Hunter', () => {
  const { sim, session } = chase()
  while (sim.hunter.state === 'dormant') sim.advance(STEP)
  for (const state of ['alert', 'pursuing']) {
    while (sim.hunter.state !== state) sim.advance(STEP)
    session.togglePause()
    const before = JSON.stringify(sim.hunter)
    for (let frame = 0; frame < 60; frame++) if (!session.paused) sim.advance(1 / 60)
    assert.equal(JSON.stringify(sim.hunter), before)
    session.togglePause()
  }
  session.restart()
  assert.equal(sim.hunter.state, 'dormant')
  assert.equal(sim.hunter.gaitTime, 0)
  session.testHunter()
  sim.advance(.1)
  session.replay()
  assert.equal(sim.hunter.state, 'dormant')
  assert.equal(sim.hunter.x, 0)
  assert.equal(sim.x, 0)
})

test('capture requires actual body overlap, with correct horizontal and vertical boundaries', () => {
  const hunter = new Hunter()
  hunter.x = 345
  const runner = { x: 345, y: hunter.y, colliderHeight: collider.height }
  assert.equal(hunter.overlaps(runner, collider.width), true)
  runner.x = hunter.x + (hunterRules.width + collider.width) / 2 + .001
  assert.equal(hunter.overlaps(runner, collider.width), false)
  runner.x = hunter.x
  runner.y = hunter.y + hunterRules.height + .001
  assert.equal(hunter.overlaps(runner, collider.width), false)
})

test('injected stationary contact reuses capture failure and automatic restart once', () => {
  const { sim } = chase()
  while (sim.hunter.state !== 'pursuing') sim.advance(STEP)
  sim.hunter.x = sim.hunter.previousX = sim.x - .825
  for (let tick = 0; tick < 30 && sim.phase === 'running'; tick++) sim.advance(STEP)
  assert.equal(sim.failure, 'hunter')
  assert.equal(sim.timer, 1.1)
  assert.ok(sim.hunter.overlaps(sim, collider.width))
  sim.advance(.1)
  assert.ok(sim.timer < 1.1)
  while (sim.restarts === 1) sim.advance(STEP)
  assert.equal(sim.restarts, 2)
  assert.equal(sim.hunter.state, 'dormant')
  assert.equal(sim.x, 0)
})

test('Finish wins the final tick and disengages pursuit without changing course or camera', () => {
  const { sim } = chase()
  sim.x = sim.previousX = course.finish - .01
  sim.hunter.state = 'pursuing'
  sim.hunter.x = sim.hunter.previousX = sim.x - .1
  sim.advance(STEP)
  assert.equal(sim.phase, 'finished')
  assert.equal(sim.failure, null)
  assert.equal(sim.hunter.state, 'disengaged')
  const before = sim.hunter.x
  sim.advance(.1)
  assert.equal(sim.hunter.x, before)
  assert.equal(course.finish, 384)
  assert.equal(course.speed, 4.5)
})

test('disengagement settles locally without moving the Hunter or leaving stale fade state', () => {
  const { sim } = chase()
  sim.x = sim.previousX = course.finish - .01
  sim.hunter.state = 'pursuing'
  sim.hunter.x = sim.hunter.previousX = sim.x - 3.3
  sim.advance(STEP)
  const x = sim.hunter.x
  for (let tick = 0; tick < 60; tick++) sim.advance(STEP)
  assert.equal(sim.hunter.disengageTime, hunterRules.disengageDuration)
  assert.equal(sim.hunter.x, x)
  sim.restart()
  assert.equal(sim.hunter.disengageTime, 0)
})


test('normal running closes separation while Sprint opens it without position snapping', () => {
  for (const sprint of [false, true]) {
    const sim = new Simulation(), session = new GameSession(sim)
    session.start()
    if (sprint) sim.setSprint(true)
    for (let tick = 0; tick < 60; tick++) sim.advance(STEP)
    const gap = sim.x - sim.hunter.x
    for (let tick = 0; tick < 120; tick++) {
      const x = sim.hunter.x
      sim.advance(STEP)
      assert.ok(sim.hunter.x - x <= hunterRules.catchupSpeed * STEP + 1e-8)
      assert.ok(sim.hunter.x < sim.x)
    }
    const change = sim.x - sim.hunter.x - gap
    if (sprint) assert.ok(change > 1)
    else assert.ok(Math.abs(change + .3) < 1e-7)
    assert.equal(sim.failure, null)
  }
})

test('recorded traversal crosses a jump and protects forced landing recovery', () => {
  const sim = new Simulation(), session = new GameSession(sim)
  session.start()
  sim.setSprint(true)
  let robotAir = false
  for (let tick = 0; tick < 700 && sim.x < 29; tick++) {
    if (sim.grounded && sim.x >= 15.3 && sim.x < 16) sim.requestJump()
    sim.advance(STEP)
    robotAir ||= !sim.hunter.grounded
    assert.equal(sim.failure, null)
  }
  assert.ok(robotAir)
  assert.ok(sim.hunter.x >= 18.4)
  assert.ok(Math.abs(sim.hunter.y - .8) < 1e-5)
  sim.landTime = 1
  sim.recoverySpeed = 0
  const x = sim.hunter.x
  for (let tick = 0; tick < 60; tick++) sim.advance(STEP)
  assert.equal(sim.hunter.x, x)
  assert.equal(sim.failure, null)
})

test('fatal obstacle starts a visible continuous approach before the existing retry', () => {
  const sim = new Simulation(), session = new GameSession(sim)
  session.replay()
  // Use the existing supported runway immediately before the first low duct.
  sim.x = sim.previousX = 80.7
  sim.y = sim.previousY = -1.3
  sim.supportingPlatform = 5
  for (let tick = 0; tick < 40 && sim.phase === 'running'; tick++) sim.advance(STEP)
  assert.equal(sim.phase, 'capturing')
  assert.equal(sim.failure, 'barrier')
  const x = sim.hunter.x, player = sim.x
  session.togglePause()
  assert.equal(session.paused, true)
  session.togglePause()
  for (let tick = 0; tick < 180 && sim.phase === 'capturing'; tick++) {
    const previous = sim.hunter.x
    sim.advance(STEP)
    assert.ok(sim.hunter.x - previous <= hunterRules.captureSpeed * STEP + 1e-8)
    assert.equal(sim.x, player)
  }
  assert.ok(sim.hunter.x > x)
  assert.equal(sim.phase, 'fallen')
  assert.equal(sim.timer, 1.1)
  for (let tick = 0; tick < 150 && sim.restarts === 1; tick++) sim.advance(STEP)
  assert.equal(sim.restarts, 2)
  assert.equal(sim.hunter.state, 'dormant')
})
