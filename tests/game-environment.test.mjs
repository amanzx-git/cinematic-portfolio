import test from 'node:test'
import assert from 'node:assert/strict'
import { CityParallax, CITY_LAYERS, CITY_TILE_WIDTH, rooftopInstances, cityInstances } from '../src/game/environment-data.ts'
import { Simulation, STEP, collider, course } from '../src/game/simulation.ts'
import { FollowCamera, framingHeight } from '../src/game/camera.ts'

test('rooftop tops and ledge bounds match collision platforms with no decoration spanning the gap',()=>{
  const roof=rooftopInstances(course.platforms)
  roof.surfaces.forEach((surface,index)=>{
    const [start,end,top]=course.platforms[index]
    assert.ok(Math.abs(surface.position[0]-surface.scale[0]/2-start)<1e-9)
    assert.ok(Math.abs(surface.position[0]+surface.scale[0]/2-end)<1e-9)
    assert.ok(Math.abs(surface.position[1]+surface.scale[1]/2-top)<1e-9)
  })
  for(const instances of Object.values(roof))for(const instance of instances){
    assert.ok(course.platforms.some(([start,end])=>instance.position[0]-instance.scale[0]/2>=start-.3&&instance.position[0]+instance.scale[0]/2<=end+.3))
  }
  for (const name of ['trim', 'details', 'pipes', 'vents']) {
    for (const { position, scale, rotation } of roof[name]) {
      const platform = course.platforms.find(([start, end]) => position[0] >= start && position[0] <= end)
      if (position[1] + scale[1] / 2 <= platform[2] + 1e-9) continue
      const depth = rotation?.[0] ? scale[1] : scale[2]
      const overheadClearance = position[1] - scale[1] / 2 >= platform[2] + collider.height + course.jumpVelocity ** 2 / (2 * course.gravity) + .05
      assert.ok(Math.abs(position[2]) - depth / 2 > 0.5 || position[1] <= platform[2] + .01 || overheadClearance, 'equipment stays outside the running lane')
      assert.ok(course.platforms.some(([start, end]) =>
        position[0] - scale[0] / 2 >= start - .3 && position[0] + scale[0] / 2 <= end + .3
      ), 'above-roof trim and equipment leave a clear margin at both ledges')
    }
  }
})
test('parallax scrolls slower than gameplay and retains screen position across camera resets',()=>{
  const model=new CityParallax();model.update(2.6,0)
  model.update(12.6,0)
  const before=CITY_LAYERS.map(layer=>model.offset(12.6,layer.rate)-12.6)
  before.forEach((offset,i)=>assert.ok(Math.abs(offset+10*CITY_LAYERS[i].rate)<1e-9))
  model.update(2.6,1)
  CITY_LAYERS.forEach((layer,i)=>assert.ok(Math.abs(model.offset(2.6,layer.rate)-2.6-before[i])<1e-9))
  model.update(3.6,1);assert.equal(model.travel,11)
  model.update(3.6,1);assert.equal(model.travel,11,'pause never drifts')
})
test('parallax uses reusable repeat tiles and stays bounded after many runs',()=>{
  const model=new CityParallax();model.update(2.6,0)
  for(let run=0;run<200;run++){model.update(21.6,run);model.update(2.6,run+1)}
  for(const layer of CITY_LAYERS){
    const offset=model.offset(2.6,layer.rate)-2.6
    assert.ok(offset<=0&&offset>-CITY_TILE_WIDTH)
    const city=cityInstances(layer)
    assert.equal(city.windows.length, 0, 'background window rectangles stay removed')
    assert.ok(city.bodies.length>36)
    assert.deepEqual(city,cityInstances(layer),'deterministic layout')
  }
})

test('terrain framing keeps the runner and destination ledges visible and resets to spawn', () => {
  const sim = new Simulation()
  const follow = new FollowCamera()
  const pitchCos = 18 / Math.hypot(18, 2.4)
  const visible = y => Math.abs((y - follow.y - 1.2) * pitchCos) < 3
  for (let tick = 0; tick < 11400 && sim.phase !== 'finished'; tick++) {
    if (sim.x >= 237.5 && sim.x < 237.8) sim.requestJump()
    if (sim.x >= 251 && sim.x < 251.2) sim.requestSlide()
    if (sim.x >= 301 && sim.x < 301.2) sim.requestSlide()
    if (sim.x >= 364 && sim.x < 364.2) sim.requestSlide()
    const index = sim.supportingPlatform
    if (sim.x >= 79 && sim.x < 79.2) sim.requestSlide()
    const marker = course.takeoffs[index]
    if (sim.grounded && index >= 0 && index < course.takeoffs.length) {
      const decisionX = marker ?? course.platforms[index][1] - 0.14
      if (sim.x >= decisionX) {
        assert.ok(visible(course.platforms[index + 1][2]), 'destination roof is visible at takeoff')
        if (marker != null) sim.requestJump()
      }
    }
    sim.advance(STEP)
    follow.update(sim.x, STEP, sim.restarts, framingHeight(sim.x, course.platforms))
    assert.ok(visible(sim.y) && visible(sim.y + collider.height), 'runner fits the vertical frame')
    if (sim.landTime > 0) sim.completeLanding()
  }
  assert.equal(sim.phase, 'finished')
  sim.restart()
  follow.update(sim.x, STEP, sim.restarts, framingHeight(sim.x, course.platforms))
  assert.equal(follow.x, 2.6)
  assert.equal(follow.y, 0)
})
