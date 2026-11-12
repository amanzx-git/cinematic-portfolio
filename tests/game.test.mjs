import test from 'node:test'
import assert from 'node:assert/strict'
import { Simulation, course } from '../src/game/simulation.ts'
import { RUN_CONTACT_TIMES } from '../src/game/run-contact.ts'
import { GameAnimation, LAND_CONTACT_TIME } from '../src/game/animation.ts'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { readFile } from 'node:fs/promises'

test('fixed-step movement and one takeoff per grounded jump, with a successful course crossing at 30/60/144 Hz', () => {
  const results = []
  for (const fps of [30, 60, 144]) {
    const sim = new Simulation()
    const supports = new Set()
    for (let frame=0;frame<fps*95;frame++) {
      if (sim.x >= 79 && sim.x < 79.2) sim.requestSlide()
      if (sim.x >= 237.5 && sim.x < 237.8) sim.requestJump()
      if (sim.x >= 251 && sim.x < 251.2) sim.requestSlide()
      if (sim.x >= 301 && sim.x < 301.2) sim.requestSlide()
      if (sim.x >= 364 && sim.x < 364.2) sim.requestSlide()
      const marker = course.takeoffs[sim.supportingPlatform]
      if (sim.grounded && marker != null && sim.x >= marker) sim.requestJump()
      if (sim.vy > 0) sim.requestJump() // held/spammed airborne input cannot add velocity
      sim.advance(1/fps, () => { if (sim.grounded) supports.add(sim.supportingPlatform); if (sim.landTime > 0) sim.completeLanding() })
    }
    assert.equal(sim.phase, 'finished'); assert.equal(sim.x, course.finish)
    assert.equal(sim.jumps, 11); assert.equal(sim.landings, 14); assert.equal(sim.restarts, 0)
    assert.equal(supports.size, 25); assert.equal(sim.hardLandings, 3)
    results.push([sim.x, sim.y, sim.vy])
  }
  assert.deepEqual(results[0],results[1]); assert.deepEqual(results[1],results[2])
})
test('missing a jump falls, delays, and restarts; large spikes are bounded', () => {
  const sim = new Simulation()
  while(sim.phase !== 'fallen') sim.advance(1/60)
  const failedX = sim.x
  sim.advance(0.1); assert.equal(sim.phase, 'fallen'); assert.equal(sim.x, failedX)
  for(let i=0;i<80;i++) sim.advance(1/60)
  assert.equal(sim.restarts,1); assert.equal(sim.phase,'ready')
  const spike = new Simulation(); spike.phase='running'
  spike.advance(30); assert.ok(spike.x <= course.speed*0.1+1e-8)
  assert.ok(spike.accumulator < 1/120)
  spike.advance(NaN); assert.ok(Number.isFinite(spike.x))
})
test('game animation clones isolate root motion and leave player world position and source clips intact', async () => {
  const bytes = await readFile('public/assets/characters/runner/runner.glb')
  const asset = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')
  const original = asset.animations.map(clip => clip.toJSON())
  const hips = asset.scene.getObjectByName('mixamorigHips') ?? asset.scene.getObjectByName('mixamorig:Hips')
  const anchor = hips.position.clone()
  const animation = new GameAnimation(asset)
  const sim = new Simulation(); sim.phase='running'; sim.x=7.3
  const states = new Set()
  sim.requestJump()
  for(let i=0;i<200;i++) {
    sim.advance(1/120,dt=>{
      const x=sim.x, y=sim.y
      animation.update(dt,sim)
      assert.equal(sim.x,x); assert.equal(sim.y,y)
      assert.ok(Math.abs(hips.position.x-anchor.x)<1e-6)
      assert.ok(Math.abs(hips.position.z-anchor.z)<1e-6)
      if (animation.current === 'Jump' && animation.fadeRemaining === 0) assert.ok(Math.abs(hips.position.y-anchor.y)<1e-6)
      states.add(animation.current)
    })
  }
  assert.ok(states.has('Jump')); assert.ok(!states.has('Land')); assert.ok(states.has('Run'))
  assert.deepEqual(asset.animations.map(clip => clip.toJSON()),original)
  assert.equal(Object.values(animation.actions).filter(action=>action.isRunning()).length,1)
  animation.dispose(); assert.equal(animation.mixer.stats.bindings.inUse,0)
})

