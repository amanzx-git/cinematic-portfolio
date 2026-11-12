import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { Simulation, course, STEP, collider } from '../src/game/simulation.ts'
import { GameSession } from '../src/game/session.ts'
import { GameAnimation } from '../src/game/animation.ts'
import { FollowCamera, framingHeight } from '../src/game/camera.ts'
import { rooftopInstances } from '../src/game/environment-data.ts'

const zone = course.zones.find(zone => zone.environment === 'underground')
const first = course.platforms.indexOf(zone.platforms[0])
function spawn(index, x) {
  const sim = new Simulation()
  Object.assign(sim, { phase: 'running', x, previousX: x, y: course.platforms[index][2], previousY: course.platforms[index][2],
    airbornePeak: course.platforms[index][2], supportingPlatform: index })
  return sim
}

test('underground extends the route by 76 metres with one path and a clear surface runway', () => {
  assert.equal(zone.end - 4, 355)
  assert.equal(zone.start, 283)
  assert.equal(zone.end, 359)
  assert.equal(zone.platforms.length, 6)
  assert.deepEqual(course.zones[2].platforms, [[227, 245, -1.4], [245, 264, -1.4], [264, 283, -1.4]])
  assert.equal(zone.platforms.at(-1)[2], course.zones[2].platforms[0][2])
  assert.ok(course.finish - zone.platforms.at(-1)[0] > 14)
  const sim = spawn(first - 1, 282.5)
  while (sim.x < 284) { sim.advance(STEP); assert.equal(sim.grounded, true); assert.equal(sim.landings, 0) }
})

test('drainage and exit jumps have reachable heights and tolerant input windows', () => {
  for (const local of [1, 3, 4]) {
    const index = first + local
    const [start, , top] = course.platforms[index + 1]
    const rise = top - course.platforms[index][2]
    const discriminant = course.jumpVelocity ** 2 - 2 * course.gravity * rise
    assert.ok(discriminant > 0)
    const time = (course.jumpVelocity + Math.sqrt(discriminant)) / course.gravity
    assert.ok(start - course.platforms[index][1] < course.speed * time)
    for (const offset of [-.25, 0, .25]) {
      const sim = spawn(index, course.takeoffs[index] + offset)
      sim.requestJump()
      for (let tick = 0; tick < 150 && !sim.landings && sim.phase === 'running'; tick++) sim.advance(STEP)
      assert.equal(sim.landings, 1, `platform ${index} offset ${offset}`)
      assert.equal(sim.supportingPlatform, index + 1)
      assert.equal(sim.y, top)
      assert.equal(sim.hardLandings, 0)
      assert.equal(sim.blocked, false)
    }
  }
})

test('low pipe uses localized Slide collision with fair timing and no crouch extension', () => {
  for (const x of [300.7, 301, 301.3]) {
    const sim = spawn(first + 1, x)
    sim.requestSlide()
    while (sim.x < 309 && sim.phase === 'running') sim.advance(STEP)
    assert.equal(sim.phase, 'running')
    assert.equal(sim.sliding, false)
    assert.equal(sim.colliderHeight, 1.8)
  }
  for (const x of [298.5, 302.4]) {
    const sim = spawn(first + 1, x)
    sim.requestSlide()
    for (let tick = 0; tick < 240 && sim.phase === 'running'; tick++) sim.advance(STEP)
    assert.equal(sim.phase, 'fallen')
    assert.equal(sim.failure, 'barrier')
  }
  const standing = spawn(first + 1, 302.75)
  standing.advance(.1)
  assert.equal(standing.failure, 'barrier')
})

test('tunnel surfaces, overhead scenery and rear fixtures preserve the complete jump envelope', () => {
  const roof = rooftopInstances(course.platforms)
  for (const platform of zone.platforms) {
    const index = course.platforms.indexOf(platform), surface = roof.surfaces[index]
    assert.ok(Math.abs(surface.position[1] + surface.scale[1] / 2 - platform[2]) < 1e-9)
    assert.equal(surface.scale[0], platform[1] - platform[0])
    const maximumHead = platform[2] + collider.height + course.jumpVelocity ** 2 / (2 * course.gravity)
    for (const item of [...roof.facade, ...roof.details].filter(item => item.position[0] >= platform[0] && item.position[0] <= platform[1])) {
      const aboveFloor = item.position[1] + item.scale[1] / 2 > platform[2] + .01
      const inLane = Math.abs(item.position[2]) - item.scale[2] / 2 <= collider.depth / 2
      if (aboveFloor && inLane) assert.ok(item.position[1] - item.scale[1] / 2 > maximumHead)
    }
  }
  assert.deepEqual(zone.barriers, [{ start: 303, end: 303.8, bottom: -2.8, top: -2, shape: 'pipe' }])
})

