// Production browser verification via the existing dependency-free CDP setup.
// Start preview on 4173 and a dedicated Chrome on DEBUG_PORT (default 9224).
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { connect } from './cdp.mjs'

const origin = process.env.TEST_URL ?? 'http://127.0.0.1:4173'
const endpoint = `http://127.0.0.1:${process.env.DEBUG_PORT ?? 9224}`
const pages = await (await fetch(`${endpoint}/json`)).json()
const page = await connect(pages.find(p => p.type === 'page').webSocketDebuggerUrl)
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const until = async expression => {
  for (let i = 0; i < 100; i++) { if (await page.evaluate(expression)) return; await wait(50) }
  throw Error(`Timed out: ${expression}`)
}
const state = expected => until(`document.querySelector('main')?.dataset.state === '${expected}'`)
const key = async value => {
  const keyCode = { Enter: 13, Tab: 9, Escape: 27 }[value]
  await page.call('Input.dispatchKeyEvent', { type: 'keyDown', key: value, code: value, windowsVirtualKeyCode: keyCode,
    ...(value === 'Enter' ? { text: '\r' } : {}) })
  await page.call('Input.dispatchKeyEvent', { type: 'keyUp', key: value, code: value, windowsVirtualKeyCode: keyCode })
}
let mode = 'static'
let fixture
const requests = []
const interceptionErrors = []
let releaseManifest
await page.call('Runtime.enable')
await page.call('Page.enable')
const { identifier: muteSetup } = await page.call('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('aman.portfolio.muted','true')}catch{}" })
await page.call('Network.enable')
await page.call('Page.navigate', { url: 'about:blank' })
await until('location.href === "about:blank"')
page.on('Network.requestWillBeSent', params => requests.push(params.request.url))
page.on('Fetch.requestPaused', async params => {
  try {
    const path = new URL(params.request.url).pathname
    if (mode === 'missing-essential' && (path.endsWith('media.json') || path.endsWith('city-poster.svg'))) {
      await page.call('Fetch.fulfillRequest', { requestId: params.requestId, responseCode: 404, body: '' })
    } else if (path.endsWith('media.json')) {
      if (mode === 'pending') await new Promise(resolve => { releaseManifest = resolve })
      const body = mode === 'static' || mode === 'pending' ? { entrance: null, idle: null }
        : { entrance: '/media/website/entrance.mp4', idle: '/media/website/idle.mp4' }
      await page.call('Fetch.fulfillRequest', { requestId: params.requestId, responseCode: 200,
        responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(body)).toString('base64') })
    } else if (path.endsWith('.mp4') && mode === 'video') {
      await page.call('Fetch.fulfillRequest', { requestId: params.requestId, responseCode: 200,
        responseHeaders: [{ name: 'Content-Type', value: 'video/webm' }], body: fixture })
    } else if (mode === 'missing' || mode === 'missing-essential') {
      await page.call('Fetch.fulfillRequest', { requestId: params.requestId, responseCode: 404, body: '' })
    } else await page.call('Fetch.continueRequest', { requestId: params.requestId })
  } catch (error) { interceptionErrors.push({ url: params.request.url, error }) }
})