test('normal jumps stay Jump throughout descent, then go directly to Run at 30/60/144 Hz', async () => {
  const bytes = await readFile('public/assets/characters/runner/runner.glb')
  for (const fps of [30,60,144]) {
    const asset = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')
    const animation = new GameAnimation(asset)
    const sim = new Simulation(); sim.phase='running'; sim.x=7.3; sim.requestJump()
    let descending = false
    for (let frame=0;frame<fps*1.2;frame++) sim.advance(1/fps,dt=>{
      const { x, y } = sim
      animation.update(dt,sim)
      assert.equal(sim.x,x); assert.equal(sim.y,y)
      if (!sim.grounded) { assert.equal(animation.current,'Jump'); descending ||= sim.vy < 0 }
      else assert.equal(animation.current,'Run')
    })
    assert.ok(descending); assert.equal(sim.landings,1); assert.equal(sim.hardLandings,0)
    assert.equal(sim.landTime,0); assert.ok(sim.lastFallDistance<2.5); assert.ok(sim.lastImpactSpeed<10)
    animation.dispose()
  }
})

test('hard drop plays Land once, holds the impact then releases motion while rejecting jumps at 30/60/144 Hz', async () => {
  const bytes = await readFile('public/assets/characters/runner/runner.glb')
  const results=[]
  for (const fps of [30,60,144]) {
    const asset = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')
    const animation = new GameAnimation(asset)
    const sim = new Simulation(); sim.testHighDrop()
    const transitions=[]
    let heldX, recoveryTicks=0
    for (let frame=0;frame<fps*1.5;frame++) sim.advance(1/fps,dt=>{
      const before=animation.current, x=sim.x, y=sim.y
      animation.update(dt,sim)
      assert.equal(sim.x,x); assert.equal(sim.y,y)
      if(before!==animation.current)transitions.push(animation.current)
      if(!sim.grounded)assert.equal(animation.current,'Jump')
      if(sim.landTime>0) {
        heldX ??= sim.x
        if (animation.actions.Land.time < 0.82) assert.equal(sim.x,heldX)
        if (animation.current === 'Run') assert.equal(animation.landFinished,true) // exit blend still protects jumping
        else assert.equal(animation.current,'Land')
        if (!animation.landFinished) {
          assert.equal(animation.actions.Land.getEffectiveTimeScale(),1)
          assert.ok(animation.actions.Land.time>=LAND_CONTACT_TIME)
        }
        sim.requestJump(); assert.equal(sim.jumpQueued,false); recoveryTicks++
      }
    })
    assert.deepEqual(transitions,['Jump','Land','Run'])
    assert.equal(sim.hardLandings,1); assert.equal(sim.landings,1); assert.equal(sim.jumps,0)
    assert.ok(recoveryTicks>=96); assert.equal(sim.y,0); assert.ok(sim.x>heldX)
    assert.equal(animation.landCompletions,1)
    assert.equal(animation.completedLandTime,animation.actions.Land.getClip().duration)
    assert.ok(Math.abs(sim.lastImpactSpeed-Math.sqrt(120))<1e-8)
    results.push([sim.x,sim.y,sim.hardLandings,sim.lastFallDistance])
    animation.dispose()
  }
  for(const result of results)assert.ok(Math.abs(result[0]-results[0][0])<=course.speed/120+1e-7)
})

