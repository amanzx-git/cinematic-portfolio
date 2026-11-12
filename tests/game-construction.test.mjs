import test from 'node:test'
import assert from 'node:assert/strict'
import { course, Simulation, collider, STEP } from '../src/game/simulation.ts'
import { FollowCamera, framingHeight } from '../src/game/camera.ts'
import { GameSession } from '../src/game/session.ts'
import { rooftopInstances, constructionScenery } from '../src/game/environment-data.ts'

const zone = course.zones.find(zone => zone.environment === 'construction')
const first = course.platforms.indexOf(zone.platforms[0])

function atPlatform(index, x) {
  const sim = new Simulation()
  Object.assign(sim, { phase: 'running', x, previousX: x, y: course.platforms[index][2], previousY: course.platforms[index][2], supportingPlatform: index })
  return sim
}

test('construction adds 76 metres with a seamless entry, supported catwalk and recovery runway', () => {
  assert.equal(zone.end - 4, 223)
  assert.equal(zone.platforms.length, 5)
  assert.equal(zone.start, 151)
  const sim = atPlatform(first - 1, 150)
  while (sim.x < 153) { sim.advance(STEP); assert.equal(sim.grounded, true); assert.equal(sim.landings, 0) }
  const catwalk = atPlatform(first + 1, 182)
  while (catwalk.x < 189) { catwalk.advance(STEP); assert.equal(catwalk.grounded, true); assert.equal(catwalk.landings, 0) }
  assert.ok(course.finish - zone.platforms.at(-1)[0] > 18)
})

test('both ascending jumps have generous measured windows at existing physics', () => {
  for (const local of [0, 2]) {
    const index = first + local
    const [, end, top] = course.platforms[index]
    const [start, , nextTop] = course.platforms[index + 1]
    const time = (course.jumpVelocity + Math.sqrt(course.jumpVelocity ** 2 - 2 * course.gravity * (nextTop - top))) / course.gravity
    const earliest = start - collider.width / 2 - course.speed * time
    const latest = end + collider.width / 2
    assert.ok(latest - earliest > .75)
    const marker = course.takeoffs[index]
    for (const offset of [-.2, 0, .3]) {
      const sim = atPlatform(index, marker + offset)
      sim.requestJump()
      for (let tick = 0; tick < 150 && !sim.landings && sim.phase === 'running'; tick++) sim.advance(STEP)
      assert.equal(sim.landings, 1, `${index} at ${marker + offset}`)
      assert.equal(sim.supportingPlatform, index + 1)
      assert.equal(sim.y, nextTop)
      assert.equal(sim.blocked, false)
      assert.equal(sim.hardLandings, 0)
    }
    const early = atPlatform(index, earliest - .4)
    early.requestJump()
    for (let tick = 0; tick < 150 && !early.landings && early.phase === 'running'; tick++) early.advance(STEP)
    assert.equal(early.landings, 0, 'too-early input remains outside the safe window')
  }
})

test('controlled step-down triggers one hard landing with ample protected recovery space', () => {
  const index = first + 3
  const sim = atPlatform(index, 202.8)
  for (let tick = 0; tick < 180 && !sim.landings; tick++) sim.advance(STEP)
  assert.equal(sim.landings, 1)
  assert.equal(sim.hardLandings, 1)
  assert.equal(sim.jumps, 0)
  assert.equal(sim.supportingPlatform, first + 4)
  assert.equal(sim.y, -1.4)
  assert.ok(sim.x < 208)
  assert.ok(sim.lastFallDistance >= 3.6 - 1e-8)
  const x = sim.x
  for (let tick = 0; tick < 60; tick++) sim.advance(STEP)
  assert.equal(sim.x, x)
  assert.equal(sim.hardLandings, 1)
  sim.completeLanding()
  while (sim.x < 223 && sim.phase === 'running') sim.advance(STEP)
  assert.equal(sim.phase, 'running')
  assert.ok(sim.x >= 223)
  assert.equal(sim.restarts, 0)
})

test('construction debug entry and scenery share the authored surfaces and leave the lane open', () => {
  const sim = new Simulation(), session = new GameSession(sim)
  session.testConstruction()
  assert.equal(sim.x, 152)
  assert.equal(sim.supportingPlatform, first)
  assert.equal(session.screen, 'playing')
  const roof = rooftopInstances(course.platforms)
  for (let index = first; index < first + zone.platforms.length; index++) {
    const [start, end, top] = course.platforms[index], surface = roof.surfaces[index]
    assert.ok(Math.abs(surface.position[1] + surface.scale[1] / 2 - top) < 1e-9)
    assert.equal(surface.scale[0], end - start)
    for (const key of ['details', 'pipes', 'windows']) {
      for (const item of roof[key].filter(item => item.position[0] >= start && item.position[0] <= end && item.position[1] > top + .01)) {
        assert.ok(Math.abs(item.position[2]) - item.scale[2] / 2 > collider.depth / 2)
      }
    }
  }
  assert.ok(constructionScenery().every(item => item.position[2] < -7))
})

test('Sprint reaches the raised steelwork and scaffold and safely descends to the exit', () => {
  for (const local of [0, 2]) {
    const index = first + local
    for (const offset of [-.2, 0, .3]) {
      const sim = atPlatform(index, course.takeoffs[index] + offset)
      sim.speed = 6
      sim.setSprint(true)
      sim.requestJump()
      for (let tick = 0; tick < 150 && !sim.landings && sim.phase === 'running'; tick++) sim.advance(STEP)
      assert.equal(sim.supportingPlatform, index + 1)
      assert.equal(sim.y, course.platforms[index + 1][2])
      assert.equal(sim.hardLandings, 0)
      assert.equal(sim.failure, null)
    }
  }
  const sim = atPlatform(first + 3, 202.8)
  sim.speed = 6
  sim.setSprint(true)
  for (let tick = 0; tick < 180 && !sim.landings; tick++) sim.advance(STEP)
  assert.equal(sim.supportingPlatform, first + 4)
  assert.equal(sim.hardLandings, 1)
  assert.equal(sim.y, -1.4)
  assert.equal(sim.failure, null)
  assert.ok(sim.x < 208)
})

test('construction camera frames both ascents and the descent at Run and Sprint speeds', () => {
  for (const speed of [4.5, 6]) {
    const sim = atPlatform(first, 166), camera = new FollowCamera()
    sim.speed = speed
    sim.setSprint(speed === 6)
    camera.update(sim.x, STEP, sim.restarts, framingHeight(sim.x, course.platforms, sim.y))
    const visible = y => assert.ok(Math.abs((y - camera.y - 1.2) * 18 / Math.hypot(18, 2.4)) < 3, `framing x=${sim.x}, y=${y}, speed=${speed}`)
    for (let tick = 0; tick < 1800 && sim.x < 210; tick++) {
      const index = sim.supportingPlatform, marker = course.takeoffs[index]
      if (sim.grounded && marker != null && sim.x >= marker) sim.requestJump()
      if (index >= first && index < first + 4 && sim.x >= course.platforms[index][1] - .7) visible(course.platforms[index + 1][2])
      sim.advance(STEP)
      const previous = camera.y
      camera.update(sim.x, STEP, sim.restarts, framingHeight(sim.x, course.platforms, sim.y))
      assert.ok(Math.abs(camera.y - previous) < .1)
      visible(sim.y)
      visible(sim.y + collider.height)
      assert.equal(sim.failure, null)
      if (sim.landTime > 0) sim.completeLanding()
    }
    assert.ok(sim.x >= 210)
    assert.equal(sim.hardLandings, 1)
  }
})
