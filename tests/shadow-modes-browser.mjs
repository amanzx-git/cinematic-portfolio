import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { connect } from './cdp.mjs'
const origin = process.env.TEST_URL ?? 'http://127.0.0.1:4173'
const pages = await (await fetch(`http://127.0.0.1:${process.env.DEBUG_PORT ?? 9224}/json`)).json()
const p = await connect(pages.find(p=>p.type==='page').webSocketDebuggerUrl)
const wait = ms=>new Promise(r=>setTimeout(r,ms))
const until = async expr=>{for(let i=0;i<400;i++){if(await p.evaluate(`!!(${expr})`))return;await wait(50)}throw Error(expr)}
const state = s=>until(`document.querySelector('main')?.dataset.state==='${s}'`)
const click = async s=>{
  const point=await p.evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(s)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`)
  await p.call('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1})
  await p.call('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1})
}
const metrics=async(width,height,mobile)=>{
  await p.call('Emulation.setDeviceMetricsOverride',{width,height,screenWidth:width,screenHeight:height,deviceScaleFactor:1,mobile})
  await p.call('Emulation.setTouchEmulationEnabled',{enabled:mobile})
}
const home=async()=>{
  await p.call('Page.navigate',{url:origin});await state('AWAITING_ENTER');await click('.enter-button');await state('HOME_MENU')
}
const play=async()=>{
  await click('[data-section=Play]');await state('PLAY_INTRO')
  await p.evaluate(`window.phases=[];window.watch=new MutationObserver(()=>{
    const phase=document.querySelector('.play-experience')?.dataset.transition;
    if(phase&&window.phases.at(-1)?.phase!==phase)window.phases.push({phase,time:performance.now()});
  });window.watch.observe(document.querySelector('.play-experience'),{attributes:true,attributeFilter:['data-transition']});`)
}
let mode='held',releases=[]
const requests=[],interceptionErrors=[]
const cancelledRequests=new Set()
await p.call('Page.enable');await p.call('Runtime.enable');await p.call('Network.enable')
await p.call('Network.setCacheDisabled',{cacheDisabled:true})
const {identifier}=await p.call('Page.addScriptToEvaluateOnNewDocument',{source:`
  localStorage.setItem('aman.portfolio.muted','false');window.musicPlays=0;
  const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(this.tagName==='AUDIO')window.musicPlays++;return play.call(this)};
  Object.defineProperty(document,'fullscreenEnabled',{value:false});screen.orientation.lock=undefined;
