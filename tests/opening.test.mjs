import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
// Use the project's installed compiler so the tests also run on Node 22.12,
// which does not yet enable native TypeScript stripping by default.
const source = await readFile(new URL('../src/website/resources.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } })
const { loadOpening, videoPath } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`)

test('opening manifest accepts only website MP4 paths, excluding game and remote assets', () => {
  assert.equal(videoPath('/media/website/entrance.mp4'), '/media/website/entrance.mp4')
  for (const value of [null, {}, 'https://example.com/a.mp4', '/assets/characters/runner/runner.glb', '/media/website/../game.mp4']) {
    assert.equal(videoPath(value), null)
  }
})

test('essential loading waits for real resources and tolerates configuration failure', async () => {
  const saved = { fetch: globalThis.fetch, Image: globalThis.Image, document: globalThis.document }
  let finishPoster
  let finishConfig
  try {
    globalThis.Image = class { set src(value) { if (value) finishPoster = () => this.onload() } }
    globalThis.document = { fonts: { ready: Promise.resolve() } }
    globalThis.fetch = () => new Promise(resolve => { finishConfig = resolve })
    let ready = false
    const result = loadOpening(new AbortController().signal).then(value => { ready = true; return value })
    await Promise.resolve()
    assert.equal(ready, false)
    finishPoster()
    await Promise.resolve()
    assert.equal(ready, false, 'poster alone must not invent readiness')
    finishConfig({ ok: false })
    assert.deepEqual(await result, { media: { entrance: null, idle: null, playIntro: null }, fallback: true })
  } finally {
    Object.assign(globalThis, saved)
  }
})

test('manifest enables optional Play video without loading the video itself', async () => {
  const saved = { fetch: globalThis.fetch, Image: globalThis.Image, document: globalThis.document }
  const requests = []
  try {
    globalThis.Image = class { set src(value) { if (value) queueMicrotask(() => this.onload()) } }
    globalThis.document = { fonts: { ready: Promise.resolve() } }
    globalThis.fetch = async path => {
      requests.push(path)
      return { ok: true, json: async () => ({ playIntro: '/media/website/play-intro.mp4' }) }
    }
    const result = await loadOpening(new AbortController().signal)
    assert.deepEqual(result, { media: { entrance: null, idle: null, playIntro: '/media/website/play-intro.mp4' }, fallback: false })
    assert.deepEqual(requests, ['/media/website/media.json'])
  } finally { Object.assign(globalThis, saved) }
})
