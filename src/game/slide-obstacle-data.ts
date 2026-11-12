import type { Barrier, Platform } from './course.ts'
import type { StaticInstance } from '../scene/StaticInstances'

export const SLIDE_STEEL_COLOR = '#202020'
export function slideObstacleInstances(platforms: readonly Platform[], barriers: readonly Barrier[]) {
  const boxes: StaticInstance[] = [], pipes: StaticInstance[] = [], markings: StaticInstance[] = []
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, tint?: string): StaticInstance => ({ position: [x, y, z], scale: [w, h, d], tint })
  for (const barrier of barriers.filter(barrier => !barrier.electrical || barrier.electrical === 'conduit')) {
    const { start, end, bottom, top } = barrier
    const x = (start + end) / 2, width = end - start, height = top - bottom
    const floor = platforms.find(([a, b]) => x >= a && x < b)![2]
    if (barrier.shape === 'pipe') {
      pipes.push({ position: [x, (bottom + top) / 2, 0], scale: [width / 2, 2.5, height / 2], rotation: [Math.PI / 2, 0, 0] })
      // The cradle makes the pipe's conservative collision envelope visible.
      boxes.push(box(x, bottom + .025, 0, width, .05, 2.5), box(x, top - .025, 0, width, .05, 2.5))
      for (const edge of [start + .025, end - .025]) boxes.push(box(edge, (bottom + top) / 2, 0, .05, height, 2.5))
    } else boxes.push(box(x, (bottom + top) / 2, 0, width, height, 2.5))
    // Rear supports show the opening without covering the character in the foreground.
    for (const edge of [start + .065, end - .065]) {
      boxes.push(box(edge, (floor + bottom) / 2, -.9, .12, bottom - floor, .16))
      markings.push(box(edge, (floor + bottom) / 2, -.81, .035, bottom - floor - .16, .018, '#E53935'))
    }
    markings.push(box(x, bottom + .075, 1.263, width, .15, .014, '#181818'))
    markings.push(box(x, top - .0175, 1.279, width, .035, .014, '#c8c8c8'))
    for (const edge of [start + .015, end - .015]) markings.push(box(edge, (bottom + top) / 2, 1.279, .03, height, .014, '#c8c8c8'))
    for (let stripe = start + .075; stripe < end - .065; stripe += .17) {
      markings.push({ ...box(stripe, bottom + .075, 1.274, .055, .12, .014, '#E53935'), rotation: [0, 0, -.4] })
    }
    markings.push(
      box(x, bottom + .014, 1.285, width, .028, .016, '#E53935'),
      box(x, top + .13, -1.2, .24, .06, .12, '#E53935'),
      box(start - 2, floor + .006, 0, .12, .012, 2.5, '#77c7c3'),
      box(x, floor + .005, -1.1, width, .01, .06, '#548f91'),
      box(x, floor + .005, 1.1, width, .01, .06, '#548f91'),
    )
  }
  return { boxes, pipes, markings }
}
