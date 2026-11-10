import { test } from 'node:test'
import assert from 'node:assert/strict'
import { selectRenderer } from '../src/rendering/backend.mjs'

test('prefers a working WebGPU renderer', async () => {
  const calls = []
  const result = await selectRenderer(false, async forced => { calls.push(forced); return 'gpu' })
  assert.equal(result, 'gpu')
  assert.deepEqual(calls, [false])
})
test('retries initialization failure with WebGL 2', async () => {
  const calls = []
  const result = await selectRenderer(false, async forced => {
    calls.push(forced)
    if (!forced) throw Error('WebGPU unavailable')
    return 'gl'
  })
  assert.equal(result, 'gl')
  assert.deepEqual(calls, [false, true])
})
test('forced WebGL skips WebGPU', async () => {
  await selectRenderer(true, async forced => { assert.equal(forced, true) })
})
test('reports failure when neither backend initializes', async () => {
  await assert.rejects(selectRenderer(false, async () => { throw Error('Unsupported graphics') }), /Unsupported graphics/)
})
