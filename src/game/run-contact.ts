// Offline 120 Hz canonical skin samples, reduced to conservative 30 Hz lifts.
// Keep the authored flight phase and lift only small sole penetration.
const soleLifts = [
  0.0112, 0.0039, 0.0, 0.0, 0.0, 0.0, 0.0047, 0.0057,
  0.0057, 0.0047, 0.0017, 0.0, 0.0, 0.0, 0.0, 0.0101,
  0.0101, 0.0064, 0.0112, 0.0112,
]
export const LAND_RUN_CONTACT_TIME = 6 / 30
export const SLIDE_RUN_CONTACT_TIME = 18 / 30
export const RUN_CONTACT_TIMES = [7 / 30, 16.5 / 30] as const
export function runSoleLift(time: number) {
  const frame = Math.min(soleLifts.length - 1, Math.max(0, time * 30))
  const index = Math.floor(frame)
  return soleLifts[index] + ((soleLifts[index + 1] ?? soleLifts[index]) - soleLifts[index]) * (frame - index)
}

/** Convert authoritative forward distance into a phase of the authored Run stride. */
export class RunStride {
  readonly times: number[]
  readonly distances: number[]
  readonly length: number
  readonly duration: number
  constructor(times: ArrayLike<number>, values: ArrayLike<number>) {
    this.times = Array.from(times)
    this.distances = this.times.map((_, i) => values[i * 3 + 2] - values[2])
    this.length = this.distances[this.distances.length - 1]
    this.duration = this.times[this.times.length - 1]
    if (this.length <= 0 || this.distances.some((value, i) => i > 0 && value <= this.distances[i - 1])) {
      throw Error('Run stride requires monotonically forward source motion')
    }
  }
  private sample(value: number, keys: readonly number[], values: readonly number[]) {
    for (let i = 1; i < keys.length; i++) {
      if (value <= keys[i]) {
        const alpha = Math.max(0, (value - keys[i - 1]) / (keys[i] - keys[i - 1]))
        return values[i - 1] + (values[i] - values[i - 1]) * alpha
      }
    }
    return values[values.length - 1]
  }
  advanceTime(time: number, distance: number) {
    const target = this.sample(time, this.times, this.distances) + distance
    const cycles = Math.floor(target / this.length)
    const next = this.sample(target - cycles * this.length, this.distances, this.times)
    return cycles * this.duration + next - time
  }
}

const slideLifts = [
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0094, 0.0094, 0.0094, 0.0007, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0, 0.0012, 0.0087, 0.02, 0.02, 0.02, 0.0065, 0.0022,
  0.002, 0.0016, 0.0017, 0.0027, 0.0027, 0.0023, 0.0009, 0.0,
  0.0, 0.0, 0.0, 0.0009, 0.0028, 0.0028, 0.0023,
]
export function slideSoleLift(time: number) {
  const frame = Math.min(slideLifts.length - 1, Math.max(0, time * 30))
  const index = Math.floor(frame)
  return slideLifts[index] + ((slideLifts[index + 1] ?? slideLifts[index]) - slideLifts[index]) * (frame - index)
}
