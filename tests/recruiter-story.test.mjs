import test from 'node:test'
import assert from 'node:assert/strict'
import { storyTransition, createVideoAvailability, STORY_VIDEOS } from '../src/recruiter/story.ts'
import { Simulation } from '../src/game/simulation.ts'
import { GameSession } from '../src/game/session.ts'
import { backToModes } from '../src/recruiterNavigation.ts'
import { startStoryVideo } from '../src/recruiter/videoPlayback.ts'

test('native playback respects mute and Back cleanup silences video and ignores late rejection', async () => {
  let rejectPlay
  let blocked = 0
  const calls = []
  const video = {
    muted: false, volume: 0,
    play: () => new Promise((resolve, reject) => { rejectPlay = reject }),
    pause: () => calls.push('pause'),
    removeAttribute: name => calls.push(name),
    load: () => calls.push('load'),
  }
  const dispose = startStoryVideo(video, true, 0.7, () => blocked++)
  assert.equal(video.muted, true)
  assert.equal(video.volume, 0.7)
  dispose()
  rejectPlay(Error('Navigation interrupted playback'))
  await Promise.resolve()
  assert.deepEqual(calls, ['pause', 'src', 'load'])
  assert.equal(blocked, 0)
})

test('autoplay rejection exposes a user-gesture retry without overriding mute', async () => {
  let blocked = 0
  const video = { muted: false, volume: 0, play: () => Promise.reject(Error('NotAllowedError')) }
  startStoryVideo(video, false, 0.7, () => blocked++)
  await Promise.resolve()
  assert.equal(blocked, 1)
  assert.equal(video.muted, false)
})

test('opening completion or Skip advances once to a stopped gameplay Ready', () => {
  let stage = storyTransition('opening', 'opening-finished')
  assert.equal(stage, 'gameplay-ready')
  stage = storyTransition(stage, 'opening-finished')
  assert.equal(stage, 'gameplay-ready')
  const session = new GameSession(new Simulation())
  assert.equal(session.screen, 'ready')
  assert.equal(session.started, false)
  assert.equal(session.sim.x, 0)
})

test('simulated successful escape enters reunion, completion and a fresh Replay opening', () => {
  let stage = storyTransition('opening', 'opening-finished')
  const session = new GameSession(new Simulation())
  session.start()
  stage = storyTransition(stage, 'start')
  assert.equal(stage, 'escape')
  session.sim.phase = 'finished'
  assert.equal(session.screen, 'complete')
  stage = storyTransition(stage, 'escape-finished')
  assert.equal(stage, 'reunion')
  assert.equal(storyTransition(stage, 'escape-finished'), stage)
  stage = storyTransition(stage, 'reunion-finished')
  assert.equal(stage, 'completion')
  assert.equal(storyTransition(stage, 'reunion-finished'), stage)
  assert.equal(storyTransition(stage, 'replay'), 'opening')
  assert.equal(new GameSession(new Simulation()).screen, 'ready')
})

test('missing videos and HTML SPA fallbacks are cached and bypassed', async () => {
  const calls = []
  const available = createVideoAvailability(async (path, options) => {
    calls.push([path, options.method])
    return new Response('', { status: path === STORY_VIDEOS.opening ? 404 : 200, headers: { 'content-type': 'text/html' } })
  })
  assert.equal(await available(STORY_VIDEOS.opening), false)
  assert.equal(await available(STORY_VIDEOS.opening), false)
  assert.equal(await available(STORY_VIDEOS.reunion), false)
  assert.equal(calls.length, 2)
  assert.ok(calls.every(([, method]) => method === 'HEAD'))
  assert.equal(storyTransition('opening', 'opening-finished'), 'gameplay-ready')
  assert.equal(storyTransition('reunion', 'reunion-finished'), 'completion')
})

test('valid video metadata is accepted and failed probes are cached', async () => {
  const available = createVideoAvailability(async () => new Response(null, { headers: { 'content-type': 'video/mp4' } }))
  assert.equal(await available(STORY_VIDEOS.opening), true)
  let calls = 0
  const missing = createVideoAvailability(async () => { calls++; throw Error('Network failure') })
  assert.equal(await missing(STORY_VIDEOS.opening), false)
  assert.equal(await missing(STORY_VIDEOS.opening), false)
  assert.equal(calls, 1)
})

test('Back in either cinematic retains the existing direct mode-selection navigation', () => {
  const saved = { history: globalThis.history, window: globalThis.window, PopStateEvent: globalThis.PopStateEvent }
  const paths = []
  globalThis.history = { state: null, pushState: (_, unused, path) => paths.push(path) }
  globalThis.window = { dispatchEvent() {} }
  globalThis.PopStateEvent = class extends Event {}
  try {
    for (const stage of ['opening', 'reunion']) {
      backToModes({ button: 0, preventDefault() {} })
      assert.equal(paths.at(-1), '/play', stage)
    }
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete globalThis[key]
      else globalThis[key] = value
    }
  }
})
