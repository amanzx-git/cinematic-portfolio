// W4.1: real delivered cinematic, manifest, audio and mobile orientation flow.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { connect } from './cdp.mjs'
const origin = process.env.TEST_URL ?? 'http://127.0.0.1:4173'
const pages = await (await fetch(`http://127.0.0.1:${process.env.DEBUG_PORT ?? 9224}/json`)).json()
const p = await connect(pages.find(p => p.type === 'page').webSocketDebuggerUrl)
const wait = ms => new Promise(r => setTimeout(r,ms))
const until = async expr => { for(let i=0;i<1200;i++) { if(await p.evaluate(`!!(${expr})`)) return; await wait(50) } throw Error(expr) }
const state = name => until(`document.querySelector('main')?.dataset.state==='${name}'`)
const click = async selector => {
  const point = await p.evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`)
  await p.call('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1})
  await p.call('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1})
}
const metrics = async (width,height,mobile) => {
  await p.call('Emulation.setDeviceMetricsOverride',{width,height,screenWidth:width,screenHeight:height,deviceScaleFactor:1,mobile})
  await p.call('Emulation.setTouchEmulationEnabled',{enabled:mobile})
}
let release, hold = true
const requests = [], interceptionErrors = []
await p.call('Runtime.enable'); await p.call('Page.enable'); await p.call('Network.enable')
const {identifier} = await p.call('Page.addScriptToEvaluateOnNewDocument',{source:`
  localStorage.setItem('aman.portfolio.muted','false');window.musicPlays=0;
  const play=HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play=function(){if(this.tagName==='AUDIO')window.musicPlays++;return play.call(this)};
  Object.defineProperty(document,'fullscreenEnabled',{value:false});screen.orientation.lock=undefined;
`})
p.on('Network.requestWillBeSent',v=>requests.push(v.request.url))
p.on('Fetch.requestPaused',async v=>{
  try {
    if(hold) await new Promise(r=>{release=r})
    await p.call('Fetch.continueRequest',{requestId:v.requestId})
  } catch(e) { interceptionErrors.push(String(e)) }
})
await p.call('Fetch.enable',{patterns:[{urlPattern:'*ModeSelection-*.js'}]})
await p.call('Network.setCacheDisabled',{cacheDisabled:true})
await mkdir('test-results',{recursive:true})
try {
  await metrics(1440,900,false)
  await p.call('Page.navigate',{url:origin}); await state('AWAITING_ENTER')
  assert.ok(!requests.some(url=>url.includes('play-intro.mp4')))
  await click('.enter-button'); await state('HOME_MENU')
  assert.ok(!requests.some(url=>url.includes('play-intro.mp4')))
  await p.evaluate("void(window.savedAudio=document.querySelector('audio'))")
  await click('[data-section=Play]'); await state('PLAY_INTRO')
  await until("document.querySelector('.play-intro-video')?.currentTime>.3")
  const metadata = await p.evaluate("(()=>{const v=document.querySelector('.play-intro-video');window.savedVideo=v;window.endedCount=0;v.addEventListener('ended',()=>window.endedCount++);return {width:v.videoWidth,height:v.videoHeight,duration:v.duration,muted:v.muted,loop:v.loop,fit:getComputedStyle(v).objectFit}})()")
  assert.ok(Number.isFinite(metadata.duration)&&metadata.duration>0)
  assert.equal(metadata.muted,true); assert.equal(metadata.loop,false); assert.equal(metadata.fit,'cover')
  assert.equal(await p.evaluate("document.querySelector('.play-controls .enter-button')===null"),true)
  await wait(700)
  await writeFile('test-results/w41-cinematic-desktop.png',Buffer.from((await p.call('Page.captureScreenshot')).data,'base64'))
  await until("document.querySelector('.play-intro-video')?.ended")
  await wait(500)
  assert.equal(await p.evaluate("window.savedVideo===document.querySelector('.play-intro-video') && window.savedVideo.readyState>=2 && getComputedStyle(window.savedVideo).opacity==='1'"),true)
  assert.equal(await p.evaluate("document.querySelector('.play-controls .enter-button')===null"),true)
  assert.equal(await p.evaluate('window.endedCount'),1)
  assert.equal(await p.evaluate("document.querySelectorAll('video').length"),2)
  assert.equal(await p.evaluate("window.savedAudio===document.querySelector('audio') && !window.savedAudio.paused && window.musicPlays===1"),true)
  const musicPosition = await p.evaluate('window.savedAudio.currentTime')
  await wait(250)
  assert.notEqual(await p.evaluate('window.savedAudio.currentTime'), musicPosition)
  hold=false; assert.ok(release); release(); await state('MODE_SELECTION')
  await wait(600)
  assert.equal(await p.evaluate("window.savedVideo.paused && !window.savedVideo.isConnected && window.endedCount===1"),true)
  assert.equal(await p.evaluate("document.querySelector('.loading-status')===null"),true)
  await writeFile('test-results/w41-modes.png',Buffer.from((await p.call('Page.captureScreenshot')).data,'base64'))
  await click('.play-controls .text-control'); await state('HOME_MENU')
  await click('[data-section=About]'); await until("document.querySelector('#detail-title')?.textContent==='About'")
  await click('.menu-detail button'); await click('[data-section=Play]')
  await until("document.querySelector('.play-intro-video')?.currentTime>.1 && document.querySelector('.play-controls .enter-button')")
  await click('.play-controls .enter-button'); await state('MODE_SELECTION')
  assert.equal(await p.evaluate("!document.querySelector('.play-intro-video') && window.musicPlays===1"),true)
  // Mobile gate pauses this cinematic without restarting its media or soundtrack.
  await metrics(844,390,true)
  await p.call('Page.navigate',{url:origin}); await state('AWAITING_ENTER')
  await click('.enter-button'); await state('HOME_MENU'); await click('[data-section=Play]')
  await until("document.querySelector('.play-intro-video')?.currentTime>.4")
  await wait(500)
  await writeFile('test-results/w41-cinematic-mobile.png',Buffer.from((await p.call('Page.captureScreenshot')).data,'base64'))
  await p.evaluate("void(window.mobileVideo=document.querySelector('.play-intro-video'))")
  await metrics(390,844,true); await until("document.querySelector('dialog')?.open")
  await wait(200)
  const held = await p.evaluate('window.mobileVideo.currentTime')
  const musicTime = await p.evaluate("document.querySelector('audio').currentTime")
  await wait(500)
  assert.equal(await p.evaluate('window.mobileVideo.currentTime'),held)
  assert.ok(await p.evaluate(`document.querySelector('audio').currentTime>${musicTime}`))
  await metrics(844,390,true); await until("!document.querySelector('dialog')")
  await until(`window.mobileVideo.currentTime>${held}`)
  assert.equal(await p.evaluate("window.mobileVideo===document.querySelector('.play-intro-video')"),true)
  await click('.sound-control'); assert.equal(await p.evaluate("localStorage.getItem('aman.portfolio.muted')"),'true')
  await click('.play-controls .enter-button'); await state('MODE_SELECTION')
  assert.equal(await p.evaluate("document.querySelector('audio').muted && window.musicPlays===1 && document.querySelectorAll('audio').length===1"),true)
  assert.equal(await p.evaluate('document.documentElement.scrollWidth>innerWidth || document.documentElement.scrollHeight>innerHeight'),false)
  assert.ok(!requests.some(url=>/characters|\.glb|\.fbx|\/assets\/App-/.test(url)))
  assert.deepEqual(interceptionErrors,[]); assert.deepEqual(p.errors,[])
  await writeFile('test-results/w41-media.json',JSON.stringify(metadata,null,2))
  console.log('Actual cinematic:',metadata,'; natural completion, retained final frame/delayed modes, ready Skip, uninterrupted single soundtrack, navigation, mobile rotation pause/resume and saved mute passed.')
} finally {
  release?.(); await p.call('Fetch.disable')
  await p.call('Page.removeScriptToEvaluateOnNewDocument',{identifier})
  await p.call('Emulation.clearDeviceMetricsOverride'); await p.call('Emulation.setTouchEmulationEnabled',{enabled:false})
  p.close()
}
