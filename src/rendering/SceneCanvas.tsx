import { createRoot, extend, events } from '@react-three/fiber'
import * as THREE from 'three'
import { useEffect, useRef, type ReactNode } from 'react'
import type { Graphics } from './renderer'

extend({ Mesh: THREE.Mesh, Group: THREE.Group, InstancedMesh: THREE.InstancedMesh, BoxGeometry: THREE.BoxGeometry, MeshBasicMaterial: THREE.MeshBasicMaterial, Fog: THREE.Fog, PlaneGeometry: THREE.PlaneGeometry, MeshStandardMaterial: THREE.MeshStandardMaterial, Color: THREE.Color, AmbientLight: THREE.AmbientLight, DirectionalLight: THREE.DirectionalLight })

// Own the DOM canvas as well as the R3F root, so fallback can use a fresh context.
export function SceneCanvas({ graphics, cap, children }: { graphics: Graphics; cap: number; children: ReactNode }) {
  const host = useRef<HTMLDivElement>(null)
  const root = useRef<ReturnType<typeof createRoot> | null>(null)
  const dprCap = useRef(cap)
  dprCap.current = cap
  useEffect(() => {
    const container = host.current!
    const canvas = graphics.renderer.domElement
    canvas.style.display = 'block'
    container.appendChild(canvas)
    const sceneRoot = createRoot(canvas)
    root.current = sceneRoot
    const resize = () => {
      const bounds = container.getBoundingClientRect()
      void sceneRoot.configure({
        gl: graphics.renderer,
        events,
        dpr: [1, dprCap.current],
        size: { width: bounds.width, height: bounds.height, top: bounds.top, left: bounds.left },
        orthographic: true,
        camera: { position: [0, 5, 30], near: 0.1, far: 200 },
      })
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    return () => { observer.disconnect(); sceneRoot.unmount(); canvas.remove(); root.current = null }
  }, [graphics])
  useEffect(() => {
    const sceneRoot = root.current!
    let current = true
    void sceneRoot.configure({ dpr: [1, cap] }).then(() => { if (current) sceneRoot.render(children) })
    return () => { current = false }
  }, [cap, children])
  return <div ref={host} style={{ width: '100%', height: '100%' }} />
}
