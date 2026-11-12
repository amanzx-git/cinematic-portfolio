import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { AnimationMixer, Box3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { GameAnimation } from '../src/game/animation.ts'
import { Simulation, STEP } from '../src/game/simulation.ts'
import { SLIDE_DURATION } from '../src/game/slide.ts'

async function load(character) {
  const bytes = await readFile(`public/assets/characters/${character}/${character}.glb`)
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
}
function skinBounds(asset) {
  asset.scene.updateMatrixWorld(true)
  const bounds = new Box3()
  asset.scene.traverse(mesh => {
    if (!mesh.isSkinnedMesh) return
    mesh.skeleton.update()
    mesh.computeBoundingBox()
    bounds.union(mesh.boundingBox.clone().applyMatrix4(mesh.matrixWorld))
  })
  return bounds
}
function clipData(asset) {
  return asset.animations.map(clip => ({ name: clip.name, duration: clip.duration,
    tracks: clip.tracks.map(track => ({ name: track.name, times: [...track.times], values: [...track.values] })) }))
}

test('Recruiter preserves canonical rig, all five clip samples and the untouched original asset', async () => {
  const original = await load('runner'), recruiter = await load('recruiter')
  assert.equal(createHash('sha256').update(await readFile('public/assets/characters/runner/runner.glb')).digest('hex'), '4308e566184d7261a8cf5ab2fd29c6f2e87987ed674c0320d4bb2f3e4304e7b1')
  assert.deepEqual(clipData(recruiter), clipData(original))
  let reference
  original.scene.traverse(mesh => { if (mesh.isSkinnedMesh) reference ??= mesh.skeleton })
  recruiter.scene.traverse(mesh => {
    if (!mesh.isSkinnedMesh) return
    assert.deepEqual(mesh.skeleton.bones.map(bone => bone.name), reference.bones.map(bone => bone.name))
    assert.deepEqual(mesh.skeleton.boneInverses.map(matrix => matrix.elements), reference.boneInverses.map(matrix => matrix.elements))
  })
})

test('formal clothing is fully skinned with normalized weights and a bright untextured shirt', async () => {
  const asset = await load('recruiter')
  let vertices = 0, shirt = false
  asset.scene.traverse(mesh => {
    if (!mesh.isMesh) return
    assert.equal(mesh.isSkinnedMesh, true)
    const { position, skinIndex, skinWeight } = mesh.geometry.attributes
    vertices += position.count
    for (let index = 0; index < position.count; index++) {
      let sum = 0
      for (let slot = 0; slot < 4; slot++) {
        assert.ok(skinIndex.array[index * 4 + slot] < 65)
        sum += skinWeight.array[index * 4 + slot]
      }
      assert.ok(Math.abs(sum - 1) < 1e-5)
    }
    assert.equal(mesh.material.map, null)
    if (mesh.material.name === 'White shirt and cuffs') {
      shirt = true
      assert.ok(mesh.material.color.r > .8 && mesh.material.color.g > .8 && mesh.material.color.b > .8)
    }
  })
  assert.ok(shirt)
  assert.ok(vertices < 4000)
})

test('all Recruiter clips deform finitely inside the original animation envelope', async () => {
  const original = await load('runner'), recruiter = await load('recruiter')
  for (const sourceClip of original.animations) {
    const sourceMixer = new AnimationMixer(original.scene), targetMixer = new AnimationMixer(recruiter.scene)
    sourceMixer.clipAction(sourceClip).play()
    targetMixer.clipAction(recruiter.animations.find(clip => clip.name === sourceClip.name)).play()
    for (let frame = 0; frame < 24; frame++) {
      sourceMixer.update(sourceClip.duration / 24)
      targetMixer.update(sourceClip.duration / 24)
      const expected = skinBounds(original).expandByScalar(.06), actual = skinBounds(recruiter)
      assert.ok([...actual.min.toArray(), ...actual.max.toArray()].every(Number.isFinite))
      assert.ok(expected.containsBox(actual), sourceClip.name + ' skin exceeds source envelope')
    }
    sourceMixer.stopAllAction(); targetMixer.stopAllAction()
    sourceMixer.uncacheRoot(original.scene); targetMixer.uncacheRoot(recruiter.scene)
  }
})

test('Recruiter retains stride calibration and fixed Slide timing without worsening source sole contact', async () => {
  const assets = [await load('runner'), await load('recruiter')]
  const animations = assets.map(asset => new GameAnimation(asset))
  assert.equal(animations[0].runPlaybackRate, animations[1].runPlaybackRate)
  assert.equal(animations[0].runStride.length, animations[1].runStride.length)
  const simulations = assets.map(() => {
    const sim = new Simulation()
    Object.assign(sim, { phase: 'running', x: 70, y: -1.3, supportingPlatform: 5 })
    sim.requestSlide()
    return sim
  })
  for (let tick = 0; tick < 184; tick++) {
    simulations.forEach((sim, index) => sim.advance(STEP, dt => animations[index].update(dt, sim)))
    const source = skinBounds(assets[0]), target = skinBounds(assets[1])
    assert.ok(target.min.y + animations[1].visualOffsetY >= source.min.y + animations[0].visualOffsetY - .003)
    assert.ok(target.max.y + animations[1].visualOffsetY <= simulations[1].colliderHeight + .003)
    assert.equal(simulations[1].sliding, simulations[0].sliding)
  }
  assert.equal(animations[1].actions.Slide.getClip().duration.toFixed(3), SLIDE_DURATION.toFixed(3))
  assert.equal(simulations[1].sliding, false)
  animations.forEach(animation => animation.dispose())
})
