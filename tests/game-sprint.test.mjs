import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { Simulation, STEP, course, sprintRules } from '../src/game/simulation.ts'
import { GameSession } from '../src/game/session.ts'
import { bindGameInput } from '../src/game/input.ts'
import { SLIDE_DURATION } from '../src/game/slide.ts'
import { GameAnimation } from '../src/game/animation.ts'

function running(x = 1, speed = course.speed) {
  const sim = new Simulation()
  const index = course.platforms.findIndex(([start, end]) => x >= start && x < end)
  const top = course.platforms[Math.max(0, index)][2]
  Object.assign(sim, { phase: 'running', x, previousX: x, y: top, previousY: top, supportingPlatform: index, speed })
  if (speed > course.speed) sim.setSprint(true)
  return sim
}

test('Sprint accelerates, releases and resets deterministically at 30/60/144 Hz', () => {
  const results = []
  for (const fps of [30, 60, 144]) {
    const sim = running()
    sim.setSprint(true)
    for (let frame = 0; frame < fps / 2; frame++) sim.advance(1 / fps)
    assert.equal(sim.speed, 6)
    assert.ok(sim.x > 1 + 4.5 * .5 && sim.x < 1 + 6 * .5)
    sim.setSprint(false)
    for (let frame = 0; frame < fps / 2; frame++) sim.advance(1 / fps)
    assert.equal(sim.speed, 4.5)
    results.push(sim.x)
    sim.restart()
    assert.equal(sim.speed, 4.5)
    assert.equal(sim.sprintHeld, false)
  }
  assert.deepEqual(results, [results[0], results[0], results[0]])
})

test('keyboard Sprint is held across multiple sources and cleared on blur, hiding, Pause and cleanup', () => {
  const saved = { window: globalThis.window, document: globalThis.document, HTMLElement: globalThis.HTMLElement }
  globalThis.window = new EventTarget()
  globalThis.document = Object.assign(new EventTarget(), { hidden: false })
  globalThis.HTMLElement = class {}
  const sim = new Simulation(), session = new GameSession(sim)
  session.start()
  const remove = bindGameInput(session, () => {})
  const key = (type, code) => {
    const event = new Event(type, { cancelable: true })
    Object.assign(event, { code, repeat: false })
    window.dispatchEvent(event)
  }
  try {
    key('keydown', 'ShiftLeft'); key('keydown', 'ShiftRight')
    key('keyup', 'ShiftLeft'); assert.equal(sim.sprintHeld, true)
    key('keyup', 'ShiftRight'); assert.equal(sim.sprintHeld, false)
    key('keydown', 'ShiftLeft'); window.dispatchEvent(new Event('blur'))
    assert.equal(sim.sprintHeld, false)
    key('keydown', 'ShiftLeft'); document.hidden = true; document.dispatchEvent(new Event('visibilitychange'))
    assert.equal(sim.sprintHeld, false)
    document.hidden = false
    key('keydown', 'ShiftLeft'); sim.advance(.1)
    session.togglePause()
    const before = [sim.x, sim.speed]
    assert.equal(sim.sprintHeld, false)
    for (let frame = 0; frame < 20; frame++) if (!session.paused) sim.advance(STEP)
    assert.deepEqual([sim.x, sim.speed], before)
    session.togglePause()
    session.holdSprint('pointer-7', true); session.holdSprint('ShiftLeft', true)
    session.holdSprint('pointer-7', false); assert.equal(sim.sprintHeld, true)
    session.replay(); assert.equal(sim.sprintHeld, false); assert.equal(sim.speed, 4.5)
    remove(); key('keydown', 'ShiftLeft'); assert.equal(sim.sprintHeld, false)
  } finally {
    remove()
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete globalThis[key]
      else globalThis[key] = value
    }
  }
})

test('Sprint extends horizontal jump travel while preserving gravity and the single-jump impulse', () => {
  const landings = []
  for (const speed of [4.5, 6]) {
    const sim = running(1, speed)
    sim.requestJump()
    while (!sim.landings) { sim.advance(STEP); sim.requestJump() }
    assert.equal(sim.jumps, 1)
    assert.equal(sim.y, 0)
    assert.ok(Math.abs((sim.x - 1) - speed * (2 * course.jumpVelocity / course.gravity)) < speed * STEP)
    landings.push(sim.x)
  }
  assert.ok(landings[1] - landings[0] > 1)
})

test('fixed Slide and swept obstacles work at both speeds with speed-appropriate takeoff points', () => {
  const pairs = [[81, 79, 78.4], [253, 251, 250.4], [303, 301, 300.4], [366, 364, 363.4]]
  for (const speed of [4.5, 6]) {
    for (const [start, normal, fast] of pairs) {
      const sim = running(speed === 6 ? fast : normal, speed)
      sim.requestSlide()
      for (let tick = 0; tick < 184; tick++) sim.advance(STEP)
      assert.equal(sim.failure, null, `pipe ${start} at ${speed}`)
      assert.equal(sim.sliding, false)
      assert.equal(sim.colliderHeight, 1.8)
      assert.ok(Math.abs(sim.x - (speed === 6 ? fast : normal) - speed * SLIDE_DURATION) < 1e-8)
      const blocked = running(start - .3, speed)
      blocked.advance(.1)
      assert.ok(blocked.failure === 'barrier' || blocked.failure === 'electrical')
    }
  }
})

