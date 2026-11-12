import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {Vector3} from 'three'
import {Simulation,STEP,course} from '../src/game/simulation.ts'
import {GameAnimation,LAND_MOVEMENT_START} from '../src/game/animation.ts'
import {runSoleLift,RUN_CONTACT_TIMES,SLIDE_RUN_CONTACT_TIME} from '../src/game/run-contact.ts'

async function load() {
  const bytes=await readFile('public/assets/characters/runner/runner.glb')
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')
}
function sole(asset) {
  asset.scene.updateMatrixWorld(true)
  let low=Infinity
  asset.scene.traverse(mesh=>{
    if(!mesh.isSkinnedMesh)return
    mesh.skeleton.update();mesh.computeBoundingBox()
    low=Math.min(low,mesh.boundingBox.min.y)
  })
  return low
}
test('distance matching uses the actual Run travel curve and retains the measured average cadence',async()=>{
  const asset=await load(),animation=new GameAnimation(asset)
  assert.ok(Math.abs(animation.runStride.length-3.7293655)<1e-6)
  assert.ok(Math.abs(animation.runPlaybackRate-4.5/5.88847195)<1e-7)
  for(const fps of [30,60,144]){
    let phase=0,cycles=0
    for(let tick=0;tick<fps*4;tick++){
      phase+=animation.runStride.advanceTime(phase,course.speed/fps)
      if(phase>=animation.runStride.duration){cycles++;phase-=animation.runStride.duration}
    }
    const traveled=cycles*animation.runStride.length
    const stride=animation.runStride
    const index=stride.times.findIndex(t=>t>=phase)
    const fraction=(phase-stride.times[index-1])/(stride.times[index]-stride.times[index-1])
    const remainder=stride.distances[index-1]+fraction*(stride.distances[index]-stride.distances[index-1])
    assert.ok(Math.abs(traveled+remainder-18)<1e-8)
  }
  animation.dispose()
})
test('Run and Idle keep canonical vertical articulation while horizontal animation travel stays anchored',async()=>{
  const asset=await load(),original=asset.animations.map(c=>c.toJSON()),animation=new GameAnimation(asset)
  for(const name of ['Run','Idle']){
    const source=asset.animations.find(c=>c.name===name).tracks.find(t=>t.name.endsWith('Hips.position'))
    const runtime=animation.actions[name].getClip().tracks.find(t=>t.name.endsWith('Hips.position'))
    for(let i=0;i<source.values.length;i+=3){
      const lift=name==='Run'?runSoleLift(source.times[i/3]):0
      assert.ok(Math.abs(runtime.values[i+1]-source.values[i+1]-lift)<1e-6)
      assert.equal(runtime.values[i],runtime.values[0]);assert.equal(runtime.values[i+2],runtime.values[2])
    }
  }
  assert.deepEqual(asset.animations.map(c=>c.toJSON()),original)
  animation.dispose()
})
test('planted Run feet stay near the surface with low world-space stance drift',async()=>{
  const asset=await load(),animation=new GameAnimation(asset),sim=new Simulation()
  sim.phase='running';sim.x=1
  const toes=['LeftToeBase','RightToeBase'].map(name=>asset.scene.getObjectByName('mixamorig'+name))
  const point=new Vector3(),ranges=[[],[]]
  for(let tick=0;tick<95;tick++){
    sim.advance(STEP,dt=>animation.update(dt,sim))
    const rate=animation.actions.Run.getEffectiveTimeScale()
    assert.ok(rate>.63&&rate<.92)
    const phase=animation.actions.Run.time
    const active=phase>=.2&&phase<=.283?0:phase>=.525&&phase<=.608?1:-1
    if(active<0||animation.fadeRemaining>0)continue
    const low=sole(asset)+animation.visualOffsetY
    assert.ok(low>=-.002&&low<.025,'stance sole '+low)
    toes[active].getWorldPosition(point)
    ranges[active].push(point.z+sim.x)
  }
  for(const positions of ranges){assert.ok(positions.length>8);assert.ok(Math.max(...positions)-Math.min(...positions)<.025)}
  animation.dispose()
})
test('late Land blends locomotion while its full clip finishes with the approved movement lock',async()=>{
  const asset=await load(),animation=new GameAnimation(asset),sim=new Simulation()
  sim.testHighDrop()
  let contactX,lock=0,moving=false,overlap=false
  for(let tick=0;tick<200;tick++){
    sim.advance(STEP,dt=>animation.update(dt,sim))
    if(!sim.grounded)continue
    contactX??=sim.x
    if(sim.x===contactX&&sim.landTime>0)lock++
    if(sim.landTime>0&&sim.x>contactX)moving=true
    const land=animation.actions.Land
    if(animation.current==='Land'&&land.time>=LAND_MOVEMENT_START){
      overlap=true
      assert.ok(animation.actions.Run.getEffectiveWeight()>0)
      assert.equal(land.getEffectiveTimeScale(),1)
      assert.ok(Math.abs(land.getEffectiveWeight()+animation.actions.Run.getEffectiveWeight()-1)<1e-6)
    }
    if(animation.current==='Land'&&land.time>.37&&land.time<.81)assert.ok(Math.abs(sole(asset)+animation.visualOffsetY)<.012)
    if(sim.landTime>0){sim.requestJump();assert.equal(sim.jumpQueued,false)}
  }
  assert.ok(lock*STEP<=.525+1e-8);assert.ok(moving&&overlap)
  assert.equal(animation.landCompletions,1)
  assert.equal(animation.completedLandTime,animation.actions.Land.getClip().duration)
  animation.dispose()
})
test('level, uphill and modest downhill jumps retain Jump throughout flight and return at planted Run phases',async()=>{
  for(const [x,y,support]of [[2,0,0],[15.5,0,0],[138,.4,10]]){
    const asset=await load(),animation=new GameAnimation(asset),sim=new Simulation()
    Object.assign(sim,{phase:'running',x,y,supportingPlatform:support})
    sim.requestJump()
    let touched=false
    for(let tick=0;tick<140&&!touched;tick++){
      sim.advance(STEP,dt=>animation.update(dt,sim))
      if(!sim.grounded)assert.equal(animation.current,'Jump')
      if(sim.landings){
        touched=true;assert.equal(animation.current,'Run');assert.equal(sim.hardLandings,0)
        const time=animation.actions.Run.time
        assert.ok(RUN_CONTACT_TIMES.some(phase=>time>=phase&&time<phase+.015))
      }
    }
    assert.ok(touched);animation.dispose()
  }
})


test('Slide exits into the matching planted right-foot phase without changing its duration',async()=>{
  const asset=await load(),animation=new GameAnimation(asset),sim=new Simulation()
  Object.assign(sim,{phase:'running',x:70,y:-1.3,supportingPlatform:5})
  sim.requestSlide()
  let ticks=0
  while(!ticks||sim.sliding){sim.advance(STEP,dt=>animation.update(dt,sim));ticks++}
  assert.equal(ticks,184)
  assert.equal(animation.current,'Run')
  assert.ok(animation.actions.Run.time>=SLIDE_RUN_CONTACT_TIME)
  assert.ok(animation.actions.Run.time<SLIDE_RUN_CONTACT_TIME+.015)
  assert.equal(animation.actions.Slide.getEffectiveTimeScale(),1)
  animation.dispose()
})