try {
  // Generate a tiny real video locally: no third-party media or new dependency.
  fixture = await page.evaluate(`new Promise(resolve => {
    const canvas = document.createElement('canvas'); canvas.width=160; canvas.height=90;
    const ctx=canvas.getContext('2d'); const stream=canvas.captureStream(15);
    const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'}); const chunks=[];
    recorder.ondataavailable=e=>chunks.push(e.data);
    recorder.onstop=async()=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(new Blob(chunks,{type:'video/webm'}));stream.getTracks().forEach(t=>t.stop());};
    recorder.start(); let n=0; const timer=setInterval(()=>{ctx.fillStyle=n%2?'#263d48':'#435b5f';ctx.fillRect(0,0,160,90);if(++n===15){clearInterval(timer);recorder.stop()}},100);
  })`)
  await page.call('Fetch.enable', { patterns: [{ urlPattern: '*media.json' }, { urlPattern: '*.mp4' }, { urlPattern: '*city-poster.svg' }] })
  await page.call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  mode = 'pending'
  await page.call('Page.navigate', { url: origin })
  await state('LOADING')
  assert.equal(await page.evaluate("document.querySelector('[role=status]').textContent.includes('%')"), false)
  await until('document.querySelector(".loading-status") !== null')
  while (!releaseManifest) await wait(20)
  releaseManifest()
  await state('AWAITING_ENTER')
  assert.equal(await page.evaluate("document.activeElement.textContent.trim().startsWith('Enter')"), true)
  assert.equal(await page.evaluate("document.querySelector('video') === null"), true)
  assert.equal(await page.evaluate("document.querySelector('[aria-label=\"Unmute audio\"]').disabled"), true)
  await key('Enter')
  await state('HOME_MENU')
  assert.equal(await page.evaluate("document.activeElement.dataset.section"), 'Play')
  await key('Tab'); await key('Enter')
  await until("document.activeElement.id === 'menu-detail'")
  assert.equal(await page.evaluate("document.querySelector('#detail-title').textContent"), 'About')
  await key('Escape')
  assert.equal(await page.evaluate("document.activeElement.dataset.section"), 'About')
  for (const item of ['Projects', 'Contact']) {
    await page.evaluate(`document.querySelector('[data-section=${item}]').click()`)
    await until("document.activeElement.id === 'menu-detail'")
    assert.ok(await page.evaluate("document.querySelector('#menu-detail').textContent.length > 30"))
    await key('Escape')
  }
  assert.ok(!requests.some(url => /characters|\.fbx|\.glb|\/assets\/App-/.test(url)), 'opening must not request game or lab resources')
  await until("getComputedStyle(document.querySelector('.home-menu')).opacity === '1'")
  await mkdir('test-results', { recursive: true })
  await writeFile('test-results/website-home.png', Buffer.from((await page.call('Page.captureScreenshot')).data, 'base64'))
  await page.call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false })
  assert.equal(await page.evaluate('document.documentElement.scrollWidth > innerWidth'), false)
  await writeFile('test-results/website-mobile.png', Buffer.from((await page.call('Page.captureScreenshot')).data, 'base64'))
  console.log('Static flow, real loading, keyboard navigation, panels, responsive layout and network isolation passed')

  mode = 'video'
  await page.call('Page.navigate', { url: origin })
  await state('AWAITING_ENTER')
  assert.equal(await page.evaluate("document.querySelector('video') === null"), true)
  await key('Enter')
  await state('ENTRANCE_ANIMATION')
  await until("document.querySelector('video[data-active=true]')?.currentTime > 0")
  assert.equal(await page.evaluate("document.querySelector('video[data-active=true]').muted"), true)
  await state('HOME_MENU')
  await until("document.querySelector('video[data-media=idle][data-active=true]')?.currentTime > 0")
  assert.equal(await page.evaluate("document.querySelector('video[data-active=true]').loop"), true)
  assert.equal(await page.evaluate("document.querySelector('video[data-active=true]').muted"), true)
  await page.evaluate("document.querySelector('[aria-label=\"Unmute audio\"]').click()")
  await until("document.querySelector('audio')?.muted === false")
  assert.equal(await page.evaluate("document.querySelector('video[data-active=true]').muted"), true)
  await page.evaluate("document.querySelector('[aria-label=\"Mute audio\"]').click()")
  await until("document.querySelector('audio')?.muted === true")
  await page.evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Pause motion').click()")
  await until("document.querySelector('video[data-active=true]').paused")
  await page.evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Resume motion').click()")
  await until("!document.querySelector('video[data-active=true]').paused")
  console.log('Real locally generated video: entrance ended → idle loop, muted playback, sound and motion controls passed')

  await page.call('Page.navigate', { url: origin })
  await state('AWAITING_ENTER'); await key('Enter'); await state('ENTRANCE_ANIMATION')
  await until("document.activeElement.className === 'skip-opening'")
  await key('Enter'); await state('HOME_MENU')
  console.log('Keyboard skip entrance passed')

  mode = 'missing-essential'
  await page.call('Page.navigate', { url: origin })
  await state('AWAITING_ENTER'); await key('Enter'); await state('HOME_MENU')
  assert.ok(await page.evaluate("document.querySelector('.media-notice').textContent.includes('unavailable')"))
  console.log('Missing essential resources: static fallback passed')

  mode = 'missing'
  await page.call('Page.navigate', { url: origin })
  await state('AWAITING_ENTER'); await key('Enter'); await state('HOME_MENU')
  await until("document.querySelector('video') === null")
  assert.ok(await page.evaluate("document.querySelector('.media-notice').textContent.includes('unavailable')"))
  console.log('Missing videos and poster: usable menu fallback passed')

  mode = 'video'
  const { identifier } = await page.call('Page.addScriptToEvaluateOnNewDocument', { source: "HTMLMediaElement.prototype.play = function(){return Promise.reject(new DOMException('Blocked','NotAllowedError'))}" })
  await page.call('Page.navigate', { url: origin })
  await state('AWAITING_ENTER'); await key('Enter'); await state('HOME_MENU')
  await until("document.querySelector('video') === null")
  assert.ok(await page.evaluate("document.querySelector('.media-notice').textContent.includes('playback')"))
  await page.call('Page.removeScriptToEvaluateOnNewDocument', { identifier })
  console.log('Rejected autoplay: usable static fallback passed')

  await page.call('Page.navigate', { url: 'about:blank' })
  await until('location.href === "about:blank"')
  await page.call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  const before = requests.length
  await page.call('Page.navigate', { url: origin })
  await state('AWAITING_ENTER'); await key('Enter'); await state('HOME_MENU')
  assert.equal(await page.evaluate("document.querySelector('video') === null"), true)
  assert.equal(await page.evaluate("getComputedStyle(document.querySelector('.home-menu')).animationName"), 'none')
  assert.ok(!requests.slice(before).some(url => /\.mp4/.test(url)))
  console.log('Reduced motion: no video request, no entrance playback or CSS animation passed')
  await page.call('Page.navigate', { url: `${origin}/lab?backend=webgl` })
  await until("document.querySelector('[data-testid=backend]')?.textContent === 'WebGL 2'")
  assert.equal(await page.evaluate("document.querySelector('canvas') !== null"), true)
  assert.equal(await page.evaluate("[...document.querySelectorAll('a')].some(a=>a.getAttribute('href')==='/lab')"), true)
  console.log('Preserved /lab route: WebGL 2 canvas and backend switch URL passed')
  assert.equal(page.errors.length, 0, JSON.stringify(page.errors))
  assert.deepEqual(interceptionErrors, [])
} finally {
  await page.call('Page.removeScriptToEvaluateOnNewDocument', { identifier: muteSetup })
  await page.call('Fetch.disable')
  await page.call('Emulation.setEmulatedMedia', { features: [] })
  await page.call('Page.navigate', { url: 'about:blank' })
  page.close()
}
