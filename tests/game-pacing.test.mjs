import test from 'node:test'
import assert from 'node:assert/strict'
import { course, Simulation, STEP } from '../src/game/simulation.ts'
import { GameSession } from '../src/game/session.ts'
import { hunterRules } from '../src/game/hunter.ts'
import { SLIDE_DURATION } from '../src/game/slide.ts'
import { FollowCamera, compositionLead, framingHeight } from '../src/game/camera.ts'

test('final chase adds only a connected flat apron and a readable recovery-spaced pipe', () => {
  assert.equal(course.finish - hunterRules.activationX, 40)
  assert.deepEqual(course.zones[3].platforms, [[283, 289, -1.4], [290.5, 316, -4], [318.1, 327, -4], [328.7, 339, -2.7], [340.7, 359, -1.4]])
  const zone = course.zones.at(-1)
  assert.equal(zone.environment, 'final')
  assert.deepEqual(zone.platforms, [[359, 388, -1.4]])
  assert.equal(course.platforms.at(-2)[1], zone.platforms[0][0])
  assert.equal(course.platforms.at(-2)[2], zone.platforms[0][2])
  const pipe = zone.barriers[0]
  assert.ok(pipe.bottom - zone.platforms[0][2] > hunterRules.height, 'Hunter fits below the localized obstacle')
  assert.ok(course.finish - (364 + course.speed * SLIDE_DURATION) > 12)
})

test('existing drone schedules, electrical timing and inter-obstacle recovery remain unchanged', () => {
  assert.deepEqual(course.zones.flatMap(zone => zone.drones ?? []).map(drone => [drone.x, drone.triggerX, drone.timing]), [
    [160, 153, { active: .6, inactive: 3.4, warning: 1.4, offset: -1.4 }],
    [234, 227.4, { active: .5, inactive: 3.5, warning: .6, offset: -.6 }],
  ])
  assert.deepEqual(course.zones[2].barriers, [
    { start: 239, end: 239.5, bottom: -1.4, top: -1.05, electrical: 'cable' },
    { start: 253, end: 254.1, bottom: -.2, top: .17, electrical: 'conduit' },
    { start: 268, end: 268.45, bottom: -1.4, top: .9, electrical: 'arc', pulse: { active: 1.4, inactive: 2.6, warning: .65, offset: 1 } },
  ])
  const jumpLanding = 237.5 + course.speed * (2 * course.jumpVelocity / course.gravity)
  assert.ok(251 - jumpLanding > 9)
  assert.ok(268 - (251 + course.speed * SLIDE_DURATION) > 10)
  assert.ok(237.5 - (234 + .6 + .22) > 2.5)
})

test('final-pipe Slide tolerates input offsets while camera and Hunter remain visible throughout pursuit', () => {
  for (const offset of [-.3, 0, .3]) {
    const sim = new Simulation(), session = new GameSession(sim), camera = new FollowCamera()
    session.testHunter()
    let slid = false
    while (sim.phase === 'running') {
      if (!slid && sim.x >= 364 + offset) { sim.requestSlide(); slid = true }
      sim.advance(STEP)
      camera.update(sim.x, STEP, sim.restarts, framingHeight(sim.x, course.platforms), compositionLead(sim.x))
      if (sim.hunter.state === 'pursuing') {
        assert.ok(sim.hunter.x - hunterRules.width / 2 >= camera.x - 7)
        assert.ok(sim.x <= camera.x + 7)
      }
      assert.equal(sim.failure, null)
    }
    assert.equal(sim.phase, 'finished')
    assert.equal(sim.x, 384)
    assert.ok(slid)
    assert.equal(sim.hunter.state, 'disengaged')
  }
})