`})
p.on('Network.requestWillBeSent',v=>requests.push(v.request.url))
p.on('Network.loadingFailed',v=>{if(v.canceled)cancelledRequests.add(v.requestId)})
p.on('Fetch.requestPaused',async v=>{
  try {
    if(mode==='held')await new Promise(r=>releases.push(r))
    if(mode==='failed')await p.call('Fetch.fulfillRequest',{requestId:v.requestId,responseCode:404,body:''})
    else await p.call('Fetch.continueRequest',{requestId:v.requestId})
  }catch(e){
    // Releasing a held request after source cleanup/navigation can race CDP's
    // loadingFailed event. An expired interception is cancellation, not a media error.
    if(!cancelledRequests.has(v.networkId) && !JSON.stringify(e).includes('Invalid InterceptionId'))interceptionErrors.push(JSON.stringify(e))
  }
})
await p.call('Fetch.enable',{patterns:[{urlPattern:'*shadow-idle.mp4'}]})
const assertModes=async()=>{
  await state('MODE_SELECTION');await until("getComputedStyle(document.querySelector('.mode-selection')).opacity==='1'")
  assert.deepEqual(await p.evaluate("[...document.querySelectorAll('.mode-option h3')].map(n=>n.textContent)"),['Play as Recruiter','Play as Aman','Play with Friend'])
  assert.ok(await p.evaluate('window.musicPlays>=2 && document.querySelectorAll("audio").length===1'))
}
try {
  await mkdir('test-results',{recursive:true});await metrics(1440,900,false)
  await home();assert.ok(!requests.some(v=>v.includes('shadow-idle')))
  await play();await until("document.querySelector('.play-intro-video')?.currentTime>.2")
  assert.ok(requests.some(v=>v.includes('shadow-idle')),'shadow prepares concurrently with intro')
  assert.equal(await p.evaluate("document.querySelector('.play-controls .enter-button')===null"),true)
  assert.equal(await p.evaluate("document.querySelector('progress').value"),1)
  await p.evaluate("document.querySelector('.play-intro-video').currentTime=document.querySelector('.play-intro-video').duration-.6")
  await until("document.querySelector('.play-intro-video')?.ended")
  await wait(600)
  assert.equal(await p.evaluate("getComputedStyle(document.querySelector('.shadow-transition')).opacity"),'0')
  assert.equal(await p.evaluate("document.querySelector('main').dataset.state"),'PLAY_INTRO')
  assert.equal(await p.evaluate("document.querySelector('.mode-selection')===null"),true)
  assert.equal(await p.evaluate("document.querySelector('.play-experience').dataset.transition"),'intro')
  assert.equal(await p.evaluate("document.querySelector('.play-intro-video').readyState>=2 && getComputedStyle(document.querySelector('.play-intro-video')).opacity==='1'"),true)
  assert.equal(await p.evaluate("document.querySelector('.loading-mark')===null"),true)
  const musicTime=await p.evaluate("document.querySelector('audio').currentTime")
  await wait(250);assert.equal(await p.evaluate(`document.querySelector('audio').currentTime`),musicTime)
  await writeFile('test-results/w42-dark-wait.png',Buffer.from((await p.call('Page.captureScreenshot')).data,'base64'))
  mode='normal';releases.splice(0).forEach(r=>r());await assertModes()
  const result=await p.evaluate(`(()=>{const v=document.querySelector('.shadow-idle-video');window.savedShadow=v;window.previous=v.currentTime;window.wraps=0;
    v.addEventListener('timeupdate',()=>{if(v.currentTime<window.previous-.5)window.wraps++;window.previous=v.currentTime});
    return {width:v.videoWidth,height:v.videoHeight,duration:v.duration,loop:v.loop,muted:v.muted,fit:getComputedStyle(v).objectFit,phases:window.phases,optionAnimation:getComputedStyle(document.querySelector('.mode-selection')).animationDuration};})()`)
  assert.equal(result.loop,true);assert.equal(result.muted,true);assert.equal(result.fit,'cover');assert.equal(result.optionAnimation,'0.25s')
  const dark=result.phases.find(v=>v.phase==='darkening'),waiting=result.phases.find(v=>v.phase==='waiting'),revealing=result.phases.find(v=>v.phase==='revealing'),ready=result.phases.find(v=>v.phase==='ready')
  assert.ok(waiting.time-dark.time>=430&&waiting.time-dark.time<850)
  assert.ok(ready.time-revealing.time>=430&&ready.time-revealing.time<850)
  await writeFile('test-results/w42-modes-desktop.png',Buffer.from((await p.call('Page.captureScreenshot')).data,'base64'))
  await until('window.wraps>=2')
  assert.equal(await p.evaluate("[...document.querySelectorAll('video')].filter(v=>!v.paused).length"),1)
  await p.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
  await until("document.querySelector('.shadow-idle-video')===null")
  await p.call('Emulation.setEmulatedMedia',{features:[]})
  await until("document.querySelector('.shadow-idle-video.is-visible')?.readyState>=2")
  await p.evaluate("void(window.savedShadow=document.querySelector('.shadow-idle-video'))")
  assert.equal(await p.evaluate("document.querySelector('.play-intro-video')===null"),true)
  await click('.play-controls .text-control');await state('HOME_MENU')
  assert.equal(await p.evaluate("window.savedShadow.paused&&window.savedShadow.getAttribute('src')===null"),true)
  // Skip and ended in the same turn must enter the same guarded sequence once.
  await play();await until("document.querySelector('.play-controls .enter-button') && document.querySelector('.play-intro-video')?.currentTime>.1")
  await p.evaluate("document.querySelector('.play-controls .enter-button').click();document.querySelector('.play-intro-video').dispatchEvent(new Event('ended'))")
  await assertModes()
  assert.equal(await p.evaluate("window.phases.filter(v=>v.phase==='darkening').length"),1)
  // Failed and stalled incoming media both reveal the established static fallback.
  mode='failed';await home();await play();await until("document.querySelector('.play-controls .enter-button')")
  await click('.play-controls .enter-button');await assertModes()
  assert.equal(await p.evaluate("document.querySelector('.shadow-idle-video')===null && document.body.textContent.includes('nighttime video is unavailable')"),true)
  mode='held';await home();await play();await until("document.querySelector('.play-controls .enter-button')")
  await click('.play-controls .enter-button');await assertModes()
  mode='normal';releases.splice(0).forEach(r=>r())
  // Reduced motion: static modes, zero shadow requests and no transition animations.
  await p.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
  const before=requests.length;await home();await play();await until("document.querySelector('.play-controls .enter-button')")
  await click('.play-controls .enter-button');await assertModes()
  assert.ok(!requests.slice(before).some(v=>/shadow-idle|play-intro\.mp4/.test(v)))
  assert.equal(await p.evaluate("getComputedStyle(document.querySelector('.mode-selection')).animationName"),'none')
  await p.call('Emulation.setEmulatedMedia',{features:[]})
  // Landscape mobile, portrait return, audio/mute and Back during transition.
  await metrics(844,390,true);await home();await play();await until("document.querySelector('.play-controls .enter-button')")
  await click('.play-controls .enter-button');await assertModes()
  await writeFile('test-results/w42-modes-mobile.png',Buffer.from((await p.call('Page.captureScreenshot')).data,'base64'))
  await p.evaluate("void(window.savedShadow=document.querySelector('.shadow-idle-video'))")
  await metrics(390,844,true);await until("document.querySelector('dialog')?.open")
  await wait(200);const held=await p.evaluate('window.savedShadow.currentTime');await wait(400)
  assert.equal(await p.evaluate('window.savedShadow.currentTime'),held)
  await metrics(844,390,true);await until("!document.querySelector('dialog')");await until(`window.savedShadow.currentTime>${held}`)
  await click('.sound-control');assert.equal(await p.evaluate("localStorage.getItem('aman.portfolio.muted')"),'true')
  assert.equal(await p.evaluate('document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight'),false)
  await click('.play-controls .text-control');await state('HOME_MENU');await play();await until("document.querySelector('.play-controls .enter-button')")
  await click('.play-controls .enter-button');await p.evaluate("document.querySelector('.play-controls .text-control').click()")
  await state('HOME_MENU');await wait(1200);await state('HOME_MENU')
  assert.equal(await p.evaluate("document.querySelector('.shadow-idle-video')===null"),true)
  assert.deepEqual(p.errors,[]);assert.deepEqual(interceptionErrors,[])
  assert.ok(!requests.some(v=>/shadow-reveal|characters|\.glb|\.fbx|\/assets\/App-/.test(v)))
  await writeFile('test-results/w42-results.json',JSON.stringify(result,null,2))
  console.log('Shadow modes: natural/Skip shared timing, held-frame gate, loop wraps, failure/timeout fallback, reduced motion, single music, race guard, mobile rotation, saved mute, Back/cleanup passed.',result)
}finally{
  mode='normal';releases.splice(0).forEach(r=>r());await p.call('Fetch.disable')
  await p.call('Page.removeScriptToEvaluateOnNewDocument',{identifier})
  await p.call('Emulation.clearDeviceMetricsOverride');await p.call('Emulation.setTouchEmulationEnabled',{enabled:false});await p.call('Emulation.setEmulatedMedia',{features:[]});p.close()
}
