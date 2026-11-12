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
    const plays = audio.plays
    music.setAmbientVolume(.07); flush()
    assert.equal(audio.volume, .07)
    assert.equal(audio.plays, plays, 'section volume reuses the same playing element')
    music.setMuted(true)
    assert.equal(audio.muted, true, 'silence is immediate, before the fade completes')
    flush(); assert.equal(audio.paused, true)
    music.setMuted(false); await Promise.resolve(); flush()
    assert.equal(audio.currentTime, 17, 'resuming must never seek to zero')
    assert.equal(audio.volume, .07, 'unmute restores the informational-page level')
    music.setAmbientVolume(.35); music.setAmbientVolume(.07); music.setAmbientVolume(.35); flush()
    assert.equal(audio.volume, .35, 'rapid navigation retains only the current fade')
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

function nativeStub() {
  const events=new Map()
  const element={src:'',volume:1,muted:false,currentTime:17,paused:true,plays:0,
    addEventListener:(name,listener)=>events.set(name,listener),removeEventListener:name=>events.delete(name),
    getAttribute:()=>element.src,removeAttribute:()=>{element.src=''},load:()=>{},
    play:()=>{element.plays++;element.paused=false;return Promise.resolve()},pause:()=>{element.paused=true}}
  return element
}
async function withFrames(run) {
  const raf=globalThis.requestAnimationFrame,cancel=globalThis.cancelAnimationFrame
  const frames=new Map();let id=0
  globalThis.requestAnimationFrame=callback=>{frames.set(++id,callback);return id}
  globalThis.cancelAnimationFrame=id=>frames.delete(id)
  const flush=()=>{const pending=[...frames.values()];frames.clear();pending.forEach(f=>f(performance.now()+1000))}
  try {await run(flush)}finally{globalThis.requestAnimationFrame=raf;globalThis.cancelAnimationFrame=cancel}
}
test('central handoff fades ambient before native video audio, keeps black silent and resumes one track position', async()=>withFrames(async flush=>{
  const audio=nativeStub(),video=nativeStub(),states=[]
  const music=new BackgroundMusic(audio,state=>states.push(state))
  music.start(false);await Promise.resolve();flush()
  music.enterIntro();const playing=music.playIntro(video)
  assert.equal(video.plays,0);assert.equal(video.muted,true);assert.equal(audio.volume,.35)
  flush();await playing
  assert.equal(audio.volume,0);assert.equal(audio.paused,true);assert.equal(video.muted,false);assert.equal(video.volume,.7)
  music.setMuted(true);assert.equal(video.muted,true)
  music.setMuted(false);await Promise.resolve();await Promise.resolve()
  assert.equal(audio.plays,1);assert.equal(video.muted,false)
  music.silenceIntro();music.setMuted(true);music.setMuted(false)
  assert.equal(video.muted,true);assert.equal(audio.paused,true)
  music.resumeAmbient();await Promise.resolve();flush()
  assert.equal(video.paused,true);assert.equal(audio.plays,2);assert.equal(audio.currentTime,17);assert.equal(audio.volume,.35)
  music.resumeAmbient();assert.equal(audio.plays,2)
  music.dispose()
}))
test('rapid intro/back/intro cancels stale handoffs and late play callbacks',async()=>withFrames(async flush=>{
  const audio=nativeStub(),first=nativeStub(),second=nativeStub()
  const music=new BackgroundMusic(audio,()=>{})
  music.start(false);await Promise.resolve();flush()
  music.enterIntro();const stale=music.playIntro(first)
  music.resumeAmbient();music.enterIntro();const fresh=music.playIntro(second)
  flush();await Promise.all([stale,fresh])
  assert.equal(first.plays,0);assert.equal(first.muted,true)
  assert.equal(second.plays,1);assert.equal(audio.paused,true);assert.equal(audio.muted,true)
  const late=nativeStub();let resolvePlay
  late.play=()=>new Promise(resolve=>{resolvePlay=resolve})
  music.enterIntro();const pending=music.playIntro(late);await Promise.resolve()
  music.resumeAmbient();late.paused=false;resolvePlay();await pending
  assert.equal(late.muted,true);assert.equal(late.paused,true)
  await Promise.resolve();flush();music.dispose()
}))
test('audible autoplay rejection keeps visuals muted and exposes retry without changing mute preference',async()=>withFrames(async flush=>{
  const audio=nativeStub(),video=nativeStub(),states=[]
  const play=video.play
  video.play=()=>!video.muted?Promise.reject(new DOMException('Blocked','NotAllowedError')):play()
  const music=new BackgroundMusic(audio,state=>states.push(state))
  music.start(false);await Promise.resolve();flush()
  music.enterIntro();const pending=music.playIntro(video);flush();await pending
  assert.equal(video.muted,true);assert.equal(video.paused,false);assert.ok(states.includes('intro-blocked'))
  music.resumeAmbient();await Promise.resolve();flush()
  assert.equal(audio.muted,false);assert.equal(audio.volume,.35)
  music.dispose()
}))

test('Skip before the handoff fade finishes silences ambient immediately and cancels video startup',async()=>withFrames(async flush=>{
  const audio=nativeStub(),video=nativeStub(),music=new BackgroundMusic(audio,()=>{})
  music.start(false);await Promise.resolve();flush()
  music.enterIntro();const pending=music.playIntro(video)
  music.silenceIntro()
  assert.equal(audio.muted,true);assert.equal(audio.paused,true);assert.equal(audio.volume,0)
  flush();await pending;assert.equal(video.plays,0);assert.equal(video.muted,true)
  music.dispose()
}))
