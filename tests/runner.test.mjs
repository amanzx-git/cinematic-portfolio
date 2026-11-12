import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { RunnerPlayback, disposeRunner } from '../src/lab/RunnerPlayback.ts'

test('runner switches, interrupts fades, sequences and uncaches a single mixer without editing tracks', async () => {
  const bytes = await readFile('public/assets/characters/runner/runner.glb')
  const asset = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset+bytes.byteLength), '')
  const original = asset.animations.map(clip => clip.toJSON())
  const player = new RunnerPlayback(asset)
  for (const name of ['Run','Jump','Land','Idle','Run']) {
    player.play(name, 0.15); player.update(0.03, 0.15)
  }
  player.update(0.2, 0.15)
  assert.equal(Object.values(player.actions).filter(action => action.isRunning()).length, 1)
  assert.equal(player.current,'Run')
  player.play('Run', 0); player.update(0.3, 0.15)
  assert.ok(player.hips.position.z-player.origin.z > 1)
  player.play('Idle', 0); player.sequence = true
  const visited = new Set()
  for(let i=0;i<400;i++) { player.update(0.02, 0.15); visited.add(player.current) }
  assert.deepEqual([...visited].sort(), ['Idle','Jump','Land','Run'])
  assert.equal(player.sequence, false); assert.equal(player.current, 'Idle')
  assert.deepEqual(asset.animations.map(clip => clip.toJSON()),original)
  player.dispose()
  assert.equal(player.mixer.stats.actions.inUse,0)
  assert.equal(player.mixer.stats.bindings.inUse,0)
  disposeRunner(asset)
})
