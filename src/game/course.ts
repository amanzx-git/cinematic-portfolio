import type { StaticInstance } from '../scene/StaticInstances'
import type { PulseTiming } from './hazards.ts'

export type Platform = readonly [start: number, end: number, top: number]
export type Barrier = Readonly<{
  start: number; end: number; bottom: number; top: number
  electrical?: 'cable' | 'conduit' | 'arc'
  shape?: 'pipe'
  pulse?: PulseTiming
}>
export type DroneEncounter = Readonly<{
  id: string; x: number; triggerX: number; width: number; height: number
  timing: PulseTiming
}>

// Planned environments have no world bounds until a playable zone is authored.
export const zoneSequence = [
  { id: 'corporate', label: 'Corporate Rooftops' },
  { id: 'construction', label: 'Construction' },
  { id: 'electrical', label: 'Electrical' },
  { id: 'underground', label: 'Underground' },
  { id: 'final', label: 'Final Escape' },
] as const

export type CourseZone = {
  id: string
  environment: typeof zoneSequence[number]['id']
  start: number
  end: number
  fallY: number
  // All positions are world coordinates. Platform indices below are zone-local.
  platforms: readonly Platform[]
  takeoffs: readonly (number | null | undefined)[]
  bridges: readonly number[]
  sections: readonly (readonly [number, string])[]
  barriers: readonly Barrier[]
  // Non-colliding boxes using the existing instanced detail batch.
  decorations: readonly StaticInstance[]
  drones?: readonly DroneEncounter[]
}

/** Flatten once so collision, camera and rendering consume the same ordered surfaces. */
export function connectZones(zones: readonly CourseZone[]) {
  if (!zones.length) throw Error('A course needs at least one playable zone')
  const platforms: Platform[] = [], takeoffs: (number | null | undefined)[] = [], bridges: number[] = []
  const ids = new Set<string>()
  zones.forEach((zone, index) => {
    if (ids.has(zone.id) || !Number.isFinite(zone.start) || !Number.isFinite(zone.end) || zone.start >= zone.end ||
      (index > 0 && zones[index - 1].end !== zone.start)) throw Error('Zone bounds must be contiguous and IDs unique')
    ids.add(zone.id)
    if (!zone.platforms.length || !Number.isFinite(zone.fallY)) throw Error('A playable zone needs platforms and a fall boundary')
    const offset = platforms.length
    zone.platforms.forEach((platform, localIndex) => {
      const [start, end, top] = platform
      const previous = platforms[platforms.length - 1]
      if (![start, end, top].every(Number.isFinite) || start >= end || start < zone.start || end > zone.end ||
        (previous && start < previous[1]) || zone.fallY >= top) throw Error('Invalid zone platform bounds')
      platforms.push(platform)
      takeoffs.push(zone.takeoffs[localIndex])
    })
    for (const bridge of zone.bridges) {
      if (!Number.isInteger(bridge) || bridge < 0 || bridge >= zone.platforms.length) throw Error('Invalid local bridge index')
      bridges.push(offset + bridge)
    }
  })
  const gaps = platforms.flatMap(([start], index) => index > 0 && start > platforms[index - 1][1]
    ? [{ start: platforms[index - 1][1], end: start, fromPlatform: index - 1, toPlatform: index }] : [])
  return {
    platforms, takeoffs: takeoffs.slice(0, -1), bridges, gaps,
    sections: zones.flatMap(zone => zone.sections),
    barriers: zones.flatMap(zone => zone.barriers),
    decorations: zones.flatMap(zone => zone.decorations),
  }
}