test('both configurable physics thresholds must pass; restart clears hard-landing recovery', () => {
  for (const rules of [{minFallDistance:4}, {minImpactSpeed:12}]) {
    const sim=new Simulation(rules); sim.testHighDrop()
    for(let i=0;i<80;i++)sim.advance(1/120)
    assert.equal(sim.landings,1); assert.equal(sim.hardLandings,0); assert.equal(sim.landTime,0)
  }
  const sim=new Simulation();sim.testHighDrop()
  while(!sim.grounded)sim.advance(1/120)
  assert.ok(sim.landTime>0)
  sim.restart();assert.equal(sim.landTime,0);assert.equal(sim.y,0);assert.equal(sim.lastImpactSpeed,0)
})

test('restart cancels an unfinished Land safely, next landing completes once, and source clips stay intact', async () => {
  const bytes=await readFile('public/assets/characters/runner/runner.glb')
  const asset=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')
  const original=asset.animations.map(clip=>clip.toJSON())
  const animation=new GameAnimation(asset), sim=new Simulation()
  sim.testHighDrop()
  while(animation.current!=='Land')sim.advance(1/120,dt=>animation.update(dt,sim))
  assert.ok(animation.actions.Land.time<animation.actions.Land.getClip().duration)
  sim.restart();animation.update(0,sim)
  assert.equal(animation.current,'Idle');assert.equal(sim.landTime,0)
  for(let i=0;i<120;i++)sim.advance(1/120,dt=>animation.update(dt,sim))
  assert.equal(animation.landCompletions,0)
  sim.testHighDrop()
  for(let i=0;i<180;i++)sim.advance(1/120,dt=>animation.update(dt,sim))
  assert.equal(animation.landCompletions,1);assert.equal(animation.current,'Run');assert.equal(sim.landTime,0)
  assert.deepEqual(asset.animations.map(clip=>clip.toJSON()),original)
  animation.dispose()
})

test('returning to Run selects a planted stride phase; visual alignment never moves the gameplay collider', async () => {
  const bytes=await readFile('public/assets/characters/runner/runner.glb')
  const asset=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')
  const animation=new GameAnimation(asset), sim=new Simulation();sim.phase='running';sim.x=2
  animation.update(.2,sim)
  const phase=animation.actions.Run.time
  sim.grounded=false;animation.update(.1,sim)
  sim.grounded=true;animation.update(.01,sim)
  const duration=animation.actions.Run.getClip().duration
  const distance=t=>Math.min(Math.abs(t-phase),duration-Math.abs(t-phase))
  const contact=distance(RUN_CONTACT_TIMES[0])<distance(RUN_CONTACT_TIMES[1])?RUN_CONTACT_TIMES[0]:RUN_CONTACT_TIMES[1]
  const expected=contact+animation.runStride.advanceTime(contact,.01*course.speed)
  assert.ok(Math.abs(animation.actions.Run.time-expected)<1e-8)
  assert.equal(sim.x,2);assert.equal(sim.y,0)
  assert.ok(animation.visualOffsetY<=0 && animation.visualOffsetY>=-.07)
  sim.restart();animation.update(.1,sim);sim.phase='running';animation.update(.01,sim)
  assert.ok(animation.actions.Run.time<.02)
  animation.dispose()
})

test('each marked takeoff tolerates early and late inputs and lands on the intended roof', () => {
  for (const [index, marker] of course.takeoffs.entries()) {
    if (marker == null) continue
    const [, edge, sourceTop] = course.platforms[index]
    const [start, , targetTop] = course.platforms[index + 1]
    assert.ok(marker < edge && edge < start)
    for (const offset of [-0.15, 0, 0.15]) {
      const sim = new Simulation()
      sim.phase = 'running'
      sim.x = marker + offset
      sim.y = sourceTop
      sim.supportingPlatform = index
      sim.requestJump()
      for (let tick = 0; tick < 120 && !sim.landings; tick++) sim.advance(1 / 120)
      assert.equal(sim.supportingPlatform, index + 1, 'gap ' + index + ', offset ' + offset)
      assert.equal(sim.y, targetTop)
      assert.equal(sim.hardLandings, 0)
    }
  }
})
