// Offline CPU skin bounds for gameplay's cloned clips. No asset modifications.
import { readFile } from 'node:fs/promises'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { GameAnimation } from '../src/game/animation.ts'

const bytes = await readFile('public/assets/characters/runner/runner.glb')
const asset = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
const animation = new GameAnimation(asset)
for (const name of ['Idle', 'Run', 'Land']) {
  animation.mixer.stopAllAction()
  const action = animation.actions[name].reset().play()
  const duration = action.getClip().duration
  const samples = []
  for (let frame = 0; frame <= Math.ceil(duration * 30); frame++) {
    const time = Math.min(duration, frame / 30)
    if (name === 'Land' && time < 0.3) continue
    action.time = time
    animation.mixer.update(0)
    asset.scene.updateMatrixWorld(true)
    let minimum = Infinity
    asset.scene.traverse(mesh => {
      if (!mesh.isSkinnedMesh) return
      mesh.skeleton.update()
      mesh.computeBoundingBox()
      minimum = Math.min(minimum, mesh.boundingBox.clone().applyMatrix4(mesh.matrixWorld).min.y)
    })
    samples.push({ time, soleHeight: minimum })
  }
  console.log(name, { min: Math.min(...samples.map(s => s.soleHeight)), max: Math.max(...samples.map(s => s.soleHeight)), samples })
}
animation.dispose()
