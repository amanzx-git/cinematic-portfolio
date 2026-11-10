// Nearest-rank percentiles. Keep long intervals: spikes are part of the result.
export function frameStats(intervals) {
  if (!intervals.length) return null
  const sorted = [...intervals].sort((a, b) => a - b)
  const percentile = p => sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)]
  const worst = sorted.slice(-Math.max(1, Math.ceil(sorted.length * 0.01)))
  const durationMs = intervals.reduce((a, b) => a + b, 0)
  return {
    frames: intervals.length, durationMs, meanFPS: intervals.length * 1000 / durationMs,
    medianMs: percentile(0.5), p95Ms: percentile(0.95), p99Ms: percentile(0.99), maxMs: sorted.at(-1),
    over16_7: sorted.filter(value => value > 16.7).length,
    over33_3: sorted.filter(value => value > 33.3).length,
    onePercentLowFPS: 1000 / (worst.reduce((a, b) => a + b, 0) / worst.length),
  }
}
