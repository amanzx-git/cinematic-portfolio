import test from 'node:test'
import assert from 'node:assert/strict'
import { destinations, sectionForPath, openSiteLink } from '../src/website/navigation.ts'
import { loadAssets } from '../src/website/assetLoading.ts'

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

test('five destinations resolve informational pages and preserve existing route namespaces', () => {
  assert.deepEqual(destinations.map(item => item.path), ['/play', '/about', '/skills', '/projects', '/contact'])
  assert.equal(new Set(destinations.map(item => item.identity)).size, 5)
  for (const id of ['about', 'skills', 'projects', 'contact']) assert.equal(sectionForPath('/' + id + '/'), id)
  for (const path of ['/', '/play', '/play/recruiter', '/lab/game', '/lab/runner']) assert.equal(sectionForPath(path), null)
})

test('menu links use SPA history, retain native modified clicks and mark cinematic Play entry', () => {
  const saved = Object.fromEntries(['history', 'location', 'window', 'PopStateEvent'].map(key => [key, globalThis[key]]))
  const calls = []
  globalThis.location = { pathname: '/' }
  globalThis.history = {
    state: null,
    replaceState(state, unused, path) { this.state = state; calls.push(['replace', path]) },
    pushState(state, unused, path) { this.state = state; calls.push(['push', path, state]) },
  }
  globalThis.window = { dispatchEvent() { calls.push(['event']) } }
  globalThis.PopStateEvent = class extends Event {}
  const link = path => ({ button: 0, currentTarget: { getAttribute: () => path }, preventDefault() {} })
  try {
    openSiteLink({ ...link('/about'), ctrlKey: true })
    assert.equal(calls.length, 0)
    openSiteLink(link('/play'))
    assert.deepEqual(calls[0], ['replace', '/'])
    assert.deepEqual(calls[1], ['push', '/play', { playIntro: true, fromHome: true }])
    calls.length = 0
    openSiteLink(link('/skills'))
    assert.deepEqual(calls[0], ['push', '/skills', null])
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete globalThis[key]
      else globalThis[key] = value
    }
  }
})

test('asset readiness waits for actual resources and rejects cancelled stale navigation promptly', async () => {
  const first = deferred(), second = deferred(), controller = new AbortController()
  let ready = false
  const loading = loadAssets([{ id: 'module', load: () => first.promise }, { id: 'media', load: () => second.promise }], controller.signal)
  loading.then(() => { ready = true })
  first.resolve('module')
  await Promise.resolve()
  assert.equal(ready, false)
  second.resolve('media')
  assert.deepEqual(await loading, ['module', 'media'])
  const abandoned = deferred(), abort = new AbortController()
  const stale = loadAssets([{ id: 'late-mode', load: () => abandoned.promise }], abort.signal)
  abort.abort()
  await assert.rejects(stale, { name: 'AbortError' })
  abandoned.resolve('late')
  assert.deepEqual(await loadAssets([], new AbortController().signal), [])
})

test('asset failures remain failures and a fresh retry can become ready', async () => {
  let attempts = 0
  const resource = { id: 'route-module', load: async () => {
    attempts++
    if (attempts === 1) throw Error('offline')
    return 'ready'
  } }
  await assert.rejects(loadAssets([resource], new AbortController().signal), /offline/)
  assert.deepEqual(await loadAssets([resource], new AbortController().signal), ['ready'])
})
