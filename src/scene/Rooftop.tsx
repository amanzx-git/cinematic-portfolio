import { useEffect, useMemo } from 'react'
import { BoxGeometry, CylinderGeometry, MeshBasicMaterial, MeshStandardMaterial } from 'three'
import { StaticInstances, type StaticInstance } from './StaticInstances'

const box = (x: number, y: number, z: number, w: number, h: number, d: number): StaticInstance => ({ position: [x, y, z], scale: [w, h, d] })

function architecture() {
  const wall = [box(0, -3.1, 0, 28, 6, 3)]
  const concrete = [box(0, 0, 0, 28.4, 0.22, 3.4), box(0, -0.2, 1.59, 28.15, 0.1, 0.08), box(0, -4.8, 1.59, 28, 0.16, 0.12)]
  const steel = [box(0, -0.32, 1.6, 28.2, 0.08, 0.1), box(0, 0, -2.4, 27.6, 0.15, 1.3)]
  const accents = [box(-5, -0.1, 1.72, 12, 0.018, 0.015)]
  const panels: StaticInstance[] = []
  const pipes: StaticInstance[] = []
  const foreground = [box(0, -5.7, 2.8, 34, 0.35, 0.35), box(0, -40.9, 2.7, 240, 70, 0.3)]
  for (let i = 0; i < 28; i++) {
    panels.push({ ...box(-13.5 + i, -2.6, 1.515, 0.96, 4.2, 0.02), tint: ['#182a37', '#1b2e3a', '#1c2f3c', '#1a2c39'][i % 4] })
    concrete.push(box(-13.6 + i, 0.115, 0, 0.012, 0.008, 3.35))
  }
  // Service equipment sits behind z=-1.7, outside the clear rooftop corridor.
  for (const x of [-11.8, 11.5]) {
    concrete.push(box(x, 0.12, -2.4, 1.7, 0.12, 1.2))
    steel.push(box(x, 0.52, -2.4, 1.4, 0.7, 0.85), box(x, 0.91, -2.4, 1.6, 0.1, 1))
    for (let j = 0; j < 5; j++) accents.push(box(x - 0.5 + j * 0.25, 0.53, -1.96, 0.035, 0.38, 0.025))
  }
  // Low railings at the rear corners leave the center and front roofline open.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) steel.push(box(side * (9 + i), 0.65, -3, 0.045, 1.25, 0.045))
    steel.push(box(side * 11, 1.27, -3, 4.1, 0.055, 0.055), box(side * 11, 0.65, -3, 4.1, 0.035, 0.035))
    pipes.push(box(side * 13.4, -2.2, 1.73, 0.06, 4.4, 0.06))
    pipes.push({ ...box(side * 12.85, -4.35, 1.73, 0.06, 1.1, 0.06), rotation: [0, 0, Math.PI / 2] })
    // Foreground brackets stay below the future character's feet.
    foreground.push({ ...box(side * 13.8, -5.05, 2.5, 0.16, 1.4, 0.16), rotation: [0, 0, side * 0.65] })
  }
  // Rear communications mast and two crossbars; no moving parts.
  steel.push(box(12.8, 2, -3.1, 0.045, 3.8, 0.045), box(12.8, 3.35, -3.1, 1.4, 0.045, 0.045), box(12.8, 2.7, -3.1, 0.9, 0.04, 0.04))
  for (let i = 0; i < 4; i++) steel.push(box(12.3 + i * 0.33, 3.35, -3.1, 0.025, 0.5, 0.025))
  // Small facade openings and their recessed lintels, combined into existing batches.
  for (const x of [-8.5, -2.5, 3.5, 9.5]) {
    foreground.push(box(x, -2, 1.56, 2.1, 0.8, 0.04))
    concrete.push(box(x, -1.54, 1.62, 2.3, 0.1, 0.16))
    accents.push(box(x, -1.72, 1.59, 1.8, 0.022, 0.02))
    for (let j = 0; j < 5; j++) steel.push(box(x, -1.83 - j * 0.12, 1.6, 1.8, 0.022, 0.03))
  }
  return { wall, concrete, steel, accents, panels, pipes, foreground }
}

export function Rooftop() {
  const resources = useMemo(() => ({
    box: new BoxGeometry(),
    pipe: new CylinderGeometry(1, 1, 1, 8),
    wall: new MeshStandardMaterial({ color: '#354654', roughness: 1 }),
    concrete: new MeshStandardMaterial({ color: '#899095', roughness: 0.9 }),
    steel: new MeshStandardMaterial({ color: '#566572', roughness: 0.8 }),
    accents: new MeshBasicMaterial({ color: '#927b63' }),
    panels: new MeshBasicMaterial({ color: '#ffffff' }),
    foreground: new MeshBasicMaterial({ color: '#0d1c29' }),
  }), [])
  const parts = useMemo(architecture, [])
  useEffect(() => () => { Object.values(resources).forEach(resource => resource.dispose()) }, [resources])
  return <>
    {(['wall', 'concrete', 'steel', 'accents', 'panels', 'foreground'] as const).map(part =>
      <StaticInstances key={part} geometry={resources.box} material={resources[part]} instances={parts[part]} />)}
    <StaticInstances geometry={resources.pipe} material={resources.steel} instances={parts.pipes} />
  </>
}
