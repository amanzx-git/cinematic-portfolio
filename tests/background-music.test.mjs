import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const source = await readFile(new URL('../src/website/backgroundMusic.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } })
const { BackgroundMusic, readMutePreference, saveMutePreference } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)

test('single music element waits for consent, fades, silences immediately, resumes position and disposes safely', async () => {
  const oldRaf = globalThis.requestAnimationFrame, oldCancel = globalThis.cancelAnimationFrame
  const frames = new Map(); let next = 0
  globalThis.requestAnimationFrame = callback => { frames.set(++next, callback); return next }
  globalThis.cancelAnimationFrame = id => frames.delete(id)
  const flush = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(f => f(performance.now() + 1000)) }
  const listeners = new Map(), states = []
  const audio = {
    src: '', volume: 1, muted: false, currentTime: 17, paused: true, plays: 0,
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: name => listeners.delete(name),
    getAttribute: () => audio.src,
    removeAttribute: () => { audio.src = '' },
    play: () => { audio.plays++; audio.paused = false; return Promise.resolve() },
    pause: () => { audio.paused = true }, load: () => {},
  }
  try {
    const music = new BackgroundMusic(audio, state => states.push(state))
    assert.equal(audio.plays, 0); assert.equal(audio.src, '')
    music.start(false)
    assert.equal(audio.plays, 1, 'play is called synchronously in the gesture')
    await Promise.resolve()
    const early = [...frames.values()]; frames.clear()
    early.forEach(callback => callback(performance.now() - 1000))
    assert.equal(audio.volume, 0, 'an earlier frame timestamp must never produce negative native volume')
    flush()
    assert.equal(audio.volume, .35); assert.equal(audio.loop, true)
    music.setMuted(true)
    assert.equal(audio.muted, true, 'silence is immediate, before the fade completes')
    flush(); assert.equal(audio.paused, true)
    music.setMuted(false); await Promise.resolve(); flush()
    assert.equal(audio.currentTime, 17, 'resuming must never seek to zero')
    assert.equal(audio.volume, .35)
    music.stop(); flush(); assert.equal(audio.paused, true); assert.equal(audio.volume, 0)
    music.start(false); music.setMuted(true); await Promise.resolve(); flush()
    assert.equal(audio.muted, true, 'late play resolution cannot undo mute')
    music.dispose(); assert.equal(listeners.size, 0); assert.equal(frames.size, 0)
    assert.equal(audio.src, ''); assert.equal(audio.paused, true)
    const count = audio.plays; music.start(false); assert.equal(audio.plays, count)
  } finally { globalThis.requestAnimationFrame = oldRaf; globalThis.cancelAnimationFrame = oldCancel }
})

test('mute persistence is optional and does not grant audio consent', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  try {
    const values = new Map()
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => values.get(key), setItem: (k,v) => values.set(k,v) } })
    assert.equal(readMutePreference(), false)
    saveMutePreference(true); assert.equal(readMutePreference(), true)
    saveMutePreference(false); assert.equal(readMutePreference(), false)
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw Error('Disabled storage') } })
    assert.equal(readMutePreference(), false)
    assert.doesNotThrow(() => saveMutePreference(true))
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous)
    else delete globalThis.localStorage
  }
})
