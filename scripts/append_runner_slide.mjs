import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'

function readGlb(path) {
  const bytes = readFileSync(path)
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF')
  assert.equal(bytes.readUInt32LE(4), 2)
  const end = 20 + bytes.readUInt32LE(12)
  return { json: JSON.parse(bytes.toString('utf8', 20, end)), bin: bytes.subarray(end + 8) }
}

const [basePath, stagedPath, outputPath] = process.argv.slice(2)
const { json, bin } = readGlb(basePath)
const staged = readGlb(stagedPath)
const source = staged.json
assert.deepEqual(json.animations.map(clip => clip.name).sort(), ['Idle', 'Jump', 'Land', 'Run'])
assert.deepEqual(source.animations.map(clip => clip.name), ['Slide'])
const animation = source.animations[0]
const nodes = new Map(json.nodes.map((node, index) => [node.name, index]))
for (const channel of animation.channels) {
  const node = source.nodes[channel.target.node]
  const index = nodes.get(node.name)
  assert.notEqual(index, undefined)
  const original = json.nodes[index]
  for (const key of ['translation', 'rotation', 'scale']) {
    const a = node[key] ?? (key === 'rotation' ? [0, 0, 0, 1] : key === 'scale' ? [1, 1, 1] : [0, 0, 0])
    const b = original[key] ?? a.map((_, i) => key === 'scale' || (key === 'rotation' && i === 3) ? 1 : 0)
    assert.ok(a.every((value, i) => Math.abs(value - b[i]) < 1e-5), node.name + ' ' + key)
  }
  assert.deepEqual((node.children ?? []).map(i => source.nodes[i].name), (original.children ?? []).map(i => json.nodes[i].name))
  channel.target.node = index
}
const parts = [bin]
let offset = bin.length
const accessors = new Map()
const views = new Map()
function appendAccessor(index) {
  if (accessors.has(index)) return accessors.get(index)
  const accessor = source.accessors[index]
  assert.ok(!accessor.sparse)
  if (!views.has(accessor.bufferView)) {
    const view = source.bufferViews[accessor.bufferView]
    assert.equal(view.buffer, 0)
    const start = view.byteOffset ?? 0
    const padding = Buffer.alloc((4 - offset % 4) % 4)
    parts.push(padding, staged.bin.subarray(start, start + view.byteLength))
    offset += padding.length
    views.set(accessor.bufferView, json.bufferViews.push({ ...view, byteOffset: offset }) - 1)
    offset += view.byteLength
  }
  const target = json.accessors.push({ ...accessor, bufferView: views.get(accessor.bufferView) }) - 1
  accessors.set(index, target)
  return target
}
for (const sampler of animation.samplers) {
  sampler.input = appendAccessor(sampler.input)
  sampler.output = appendAccessor(sampler.output)
}
json.animations.push(animation)
json.buffers[0].byteLength = offset
const jsonBytes = Buffer.from(JSON.stringify(json))
const paddedJson = Buffer.concat([jsonBytes, Buffer.alloc((4 - jsonBytes.length % 4) % 4, 0x20)])
const binary = Buffer.concat([...parts, Buffer.alloc((4 - offset % 4) % 4)])
const header = Buffer.alloc(20)
header.write('glTF')
header.writeUInt32LE(2, 4)
header.writeUInt32LE(28 + paddedJson.length + binary.length, 8)
header.writeUInt32LE(paddedJson.length, 12)
header.write('JSON', 16)
const binHeader = Buffer.alloc(8)
binHeader.writeUInt32LE(binary.length, 0)
binHeader.write('BIN\0', 4)
writeFileSync(outputPath, Buffer.concat([header, paddedJson, binHeader, binary]))

