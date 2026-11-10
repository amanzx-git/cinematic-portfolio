import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import { color, mix, screenSize, screenUV, sin, smoothstep, uniform } from 'three/tsl'

export function Atmosphere({ effects }: { effects: boolean }) {
  const sky = useMemo(() => {
    const phase = uniform(0)
    const material = new MeshBasicNodeMaterial({ depthWrite: false, fog: false, toneMapped: false })
    const baseline = new MeshBasicNodeMaterial({ depthWrite: false, fog: false, toneMapped: false })
    const height = screenUV.y.oneMinus()
    const lowerSky = mix(color('#c19a85'), color('#435d76'), smoothstep(0.08, 0.85, height))
    const gradient = mix(lowerSky, color('#15283f'), smoothstep(0.55, 1, height))
    const dx = screenUV.x.sub(0.29).mul(screenSize.x.div(screenSize.y))
    const dy = height.sub(0.47)
    const radiusSquared = dx.mul(dx).add(dy.mul(dy))
    // An aspect-correct soft horizon glow and small sun, all in the sky's single draw.
    const glow = smoothstep(0, 0.55, radiusSquared).oneMinus().mul(0.38)
    const sun = smoothstep(0.0015, 0.002, radiusSquared).oneMinus().mul(0.65)
    const litSky = mix(mix(gradient, color('#d4a182'), glow), color('#e4c7a0'), sun)
    // Two broad waves; no noise textures, loops, transparency or extra pass.
    const drift = sin(screenUV.x.mul(12).add(height.mul(22)).add(phase))
      .mul(sin(height.mul(30).sub(phase.mul(0.3)))).mul(0.002)
      .mul(smoothstep(0.25, 0.8, height))
    material.colorNode = litSky.add(drift)
    baseline.colorNode = litSky
    return { material, baseline, phase }
  }, [])
  useEffect(() => () => { sky.material.dispose(); sky.baseline.dispose() }, [sky])
  useFrame(({ clock }) => { sky.phase.value = clock.elapsedTime * 0.035 })
  return <mesh position={[0, 0, -65]} renderOrder={-1} frustumCulled={false} material={effects ? sky.material : sky.baseline}>
    <planeGeometry args={[240, 180]} />
  </mesh>
}
