import { course, type Platform } from './simulation.ts'
import { zoneAt } from './course.ts'
import type { StaticInstance } from '../scene/StaticInstances'

export const CITY_TILE_WIDTH = 48

type Profile = 'slab' | 'setback' | 'split' | 'terrace' | 'plant'
type Tower = readonly [x: number, width: number, height: number, profile: Profile]
type District = {
  depth: number
  base: number
  rate: number
  color: string
  windows: string
  detail: number
  towers: readonly Tower[]
}

// Each district has its own roofline and spacing. Only whole districts repeat.
export const CITY_LAYERS: readonly District[] = [
  { depth: -38, base: -12, rate: 0.08, color: '#b0c8d8', windows: '#afa18a', detail: 0, towers: [
    [-22, 3.2, 8, 'slab'], [-18, 3, 9.9, 'setback'], [-14.5, 2.8, 7.7, 'slab'],
    [-11, 3.5, 9.2, 'split'], [-6.5, 4.1, 8.7, 'terrace'], [-1.7, 4.6, 9.1, 'split'],
    [3.5, 3.3, 9, 'setback'], [7.5, 3.4, 8.2, 'slab'], [12, 4.2, 9.7, 'terrace'],
    [17, 4.3, 7.5, 'plant'], [22, 3.1, 8.6, 'setback'],
  ] },
  { depth: -23, base: -8, rate: 0.18, color: '#8ea9bc', windows: '#c0a37a', detail: 1, towers: [
    [-21, 5.2, 5.4, 'terrace'], [-15.6, 3.4, 10.5, 'setback'], [-11, 4.9, 6.7, 'split'],
    [-5.2, 5.4, 5.9, 'plant'], [0.6, 4.7, 6.7, 'setback'], [6, 4.8, 9.8, 'split'],
    [11.1, 3.9, 5.7, 'terrace'], [16, 4.2, 10.3, 'setback'], [21.3, 4.5, 5.6, 'plant'],
  ] },
  { depth: -11, base: -5.2, rate: 0.34, color: '#6d8d9f', windows: '#b3946d', detail: 2, towers: [
    [-21, 5.5, 4.8, 'split'], [-14, 6.2, 5.2, 'plant'], [-6.2, 6.5, 3.5, 'terrace'],
    [1.1, 5.6, 4.45, 'plant'], [7.6, 5.5, 4.4, 'setback'], [14.4, 5.2, 5.6, 'split'],
    [21, 5.2, 4.5, 'terrace'],
  ] },
]

const box = (x: number, y: number, z: number, w: number, h: number, d: number, tint?: string): StaticInstance => ({
  position: [x, y, z], scale: [w, h, d], tint,
})

// Section coordinates are fractions of the tower's width and height.
const sections: Record<Profile, readonly (readonly [x: number, bottom: number, width: number, height: number])[]> = {
  slab: [[0, 0, 1, 0.93], [-0.12, 0.93, 0.7, 0.07]],
  setback: [[0, 0, 1, 0.56], [0.08, 0.56, 0.76, 0.29], [0.17, 0.85, 0.46, 0.15]],
  split: [[0, 0, 1, 0.35], [-0.25, 0.35, 0.46, 0.65], [0.26, 0.35, 0.4, 0.47]],
  terrace: [[0, 0, 1, 0.53], [-0.14, 0.53, 0.72, 0.27], [-0.28, 0.8, 0.43, 0.2]],
  plant: [[0, 0, 1, 0.86], [-0.26, 0.86, 0.38, 0.14], [0.24, 0.86, 0.29, 0.08]],
}

export function cityInstances(layer: District) {
  const bodies: StaticInstance[] = []
  const windows: StaticInstance[] = []
  for (const tile of [-1, 0, 1]) {
    layer.towers.forEach(([localX, width, height, profile], index) => {
      const x = localX + tile * CITY_TILE_WIDTH
      const depth = layer.depth
      for (const [offset, bottom, widthRatio, heightRatio] of sections[profile]) {
        const sectionX = x + offset * width
        const widthM = width * widthRatio
        const heightM = height * heightRatio
        const base = layer.base + bottom * height
        const top = base + heightM
        bodies.push(box(sectionX, base + heightM / 2, depth, widthM, heightM, 0.9, bottom ? '#cbcbcb' : '#ffffff'))
        if (layer.detail && heightM > 1) {
          // Dark glazing sits between projecting side piers and below a coping.
          bodies.push(box(sectionX, base + heightM / 2, depth + 0.46, widthM * 0.8, heightM - 0.22, 0.035, '#9b9b9b'))
          for (const side of [-1, 1]) {
            bodies.push(box(sectionX + side * widthM * 0.44, base + heightM / 2, depth + 0.52, widthM * 0.095, heightM, 0.16, '#dcdcdc'))
          }
          bodies.push(box(sectionX, top - 0.045, depth + 0.52, widthM, 0.09, 0.19, '#e0e0e0'))
        }
      }
      if (profile === 'setback' && index % 2 === 1) {
        bodies.push(box(x + 0.17 * width, layer.base + height + 0.37, depth, 0.04, 0.74, 0.04, '#d6d6d6'))
        bodies.push(box(x + 0.17 * width, layer.base + height + 0.56, depth, 0.32, 0.025, 0.035, '#b1b1b1'))
      }
    })
  }
  return { bodies, windows }
}

