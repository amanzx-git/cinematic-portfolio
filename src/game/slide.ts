// G2.3 canonical skin heights from stage_runner_slide.py, sampled at 120 Hz.
export const STANDING_HEIGHT = 1.8
export const SLIDE_HEIGHT = 0.8
const keyRate = 30
// 30 Hz upper envelope with 1 cm padding and standing endpoints for the blends.
const heights = [
  1.8, 1.8, 1.8, 1.704, 1.651, 1.567, 1.454, 1.324,
  1.19, 1.051, 0.929, 0.834, 0.8, 0.8, 0.8, 0.8,
  0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.804,
  0.908, 1.016, 1.101, 1.171, 1.227, 1.26, 1.29, 1.32,
  1.351, 1.385, 1.422, 1.462, 1.501, 1.539, 1.575, 1.608,
  1.633, 1.651, 1.665, 1.675, 1.8, 1.8, 1.8,
]
export const SLIDE_DURATION = (heights.length - 1) / keyRate
export function slideHeightAt(time: number) {
  const frame = Math.min(heights.length - 1, Math.max(0, time * keyRate))
  const index = Math.floor(frame)
  const start = heights[index]
  return start + ((heights[index + 1] ?? start) - start) * (frame - index)
}
