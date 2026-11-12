import { Matrix4, Quaternion, Vector3, Box3, type Texture, type Mesh } from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { SLIDE_DURATION } from '../game/slide.ts'
import { disposeRunner } from '../lab/RunnerPlayback.ts'

export function disposePlayerCharacter(asset: GLTF) {
  const textures = new Set<Texture>()
  asset.scene.traverse(node => {
    const mesh = node as Mesh
    if (!mesh.material) return
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value)
    }
  })
  for (const texture of textures) {
    texture.dispose()
    const bitmap = texture.source.data as ImageBitmap | undefined
    if (typeof bitmap?.close === 'function') bitmap.close()
  }
  disposeRunner(asset)
}

/** Bake only the exported Armature transform into its direct children and hip keys.
 * World-space bones/meshes and inverse binds remain unchanged by reparenting. */
export function normalizeMaleCharacter(asset: GLTF) {
  const armature = asset.scene.getObjectByName('Armature')
  const hips = armature?.children.find(node => /mixamorig\d*:?Hips$/.test(node.name))
  if (!armature || !hips) throw Error('Male Recruiter Armature/Hips missing')
  const names = ['Idle', 'Run', 'Jump', 'Land', 'Slide']
  if (!names.every(name => asset.animations.some(clip => clip.name === name))) throw Error('Male Recruiter clips missing')
  asset.scene.updateMatrixWorld(true)
  const bounds = new Box3().setFromObject(asset.scene, true)
  const height = bounds.max.y - bounds.min.y
  if (!Number.isFinite(height) || height <= 0) throw Error('Invalid Male Recruiter size')
  armature.scale.multiplyScalar(1.8 / height)
  asset.scene.updateMatrixWorld(true)
  const transform = new Matrix4().copy(armature.matrix)
  const rotation = new Quaternion(), scale = new Vector3()
  transform.decompose(new Vector3(), rotation, scale)
  const hipName = hips.name
  const normalizedName = 'mixamorigHips'
  const position = new Vector3(), orientation = new Quaternion()
  asset.animations = names.map(name => {
    const clip = asset.animations.find(clip => clip.name === name)!.clone()
    for (const track of clip.tracks) {
      if (track.name.startsWith(hipName + '.')) {
        track.name = normalizedName + track.name.slice(hipName.length)
        for (let offset = 0; offset < track.values.length; offset += track.getValueSize()) {
          if (track.name.endsWith('.position')) {
            position.fromArray(track.values, offset).applyMatrix4(transform).toArray(track.values, offset)
          } else if (track.name.endsWith('.quaternion')) {
            orientation.fromArray(track.values, offset).premultiply(rotation).normalize().toArray(track.values, offset)
          } else if (track.name.endsWith('.scale')) {
            position.fromArray(track.values, offset).multiply(scale).toArray(track.values, offset)
          }
        }
      }
      if (name === 'Slide') {
        for (let i = 0; i < track.times.length; i++) track.times[i] *= SLIDE_DURATION / clip.duration
      }
    }
    if (name === 'Slide') clip.duration = SLIDE_DURATION
    return clip
  })
  for (const child of [...armature.children]) asset.scene.attach(child)
  armature.removeFromParent()
  hips.name = normalizedName
  asset.scene.updateMatrixWorld(true)
  const floor = new Box3().setFromObject(asset.scene, true).min.y
  asset.scene.position.y -= floor
  asset.scene.userData.maleRecruiter = true
  return asset
}
