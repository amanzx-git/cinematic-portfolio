import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three'
import type { Simulation } from './simulation'

export function DroneView({ sim, reducedMotion }: { sim: Simulation; reducedMotion: boolean }) {
  const fleet = useMemo(() => {
    const geometry = new BoxGeometry()
    const armor = new MeshBasicMaterial({ color: '#303030', toneMapped: false })
    const steel = new MeshBasicMaterial({ color: '#777777', toneMapped: false })
    const marker = new MeshBasicMaterial({ color: '#555555', toneMapped: false })
    const root = new Group()
    const drones = sim.drones.map(drone => {
      const group = new Group(), body = new Group()
      group.position.set(drone.encounter.x, drone.floor, 0)
      root.add(group); group.add(body)
      const optic = new MeshBasicMaterial({ color: '#a8594b', toneMapped: false })
      const beam = new MeshBasicMaterial({ color: '#738c9b', transparent: true, opacity: .045, depthWrite: false, toneMapped: false })
      const box = (parent: Group, x: number, y: number, z: number, w: number, h: number, d: number, material: MeshBasicMaterial) => {
        const mesh = new Mesh(geometry, material)
        mesh.position.set(x, y, z); mesh.scale.set(w, h, d); parent.add(mesh)
        return mesh
      }
      box(body, 0, 0, 0, .55, .24, .48, armor)
      box(body, 0, -.16, .12, .18, .1, .22, optic)
      box(body, 0, -.03, .25, .18, .07, .025, optic)
      box(body, 0, .04, 0, 1, .055, .1, steel)
      const rotors = [-.43, .43].map(x => {
        const rotor = new Group()
        rotor.position.set(x, .12, 0); body.add(rotor)
        box(rotor, 0, 0, 0, .38, .025, .05, steel)
        box(rotor, 0, 0, 0, .05, .025, .38, steel)
        return rotor
      })
      box(group, 0, drone.encounter.height / 2, 0, drone.encounter.width, drone.encounter.height, .7, beam)
      box(group, 0, .006, 0, drone.encounter.width, .012, .7, marker)
      return { drone, body, rotors, optic, beam }
    })
    return { root, drones, geometry, armor, steel, marker }
  }, [sim])
  useEffect(() => () => {
    fleet.geometry.dispose(); fleet.armor.dispose(); fleet.steel.dispose(); fleet.marker.dispose()
    fleet.drones.forEach(model => { model.optic.dispose(); model.beam.dispose() })
  }, [fleet])
  useFrame(() => {
    for (const model of fleet.drones) {
      const phase = model.drone.scanPhase
      const color = phase === 'active' ? '#E53935' : phase === 'warning' ? '#e5ae4e' : '#65b89a'
      model.beam.color.set(color)
      model.optic.color.set(color)
      model.beam.opacity = phase === 'active' ? .28 : phase === 'warning' ? .19 : .10
      model.body.position.y = model.drone.encounter.height + .28 + (reducedMotion ? 0 : Math.sin(model.drone.time * 3) * .035)
      for (const rotor of model.rotors) rotor.rotation.y = reducedMotion ? 0 : model.drone.time * 23
    }
  }, -1)
  return <primitive object={fleet.root} dispose={null} />
}
