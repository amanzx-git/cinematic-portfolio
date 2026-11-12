import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { Simulation, STEP } from '../src/game/simulation.ts'
import { GameAnimation } from '../src/game/animation.ts'

test('runtime Slide skin remains inside the measured collider throughout entry, low and recovery',async()=>{
 const b=await readFile('public/assets/characters/runner/runner.glb')
 const asset=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')
 const animation=new GameAnimation(asset),sim=new Simulation()
 sim.phase='running';sim.x=70;sim.y=-1.3;sim.supportingPlatform=5
 animation.update(.1,sim);sim.requestSlide()
 for(let tick=0;tick<184;tick++){
   sim.advance(STEP,dt=>animation.update(dt,sim))
   asset.scene.updateMatrixWorld(true)
   asset.scene.traverse(mesh=>{
     if(!mesh.isSkinnedMesh)return
     mesh.skeleton.update();mesh.computeBoundingBox()
     assert.ok(mesh.boundingBox.min.y+animation.visualOffsetY>=-.002,'Slide sole penetration')
     assert.ok(mesh.boundingBox.max.y+animation.visualOffsetY<=sim.colliderHeight+.002,
       tick+': skin '+mesh.boundingBox.max.y+' body '+sim.colliderHeight)
   })
 }
 assert.equal(sim.sliding,false)
 animation.dispose()
})