export function rooftopInstances(platforms: readonly Platform[]) {
  const facade: StaticInstance[] = [], surfaces: StaticInstance[] = [], trim: StaticInstance[] = []
  const details: StaticInstance[] = [], windows: StaticInstance[] = [], pipes: StaticInstance[] = []
  const vents: StaticInstance[] = []
  const shaftLights: StaticInstance[] = []
  for (const [index, [start, end, top]] of platforms.entries()) {
    const batches = [facade, surfaces, trim, details, windows, pipes, vents]
    const offsets = batches.map(batch => batch.length)
    const center = (start + end) / 2
    const width = end - start
    if (zoneAt(center).environment === 'underground') {
      const enclosed = start >= 290 && end <= 327
      const wallHeight = enclosed ? 5 : start < 290 ? 2.5 : 1.4
      surfaces.push(box(center, top - .12, 0, width, .24, 2.8, '#b7b7b7'))
      facade.push(box(center, top - 1.6, 0, width, 2.96, 2.8, '#7f7f7f'))
      facade.push(box(center, top + wallHeight / 2 - .3, -2.9, width, wallHeight, .35, '#898989'))
      if (enclosed) facade.push(box(center, top + 4.05, -.15, width, .35, 5.2, '#919191'))
      for (const z of [-1.18, 1.18]) {
        trim.push(box(center, top - .025, z, width, .05, .16, '#636363'))
        for (let x = start + .2; x < end; x += .45) vents.push(box(x, top + .002, z, .02, .004, .14))
      }
      for (let x = start + 1.3; x < end - 1.2; x += 4.5) {
        details.push(box(x, top + 1.8, -2.45, .25, 3.6, .4, '#a5a5a5'))
        details.push(box(x, top + 3.8, -.2, .25, .28, 4.5, '#a3a3a3'))
        windows.push(box(x + .35, top + 2.55, -2.21, .28, .12, .05, '#d3d3d3'))
        details.push(box(x + .5, top + 1.35, -2.3, 1.3, .13, .3, '#a8a8a8'))
        if (enclosed) {
          details.push(box(x + .5, top + 2.8, -2.15, 1.1, .5, .45, '#afafaf'))
          vents.push(box(x + .5, top + 2.8, -1.91, .85, .32, .02))
          for (const angle of [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]) {
            details.push({ ...box(x + .5, top + 2.8, -1.88, .65, .065, .025, '#808080'), rotation: [0, 0, angle] })
          }
          // Static steam wisps sit against the rear wall, away from the body lane.
          for (let wisp = 0; wisp < 3; wisp++) details.push(box(x + .6 + wisp * .08, top + .5 + wisp * .22, -2.2, .16 + wisp * .05, .07, .06, '#c2c2c2'))
          shaftLights.push(box(x - .45, top + 2, -2.65, .34, 3.4, .04, '#626262'))
        }
      }
      if (enclosed) pipes.push({ position: [center, top + 2.05, -2.1], scale: [.17, width - .6, .17], rotation: [0, 0, Math.PI / 2], tint: '#b8b8b8' })
      continue
    }
    if (zoneAt(center).environment === 'electrical') {
      surfaces.push(box(center, top - .12, 0, width, .24, 2.8, '#a8a8a8'))
      facade.push(box(center, top - 2.15, 0, width, 4.06, 2.8, '#747474'))
      trim.push(box(center, top - .28, 1.4, width, .24, .14, '#979797'))
      for (let x = start + 1.5; x < end - 1.8; x += 4.5) {
        details.push(box(x, top + .65, -1.95, 1.2, 1.3, .7, '#a2a2a2'))
        vents.push(box(x, top + .65, -1.58, .8, .75, .025))
        details.push(box(x + .35, top + 1.38, -1.92, .32, .15, .5, '#5a5a5a'))
        windows.push(box(x - .33, top + 1.12, -1.57, .1, .1, .03, '#d6d6d6'))
        details.push(box(x, top + 1.8, -3, .18, 3.6, .18, '#696969'))
        details.push(box(x, top + 3.5, -3, 2.3, .16, .2, '#828282'))
        pipes.push({ position: [x, top + .23, -1.65], scale: [.09, 2.7, .09], rotation: [0, 0, Math.PI / 2], tint: '#b3b3b3' })
      }
      continue
    }
    if (zoneAt(center).environment === 'construction') {
      surfaces.push(box(center, top - .1, 0, width, .2, 2.8, '#ffffff'))
      for (const z of [-1.36, 1.36]) {
        trim.push(box(center, top - .27, z, width, .3, .16, '#555555'))
        for (let x = start + .7; x < end - .6; x += 5.5) {
          facade.push(box(x, top - 2.1, z, .24, 4, .24, '#ffffff'))
        }
      }
      details.push(box(center, top + .72, -1.46, width - .8, .06, .06, '#444444'))
      for (const x of [start + .8, end - .8]) {
        details.push(box(x, top + .36, -1.46, .06, .72, .06, '#444444'))
        facade.push(box(x, top + 1.8, -3.4, .22, 3.6, .24, '#ffffff'))
      }
      facade.push(box(center, top + 3.5, -3.4, width - 1.4, .22, .24, '#ffffff'))
      for (const edge of [start + .1, end - .1]) {
        trim.push(box(edge, top - .045, 0, .2, .09, 2.8, '#ffffff'))
      }
      continue
    }
    if (course.bridges.includes(index)) {
      surfaces.push(box(center, top - 0.11, 0, width, 0.22, 2.8, '#797979'))
      for (const z of [-1.32, 1.32]) {
        trim.push(box(center, top - 0.32, z, width + 0.3, 0.42, 0.14, '#8d8d8d'))
        details.push(box(center, top + 0.68, z, width, 0.07, 0.07))
        for (let x = start; x <= end + 0.01; x += 1.5) {
          details.push(box(x, top + 0.34, z, 0.055, 0.68, 0.055))
          details.push(box(x, top - 1.25, z, 0.12, 2.1, 0.12))
          details.push(box(x + 0.5, top - 0.85, z, 1.2, 0.075, 0.075, '#969696'))
        }
      }
      for (let x = start + 0.15; x < end; x += 0.24) {
        vents.push(box(x, top + 0.002, 0, 0.025, 0.004, 2.45))
      }
      continue
    }
    facade.push(box(center, -4.11, 0, width, 7.78, 2.8))
    surfaces.push(box(center, -0.11, 0, width, 0.22, 2.8, ['#f1f1f1', '#e7e7e7', '#eeeeee'][index % 3]))
    // Broad concrete cornice and a recessed belt below the roof skin.
    trim.push(box(center, -0.25, 1.41, width, 0.32, 0.14, '#b0b0b0'))
    trim.push(box(center, -0.57, 1.41, width, 0.075, 0.1, '#727272'))
    for (const edge of [start + 0.065, end - 0.065]) {
      trim.push(box(edge, -0.295, 0, 0.13, 0.15, 2.8, '#dfdfdf'))
    }
    // Parapets and utility details are at the back and set away from either edge.
    trim.push(box(center, 0.15, -1.31, width - 1.1, 0.3, 0.17, '#848484'))
    trim.push(box(center, 0.31, -1.31, width - 1.1, 0.045, 0.21, '#cbcbcb'))
    for (let x = start + 0.85, bay = 0; x < end - 0.8; x += 1.65, bay++) {
      details.push(box(x, -2.68, 1.44, 0.19, 4.4, 0.18, '#cacaca'))
      vents.push(box(x + 0.38, -1.05, 1.406, 0.58, 0.64, 0.035))
      if (bay % 4 !== 2) {
        windows.push(box(x + 0.38, -1.0, 1.43, bay % 3 === 0 ? 0.44 : 0.3, 0.09, 0.015,
          bay % 3 === 1 ? '#a4a4a4' : '#f2f2f2'))
      }
      trim.push(box(x + 0.38, -0.69, 1.44, 0.63, 0.065, 0.15, '#939393'))
    }
    for (const x of width >= 9 ? [start + 1.8, end - 2.9] : [center]) {
      details.push(box(x, 0.075, -0.99, 1.23, 0.15, 0.63, '#818181'))
      details.push(box(x, 0.37, -1.03, 0.97, 0.48, 0.52, '#c6c6c6'))
      details.push(box(x, 0.62, -1.03, 1.08, 0.055, 0.58, '#eaeaea'))
      vents.push(box(x, 0.37, -0.755, 0.76, 0.34, 0.026))
      for (let slat = 0; slat < 5; slat++) {
        details.push(box(x, 0.245 + slat * 0.056, -0.731, 0.72, 0.015, 0.024, '#bcbcbc'))
      }
      // Rear drain grates sit just above the roof skin to avoid coplanar faces.
      for (let slot = 0; slot < 4; slot++) vents.push(box(x + 0.77 + slot * 0.045, 0.001, -1.14, 0.02, 0.002, 0.19))
      pipes.push({ position: [x + 0.72, 0.21, -1.18], scale: [0.047, 0.42, 0.047] })
      pipes.push({ position: [x + 0.72, 0.43, -1.04], scale: [0.047, 0.3, 0.047], rotation: [Math.PI / 2, 0, 0] })
    }
    // Selective moonlit caps rather than a bright stripe across the whole roof.
    for (const x of [start + 0.43, end - 0.43]) {
      trim.push(box(x, -0.035, 1.405, 0.7, 0.05, 0.055, '#eaeaea'))
    }
    if (top >= 2) {
      details.push(box(center, 0.52, -1.47, width - 1.4, 1.04, 0.66, '#898989'))
      trim.push(box(center, 1.08, -1.47, width - 1.35, 0.08, 0.72, '#c4c4c4'))
      pipes.push({ position: [center + 0.7, 1.62, -1.55], scale: [0.025, 1.05, 0.025] })
    }
    // Rear communication masts and steel frames stay outside the body lane.
    if (index % 3 === 1) {
      pipes.push({ position: [start + 2, 1.5, -1.65], scale: [0.055, 3, 0.055] })
      details.push(box(start + 2, 2.45, -1.65, 0.8, 0.055, 0.055))
      details.push(box(start + 2.22, 2.1, -1.65, 0.07, 0.85, 0.07))
    }
    if (index === 5) {
      // Pipe corridor leaves an open approach, then a single timed low duct.
      for (const x of [start + 3, start + 8, end - 3]) {
        details.push(box(x, 1.55, -1.6, 0.18, 3.1, 0.18))
        details.push(box(x, 3.1, -1.6, 1.9, 0.14, 0.16))
      }
      pipes.push({ position: [center, 2.55, -1.65], scale: [0.16, width - 2, 0.16], rotation: [0, 0, Math.PI / 2] })
    }
    if (index === 8 || index === 9) {
      // Rear scaffolding bays are grounded on roof and facade.
      for (let x = start + 0.7; x < end - 0.4; x += 2) {
        details.push(box(x, 0.6, -1.6, 0.09, 3.6, 0.09, '#a6a6a6'))
        details.push(box(x + 0.7, 1.8, -1.6, 1.5, 0.09, 0.65, '#8d8d8d'))
        details.push(box(x + 0.7, 0.6, -1.6, 1.5, 0.06, 0.06))
      }
    }
    if (index === 10) {
      details.push(box(center, 0.75, -1.44, width - 1.2, 1.5, 0.5, '#c1c1c1'))
      trim.push(box(center, 1.53, -1.44, width - 1.05, 0.06, 0.57, '#e6e6e6'))
      for (const x of [center - 2.4, center + 2.4]) {
        vents.push(box(x, 0.84, -1.175, 1.8, 0.45, 0.022))
      }
    }
    batches.forEach((batch, i) => {
      for (let j = offsets[i]; j < batch.length; j++) batch[j].position[1] += top
    })
  }
  return { facade, surfaces, trim, details, windows, pipes, vents, shaftLights }
}
export function constructionScenery(): StaticInstance[] {
  const instances: StaticInstance[] = []
  for (const zone of course.zones.filter(zone => zone.environment === 'construction')) {
    const x = zone.start + 32
    instances.push(
      box(x, -2.7, -9, .5, 10.6, .5, '#777777'),
      box(x + 4, 2.5, -9, 23, .28, .3, '#777777'),
    )
  }
  return instances
}
// Track travel continuously but ignore the camera's intentional restart teleport.
// Repeated tiles make modulo wrapping seamless for arbitrarily many restarts.
export class CityParallax {
  travel = 0
  previousCamera = 0
  resetVersion = -1
  update(cameraX: number, resetVersion: number, reducedMotion = false) {
    if(this.resetVersion===resetVersion && !reducedMotion) this.travel += cameraX-this.previousCamera
    this.resetVersion=resetVersion; this.previousCamera=cameraX
  }
  offset(cameraX: number, rate: number) {
    const phase=((this.travel*rate)%CITY_TILE_WIDTH+CITY_TILE_WIDTH)%CITY_TILE_WIDTH
    return cameraX-phase
  }
}