test('underground descent, Slide, drainage and ascent finish with real animation and camera at 30/60/144 Hz', async () => {
  const bytes = await readFile('public/assets/characters/runner/runner.glb')
  for (const fps of [30, 60, 144]) {
    const asset = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
    const animation = new GameAnimation(asset), sim = new Simulation(), session = new GameSession(sim), camera = new FollowCamera()
    session.testUnderground()
    const supports = new Set()
    let lockX, lockTicks = 0
    for (let frame = 0; frame < fps * 32 && sim.phase === 'running'; frame++) {
      if (sim.x >= 364 && sim.x < 364.2) sim.requestSlide()
      const marker = course.takeoffs[sim.supportingPlatform]
      if (marker != null && sim.x >= marker - .08) sim.requestJump()
      if (sim.x >= 301 && sim.x < 301.2) sim.requestSlide()
      sim.advance(1 / fps, dt => {
        animation.update(dt, sim)
        if (sim.grounded && sim.supportingPlatform >= first && sim.supportingPlatform < first + zone.platforms.length) supports.add(sim.supportingPlatform)
        if (animation.current === 'Land' && sim.recoverySpeed === 0) {
          lockX ??= sim.x
          assert.equal(sim.x, lockX)
          lockTicks++
        }
        camera.update(sim.x, STEP, sim.restarts, framingHeight(sim.x, course.platforms))
        const screenFeet = Math.abs((sim.y - camera.y - 1.2) * 18 / Math.hypot(18, 2.4))
        const screenHead = Math.abs((sim.y + collider.height - camera.y - 1.2) * 18 / Math.hypot(18, 2.4))
        assert.ok(screenFeet < 3 && screenHead < 3)
        assert.equal(sim.failure, null)
      })
    }
    assert.equal(sim.phase, 'finished')
    assert.equal(sim.x, course.finish)
    assert.equal(sim.jumps, 3)
    assert.equal(sim.hardLandings, 1)
    assert.equal(animation.landCompletions, 1)
    assert.equal(sim.landings, 5)
    assert.equal(supports.size, 6)
    assert.ok(lockTicks * STEP >= .5)
    animation.dispose()
  }
})

test('raised maintenance walkway, controlled descent and exit steps work at Run and Sprint', () => {
  assert.equal(course.finish, 384)
  for (const speed of [4.5, 6]) {
    const sim = spawn(first + 1, 314), camera = new FollowCamera(), supports = new Set()
    sim.speed = speed
    sim.setSprint(speed === 6)
    camera.update(sim.x, STEP, sim.restarts, framingHeight(sim.x, course.platforms, sim.y))
    for (let tick = 0; tick < 1200 && sim.x < 343; tick++) {
      const marker = course.takeoffs[sim.supportingPlatform]
      if (sim.grounded && marker != null && sim.x >= marker) sim.requestJump()
      sim.advance(STEP)
      camera.update(sim.x, STEP, sim.restarts, framingHeight(sim.x, course.platforms, sim.y))
      for (const y of [sim.y, sim.y + collider.height]) assert.ok(Math.abs((y - camera.y - 1.2) * 18 / Math.hypot(18, 2.4)) < 3)
      if (sim.grounded) supports.add(sim.supportingPlatform)
      assert.equal(sim.failure, null)
      assert.equal(sim.blocked, false)
    }
    assert.ok(sim.x >= 343)
    assert.deepEqual([...supports], [first + 1, first + 2, first + 3, first + 4, first + 5])
    assert.equal(sim.jumps, 3)
    assert.equal(sim.landings, 4)
    assert.equal(sim.hardLandings, 0)
  }
})
