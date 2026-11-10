import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

// Exercise the capability policy without mounting a React hook or adding a DOM dependency.
const source = (await readFile(new URL('../src/website/useMobileLandscape.ts', import.meta.url), 'utf8')).replace(/^import .* from 'react'\r?\n/, '')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } })
const { isMobileLayout } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`)

test('mobile policy requires touch, coarse pointer and a mobile-size screen, independent of viewport width or UA', () => {
  const saved = Object.fromEntries(['navigator', 'screen', 'matchMedia'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  try {
    for (const [touch, coarse, width, height, expected] of [
      [0, false, 1920, 1080, false], // narrow desktop windows still have desktop capabilities
      [0, true, 390, 844, false],
      [5, false, 390, 844, false],
      [5, true, 390, 844, true],
      [5, true, 844, 390, true],
      [10, true, 1024, 1366, true],
      [10, true, 1920, 1080, false],
    ]) {
      Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { maxTouchPoints: touch } })
      Object.defineProperty(globalThis, 'screen', { configurable: true, value: { width, height } })
      Object.defineProperty(globalThis, 'matchMedia', { configurable: true, value: () => ({ matches: coarse }) })
      assert.equal(isMobileLayout(), expected, `${touch}/${coarse}/${width}x${height}`)
    }
  } finally {
    for (const [key, descriptor] of Object.entries(saved)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  }
})
