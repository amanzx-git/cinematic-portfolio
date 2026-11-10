import { test } from 'node:test'
import assert from 'node:assert/strict'
import { frameStats } from './frame-stats.mjs'

test('reports nearest-rank percentiles without mutating measurements', () => {
  const frames = Array.from({ length: 100 }, (_, index) => 100 - index)
  const stats = frameStats(frames)
  assert.equal(stats.medianMs, 50)
  assert.equal(stats.p95Ms, 95)
  assert.equal(stats.p99Ms, 99)
  assert.equal(stats.onePercentLowFPS, 10)
  assert.equal(frames[0], 100)
})
test('includes long startup or rendering spikes instead of filtering them out', () => {
  const stats = frameStats([8, 8, 300])
  assert.equal(stats.maxMs, 300)
  assert.equal(stats.p99Ms, 300)
  assert.equal(stats.durationMs, 316)
  assert.equal(stats.over33_3, 1)
  assert.equal(frameStats([]), null)
})
