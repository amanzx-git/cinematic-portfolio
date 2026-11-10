import { useLayoutEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { OrthographicCamera } from 'three'
import { Atmosphere } from '../rendering/Atmosphere'
import { Rooftop } from './Rooftop'
import { Skyline } from './Skyline'

function Framing() {
  const camera = useThree(state => state.camera) as OrthographicCamera
  const size = useThree(state => state.size)
  useLayoutEffect(() => {
    // Preserve the full run surface in portrait; expand the sky vertically.
    camera.zoom = Math.min(size.width / 34, size.height / 18)
    camera.position.set(0, 5, 30)
    camera.lookAt(0, 2, 0)
    camera.updateProjectionMatrix()
  }, [camera, size])
  return null
}

export function FoundationScene({ effects }: { effects: boolean }) {
  return <>
    <Framing />
    <color attach="background" args={['#28394e']} />
    <fog attach="fog" args={['#86949e', 42, 110]} />
    <Atmosphere effects={effects} />
    <ambientLight color="#adc3dc" intensity={2.1} />
    <directionalLight color="#f1c39a" position={[-12, 8, -4]} intensity={2.1} />
    <Skyline />
    <Rooftop />
  </>
}
