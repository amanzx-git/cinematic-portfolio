import test from 'node:test'
import assert from 'node:assert/strict'
import { Simulation, collider, CONTACT_EPSILON, STEP, course, supportAt } from '../src/game/simulation.ts'
import { FollowCamera } from '../src/game/camera.ts'

test('feet stay stable on platform tops despite tiny numeric error, without repeated contacts', () => {
  const sim = new Simulation(); sim.phase='running'
  for(let i=0;i<180;i++) { sim.y = CONTACT_EPSILON/2; sim.advance(STEP); assert.equal(sim.grounded,true); assert.equal(sim.y,0); assert.equal(sim.supportingPlatform,0) }
  assert.equal(sim.landings,0)
})
test('body overlaps support an edge landing without horizontal snapping', () => {
  for(const x of [15.95,16.1,18.25]) {
    const sim=new Simulation();sim.phase='running';sim.x=x;sim.y=(x<17?0:.8)+.001;sim.vy=-1;sim.grounded=false;sim.airbornePeak=.2
    sim.advance(STEP)
    assert.equal(sim.grounded,true);assert.equal(sim.landings,1);assert.equal(sim.y,x<17?0:.8)
    assert.ok(Math.abs(sim.x-x-course.speed*STEP)<1e-8)
    assert.equal(sim.supportingPlatform,x<17?0:1)
  }
})
test('support ends only when the rectangular foot clears the edge; no extra airborne jump', () => {
  const sim=new Simulation();sim.phase='running';sim.x=16.15
  sim.advance(STEP);assert.equal(sim.grounded,true)
  sim.advance(STEP);assert.equal(sim.grounded,false);assert.equal(sim.supportingPlatform,-1)
  assert.ok(sim.y<0);assert.ok(sim.vy<0)
  sim.requestJump();sim.advance(STEP);assert.equal(sim.jumps,0)
  assert.equal(supportAt(16+collider.width/2+CONTACT_EPSILON),-1)
})
test('ascending/body-side overlap never counts as a landing; walls block without pulling back', () => {
  const sim=new Simulation();sim.phase='running';sim.x=18.15;sim.y=.5;sim.vy=1;sim.grounded=false
  sim.advance(STEP)
  assert.equal(sim.grounded,false);assert.equal(sim.landings,0);assert.equal(sim.supportingPlatform,-1)
  assert.equal(sim.blocked,true);assert.ok(sim.x>=18.15);assert.ok(Math.abs(sim.x-(18.4-collider.width/2))<1e-8)
  const rising=new Simulation();rising.phase='running';rising.x=11;rising.y=-.02;rising.vy=5;rising.grounded=false
  rising.advance(STEP);assert.ok(rising.y>0);assert.equal(rising.grounded,false);assert.equal(rising.landings,0)
})
test('fast descending feet sweep the platform top rather than tunneling; stalls stay bounded', () => {
  const sim=new Simulation();sim.phase='running';sim.x=1;sim.y=.3;sim.vy=-300;sim.grounded=false;sim.airbornePeak=.3
  sim.advance(STEP);assert.equal(sim.y,0);assert.equal(sim.grounded,true);assert.equal(sim.landings,1)
  sim.advance(30);assert.equal(sim.y,0);assert.equal(sim.grounded,true);assert.equal(sim.landings,1)
  assert.ok(sim.x<2)
})
test('camera resets immediately for manual/automatic/debug restart and clears old damping', () => {
  const sim=new Simulation(), camera=new FollowCamera()
  camera.update(19,.016,sim.restarts)
  sim.restart();assert.equal(camera.update(sim.x,.016,sim.restarts),2.6)
  assert.equal(camera.update(0,.1,sim.restarts),2.6)
  const expected=2.6+.1*(1-Math.exp(-8*.016))
  assert.ok(Math.abs(camera.update(.1,.016,sim.restarts)-expected)<1e-12)
  sim.phase='fallen';sim.timer=0;sim.x=10;sim.previousX=10;sim.accumulator=0
  sim.advance(STEP)
  assert.equal(sim.x,0);assert.equal(sim.previousX,0);assert.equal(sim.previousY,0)
  assert.equal(camera.update(sim.x,.1,sim.restarts),2.6)
  sim.testHighDrop();assert.equal(camera.update(sim.x,.016,sim.restarts),2.6)
})

test('touching down beyond the finish never teleports the body back to the flag', () => {
  const top=course.platforms.at(-1)[2]
  const sim=new Simulation();sim.phase='running';sim.x=course.finish+1;sim.y=top+.001;sim.vy=-1;sim.grounded=false;sim.airbornePeak=top+1
  sim.advance(STEP)
  assert.equal(sim.phase,'finished');assert.ok(sim.x>=course.finish+1);assert.equal(sim.y,top)
})

test('elevated contacts measure impact relative to the roof and reject a front-face hit', () => {
  const [start, , top] = course.platforms[4]
  const drop = new Simulation()
  drop.phase = 'running'
  drop.grounded = false
  drop.x = start + 0.4
  drop.y = drop.airbornePeak = top + 3
  while (!drop.landings && drop.phase === 'running') drop.advance(STEP)
  assert.equal(drop.supportingPlatform, 4)
  assert.equal(drop.y, top)
  assert.ok(Math.abs(drop.lastFallDistance - 3) < 1e-9)
  assert.ok(Math.abs(drop.lastImpactSpeed - Math.sqrt(120)) < 1e-9)
  assert.equal(drop.hardLandings, 1)

  const approach = new Simulation()
  approach.phase = 'running'
  approach.grounded = false
  approach.x = start - collider.width / 2 - 0.01
  approach.y = top - 0.2
  approach.advance(STEP)
  assert.equal(approach.blocked, true)
  assert.equal(approach.grounded, false)
  assert.equal(approach.landings, 0)
})
