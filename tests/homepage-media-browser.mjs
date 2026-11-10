// W3.1: decode the supplied videos, record transition/lapping and actual layouts.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { connect } from './cdp.mjs'
const origin = process.env.TEST_URL ?? 'http://127.0.0.1:4173'
const pages = await (await fetch(`http://127.0.0.1:${process.env.DEBUG_PORT ?? 9224}/json`)).json()
const page = await connect(pages.find(p => p.type === 'page').webSocketDebuggerUrl)
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const until = async expression => {
  for (let n = 0; n < 300; n++) { if (await page.evaluate(expression)) return; await wait(50) }
  throw Error(`Timeout: ${expression}`)
}
const key = async value => {
  const code = { Enter: 13, Tab: 9, Escape: 27 }[value]
  await page.call('Input.dispatchKeyEvent', { type: 'keyDown', key: value, code: value, windowsVirtualKeyCode: code, ...(value === 'Enter' ? { text: '\r' } : {}) })
  await page.call('Input.dispatchKeyEvent', { type: 'keyUp', key: value, code: value, windowsVirtualKeyCode: code })
}
const requests = []
page.on('Network.requestWillBeSent', p => requests.push(p.request.url))
await page.call('Runtime.enable'); await page.call('Page.enable'); await page.call('Network.enable')
const { identifier: muteSetup } = await page.call('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('aman.portfolio.muted','true')}catch{}" })
await mkdir('test-results', { recursive: true })
const records = []
try {
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await page.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    await page.call('Page.navigate', { url: origin })
    await until("document.querySelector('main')?.dataset.state==='AWAITING_ENTER'")
    assert.equal(await page.evaluate("document.querySelector('video')===null"), true)
    await key('Enter')
    await until("document.querySelector('[data-media=entrance]')?.currentTime > .1")
    assert.equal(await page.evaluate("document.querySelector('[data-media=entrance]').muted"), true)
    await page.evaluate(`window.__media = {samples:[],loopTimes:[],ended:0};
      document.querySelector('[data-media=entrance]').addEventListener('ended',()=>window.__media.ended++);
      let prev=0;function sample(){const videos=[...document.querySelectorAll('.homepage-video')];const active=videos.filter(v=>Number(getComputedStyle(v).opacity)>.01);const idle=document.querySelector('[data-media=idle]');if(idle&&idle.currentTime<prev-.5)window.__media.loopTimes.push(performance.now());prev=idle?.currentTime||0;
      window.__media.samples.push({at:performance.now(),state:document.querySelector('main').dataset.state,decodedVisible:active.some(v=>v.readyState>=2),videos:videos.map(v=>({kind:v.dataset.media,time:v.currentTime,ready:v.readyState,opacity:getComputedStyle(v).opacity})),audiblePlaying:videos.filter(v=>!v.paused&&!v.muted).length});
      window.__media.frame=requestAnimationFrame(sample)}sample();`)
    await page.evaluate("document.querySelector('[aria-label=\"Unmute audio\"]').click()")
    await until("document.querySelector('audio')?.muted===false")
    assert.equal(await page.evaluate("document.querySelector('[data-media=entrance]').muted"), true)
    assert.equal(await page.evaluate("document.querySelector('[data-media=idle]').paused"), true, 'idle preloads without playing')
    await until("document.querySelector('[data-media=entrance]').currentTime>4.8")
    await writeFile(`test-results/w3-entrance-${width}.png`, Buffer.from((await page.call('Page.captureScreenshot')).data, 'base64'))
    await until("document.querySelector('[data-media=idle][data-active=true]')?.currentTime > .5")
    assert.equal(await page.evaluate("document.querySelector('[data-media=entrance]').paused"), true)
    assert.equal(await page.evaluate("document.querySelector('[data-media=entrance]').muted"), true)
    assert.equal(await page.evaluate("document.querySelector('[data-media=idle]').muted"), true)
    assert.equal(await page.evaluate("document.querySelector('audio').muted"), false)
    assert.equal(await page.evaluate("document.activeElement.dataset.section"), 'Play')
    await until("window.__media.loopTimes.length>=2")
    const result = await page.evaluate(`(()=>{cancelAnimationFrame(window.__media.frame);const v=document.querySelector('[data-media=idle]');const quality=v.getVideoPlaybackQuality();return {...window.__media,frame:undefined,quality:{total:quality.totalVideoFrames,dropped:quality.droppedVideoFrames},idleSize:[v.videoWidth,v.videoHeight],idleDuration:v.duration,overflow:document.documentElement.scrollWidth>innerWidth,menuVisible:[...document.querySelectorAll('.home-menu button')].every(b=>{const r=b.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})}})()`)
    await writeFile(`test-results/w3-debug-${width}.json`, JSON.stringify(result, null, 2))
    assert.equal(result.ended, 1)
    // Browsers briefly lower readyState to HAVE_METADATA while seeking a native
    // loop, retaining the already painted frame. Check decoded coverage of the
    // entrance handoff separately from those seek notifications.
    assert.ok(result.samples.filter(s => s.at < result.loopTimes[0]).every(s => s.decodedVisible), 'no decoded-frame gap during entrance handoff')
    assert.ok(result.samples.every(s => s.audiblePlaying <= 1), 'no overlapping audio playback')
    assert.equal(result.overflow, false); assert.equal(result.menuVisible, true)
    await writeFile(`test-results/w3-idle-${width}.png`, Buffer.from((await page.call('Page.captureScreenshot')).data, 'base64'))
    await page.evaluate("document.querySelector('[aria-label=\"Mute audio\"]').click()")
    await until("document.querySelector('audio').muted")
    await key('Tab'); await key('Enter')
    await until("document.querySelector('#detail-title')?.textContent==='About'")
    await key('Escape')
    records.push({ width, height, ...result })
    console.log(width, height, 'once-only entrance, preloaded idle, no decoded-frame gap/audio overlap, 2 loop wraps, keyboard and sound passed', result.quality)
  }
  await page.call('Network.setCacheDisabled', { cacheDisabled: true })
  let releaseIdle
  let idleRequested = false
  const idleGate = new Promise(resolve => { releaseIdle = resolve })
  page.on('Fetch.requestPaused', async event => {
    idleRequested = true
    // Release all range requests together, including later metadata seeks.
    await idleGate
    await page.call('Fetch.continueRequest', { requestId: event.requestId })
  })
  await page.call('Fetch.enable', { patterns: [{ urlPattern: '*idle.mp4' }] })
  await page.call('Page.navigate', { url: origin })
  await until("document.querySelector('main')?.dataset.state==='AWAITING_ENTER'"); await key('Enter')
  await until("document.querySelector('main')?.dataset.state==='HOME_MENU'")
  assert.ok(idleRequested)
  assert.equal(await page.evaluate("document.querySelector('[data-media=entrance]').ended"), true)
  assert.equal(await page.evaluate("getComputedStyle(document.querySelector('[data-media=entrance]')).opacity"), '1')
  assert.equal(await page.evaluate("getComputedStyle(document.querySelector('[data-media=idle]')).opacity"), '0')
  await writeFile('test-results/w3-idle-wait.png', Buffer.from((await page.call('Page.captureScreenshot')).data, 'base64'))
  releaseIdle()
  await until("document.querySelector('[data-media=idle][data-active=true]')?.currentTime>.5")
  await page.call('Fetch.disable')
  console.log('Delayed idle request retains the decoded final entrance frame until idle presents; no poster/black replacement')
  await page.call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await page.call('Page.navigate', { url: 'about:blank' })
  const before = requests.length
  await page.call('Page.navigate', { url: origin })
  await until("document.querySelector('main')?.dataset.state==='AWAITING_ENTER'"); await key('Enter')
  await until("document.querySelector('main')?.dataset.state==='HOME_MENU'")
  assert.equal(await page.evaluate("document.querySelector('video')===null"), true)
  assert.ok(!requests.slice(before).some(url=>/\.mp4/.test(url)))
  assert.ok(!requests.some(url=>/characters|\.fbx|\.glb|\/assets\/App-/.test(url)))
  assert.deepEqual(page.errors, [])
  await writeFile('test-results/w3-media-results.json', JSON.stringify(records, null, 2))
} finally {
  await page.call('Page.removeScriptToEvaluateOnNewDocument', { identifier: muteSetup })
  await page.call('Fetch.disable')
  await page.call('Emulation.setEmulatedMedia', { features: [] })
  await page.call('Page.navigate', { url: 'about:blank' }); page.close()
}
