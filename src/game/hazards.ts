export type PulseTiming = Readonly<{ active: number; inactive: number; warning: number; offset: number }>
export type HazardState = 'active' | 'warning' | 'inactive'

export function hazardState(pulse: PulseTiming | undefined, time: number): HazardState {
  if (!pulse) return 'active'
  const period = pulse.active + pulse.inactive
  const phase = ((time + pulse.offset) % period + period) % period
  if (phase < pulse.active) return 'active'
  return phase >= period - pulse.warning ? 'warning' : 'inactive'
}

/** Intersect a swept contact with the active portion of this fixed simulation tick. */
export function activeHazardInterval(pulse: PulseTiming | undefined, time: number, enter: number, exit: number): readonly [number, number] | null {
  if (!pulse) return [enter, exit]
  const period = pulse.active + pulse.inactive
  const phase = ((time + enter + pulse.offset) % period + period) % period
  const start = phase < pulse.active ? enter : enter + period - phase
  const end = phase < pulse.active ? Math.min(exit, enter + pulse.active - phase) : Math.min(exit, start + pulse.active)
  return start < end ? [start, end] : null
}
