import { course, barriers, type Platform } from './simulation.ts'

// Blend toward landing ledges early; retain headroom until the runner descends.
export function framingHeight(x: number, platforms: readonly Platform[], feetY = -Infinity) {
  for (let i = 0; i < platforms.length - 1; i++) {
    const [, end, top] = platforms[i]
    const [nextStart, , nextTop] = platforms[i + 1]
    const approach = end - (top - nextTop > 3 ? 6.4 : top - nextTop > 1 ? 4.6 : nextTop > top ? 3.2 : 2.5)
    if (x < approach) return Math.max(top, feetY - 2)
    if (x < nextStart + 0.8) {
      const t = (x - approach) / (nextStart + 0.8 - approach)
      return Math.max(top + (nextTop - top) * t * t * (3 - 2 * t), feetY - 2)
    }
  }
  return Math.max(platforms[platforms.length - 1][2], feetY - 2)
}

export class FollowCamera {
  x = 2.6
  y = 0
  resetVersion = -1
  update(actorX: number, delta: number, resetVersion: number, roofHeight = 0, lead = 2.6) {
    const dt = Math.min(0.1, Math.max(0, delta))
    if (resetVersion !== this.resetVersion) {
      this.resetVersion = resetVersion
      this.x = actorX + 2.6
      this.y = roofHeight
    } else {
      this.x += (actorX + lead - this.x) * (1 - Math.exp(-8 * dt))
      this.y += (roofHeight - this.y) * (1 - Math.exp(-6 * dt))
    }
    return this.x
  }
}

// Smooth spatial envelopes keep composition independent of animation phase.
function smoothRange(start: number, end: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - start) / (end - start)))
  return t * t * (3 - 2 * t)
}
export function compositionLead(x: number, reducedMotion = false) {
  if (reducedMotion) return 2.6
  let approach = 0
  for (const [index, marker] of course.takeoffs.entries()) {
    if (marker === undefined) continue
    const end = course.platforms[index][1]
    const landing = course.platforms[index + 1][0]
    const weight = smoothRange(end - 6, end - 2, x) * (1 - smoothRange(landing + 0.5, landing + 3, x))
    approach = Math.max(approach, weight)
  }
  for (const obstacle of barriers) {
    const weight = smoothRange(obstacle.start - 6, obstacle.start - 3, x) * (1 - smoothRange(obstacle.end + 1, obstacle.end + 4, x))
    approach = Math.max(approach, weight)
  }
  return 2.6 + approach * 0.45 - smoothRange(course.finish - 6, course.finish, x) * 0.9
}
