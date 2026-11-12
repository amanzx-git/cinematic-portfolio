// Native soundtrack checks against the supplied ambient.mp3 (Chrome/CDP).
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { connect } from './cdp.mjs'
const origin = process.env.TEST_URL ?? 'http://127.0.0.1:4173'
const pages = await (await fetch(`http://127.0.0.1:${process.env.DEBUG_PORT ?? 9224}/json`)).json()
const page = await connect(pages.find(p => p.type === 'page').webSocketDebuggerUrl)
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const until = async expression => {
  for (let i = 0; i < 250; i++) { if (await page.evaluate(expression)) return; await wait(50) }
  throw Error(`Timed out: ${expression}`)
}
const key = async value => {
  const code = { Enter: 13, Tab: 9, Escape: 27 }[value]
  await page.call('Input.dispatchKeyEvent', { type: 'keyDown', key: value, code: value, windowsVirtualKeyCode: code, ...(value === 'Enter' ? { text: '\r' } : {}) })
  await page.call('Input.dispatchKeyEvent', { type: 'keyUp', key: value, code: value, windowsVirtualKeyCode: code })
}
const fresh = async () => {
  await page.call('Page.navigate', { url: origin })
  await until("document.querySelector('main')?.dataset.state==='AWAITING_ENTER'")
}
const requests = [], scripts = []
page.on('Network.requestWillBeSent', p => requests.push(p.request.url))
await page.call('Runtime.enable'); await page.call('Page.enable'); await page.call('Network.enable')
await page.call('Page.navigate', { url: origin }); await until("document.querySelector('audio')!==null")
await page.evaluate("localStorage.removeItem('aman.portfolio.muted')")
const { identifier } = await page.call('Page.addScriptToEvaluateOnNewDocument', { source: `
  window.__musicPlays=[];const original=HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play=function(){if(this.tagName==='AUDIO')window.__musicPlays.push({time:this.currentTime,activation:navigator.userActivation.isActive});return original.call(this)};
` })
scripts.push(identifier)
try {
  const before = requests.length
  await fresh()
  assert.equal(await page.evaluate("document.querySelector('audio').getAttribute('src')"), null)
  assert.equal(await page.evaluate("document.querySelector('audio').paused"), true)
  assert.equal(await page.evaluate("document.querySelector('[aria-label=\"Unmute audio\"]').disabled"), true)
  assert.ok(!requests.slice(before).some(url => /ambient\.mp3/.test(url)))
  await key('Enter')
  await until("document.querySelector('audio').currentTime>.1")
  await until("document.querySelector('audio').volume>.349")
  assert.equal(await page.evaluate("window.__musicPlays[0].activation"), true)
  assert.equal(await page.evaluate("document.querySelectorAll('audio').length"), 1)
  assert.equal(await page.evaluate("document.querySelector('audio').loop"), true)
  assert.ok(await page.evaluate("[...document.querySelectorAll('video')].every(v=>v.muted)"))
  await page.evaluate("void(window.__musicElement=document.querySelector('audio'))")
  await until("document.querySelector('main').dataset.state==='HOME_MENU'")
  await page.evaluate("document.querySelector('[data-section=About]').click()")
  await key('Escape')
  await page.evaluate("document.querySelector('[data-section=Play]').click()")
  await until("document.querySelector('.play-controls .enter-button')!==null")
  await page.evaluate("document.querySelector('.play-controls .enter-button').click()")
  await until("document.querySelector('main').dataset.state==='MODE_SELECTION'")
  assert.equal(await page.evaluate("window.__musicElement===document.querySelector('audio')"), true)
  assert.equal(await page.evaluate("window.__musicPlays.length"), 2, 'mode selection resumes the same ambient element')
  await key('Escape')
  await page.evaluate("document.querySelector('[aria-label=\"Mute audio\"]').focus()")
  await key('Enter')
  assert.equal(await page.evaluate("document.querySelector('audio').muted"), true)
  await until("document.querySelector('audio').paused")
  const time = await page.evaluate("document.querySelector('audio').currentTime")
  assert.equal(await page.evaluate("localStorage.getItem('aman.portfolio.muted')"), 'true')
  await key('Enter')
  await until("!document.querySelector('audio').paused && document.querySelector('audio').volume>.349")
  assert.ok((await page.evaluate("document.querySelector('audio').currentTime")) >= time)
  assert.equal(await page.evaluate("localStorage.getItem('aman.portfolio.muted')"), 'false')
  const duration = await page.evaluate("document.querySelector('audio').duration")
  await page.evaluate("document.querySelector('audio').currentTime=document.querySelector('audio').duration-.15")
  await until("document.querySelector('audio').currentTime<2 && !document.querySelector('audio').paused")
  console.log('Real MP3, gesture activation, 35% fade, loop wrap, immediate mute, position resume and single instance across navigation passed; seconds:', duration)

  await page.evaluate("document.querySelector('[aria-label=\"Mute audio\"]').click()")
  await fresh(); await key('Enter')
  assert.equal(await page.evaluate("document.querySelector('audio').paused"), true)
  assert.equal(await page.evaluate("document.querySelector('audio').getAttribute('src')"), null)
  assert.equal(await page.evaluate("document.querySelector('[aria-label=\"Unmute audio\"]').getAttribute('aria-pressed')"), 'false')
  console.log('Refresh preserves chosen mute and still requires Enter before enabling sound')

  await page.call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await page.call('Emulation.setTouchEmulationEnabled', { enabled: true })
  await until("document.querySelector('dialog')?.open===true")
  await page.evaluate("document.querySelector('.orientation-gate .enter-button').click()")
  const point = await page.evaluate("(()=>{const r=document.querySelector('.sound-control').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()")
  await page.call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] })
  await page.call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await until("!document.querySelector('audio').paused && !document.querySelector('audio').muted")
  assert.equal(await page.evaluate('document.documentElement.scrollWidth>innerWidth'), false)
  await mkdir('test-results', { recursive: true })
  await writeFile('test-results/w3-audio-mobile.png', Buffer.from((await page.call('Page.captureScreenshot')).data, 'base64'))
  console.log('Mobile Chrome emulation: touch sound control and layout passed')
  await page.call('Emulation.setTouchEmulationEnabled', { enabled: false })
  await page.call('Emulation.clearDeviceMetricsOverride')

  page.on('Fetch.requestPaused', async p => {
    await page.call('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: 404, body: '' })
  })
  await page.call('Fetch.enable', { patterns: [{ urlPattern: '*ambient.mp3' }] })
  await page.call('Network.setCacheDisabled', { cacheDisabled: true })
  await fresh(); await key('Enter')
  await until("document.body.textContent.includes('Background music is unavailable')")
  await until("document.querySelector('main').dataset.state==='HOME_MENU'")
  await page.call('Fetch.disable')
  console.log('Missing MP3: nonblocking status and menu passed')

  const blocked = await page.call('Page.addScriptToEvaluateOnNewDocument', { source: "const p=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){return this.tagName==='AUDIO'?Promise.reject(new DOMException('Blocked','NotAllowedError')):p.call(this)}" })
  scripts.push(blocked.identifier)
  await fresh(); await key('Enter')
  await until("document.body.textContent.includes('Music playback was blocked')")
  await until("document.querySelector('main').dataset.state==='HOME_MENU'")
  await page.call('Page.removeScriptToEvaluateOnNewDocument', { identifier: blocked.identifier }); scripts.pop()
  console.log('Browser audio restriction: usable menu and nonblocking retry guidance passed')

  const noStorage = await page.call('Page.addScriptToEvaluateOnNewDocument', { source: "Object.defineProperty(window,'localStorage',{get(){throw Error('Storage unavailable')}})" })
  scripts.push(noStorage.identifier)
  await fresh(); await key('Enter')
  await until("document.querySelector('audio').currentTime>.1")
  await page.evaluate("document.querySelector('[aria-label=\"Mute audio\"]').click()")
  assert.equal(await page.evaluate("document.querySelector('audio').muted"), true)
  assert.deepEqual(page.errors, [])
  console.log('Unavailable localStorage: playback/control fallback passed; zero runtime errors')
} catch (error) {
  console.log(await page.evaluate("({visibility:document.visibilityState,audio:[...document.querySelectorAll('audio')].map(a=>({volume:a.volume,muted:a.muted,paused:a.paused,time:a.currentTime,error:a.error?.code})),status:[...document.querySelectorAll('[role=status]')].map(n=>n.textContent),plays:window.__musicPlays})"))
  throw error
} finally {
  await page.call('Fetch.disable')
  for (const id of scripts) await page.call('Page.removeScriptToEvaluateOnNewDocument', { identifier: id })
  await page.call('Emulation.setTouchEmulationEnabled', { enabled: false })
  await page.call('Page.navigate', { url: 'about:blank' }); page.close()
}