export const courseZones: readonly CourseZone[] = [{
  id: 'corporate-rooftops', environment: 'corporate', start: -4, end: 151, fallY: -3.2,
  platforms: [
    [-4, 16, 0], [18.4, 32, 0.8], [32, 38, 0.8], [38, 53, 0.8],
    [55.5, 65, 1.4], [66.85, 94, -1.3], [96.6, 108, -0.8],
    [108, 114, -0.8], [114, 122, -0.8], [124.6, 133, -0.4], [135.5, 151, 0],
  ],
  // Undefined entries are continuous connections. Null is the authored step-off.
  takeoffs: [15.5, undefined, undefined, 52.5, null, 93.5, undefined, undefined, 121.5, 132.5],
  bridges: [2, 7],
  sections: [[0, 'Corporate approach'], [32, 'Skybridge'], [55.5, 'Impact descent'], [66.85, 'Industrial corridor'], [108, 'Scaffolding'], [124.6, 'Final escape']],
  barriers: [{ start: 81, end: 82.6, bottom: -0.1, top: 0.27 }],
  decorations: [],
}, {
  id: 'construction-site', environment: 'construction', start: 151, end: 227, fallY: -4.5,
  drones: [{ id: 'construction-scout', x: 160, triggerX: 153, width: 1.2, height: 3.4,
    timing: { active: .6, inactive: 3.4, warning: 1.4, offset: -1.4 } }],
  platforms: [[151, 170, 0], [172.2, 183, 1.1], [183, 190, 1.1], [192.3, 203, 2.2], [204.5, 227, -1.4]],
  takeoffs: [169.6, undefined, 189.7, null],
  bridges: [2],
  sections: [[151, 'Construction approach'], [172.2, 'Steelwork'], [183, 'Suspended catwalk'], [192.3, 'Upper scaffold'], [204.5, 'Construction exit']],
  barriers: [], decorations: [],
}, {
  id: 'electrical-yard', environment: 'electrical', start: 227, end: 283, fallY: -4.5,
  drones: [{ id: 'electrical-scout', x: 234, triggerX: 227.4, width: 1.2, height: 3.4,
    timing: { active: .5, inactive: 3.5, warning: .6, offset: -.6 } }],
  platforms: [[227, 245, -1.4], [245, 264, -1.4], [264, 283, -1.4]],
  takeoffs: [], bridges: [],
  sections: [[227, 'Power distribution'], [245, 'Conduit passage'], [264, 'Arc crossing']],
  barriers: [
    { start: 239, end: 239.5, bottom: -1.4, top: -1.05, electrical: 'cable' },
    { start: 253, end: 254.1, bottom: -0.2, top: 0.17, electrical: 'conduit' },
    { start: 268, end: 268.45, bottom: -1.4, top: 0.9, electrical: 'arc', pulse: { active: 1.4, inactive: 2.6, warning: 0.65, offset: 1 } },
  ],
  decorations: [],
}, {
  id: 'underground-maintenance', environment: 'underground', start: 283, end: 359, fallY: -6.5,
  platforms: [[283, 289, -1.4], [290.5, 316, -4], [318.1, 327, -3], [328.7, 332, -4], [333.4, 339, -2.7], [340.7, 359, -1.4]],
  takeoffs: [null, 315.5, null, 331.4, 338.6], bridges: [],
  sections: [[283, 'Service descent'], [290.5, 'Maintenance tunnel'], [318.1, 'Raised maintenance walkway'], [328.7, 'Service landing'], [333.4, 'Access ascent'], [340.7, 'Surface escape']],
  barriers: [{ start: 303, end: 303.8, bottom: -2.8, top: -2, shape: 'pipe' }],
  decorations: [],
}, {
  id: 'final-service-apron', environment: 'final', start: 359, end: 388, fallY: -4.5,
  platforms: [[359, 388, -1.4]], takeoffs: [], bridges: [],
  sections: [[359, 'Security pursuit'], [371, 'Final service exit']],
  barriers: [{ start: 366, end: 366.8, bottom: -.2, top: .6, shape: 'pipe' }],
  decorations: [],
}]

export function zoneAt(x: number, zones: readonly CourseZone[] = courseZones) {
  return zones.find(zone => x < zone.end) ?? zones[zones.length - 1]
}

export const course = {
  speed: 4.5, gravity: 20, jumpVelocity: 7.8, finish: 384,
  zones: courseZones,
  ...connectZones(courseZones),
}
export const barriers = course.barriers
