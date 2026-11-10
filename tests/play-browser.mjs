// W2 production checks, using the existing dependency-free Chrome/CDP tooling.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { connect } from './cdp.mjs'

const origin = process.env.TEST_URL ?? 'http://127.0.0.1:4173'
const endpoint = `http://127.0.0.1:${process.env.DEBUG_PORT ?? 9224}`
const pages = await (await fetch(`${endpoint}/json`)).json()
const page = await connect(pages.find(p => p.type === 'page').webSocketDebuggerUrl)
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const until = async (expression, timeout = 10000) => {
  for (let i = 0; i < timeout / 50; i++) { if (await page.evaluate(expression)) return; await wait(50) }
  throw Error(`Timed out: ${expression}`)
}
const state = value => until(`document.querySelector('main')?.dataset.state === '${value}'`)
const key = async value => {
  const code = { Enter: 13, Tab: 9, Escape: 27 }[value]
  await page.call('Input.dispatchKeyEvent', { type: 'keyDown', key: value, code: value, windowsVirtualKeyCode: code, ...(value === 'Enter' ? { text: '\r' } : {}) })
  await page.call('Input.dispatchKeyEvent', { type: 'keyUp', key: value, code: value, windowsVirtualKeyCode: code })
}
const home = async () => {
  await page.call('Page.navigate', { url: origin })
  await state('AWAITING_ENTER'); await key('Enter'); await state('HOME_MENU')
  // W3.2 owns the rotation gate; this suite exercises the explicit portrait fallback.
  await page.evaluate("document.querySelector('.orientation-gate .enter-button')?.click()")
}
const play = async () => {
  await page.evaluate("document.querySelector('[data-section=Play]').focus()")
  await key('Enter'); await state('PLAY_INTRO')
}
const back = async () => {
  await page.evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Back to homepage')).click()")
  await state('HOME_MENU')
  assert.equal(await page.evaluate('document.activeElement.dataset.section'), 'Play')
}
const modes = async () => {
  await state('MODE_SELECTION')
  assert.deepEqual(await page.evaluate("[...document.querySelectorAll('.mode-option h3')].map(n=>n.textContent)"), ['Play as Recruiter', 'Play as Aman', 'Play with Friend'])
  assert.equal(await page.evaluate("document.querySelectorAll('.mode-option button,.mode-option a').length"), 0)
  assert.ok(await page.evaluate("document.querySelector('.mode-recruiter').textContent.includes('Gameplay is not available yet')"))
  assert.equal(await page.evaluate("document.activeElement.className"), 'play-experience')
}
let mode = 'fallback', holdDestination = false, failDestination = false, releaseDestination
let fixture
const requests = [], interceptionErrors = []
await page.call('Page.enable'); await page.call('Runtime.enable'); await page.call('Network.enable')
const { identifier: muteSetup } = await page.call('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('aman.portfolio.muted','true')}catch{}" })
await page.call('Network.setCacheDisabled', { cacheDisabled: true })
await page.call('Page.navigate', { url: 'about:blank' })
await until("location.href === 'about:blank'")
fixture = (await readFile(new URL('../public/media/website/play-intro.mp4', import.meta.url))).toString('base64')
page.on('Network.requestWillBeSent', params => requests.push(params.request.url))
page.on('Fetch.requestPaused', async params => {
  try {
    const path = new URL(params.request.url).pathname
    if (path.endsWith('media.json')) {
      const body = { entrance: null, idle: null, playIntro: mode === 'fallback' ? null : '/media/website/play-intro.mp4' }
      await page.call('Fetch.fulfillRequest', { requestId: params.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(body)).toString('base64') })
    } else if (path.includes('ModeSelection-')) {
      if (holdDestination) await new Promise(resolve => { releaseDestination = resolve })
      if (failDestination) await page.call('Fetch.failRequest', { requestId: params.requestId, errorReason: 'Failed' })
      else await page.call('Fetch.continueRequest', { requestId: params.requestId })
    } else if (mode === 'missing') {
      await page.call('Fetch.fulfillRequest', { requestId: params.requestId, responseCode: 404, body: '' })
    } else {
      await page.call('Fetch.fulfillRequest', { requestId: params.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'video/mp4' }], body: fixture })
    }
  } catch (error) { interceptionErrors.push(String(error)) }
})
await page.call('Fetch.enable', { patterns: [{ urlPattern: '*media.json' }, { urlPattern: '*play-intro.mp4' }, { urlPattern: '*ModeSelection-*.js' }] })
try {
  await page.call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  holdDestination = true
  await home()
  assert.ok(!requests.some(url => /ModeSelection-|play-intro\.mp4/.test(url)), 'Play resources must wait for Play')
  await play()
  await until("document.querySelector('.cinematic-loading')?.textContent.includes('Preparing mode selection')", 12000)
  assert.equal(await page.evaluate("document.querySelector('.play-controls .enter-button') === null"), true)
  assert.ok(releaseDestination)
  holdDestination = false; releaseDestination()
  await modes(); await back()
  console.log('Natural fallback completion waits on the actual held destination, then enters modes; Back restores Play focus')

  await play()
  await until("document.querySelector('.play-controls .enter-button') !== null")
  await page.evaluate("document.querySelector('.play-controls .enter-button').focus()")
  await key('Enter'); await modes()
  await until("getComputedStyle(document.querySelector('.mode-selection')).opacity === '1'")
  await mkdir('test-results', { recursive: true })
  await writeFile('test-results/w2-modes-desktop.png', Buffer.from((await page.call('Page.captureScreenshot')).data, 'base64'))
  await key('Escape'); await state('HOME_MENU')
  await play(); await until("document.querySelector('.play-controls .enter-button') !== null")
  const point = await page.evaluate("(()=>{const r=document.querySelector('.play-controls .enter-button').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()")
  await page.call('Emulation.setTouchEmulationEnabled', { enabled: true })
  await page.call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] })
  await page.call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await modes(); await back()
  console.log('Skip ready after module and visual readiness; keyboard, touch and Escape passed')

  mode = 'video'; holdDestination = true; releaseDestination = undefined
  await home(); await play()
  await until("document.querySelector('.play-intro-video')?.currentTime > 0")
  assert.equal(await page.evaluate("document.querySelector('.play-intro-video').muted"), true)
  await until("document.querySelector('.cinematic-loading')?.textContent.includes('Preparing mode selection')")
  assert.equal(await page.evaluate("document.querySelector('.play-controls .enter-button') === null"), true)
  assert.ok(releaseDestination)
  await until("document.querySelector('.play-intro-video')?.ended", 60000)
  holdDestination = false; releaseDestination()
  await modes(); await back()
  await play(); await until("document.querySelector('.play-intro-video')?.currentTime > 0")
  await page.evaluate("document.querySelector('[aria-label=\"Unmute audio\"]').click()")
  await until("document.querySelector('audio')?.muted === false")
  assert.equal(await page.evaluate("document.querySelector('.play-intro-video').muted"), true)
  await back(); await play(); await until("document.querySelector('audio')?.muted === false")
  await back()
  console.log('Real video completion waits for destination, muted default, explicit audio consent and mute preference retention passed')

  mode = 'missing'; await home(); await play()
  await until("document.querySelector('.play-notice')?.textContent.includes('video is unavailable')")
  await until("document.querySelector('.play-controls .enter-button') !== null")
  await page.evaluate("document.querySelector('.play-controls .enter-button').click()")
  await modes(); await back()
  console.log('Missing video falls back to captions and permits Skip')

  mode = 'video'
  const { identifier } = await page.call('Page.addScriptToEvaluateOnNewDocument', { source: "HTMLMediaElement.prototype.play=function(){return Promise.reject(new DOMException('Blocked','NotAllowedError'))}" })
  await home(); await play()
  await until("document.querySelector('.play-notice')?.textContent.includes('video is unavailable')")
  await back(); await page.call('Page.removeScriptToEvaluateOnNewDocument', { identifier })
  console.log('Rejected playback falls back without trapping navigation')

  await page.call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await page.call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false })
  await home(); const before = requests.length; await play()
  await until("document.querySelector('.play-controls .enter-button') !== null")
  assert.equal(await page.evaluate("document.querySelectorAll('.intro-captions p').length"), 3)
  assert.equal(await page.evaluate("getComputedStyle(document.querySelector('.play-intro')).animationName"), 'none')
  assert.ok(!requests.slice(before).some(url => /\.mp4/.test(url)))
  await page.evaluate("document.querySelector('.play-controls .enter-button').click()")
  await modes()
  assert.equal(await page.evaluate('document.documentElement.scrollWidth > innerWidth'), false)
  await writeFile('test-results/w2-modes-mobile.png', Buffer.from((await page.call('Page.captureScreenshot')).data, 'base64'))
  await back()
  console.log('Reduced motion uses readable static captions without video requests; mobile layout passed')

  failDestination = true
  await home(); await play()
  await until("document.querySelector('[role=alert]')?.textContent.includes('Mode selection could not load')")
  assert.equal(await page.evaluate("document.querySelector('.play-controls .enter-button') === null"), true)
  await back()
  console.log('Destination load failure provides usable Back navigation')
  assert.ok(!requests.some(url => /characters|\.fbx|\.glb|\/assets\/App-/.test(url)))
  assert.deepEqual(page.errors, [])
  assert.deepEqual(interceptionErrors, [])
} finally {
  await page.call('Page.removeScriptToEvaluateOnNewDocument', { identifier: muteSetup })
  releaseDestination?.()
  await page.call('Fetch.disable')
  await page.call('Emulation.setEmulatedMedia', { features: [] })
  await page.call('Page.navigate', { url: 'about:blank' })
  page.close()
}
