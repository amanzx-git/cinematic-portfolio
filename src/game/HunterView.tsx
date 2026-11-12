import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { STEP, type Simulation } from './simulation'
import { SecurityRobot } from './security-robot'

export function HunterView({ sim, asset, reducedMotion }: { sim: Simulation; asset: GLTF; reducedMotion: boolean }) {
  const model = useMemo(() => new SecurityRobot(asset), [asset])
  useEffect(() => () => model.dispose(), [model])
  useFrame(() => model.update(sim.hunter, sim.restarts, Math.max(0, sim.accumulator / STEP), reducedMotion, sim.x), -1)
  return <primitive object={model.root} dispose={null} />
}
