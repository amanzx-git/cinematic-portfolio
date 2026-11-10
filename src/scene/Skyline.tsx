import { useEffect, useMemo } from 'react'
import { BoxGeometry, MeshBasicMaterial } from 'three'
import { StaticInstances, type StaticInstance } from './StaticInstances'

type Tower = [x: number, width: number, height: number, crown?: 'step' | 'spire' | 'plant']
// Authored rhythms: left industrial cluster, central breathing room, right landmark.
// Silhouette components share one draw per layer, including crowns and aerials.
const districts: { depth: number; tint: string; towers: Tower[] }[] = [
  { depth: -42, tint: '#87929b', towers: [
    [-24, 5, 6], [-19, 3.8, 7.2, 'plant'], [-15.5, 2.7, 9.1, 'step'],
    [-12, 3.8, 8.2], [-8.5, 2.1, 11, 'spire'], [-5.3, 3.4, 6.2],
    [-1.5, 4, 5.4], [2.5, 3.6, 6.8, 'step'], [6.7, 2.8, 10.2, 'step'],
    [10, 3.3, 8.8], [13.8, 3.7, 7.1, 'plant'], [18.5, 5, 6.3], [24, 5, 7],
  ] },
  { depth: -26, tint: '#526779', towers: [
    [-24, 6, 7.1], [-18, 5, 8.7, 'plant'], [-13.8, 3.4, 9.6, 'step'],
    [-10.5, 3, 7.5], [-6.8, 4.1, 4.7, 'plant'], [-2.1, 5.3, 3.8],
    [3.1, 4.6, 4.8], [7.2, 3.1, 6.5, 'plant'], [11, 3.2, 8.5, 'step'],
    [15.7, 5.2, 7.6], [21, 5, 6.2],
  ] },
  { depth: -12, tint: '#283e50', towers: [
    [-22, 5, 7.3], [-17.7, 4, 10.3, 'plant'], [-13.5, 4, 6.5],
    [-8.4, 5.5, 4], [-2, 7, 3.3], [5, 5.4, 3.9],
    [10.2, 4, 5.2], [15.1, 4.6, 9, 'plant'], [20.5, 5.3, 7],
  ] },
]

function compose(towers: Tower[], depth: number): StaticInstance[] {
  const boxes: StaticInstance[] = []
  for (const [x, width, height, crown] of towers) {
    const top = -7.5 + height
    boxes.push({ position: [x, -7.5 + height / 2, depth], scale: [width, height, 0.6] })
    if (crown === 'step' || crown === 'spire') {
      boxes.push({ position: [x, top + 0.45, depth], scale: [width * 0.68, 0.9, 0.6] })
      boxes.push({ position: [x, top + 1.12, depth], scale: [width * 0.4, 0.45, 0.6] })
    }
    if (crown === 'spire') boxes.push({ position: [x, top + 2, depth], scale: [0.045, 1.4, 0.045] })
    if (crown === 'plant') {
      boxes.push({ position: [x - width * 0.18, top + 0.25, depth], scale: [width * 0.45, 0.5, 0.6] })
      boxes.push({ position: [x + width * 0.24, top + 0.65, depth], scale: [0.16, 1.3, 0.2] })
    }
  }
  return boxes
}

export function Skyline() {
  const layers = useMemo(() => districts.map(district => ({
    instances: compose(district.towers, district.depth),
    // Authored colors provide predictable atmospheric contrast without extra passes.
    material: new MeshBasicMaterial({ color: district.tint, fog: false }),
  })), [])
  const geometry = useMemo(() => new BoxGeometry(), [])
  useEffect(() => () => { geometry.dispose(); layers.forEach(layer => layer.material.dispose()) }, [geometry, layers])
  return <>{layers.map((layer, index) => <StaticInstances key={index} geometry={geometry} {...layer} />)}</>
}
