import test from 'node:test'
import assert from 'node:assert/strict'
import { Simulation, STEP, course, barriers } from '../src/game/simulation.ts'
import { SLIDE_DURATION, slideHeightAt } from '../src/game/slide.ts'

function onRoof(x) {
  const sim = new Simulation()
  Object.assign(sim, { phase: 'running', x, y: course.platforms[5][2], supportingPlatform: 5 })
  return sim
}
test('press-once slide completes, ignores repeated presses and blocks jumping', () => {
  const sim = onRoof(71)
  sim.requestSlide()
  for (let i = 0; i < 184; i++) {
    sim.advance(STEP)
    if (i < 183) {
      assert.ok(sim.sliding)
      assert.ok(Math.abs(sim.slideTime - (i+1)*STEP) < 1e-8)
      assert.equal(sim.colliderHeight, slideHeightAt(sim.slideTime))
      sim.requestSlide(); sim.requestJump()
    }
  }
  assert.equal(sim.sliding, false)
  assert.equal(sim.jumps, 0)
  assert.ok(Math.abs(sim.x - 71 - course.speed * SLIDE_DURATION) < 1e-8)
})
test('pose collider has standing entry, a low phase, and authored recovery', () => {
  assert.equal(slideHeightAt(0), 1.8)
  assert.equal(slideHeightAt(.5), .8)
  assert.ok(slideHeightAt(.9) > .8)
  assert.equal(slideHeightAt(SLIDE_DURATION), 1.8)
})
test('early, late and recovery collisions fail without extension and restart after 1.1s', () => {
  for (const start of [77, 80.5]) {
    const sim = onRoof(start)
    sim.requestSlide()
    for (let i=0;i<300 && sim.phase==='running';i++) sim.advance(STEP)
    assert.equal(sim.failure, 'barrier')
    assert.equal(sim.sliding, false)
    const x=sim.x
    for(let i=0;i<120;i++)sim.advance(STEP)
    assert.equal(sim.x,x)
    for(let i=0;i<13;i++)sim.advance(STEP)
    assert.equal(sim.restarts,1)
    assert.equal(sim.slideQueued,false)
  }
})
test('fair duct activation range clears at 30/60/144 Hz with no course changes per frame rate', () => {
  for(const fps of [30,60,144])for(const x of [78.8,79,79.4]) {
    const sim=onRoof(x); sim.requestSlide()
    while(sim.x<87 && sim.phase==='running')sim.advance(1/fps)
    assert.equal(sim.phase,'running')
    assert.equal(sim.sliding,false)
    assert.equal(sim.y,course.platforms[5][2])
    assert.equal(sim.failure,null)
  }
  assert.deepEqual([barriers[0].start, barriers[0].end], [81,82.6])
})
test('airborne and protected Land input is discarded, restart cancels slide', () => {
  const sim=new Simulation();sim.testHighDrop();sim.requestSlide()
  assert.equal(sim.slideQueued,false)
  while(!sim.grounded)sim.advance(STEP)
  sim.requestSlide();assert.equal(sim.slideQueued,false)
  sim.completeLanding();sim.requestSlide();sim.advance(STEP)
  assert.equal(sim.sliding,true)
  sim.restart();assert.equal(sim.slideTime,null);assert.equal(sim.slideQueued,false)
})
