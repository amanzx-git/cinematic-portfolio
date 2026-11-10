import { WebGPURenderer } from 'three/webgpu'
import { selectRenderer } from './backend.mjs'

export type Graphics = {
  renderer: WebGPURenderer
  backend: 'WebGPU' | 'WebGL 2'
}

export async function initializeRenderer(forceWebGL: boolean): Promise<Graphics> {
  return selectRenderer(forceWebGL, async (webgl: boolean) => {
    const renderer = new WebGPURenderer({
      canvas: document.createElement('canvas'),
      antialias: true,
      forceWebGL: webgl,
    })
    try {
      await renderer.init()
      const backend = renderer.backend as unknown as { isWebGPUBackend?: boolean }
      return { renderer, backend: backend.isWebGPUBackend ? 'WebGPU' : 'WebGL 2' }
    } catch (error) {
      // dispose() calls async setAnimationLoop(), which retries rejected init().
      // No initialized resources exist here; let the failed canvas be collected.
      throw error
    }
  })
}
