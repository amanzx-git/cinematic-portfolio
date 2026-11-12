import test from 'node:test'
import assert from 'node:assert/strict'
import { slideObstacleInstances, SLIDE_STEEL_COLOR } from '../src/game/slide-obstacle-data.ts'
import { course, barriers, Simulation, STEP, collider } from '../src/game/simulation.ts'
import { FollowCamera, compositionLead } from '../src/game/camera.ts'
import { SLIDE_DURATION } from '../src/game/slide.ts'

const obstacles = barriers.filter(barrier => !barrier.electrical || barrier.electrical === 'conduit')

test('all four Slide obstacles share dark steel cores with their exact existing collision extents', () => {
  const before = JSON.stringify(barriers)
  const visual = slideObstacleInstances(course.platforms, barriers)
  assert.deepEqual(obstacles.map(barrier => [barrier.start, barrier.end, barrier.bottom, barrier.top]), [
    [81, 82.6, -.1, .27], [253, 254.1, -.2, .17], [303, 303.8, -2.8, -2], [366, 366.8, -.2, .6],
  ])
  assert.equal(SLIDE_STEEL_COLOR, '#202020')
  for (const barrier of obstacles) {
    const center = (barrier.start + barrier.end) / 2, width = barrier.end - barrier.start, height = barrier.top - barrier.bottom
    const core = (barrier.shape === 'pipe' ? visual.pipes : visual.boxes).find(item => item.position[0] === center && item.position[1] === (barrier.bottom + barrier.top) / 2 && item.position[2] === 0)
    assert.ok(core)
    assert.ok(Math.abs((barrier.shape === 'pipe' ? core.scale[0] * 2 : core.scale[0]) - width) < 1e-9)
    assert.ok(Math.abs((barrier.shape === 'pipe' ? core.scale[2] * 2 : core.scale[1]) - height) < 1e-9)
  }
  assert.equal(JSON.stringify(barriers), before)
})

test('rear supports leave the playable opening clear and warning paint distinguishes the Slide timing mark', () => {
  for (const barrier of obstacles) {
    const visual = slideObstacleInstances(course.platforms, [barrier])
    const floor = course.platforms.find(([start, end]) => barrier.start >= start && barrier.start < end)[2]
    for (const box of visual.boxes) {
      if (box.position[1] - box.scale[1] / 2 < barrier.bottom - 1e-9) {
        assert.ok(Math.abs(box.position[2]) - box.scale[2] / 2 > collider.depth / 2)
      }
    }
    assert.ok(visual.markings.some(mark => mark.position[0] === barrier.start - 2 && mark.tint === '#77c7c3' && mark.position[1] === floor + .006))
    assert.ok(visual.markings.some(mark => mark.tint === '#E53935' && !!mark.rotation))
    assert.ok(visual.markings.some(mark => mark.position[1] > barrier.top && mark.tint === '#E53935'))
    assert.ok(visual.markings.every(mark => mark.tint && !['#fff', '#ffffff'].includes(mark.tint)))
  }
})

test('warning beacons are framed before the input mark at 6 m/s with existing camera look-ahead', () => {
  for (const barrier of obstacles) {
    const camera = new FollowCamera(), floor = course.platforms.find(([start, end]) => barrier.start >= start && barrier.start < end)[2]
    for (let x = barrier.start - 12; x < barrier.start - 7.5; x += 6 * STEP) camera.update(x, STEP, 0, floor, compositionLead(x))
    const beacon = slideObstacleInstances(course.platforms, [barrier]).markings.find(mark => mark.tint === '#E53935')
    assert.ok(Math.abs(beacon.position[0] - camera.x) + beacon.scale[0] / 2 < 7)
    assert.ok((7.5 - 2) / 6 > .9)
  }
})

test('releasing Sprint halfway through each Slide preserves collision and exact duration at 30/60/144 Hz', () => {
  for (const barrier of obstacles) {
    const distances = []
    for (const fps of [30, 60, 144]) {
      const sim = new Simulation(), x = barrier.start - 2.6
      const index = course.platforms.findIndex(([a, b]) => x >= a && x < b)
      Object.assign(sim, { phase: 'running', x, previousX: x, y: course.platforms[index][2], previousY: course.platforms[index][2], supportingPlatform: index, speed: 6 })
      sim.setSprint(true); sim.requestSlide()
      let ticks = 0, completedX
      for (let frame = 0; frame < fps * 3 && completedX === undefined; frame++) {
        sim.advance(1 / fps, () => {
          if (completedX !== undefined) return
          ticks++
          if (sim.slideTime >= .5) sim.setSprint(false)
          if (!sim.sliding) completedX = sim.x
        })
      }
      assert.equal(sim.failure, null)
      assert.equal(ticks, 184)
      assert.equal(sim.speed, 4.5)
      assert.equal(sim.colliderHeight, 1.8)
      assert.ok(completedX - x > 4.5 * SLIDE_DURATION && completedX - x < 6 * SLIDE_DURATION)
      distances.push(completedX)
    }
    assert.deepEqual(distances, [distances[0], distances[0], distances[0]])
  }
})

test('the shared teal timing mark clears every obstacle at both 4.5 and 6 m/s', () => {
  for (const barrier of obstacles) for (const speed of [4.5, 6]) {
    const sim = new Simulation(), x = barrier.start - 2
    const index = course.platforms.findIndex(([a, b]) => x >= a && x < b)
    Object.assign(sim, { phase: 'running', x, previousX: x, y: course.platforms[index][2], previousY: course.platforms[index][2], supportingPlatform: index, speed })
    if (speed === 6) sim.setSprint(true)
    sim.requestSlide()
    for (let tick = 0; tick < 184; tick++) sim.advance(STEP)
    assert.equal(sim.failure, null, `obstacle ${barrier.start} speed ${speed}`)
    assert.equal(sim.sliding, false)
    assert.equal(sim.colliderHeight, 1.8)
  }
})
