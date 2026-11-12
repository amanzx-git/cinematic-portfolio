// Build a separate authored contour mesh on the canonical rig, preserving clip bytes.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { Color, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const sourcePath = 'public/assets/characters/runner/runner.glb'
const bytes = await readFile(sourcePath)
const sourceHash = createHash('sha256').update(bytes).digest('hex')
const jsonEnd = 20 + bytes.readUInt32LE(12)
const json = JSON.parse(bytes.toString('utf8', 20, jsonEnd))
const binary = bytes.subarray(jsonEnd + 8)
const asset = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
asset.scene.updateMatrixWorld(true)
const skin = json.skins[0]
const joints = new Map(skin.joints.map((node, index) => [json.nodes[node].name.replace(/^mixamorig:?/, ''), index]))
const joint = name => { assert.ok(joints.has(name), name); return joints.get(name) }
const point = name => asset.scene.getObjectByName('mixamorig' + name).getWorldPosition(new Vector3())
const materials = [
  ['Suit jacket', '#17191c'], ['White shirt and cuffs', '#eeeeea'],
  ['Black necktie', '#08090b'], ['Formal trousers', '#1b1d20'],
  ['Dress shoes', '#0d0e10'], ['Skin', '#63594f'], ['Professional hair', '#141210'],
].map(([name, hex]) => ({ name, pbrMetallicRoughness: { baseColorFactor: [...new Color(hex).toArray(), 1], metallicFactor: 0, roughnessFactor: 1 }, extensions: { KHR_materials_unlit: {} } }))
const parts = materials.map(() => ({ positions: [], weights: [], joints: [], indices: [] }))
function vertex(part, position, influences) {
  const index = part.positions.length / 3
  part.positions.push(...position)
  const entries = influences.filter(([, weight]) => weight > 0)
  const sum = entries.reduce((total, [, weight]) => total + weight, 0)
  for (let slot = 0; slot < 4; slot++) {
    part.joints.push(entries[slot] ? joint(entries[slot][0]) : 0)
    part.weights.push(entries[slot] ? entries[slot][1] / sum : 0)
  }
  return index
}
const torsoJoints = ['Hips', 'Spine', 'Spine1', 'Spine2']
function torsoWeights(y) {
  for (let i = 0; i < torsoJoints.length - 1; i++) {
    const bottom = point(torsoJoints[i]).y, top = point(torsoJoints[i + 1]).y
    if (y <= top) {
      const blend = Math.max(0, Math.min(1, (y - bottom) / (top - bottom)))
      return [[torsoJoints[i], 1 - blend], [torsoJoints[i + 1], blend]]
    }
  }
  return [['Spine2', 1]]
}
// Loft contours into closed, smoothly skinned surfaces, without primitive joint shells.
function loft(material, rings, influences, segments = 12) {
  const part = parts[material], first = part.positions.length / 3, firstIndex = part.indices.length
  for (let row = 0; row < rings.length; row++) {
    const { center, u, v } = rings[row]
    for (let side = 0; side < segments; side++) {
      const angle = side / segments * Math.PI * 2
      vertex(part, center.clone().addScaledVector(u, Math.sin(angle)).addScaledVector(v, Math.cos(angle)).toArray(), influences(row, side))
    }
  }
  for (let row = 0; row < rings.length - 1; row++) {
    for (let side = 0; side < segments; side++) {
      const a = first + row * segments + side, b = first + row * segments + (side + 1) % segments
      part.indices.push(a, b, a + segments, b, b + segments, a + segments)
    }
  }
  for (const [row, reverse] of [[0, true], [rings.length - 1, false]]) {
    const cap = vertex(part, rings[row].center.toArray(), influences(row, 0))
    for (let side = 0; side < segments; side++) {
      const a = first + row * segments + side, b = first + row * segments + (side + 1) % segments
      part.indices.push(cap, reverse ? b : a, reverse ? a : b)
    }
  }
  const direction = rings[1].center.clone().sub(rings[0].center)
  if (new Vector3().crossVectors(rings[0].u, direction).dot(rings[0].v) < 0) {
    for (let i = firstIndex; i < part.indices.length; i += 3) [part.indices[i + 1], part.indices[i + 2]] = [part.indices[i + 2], part.indices[i + 1]]
  }
}
function horizontal(material, rows, weights, segments) {
  loft(material, rows.map(([y, width, depth, z = -.03, x = 0]) => ({ center: new Vector3(x, y, z), u: new Vector3(width, 0, 0), v: new Vector3(0, 0, depth) })), row => weights(rows[row][0]), segments)
}
const jacket = [[.985, .135, .085, -.025], [1.06, .132, .087, -.02], [1.14, .126, .087, -.012], [1.24, .15, .098, -.026], [1.34, .17, .104, -.04], [1.42, .166, .097, -.061], [1.466, .075, .061, -.058]]
horizontal(0, jacket, torsoWeights, 16)
horizontal(3, [[.9, .115, .079], [.98, .132, .085], [1.065, .125, .083]], () => [['Hips', 1]], 12)
function chestContour(y) {
  for (let i = 1; i < jacket.length; i++) if (y <= jacket[i][0]) {
    const a = jacket[i - 1], b = jacket[i], t = Math.max(0, (y - a[0]) / (b[0] - a[0]))
    return a.map((value, axis) => value + (b[axis] - value) * t)
  }
  return jacket.at(-1)
}
function chestPatch(material, rows, columns = 8) {
  const part = parts[material], first = part.positions.length / 3
  for (const [y, angleWidth] of rows) {
    const [, width, depth, z] = chestContour(y)
    for (let col = 0; col <= columns; col++) {
      const angle = (col / columns * 2 - 1) * angleWidth
      vertex(part, [(width + .004) * Math.sin(angle), y, z + (depth + .006 + material * .001) * Math.cos(angle)], torsoWeights(y))
    }
  }
  for (let row = 0; row < rows.length - 1; row++) for (let col = 0; col < columns; col++) {
    const a = first + row * (columns + 1) + col, b = a + columns + 1
    part.indices.push(a, a + 1, b, a + 1, b + 1, b)
  }
}
// Use the actual jacket surface for the open shirt insert, avoiding buried overlays.
const jacketFaces = []
for (let offset = 0; offset < parts[0].indices.length; offset += 3) {
  const face = parts[0].indices.slice(offset, offset + 3)
  const center = face.reduce((sum, index) => sum.add(new Vector3().fromArray(parts[0].positions, index * 3)), new Vector3()).divideScalar(3)
  const contour = chestContour(center.y)
  const angle = Math.abs(Math.atan2(center.x, center.z - contour[3]))
  const opening = Math.max(0, Math.min(1.65, (center.y - 1.18) * 9))
  if (center.y > 1.19 && center.y < 1.455 && angle < opening) {
    for (const index of face) {
      parts[1].indices.push(parts[1].positions.length / 3)
      parts[1].positions.push(...parts[0].positions.slice(index * 3, index * 3 + 3))
      parts[1].joints.push(...parts[0].joints.slice(index * 4, index * 4 + 4))
      parts[1].weights.push(...parts[0].weights.slice(index * 4, index * 4 + 4))
    }
  } else jacketFaces.push(...face)
}
parts[0].indices = jacketFaces
chestPatch(2, [[1.215, .005], [1.24, .12], [1.30, .08], [1.34, .075], [1.38, .075], [1.40, .075], [1.425, .13]], 2)
horizontal(1, [[1.465, .058, .056, -.058], [1.50, .052, .049, -.058]], () => [['Neck', .35], ['Spine2', .65]], 12)
horizontal(5, [[1.492, .042, .04, -.057], [1.57, .043, .042, -.041]], () => [['Neck', 1]], 12)
// Jaw, cheek, brow and crown contours give a human head profile, including a nose.
horizontal(5, [[1.562, .041, .045, -.023], [1.595, .061, .063, -.028], [1.65, .071, .074, -.037], [1.71, .073, .072, -.043], [1.758, .062, .059, -.045], [1.785, .028, .026, -.045]], () => [['Head', 1]], 16)
const face = parts[5], nose = [[-.012, 1.65, .036], [.012, 1.65, .036], [0, 1.672, .064], [0, 1.693, .032]].map(p => vertex(face, p, [['Head', 1]]))
face.indices.push(nose[0], nose[1], nose[2], nose[1], nose[3], nose[2], nose[3], nose[0], nose[2])
// A close-cut crown and raised front sweep, with no facial textures.
horizontal(6, [[1.727, .073, .072, -.049], [1.767, .065, .061, -.045], [1.795, .035, .034, -.04], [1.802, .008, .009, -.036]], () => [['Head', 1]], 16)
function limb(material, start, end, profile, startBone, endBone, radiusDepth = 1) {
  const a = point(start), b = point(end), direction = b.clone().sub(a).normalize()
  const u = Math.abs(direction.y) > .8 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0)
  const v = new Vector3().crossVectors(direction, u).normalize()
  const rings = profile.map(([t, radius]) => ({ center: a.clone().lerp(b, t), u: u.clone().multiplyScalar(radius), v: v.clone().multiplyScalar(radius * radiusDepth) }))
  loft(material, rings, row => {
    const t = profile[row][0], blend = Math.max(0, (t - .82) / .18) * .5
    return [[startBone, 1 - blend], [endBone, blend]]
  }, 12)
}
for (const side of ['Left', 'Right']) {
  limb(0, side + 'Arm', side + 'ForeArm', [[0, .057], [.15, .059], [.65, .048], [1, .038]], side + 'Arm', side + 'ForeArm')
  limb(0, side + 'ForeArm', side + 'Hand', [[0, .038], [.12, .04], [.65, .032], [.93, .029]], side + 'ForeArm', side + 'Hand')
  limb(1, side + 'ForeArm', side + 'Hand', [[.93, .03], [1, .03]], side + 'ForeArm', side + 'Hand')
  const hand = point(side + 'Hand'), sign = side === 'Left' ? 1 : -1
  loft(5, [[0, .029, .023], [.045, .035, .024], [.09, .027, .021], [.113, .012, .013]].map(([offset, y, z]) => ({ center: hand.clone().add(new Vector3(sign * offset, 0, .008)), u: new Vector3(0, y, 0), v: new Vector3(0, 0, z) })), () => [[side + 'Hand', 1]], 10)
  limb(3, side + 'UpLeg', side + 'Leg', [[0, .066], [.15, .067], [.65, .054], [1, .045]], side + 'UpLeg', side + 'Leg', 1.12)
  limb(3, side + 'Leg', side + 'Foot', [[0, .045], [.2, .049], [.7, .036], [.97, .03]], side + 'Leg', side + 'Foot', 1.08)

}
// Retain the validated foot surface and weights as the dress-shoe base.
// Its exact sole profile is required by the existing Run/Slide contact calibration.
parts[4] = { positions: [], weights: [], joints: [], indices: [] }
asset.scene.traverse(mesh => {
  if (!mesh.isSkinnedMesh || mesh.material.name !== 'Beta_HighLimbsGeoSG3') return
  const { position, skinIndex, skinWeight } = mesh.geometry.attributes
  const indices = mesh.geometry.index.array, copied = new Map()
  for (let triangle = 0; triangle < indices.length; triangle += 3) {
    const face = Array.from(indices.slice(triangle, triangle + 3))
    if (!face.every(index => position.getY(index) < .15)) continue
    for (const index of face) {
      if (!copied.has(index)) {
        copied.set(index, parts[4].positions.length / 3)
        parts[4].positions.push(position.getX(index), position.getY(index), position.getZ(index))
        parts[4].joints.push(...skinIndex.array.slice(index * 4, index * 4 + 4))
        parts[4].weights.push(...skinWeight.array.slice(index * 4, index * 4 + 4))
      }
      parts[4].indices.push(copied.get(index))
    }
  }
})
const buffers = [binary]
let offset = binary.length
function accessor(values, componentType, type, bounds = false) {
  const array = componentType === 5126 ? new Float32Array(values) : new Uint16Array(values)
  const padding = Buffer.alloc((4 - offset % 4) % 4)
  buffers.push(padding, Buffer.from(array.buffer)); offset += padding.length
  const bufferView = json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: array.byteLength }) - 1
  offset += array.byteLength
  const size = { SCALAR: 1, VEC3: 3, VEC4: 4 }[type]
  const entry = { bufferView, componentType, count: values.length / size, type }
  if (bounds) {
    entry.min = Array.from({ length: size }, (_, axis) => Math.min(...values.filter((_, i) => i % size === axis)))
    entry.max = Array.from({ length: size }, (_, axis) => Math.max(...values.filter((_, i) => i % size === axis)))
  }
  return json.accessors.push(entry) - 1
}
json.meshes = [{ name: 'RecruiterSuitMesh', primitives: parts.map((part, material) => ({
  attributes: { POSITION: accessor(part.positions, 5126, 'VEC3', true), JOINTS_0: accessor(part.joints, 5123, 'VEC4'), WEIGHTS_0: accessor(part.weights, 5126, 'VEC4') },
  indices: accessor(part.indices, 5123, 'SCALAR'), material,
})) }]
json.materials = materials
json.extensionsUsed = [...new Set([...(json.extensionsUsed ?? []), 'KHR_materials_unlit'])]
json.nodes.find(node => node.mesh !== undefined).name = 'RecruiterMesh'
json.asset.extras = { source: sourcePath, sourceSha256: sourceHash, character: 'G8.0 skinned formal recruiter' }
// Compact only referenced geometry, rig and animation data into the new asset.
const joined = Buffer.concat(buffers), packed = [], views = new Map(), accessors = new Map()
let packedOffset = 0
function packAccessor(old) {
  if (accessors.has(old)) return accessors.get(old).index
  const entry = json.accessors[old], sourceView = json.bufferViews[entry.bufferView]
  if (!views.has(entry.bufferView)) {
    const padding = Buffer.alloc((4 - packedOffset % 4) % 4)
    packed.push(padding); packedOffset += padding.length
    views.set(entry.bufferView, { index: views.size, view: { ...sourceView, byteOffset: packedOffset } })
    const start = sourceView.byteOffset ?? 0
    packed.push(joined.subarray(start, start + sourceView.byteLength)); packedOffset += sourceView.byteLength
  }
  const next = accessors.size
  accessors.set(old, { index: next, entry: { ...entry, bufferView: views.get(entry.bufferView).index } })
  return next
}
// All references are remapped after the referenced bytes have been collected.
for (const primitive of json.meshes[0].primitives) {
  for (const key of Object.keys(primitive.attributes)) primitive.attributes[key] = packAccessor(primitive.attributes[key])
  primitive.indices = packAccessor(primitive.indices)
}
for (const rig of json.skins) rig.inverseBindMatrices = packAccessor(rig.inverseBindMatrices)
for (const animation of json.animations) for (const sampler of animation.samplers) {
  sampler.input = packAccessor(sampler.input); sampler.output = packAccessor(sampler.output)
}
json.accessors = [...accessors.values()].map(value => value.entry)
json.bufferViews = [...views.values()].map(value => value.view)
json.buffers = [{ byteLength: packedOffset }]
const jsonBytes = Buffer.from(JSON.stringify(json)), jsonPadding = Buffer.alloc((4 - jsonBytes.length % 4) % 4, 0x20)
const binBytes = Buffer.concat([...packed, Buffer.alloc((4 - packedOffset % 4) % 4)])
const header = Buffer.alloc(20), binHeader = Buffer.alloc(8)
header.write('glTF'); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + jsonBytes.length + jsonPadding.length + binBytes.length, 8)
header.writeUInt32LE(jsonBytes.length + jsonPadding.length, 12); header.write('JSON', 16)
binHeader.writeUInt32LE(binBytes.length); binHeader.write('BIN\0', 4)
await mkdir('public/assets/characters/recruiter', { recursive: true })
const output = Buffer.concat([header, jsonBytes, jsonPadding, binHeader, binBytes])
await writeFile('public/assets/characters/recruiter/recruiter.glb', output)
assert.equal(createHash('sha256').update(await readFile(sourcePath)).digest('hex'), sourceHash)
console.log(JSON.stringify({ bytes: output.length, vertices: parts.reduce((sum, part) => sum + part.positions.length / 3, 0), triangles: parts.reduce((sum, part) => sum + part.indices.length / 3, 0), sourceSha256: sourceHash }))
