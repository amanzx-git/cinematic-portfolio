// Inspect the delivered source, without modifying it or gameplay's runtime clips.
import { readFile } from 'node:fs/promises'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { AnimationMixer, LoopOnce, Vector3 } from 'three'

const bytes = await readFile('public/assets/characters/runner/runner.glb')
const asset = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
const clip = asset.animations.find(clip => clip.name === 'Land')
const mixer = new AnimationMixer(asset.scene)
const action = mixer.clipAction(clip).setLoop(LoopOnce, 1)
action.clampWhenFinished = true
action.play()
console.log({ duration: clip.duration, tracks: clip.tracks.length,
  keyCounts: [...new Set(clip.tracks.map(track => track.times.length))], times: Array.from(clip.tracks[0].times) })
const point = name => asset.scene.getObjectByName(`mixamorig${name}`).getWorldPosition(new Vector3()).toArray().map(value => +value.toFixed(3))
for (const time of [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.72, 0.8, 0.9, 1, clip.duration]) {
  mixer.setTime(time)
  asset.scene.updateMatrixWorld(true)
  console.log(time, { hips: point('Hips'), leftFoot: point('LeftFoot'), rightFoot: point('RightFoot') })
}
mixer.stopAllAction()
mixer.uncacheRoot(asset.scene)
