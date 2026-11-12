import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { Simulation, course, STEP } from '../src/game/simulation.ts'
import { GameAnimation, LAND_CONTACT_TIME, LAND_EXIT_FADE, LAND_MOVEMENT_START } from '../src/game/animation.ts'
import { SLIDE_DURATION, slideHeightAt } from '../src/game/slide.ts'

const hash = value => createHash('sha256').update(value).digest('hex')
async function asset() {
  const bytes=await readFile('public/assets/characters/runner/runner.glb')
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')
}
test('the original four clips, bind rig, geometry, materials and binary payload are preserved', async () => {
  const baseline=JSON.parse(await readFile('docs/runner-slide-baseline.json','utf8'))
  const bytes=await readFile('public/assets/characters/runner/runner.glb')
  const end=20+bytes.readUInt32LE(12)
  const json=JSON.parse(bytes.toString('utf8',20,end))
  assert.deepEqual(json.animations.map(a=>a.name).sort(),['Idle','Jump','Land','Run','Slide'])
  assert.equal(hash(bytes.subarray(end+8,end+8+baseline.binaryLength)),baseline.binaryHash)
  for(const [key,digest] of Object.entries(baseline.structures)) {
    const value=key==='animations'?json.animations.slice(0,4):key==='accessors'?json.accessors.slice(0,baseline.accessors):key==='bufferViews'?json.bufferViews.slice(0,baseline.bufferViews):json[key]
    assert.equal(hash(JSON.stringify(value)),digest,key)
  }
})
test('new route with actual animation completes at 30/60/144 Hz with eleven jumps and three full hard landings',async()=>{
  const positions=[]
  for(const fps of [30,60,144]){
    const animation=new GameAnimation(await asset()),sim=new Simulation()
    const supports=new Set(),states=new Set()
    let impactX,locked=0,recoveryMovement=false,slideSeen=false
    for(let frame=0;frame<fps*95&&sim.phase!=='finished';frame++){
      if (sim.x >= 237.5 && sim.x < 237.8) sim.requestJump()
      if (sim.x >= 251 && sim.x < 251.2) sim.requestSlide()
      if (sim.x >= 301 && sim.x < 301.2) sim.requestSlide()
      if (sim.x >= 364 && sim.x < 364.2) sim.requestSlide()
      const marker=course.takeoffs[sim.supportingPlatform]
      if(marker!=null&&sim.x>=marker-.08)sim.requestJump()
      if(sim.x>=79&&sim.x<79.2)sim.requestSlide()
      sim.advance(1/fps,dt=>{
        const x=sim.x,y=sim.y
        animation.update(dt,sim)
        assert.equal(sim.x,x);assert.equal(sim.y,y)
        states.add(animation.current)
        if(sim.grounded)supports.add(sim.supportingPlatform)
        if(sim.landTime>0){
          if (animation.actions.Land.time <= LAND_CONTACT_TIME + STEP * 2) impactX = sim.x
          if(animation.actions.Land.time<LAND_MOVEMENT_START){assert.equal(sim.x,impactX);locked++}
          if(sim.x>impactX)recoveryMovement=true
          sim.requestJump();assert.equal(sim.jumpQueued,false)
        }
        if(sim.sliding){slideSeen=true;assert.equal(animation.current,'Slide');assert.ok(Math.abs(animation.actions.Slide.time-sim.slideTime)<1e-5)}
        assert.equal(sim.failure,null)
      })
    }
    assert.equal(sim.phase,'finished');assert.equal(sim.x,course.finish)
    assert.equal(sim.jumps,11);assert.equal(sim.landings,14);assert.equal(sim.hardLandings,3)
    assert.equal(animation.landCompletions,3);assert.equal(animation.completedLandTime,animation.actions.Land.getClip().duration)
    assert.ok(recoveryMovement&&slideSeen);assert.equal(supports.size,25)
    assert.ok(locked*STEP>=1.50&&locked*STEP<=1.59)
    positions.push(sim.x);animation.dispose()
  }
  assert.deepEqual(positions,[course.finish,course.finish,course.finish])
  assert.ok(Math.abs((LAND_MOVEMENT_START-LAND_CONTACT_TIME)-.52)<1e-9)
  assert.ok(1.0333333-LAND_CONTACT_TIME+LAND_EXIT_FADE>.81)
})
test('slide clearance and post-recovery runway are calculated from measured pose timing',()=>{
  let low,high
  for(let t=0;t<=SLIDE_DURATION;t+=.00001)if(slideHeightAt(t)<=1.2){low??=t;high=t}
  const earliest=82.82-4.5*high,latest=80.78-4.5*low
  assert.ok(latest-earliest>.89)
  assert.ok(course.takeoffs[5]-(latest+4.5*SLIDE_DURATION)>7)
  assert.ok(earliest>course.platforms[5][0]+10)
})
test('bridge decks retain supported approaches and their authored exits',()=>{
  for(const i of course.bridges){
    const [start,end,top]=course.platforms[i]
    assert.equal(start,course.platforms[i-1][1]);assert.equal(top,course.platforms[i-1][2])
    if(course.takeoffs[i]===undefined){assert.equal(end,course.platforms[i+1][0]);assert.equal(top,course.platforms[i+1][2])}
    const sim=new Simulation();Object.assign(sim,{phase:'running',x:start-.3,y:top,supportingPlatform:i-1})
    const exit=course.takeoffs[i]===undefined?end+.5:end-.25
    while(sim.x<exit){sim.advance(STEP);assert.equal(sim.grounded,true);assert.equal(sim.y,top)}
    assert.equal(sim.jumps,0);assert.equal(sim.landings,0)
  }
})
