import { useEffect, useLayoutEffect, useRef } from 'react'
import { Color, InstancedMesh, Object3D, type BufferGeometry, type Material } from 'three'

export type StaticInstance = {
  position: [number, number, number]
  scale: [number, number, number]
  rotation?: [number, number, number]
  tint?: string
}

// Transforms and optional color variation are uploaded only when the batch changes.
// Geometry/material ownership stays with the caller so batches can share resources.
export function StaticInstances({ instances, geometry, material }: {
  instances: StaticInstance[]; geometry: BufferGeometry; material: Material
}) {
  const ref = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current!
    const transform = new Object3D()
    const tint = new Color()
    const colored = instances.some(instance => instance.tint)
    instances.forEach((instance, index) => {
      transform.position.set(...instance.position)
      transform.scale.set(...instance.scale)
      transform.rotation.set(...(instance.rotation ?? [0, 0, 0]))
      transform.updateMatrix()
      mesh.setMatrixAt(index, transform.matrix)
      if (colored) mesh.setColorAt(index, tint.set(instance.tint ?? '#ffffff'))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [instances])
  useEffect(() => {
    const mesh = ref.current!
    return () => mesh.dispose()
  }, [])
  return <instancedMesh ref={ref} args={[geometry, material, instances.length]} dispose={null} />
}
