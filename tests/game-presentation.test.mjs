import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {Simulation,STEP,course,collider} from '../src/game/simulation.ts'
import {FollowCamera,framingHeight,compositionLead} from '../src/game/camera.ts'
import {MovementFeedback,PUFF_COUNT} from '../src/game/feedback.ts'
import {CityParallax} from '../src/game/environment-data.ts'

test('camera composition is bounded and continuous across the entire route',()=>{
  let previous=compositionLead(0)
  for(let x=0;x<=151;x+=.01){
    const lead=compositionLead(x)
    assert.ok(lead>=1.7-1e-9&&lead<=3.05+1e-9)
    assert.ok(Math.abs(lead-previous)<.01)
    assert.equal(compositionLead(x,true),2.6)
    previous=lead
  }
  assert.ok(compositionLead(13)>compositionLead(1))
  assert.ok(compositionLead(79)>2.9)
  assert.ok(compositionLead(course.finish)<2)
})
test('camera keeps elevated roofs and the runner within desktop and landscape framing',()=>{
  for(const reduced of [false,true]){
    const sim=new Simulation(),camera=new FollowCamera()
    const cosine=18/Math.hypot(18,2.4)
    for(let i=0;i<5200&&sim.phase!=='finished';i++){
      const mark=course.takeoffs[sim.supportingPlatform]
      if(mark!=null&&sim.x>=mark)sim.requestJump()
      if(sim.x>=79&&sim.x<79.2)sim.requestSlide()
      sim.advance(STEP)
      if(sim.landTime>0)sim.completeLanding()
      const oldX=camera.x,oldY=camera.y
      camera.update(sim.x,STEP,sim.restarts,framingHeight(sim.x,course.platforms),compositionLead(sim.x,reduced))
      assert.ok(Math.abs(camera.x-oldX)<.06)
      assert.ok(Math.abs(camera.y-oldY)<.04)
      for(const y of [sim.y,sim.y+collider.height])assert.ok(Math.abs((y-camera.y-1.2)*cosine)<3)
    }
    assert.equal(sim.phase,'finished')
    sim.restart();camera.update(0,STEP,sim.restarts,0,compositionLead(0,reduced))
    assert.equal(camera.x,2.6);assert.equal(camera.y,0)
  }
})
test('hard impact emits once from gameplay, ordinary contacts emit no landing dust',()=>{
  const sim=new Simulation(),feedback=new MovementFeedback()
  sim.testHighDrop();feedback.update(0,sim,true)
  while(!sim.grounded){sim.advance(STEP);feedback.update(STEP,sim,true)}
  assert.equal(feedback.events.land,1);assert.equal(feedback.activeCount,6)
  for(let i=0;i<100;i++){sim.advance(STEP);feedback.update(STEP,sim,true)}
  assert.equal(feedback.events.land,1);assert.equal(feedback.activeCount,0)
  sim.restart();feedback.update(0,sim,true)
  sim.landings++;feedback.update(STEP,sim,true)
  assert.equal(feedback.events.land,0)
})
test('slide friction follows the low physical collider and uses a fixed particle pool',()=>{
  const sim=new Simulation(),feedback=new MovementFeedback()
  Object.assign(sim,{phase:'running',x:70,y:-1.3,supportingPlatform:5})
  feedback.update(0,sim,true)
  const identities=[...feedback.particles]
  sim.requestSlide()
  let friction=false
  for(let i=0;i<184;i++){
    sim.advance(STEP);feedback.update(STEP,sim,true)
    if(i<30)assert.equal(feedback.activeCount,0)
    if(feedback.activeCount>0)friction=true
    assert.ok(feedback.activeCount<=PUFF_COUNT)
  }
  assert.ok(friction);assert.equal(feedback.events.slide,1)
  assert.equal(sim.sliding,false)
  assert.ok(feedback.particles.every((puff,index)=>puff===identities[index]))
  sim.restart();feedback.update(0,sim,true)
  assert.equal(feedback.activeCount,0);assert.equal(feedback.failurePulse,0)
})
test('actual failure and finish trigger once, pause freezes feedback and restart clears it',()=>{
  const sim=new Simulation(),feedback=new MovementFeedback()
  Object.assign(sim,{phase:'running',x:80.6,y:-1.3,supportingPlatform:5})
  feedback.update(0,sim,true)
  while(sim.phase!=='fallen'){sim.advance(STEP);feedback.update(STEP,sim,true)}
  assert.equal(feedback.events.failure,1);assert.ok(feedback.failurePulse>0)
  const age=feedback.particles[0].age
  feedback.update(0,sim,true)
  assert.equal(feedback.particles[0].age,age);assert.equal(feedback.events.failure,1)
  sim.restart();feedback.update(0,sim,true)
  assert.equal(feedback.activeCount,0);assert.equal(feedback.failurePulse,0)
  Object.assign(sim,{phase:'running',x:146.9,y:0,supportingPlatform:10})
  for(let i=0;i<20;i++){sim.advance(STEP);feedback.update(STEP,sim,true)}
  assert.equal(feedback.events.finish,1);assert.ok(feedback.activeCount>0)
})
test('disabled feedback clears immediately and avoids replaying stale events when enabled',()=>{
  const sim=new Simulation(),feedback=new MovementFeedback()
  feedback.update(0,sim,true)
  sim.hardLandings++;feedback.update(STEP,sim,true)
  assert.equal(feedback.activeCount,6)
  feedback.update(0,sim,false)
  assert.equal(feedback.activeCount,0)
  feedback.update(STEP,sim,true)
  assert.equal(feedback.activeCount,0);assert.equal(feedback.events.land,1)
})
test('reduced-motion skyline freezes secondary travel and resumes without a phase jump',()=>{
  const city=new CityParallax();city.update(2.6,0);city.update(5,0)
  const offset=city.offset(5,.08)-5
  city.update(10,0,true)
  assert.ok(Math.abs(city.offset(10,.08)-10-offset)<1e-9)
  city.update(10,0,false)
  assert.ok(Math.abs(city.offset(10,.08)-10-offset)<1e-9)
  city.update(11,0,false);assert.ok(city.travel>2.4)
})
test('the canonical five-clip asset is byte-identical to the G2.5 baseline',async()=>{
  const bytes=await readFile('public/assets/characters/runner/runner.glb')
  assert.equal(createHash('sha256').update(bytes).digest('hex'),'4308e566184d7261a8cf5ab2fd29c6f2e87987ed674c0320d4bb2f3e4304e7b1')
})
