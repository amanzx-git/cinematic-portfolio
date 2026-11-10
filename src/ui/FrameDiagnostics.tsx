import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'

export function FrameDiagnostics({ output }: { output: React.RefObject<HTMLOutputElement | null> }) {
  const sample = useRef({ elapsed: 0, frames: 0 })
  useFrame((state, delta) => {
    if (delta > 0.25) { sample.current = { elapsed: 0, frames: 0 }; return }
    const current = sample.current
    current.elapsed += delta
    current.frames++
    if (current.elapsed >= 0.5) {
      if (output.current) {
        output.current.textContent = `${(current.frames / current.elapsed).toFixed(0)} FPS · ${(current.elapsed * 1000 / current.frames).toFixed(1)} ms · DPR ${state.viewport.dpr.toFixed(2)} · ${state.size.width} × ${state.size.height}`
      }
      current.elapsed = 0
      current.frames = 0
    }
  })
  return null
}
