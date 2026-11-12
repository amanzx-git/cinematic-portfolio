import test from 'node:test'
import assert from 'node:assert/strict'
import { course, courseZones, connectZones, zoneAt, zoneSequence } from '../src/game/course.ts'
import { course as simulationCourse, barriers, Simulation, STEP } from '../src/game/simulation.ts'
import { framingHeight, FollowCamera } from '../src/game/camera.ts'

test('zone extraction preserves the complete approved course data and shared collision references', () => {
  assert.equal(course, simulationCourse)
  assert.equal(barriers, course.barriers)
  assert.deepEqual([course.speed, course.gravity, course.jumpVelocity, course.finish], [4.5, 20, 7.8, 384])
  assert.deepEqual(courseZones[0].platforms, [
    [-4, 16, 0], [18.4, 32, .8], [32, 38, .8], [38, 53, .8], [55.5, 65, 1.4],
    [66.85, 94, -1.3], [96.6, 108, -.8], [108, 114, -.8], [114, 122, -.8], [124.6, 133, -.4], [135.5, 151, 0],
  ])
  assert.deepEqual(courseZones[0].takeoffs, [15.5, undefined, undefined, 52.5, null, 93.5, undefined, undefined, 121.5, 132.5])
  assert.deepEqual(courseZones[0].bridges, [2, 7])
  assert.deepEqual(courseZones[0].barriers, [{ start: 81, end: 82.6, bottom: -.1, top: .27 }])
  assert.deepEqual(courseZones[0].sections, [[0, 'Corporate approach'], [32, 'Skybridge'], [55.5, 'Impact descent'], [66.85, 'Industrial corridor'], [108, 'Scaffolding'], [124.6, 'Final escape']])
  assert.equal(courseZones.length, 5)
  assert.deepEqual(zoneSequence.map(zone => zone.id), ['corporate', 'construction', 'electrical', 'underground', 'final'])
})

const zone = (id, start, end, platforms) => ({
  id, environment: 'corporate', start, end, platforms, fallY: -30,
  takeoffs: [], bridges: [], sections: [], barriers: [], decorations: [],
})

test('connected zones flatten local indices, transition takeoffs and cross-zone gaps deterministically', () => {
  const first = { ...zone('roof', 0, 10, [[0, 8, 0]]), takeoffs: [7.5], bridges: [0] }
  const decoration = { position: [14, 1, -2], scale: [1, 1, 1] }
  const second = { ...zone('site', 10, 25, [[10.5, 16, .5], [16, 25, .5]]), environment: 'construction', bridges: [1],
    barriers: [{ start: 20, end: 21, bottom: 1.5, top: 2 }], decorations: [decoration] }
  const connected = connectZones([first, second])
  assert.deepEqual(connected.platforms, [...first.platforms, ...second.platforms])
  assert.deepEqual(connected.bridges, [0, 2])
  assert.deepEqual(connected.takeoffs, [7.5, undefined])
  assert.deepEqual(connected.gaps, [{ start: 8, end: 10.5, fromPlatform: 0, toPlatform: 1 }])
  assert.equal(connected.barriers[0], second.barriers[0])
  assert.equal(connected.decorations[0], decoration)
  assert.deepEqual(connectZones([first, second]), connected)
  assert.equal(zoneAt(9.999, [first, second]), first)
  assert.equal(zoneAt(10, [first, second]), second)
  assert.equal(zoneAt(25, [first, second]), second)
  assert.equal(zoneAt(-1, [first, second]), first)
})

test('invalid zone seams and overlapping collision surfaces fail during course assembly', () => {
  const first = zone('a', 0, 10, [[0, 10, 0]])
  assert.throws(() => connectZones([]))
  assert.throws(() => connectZones([first, zone('b', 11, 20, [[11, 20, 0]])]))
  assert.throws(() => connectZones([first, zone('a', 10, 20, [[10, 20, 0]])]))
  assert.throws(() => connectZones([{ ...first, platforms: [[0, 6, 0], [5, 10, 0]] }]))
  assert.throws(() => connectZones([{ ...first, bridges: [1] }]))
})

test('current gaps derive exactly from the collision surfaces and fall/restart boundary stays unchanged', () => {
  assert.deepEqual(course.gaps.filter(gap => gap.end <= 151).map(gap => [gap.start, gap.end]), [[16, 18.4], [53, 55.5], [65, 66.85], [94, 96.6], [122, 124.6], [133, 135.5]])
  assert.equal(zoneAt(80).fallY, -3.2)
  const sim = new Simulation()
  Object.assign(sim, { phase: 'running', x: 17, y: -3.19, vy: -3, grounded: false })
  sim.advance(STEP)
  assert.equal(sim.phase, 'fallen')
  assert.equal(sim.timer, 1.1)
  sim.advance(STEP)
  assert.equal(sim.restarts, 0)
})

test('existing camera framing handles higher, descending, underground and returning roof data', () => {
  const platforms = [[0, 12, 0], [14, 26, 3], [28, 42, -8], [44, 56, -4], [58, 70, 0]]
  assert.equal(framingHeight(2, platforms), 0)
  assert.equal(framingHeight(18, platforms), 3)
  assert.equal(framingHeight(32, platforms), -8)
  assert.equal(framingHeight(48, platforms), -4)
  assert.equal(framingHeight(64, platforms), 0)
  const camera = new FollowCamera()
  for (let x = 0; x < 70; x += .0375) {
    const previous = camera.y
    camera.update(x, STEP, 0, framingHeight(x, platforms))
    assert.ok(Number.isFinite(camera.x) && Number.isFinite(camera.y))
    assert.ok(Math.abs(camera.y - previous) < .1)
  }
  camera.update(0, STEP, 1, framingHeight(0, platforms))
  assert.equal(camera.x, 2.6)
  assert.equal(camera.y, 0)
})
