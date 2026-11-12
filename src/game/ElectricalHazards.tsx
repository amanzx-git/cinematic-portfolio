import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group, MeshBasicMaterial } from 'three'
import { barriers, type Simulation } from './simulation'
import type { Barrier } from './course'
import { hazardState } from './hazards'

function ElectricalHazard({ barrier, sim, animated }: { barrier: Barrier; sim: Simulation; animated: boolean }) {
  const core = useRef<MeshBasicMaterial>(null)
  const indicator = useRef<MeshBasicMaterial>(null)
  const sparks = useRef<Group>(null)
  const discharge = useRef<Group>(null)
  const width = barrier.end - barrier.start, height = barrier.top - barrier.bottom
  const center = (barrier.start + barrier.end) / 2
  const arc = barrier.electrical === 'arc'
  const slide = barrier.electrical === 'conduit'
  useFrame(() => {
    const state = hazardState(barrier.pulse, sim.hazardTime)
    if (core.current) {
      core.current.color.set(state === 'active' ? (arc ? '#E53935' : '#444444') : state === 'warning' ? '#d4a566' : '#888888')
      core.current.opacity = state === 'active' ? 1 : .45
    }
    indicator.current!.color.set(slide ? '#E53935' : state === 'active' ? '#E53935' : state === 'warning' ? '#ffc078' : '#78aaac')
    sparks.current!.visible = animated && state === 'active'
    if (discharge.current) discharge.current.visible = state === 'active'
    sparks.current!.position.y = Math.sin(sim.hazardTime * 11) * .035
  }, -1)
  return <group>
    {!slide && <mesh position={[center, (barrier.bottom + barrier.top) / 2, 0]}>
      <boxGeometry args={[width, height, 2.5]} />
      <meshBasicMaterial ref={core} color="#444444" toneMapped={false} wireframe={arc} transparent />
    </mesh>}
    {!arc && !slide && <mesh position={[center, barrier.top - .0125, 0]}>
      <boxGeometry args={[width, .025, 2.5]} /><meshBasicMaterial color="#E53935" toneMapped={false} />
    </mesh>}
    {/* Floor bands mark the exact swept hazard footprint even during inactive phases. */}
    {!slide && <mesh position={[center, -1.395, 0]}>
      <boxGeometry args={[width, .01, 2.6]} /><meshBasicMaterial color="#666666" toneMapped={false} />
    </mesh>}
    {!arc && !slide && <mesh position={[barrier.start - 1.5, -1.39, 0]}>
      <boxGeometry args={[.12, .012, 2.5]} /><meshBasicMaterial color={barrier.electrical === 'cable' ? '#e6be7f' : '#77c7c3'} toneMapped={false} />
    </mesh>}
    <mesh position={[center, barrier.top + .25, -1.55]}>
      <boxGeometry args={[.28, .12, .12]} /><meshBasicMaterial ref={indicator} color="#E53935" toneMapped={false} />
    </mesh>
    {!slide && [-1.5, 1.5].map(z => <mesh key={z} position={[center, -.3, z]}>
      <boxGeometry args={[.13, 2.2, .13]} /><meshBasicMaterial color="#666666" toneMapped={false} />
    </mesh>)}
    {arc && <group ref={discharge}>
      {[0, 1, 2, 3].map(index => <mesh key={index} position={[center, barrier.bottom + height * (index + .5) / 4, 0]} rotation={[0, 0, index % 2 ? .3 : -.3]}>
        <boxGeometry args={[.035, height / 4, 2.4]} /><meshBasicMaterial color="#E53935" toneMapped={false} />
      </mesh>)}
    </group>}
    <group ref={sparks}>
      {[-.8, -.25, .3, .85].map((z, index) => <mesh key={z} position={[center, barrier.top + .04, z]} rotation={[0, 0, index % 2 ? .6 : -.6]}>
        <boxGeometry args={[.025, .13, .025]} /><meshBasicMaterial color="#E53935" toneMapped={false} />
      </mesh>)}
    </group>
  </group>
}

export function ElectricalHazards({ sim, animated }: { sim: Simulation; animated: boolean }) {
  return <>{barriers.filter(barrier => barrier.electrical).map(barrier =>
    <ElectricalHazard key={barrier.start} barrier={barrier} sim={sim} animated={animated} />)}</>
}
