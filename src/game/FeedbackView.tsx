import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CircleGeometry, Color, InstancedMesh, MeshBasicMaterial, Object3D } from 'three'
import { MovementFeedback, PUFF_COUNT } from './feedback'

export function FeedbackView({ feedback, stage, enabled }: {
  enabled: boolean
  feedback: MovementFeedback
  stage: React.RefObject<HTMLDivElement | null>
}) {
  const mesh = useRef<InstancedMesh>(null)
  const resources = useMemo(() => ({
    geometry: new CircleGeometry(1, 6),
    material: new MeshBasicMaterial({ transparent: true, opacity: 0.12, depthWrite: false, toneMapped: false }),
    transform: new Object3D(),
    colors: { land: new Color('#aaaaaa'), slide: new Color('#888888'), failure: new Color('#bc927a'), finish: new Color('#c5af7c') },
  }), [])
  useEffect(() => {
    const object = mesh.current
    return () => {
      feedback.clear()
      resources.geometry.dispose()
      resources.material.dispose()
      object?.dispose()
      stage.current?.style.removeProperty('--impact-opacity')
    }
  }, [resources, stage, feedback])
  useFrame(() => {
    const object = mesh.current
    if (!object) return
    object.visible = enabled
    feedback.particles.forEach((puff, i) => {
      const size = puff.age < puff.life ? puff.size * (1 - puff.age / puff.life) : 0
      resources.transform.position.set(puff.x + puff.vx * puff.age, puff.y + puff.vy * puff.age, 0.4)
      resources.transform.scale.setScalar(size)
      resources.transform.updateMatrix()
      object.setMatrixAt(i, resources.transform.matrix)
      object.setColorAt(i, resources.colors[puff.kind])
    })
    object.instanceMatrix.needsUpdate = true
    if (object.instanceColor) object.instanceColor.needsUpdate = true
    stage.current?.style.setProperty('--impact-opacity', String(feedback.failurePulse / 0.18 * 0.22))
  }, -1.5)
  return <instancedMesh ref={mesh} args={[resources.geometry, resources.material, PUFF_COUNT]} frustumCulled={false} dispose={null} />
}