test('faster face sweeps and top contacts preserve actual horizontal position without tunneling', () => {
  for (const speed of [4.5, 6]) {
    const side = running(18.15, speed)
    Object.assign(side, { y: .5, vy: 1, grounded: false })
    side.advance(STEP)
    assert.equal(side.blocked, true)
    assert.ok(side.x <= 18.4 - .22 + 1e-9)
    assert.equal(side.landings, 0)
    const falling = running(19, speed)
    Object.assign(falling, { y: .9, vy: -100, grounded: false, airbornePeak: .9 })
    falling.advance(STEP)
    assert.equal(falling.y, .8)
    assert.equal(falling.landings, 1)
    assert.ok(Math.abs(falling.x - 19 - speed * STEP) < 1e-9)
  }
})

test('distance-matched Run uses actual Sprint travel and resumes after zero-distance updates', async () => {
  const bytes = await readFile('public/assets/characters/runner/runner.glb')
  const asset = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  const animation = new GameAnimation(asset), sim = running(1, 6)
  sim.advance(STEP, dt => animation.update(dt, sim))
  for (let tick = 0; tick < 120; tick++) {
    const before = animation.actions.Run.time
    sim.advance(STEP, dt => animation.update(dt, sim))
    const expected = (before + animation.runStride.advanceTime(before, sim.x - sim.previousX)) % animation.runStride.duration
    assert.ok(Math.abs(animation.actions.Run.time - expected) < 1e-6)
  }
  sim.previousX = sim.x
  animation.update(STEP, sim)
  assert.ok(Math.abs(animation.actions.Run.getEffectiveTimeScale()) < 1e-8)
  sim.advance(STEP, dt => animation.update(dt, sim))
  assert.ok(animation.actions.Run.getEffectiveTimeScale() > 0)
  animation.dispose()
})

test('electrical drone rewards normal-speed approaches and releasing Sprint', () => {
  for (const zone of ['electrical']) {
    const sim = new Simulation(), session = new GameSession(sim)
    if (zone === 'construction') session.testConstruction()
    else session.testElectrical()
    sim.setSprint(true)
    for (let frame = 0; frame < 180 && sim.phase === 'running'; frame++) sim.advance(STEP)
    assert.equal(sim.failure, 'drone')
    assert.equal(sim.sprintHeld, false)
  }
  assert.equal(sprintRules.speed, 6)
})

test('releasing Sprint during the early scan warning restores a safe normal-speed crossing', () => {
  for (const environment of ['electrical']) {
    const sim = new Simulation(), session = new GameSession(sim)
    if (environment === 'construction') session.testConstruction()
    else session.testElectrical()
    const drone = sim.drones.find(drone => drone.encounter.id.startsWith(environment))
    sim.setSprint(true)
    while (drone.time < .1) sim.advance(STEP)
    sim.setSprint(false)
    while (sim.x < drone.encounter.x + 3 && sim.phase === 'running') sim.advance(STEP)
    assert.equal(sim.failure, null)
    assert.equal(sim.speed, 4.5)
    assert.equal(drone.state, 'reset')
  }
})

test('electrical active sweeps remain lethal and inactive crossings stay safe at both speeds', () => {
  for (const speed of [4.5, 6]) {
    const active = running(267.77, speed)
    active.advance(.1)
    assert.equal(active.failure, 'electrical')
    const inactive = running(267.77, speed)
    inactive.hazardTicks = 120
    while (inactive.x < 269 && inactive.phase === 'running') inactive.advance(STEP)
    assert.equal(inactive.failure, null)
    const cable = running(237.2, speed)
    cable.requestJump()
    while (!cable.landings && cable.phase === 'running') cable.advance(STEP)
    assert.equal(cable.failure, null)
    assert.equal(cable.landings, 1)
  }
})

test('authored gap jumps remain reachable at normal and Sprint speeds', () => {
  for (const speed of [4.5, 6]) {
    for (const [index, marker] of course.takeoffs.entries()) {
      if (marker == null) continue
      const sim = running(marker, speed)
      sim.requestJump()
      for (let tick = 0; tick < 200 && !sim.landings && sim.phase === 'running'; tick++) sim.advance(STEP)
      assert.equal(sim.failure, null)
      assert.equal(sim.landings, 1, `platform ${index} speed ${speed}`)
      assert.equal(sim.supportingPlatform, index + 1)
    }
  }
})

test('Sprint opens Hunter separation without changing the pursuer speed or capture rules', () => {
  const sim = new Simulation(), session = new GameSession(sim)
  session.testHunter()
  sim.setSprint(true)
  while (sim.hunter.state !== 'pursuing') sim.advance(STEP)
  const gap = sim.x - sim.hunter.x
  for (let tick = 0; tick < 120; tick++) sim.advance(STEP)
  assert.ok(sim.x - sim.hunter.x > gap + 1.4)
  assert.equal(sim.failure, null)
  const before = sim.hunter.x
  sim.advance(STEP)
  assert.ok(Math.abs(sim.hunter.x - before - 4.5 * STEP) < 1e-9)
})
