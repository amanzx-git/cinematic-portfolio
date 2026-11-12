import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { SecurityRobot } from '../src/game/security-robot.ts'
import { Simulation, STEP } from '../src/game/simulation.ts'
import { GameSession } from '../src/game/session.ts'

async function load() {
  const bytes = await readFile('public/assets/characters/runner/runner.glb')
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
}

test('Security Robot preserves source clips, attaches its sensor to Head and releases presentation resources', async () => {
  const asset = await load(), originalClips = asset.animations.map(clip => clip.toJSON())
  const materials = []
  asset.scene.traverse(mesh => { if (mesh.isMesh) materials.push(mesh.material) })
  const robot = new SecurityRobot(asset), sim = new Simulation()
  assert.equal(robot.root.visible, false)
  assert.equal(robot.sensor.parent, asset.scene.getObjectByName('mixamorigHead'))
  assert.equal(robot.actions.Idle.isRunning(), true)
  for (let tick = 0; tick < 10; tick++) robot.update(sim.hunter, sim.restarts, 1, false, sim.x)
  assert.equal(robot.actions.Run.time, 0)
  assert.deepEqual(asset.animations.map(clip => clip.toJSON()), originalClips)
  robot.dispose()
  assert.equal(robot.actions.Idle.isScheduled(), false)
  assert.equal(robot.actions.Run.isScheduled(), false)
  assert.equal(robot.sensor.parent, null)
  const restored = []
  asset.scene.traverse(mesh => { if (mesh.isMesh) restored.push(mesh.material) })
  assert.deepEqual(restored, materials)
})

test('Security Robot matches Hunter travel and freezes/resets with simulation clocks', async () => {
  const asset = await load(), robot = new SecurityRobot(asset)
  const sim = new Simulation(), session = new GameSession(sim)
  session.testHunter()
  robot.update(sim.hunter, sim.restarts, 1, false, sim.x)
  while (sim.hunter.state !== 'pursuing') {
    sim.advance(STEP)
    robot.update(sim.hunter, sim.restarts, 1, false, sim.x)
  }
  let phase = robot.actions.Run.time
  for (let tick = 0; tick < 120; tick++) {
    const before = sim.hunter.x
    sim.advance(STEP)
    const advance = robot.stride.advanceTime(phase, sim.hunter.x - before)
    phase = (phase + advance) % robot.stride.duration
    robot.update(sim.hunter, sim.restarts, 1, false, sim.x)
    assert.ok(Math.abs(robot.actions.Run.time - phase) < 1e-6)
    assert.equal(robot.root.position.x, sim.hunter.x)
  }
  session.togglePause()
  const paused = robot.actions.Run.time
  for (let frame = 0; frame < 20; frame++) robot.update(sim.hunter, sim.restarts, 1, false, sim.x)
  assert.equal(robot.actions.Run.time, paused)
  session.togglePause()
  sim.phase = 'finished'
  for (let tick = 0; tick < 60; tick++) { sim.advance(STEP); robot.update(sim.hunter, sim.restarts, 1, false, sim.x) }
  assert.equal(sim.hunter.state, 'disengaged')
  assert.equal(robot.actions.Idle.isRunning(), true)
  assert.equal(robot.actions.Run.getEffectiveWeight(), 0)
  session.replay()
  robot.update(sim.hunter, sim.restarts, 1, false, sim.x)
  assert.equal(robot.root.visible, false)
  assert.equal(robot.actions.Run.time, 0)
  robot.dispose()
})
