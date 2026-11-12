import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { connect } from './cdp.mjs'
const pages = await (await fetch(`http://127.0.0.1:${process.env.DEBUG_PORT ?? 9224}/json`)).json()
const p = await connect(pages.find(p => p.type === 'page').webSocketDebuggerUrl)
const wait = ms => new Promise(r => setTimeout(r, ms))
const until = async expr => { for(let i=0;i<300;i++) { if(await p.evaluate(`!!(${expr})`)) return; await wait(50) } throw Error(expr) }
const metrics = async (width,height,mobile=true) => {
  await p.call('Emulation.setDeviceMetricsOverride',{width,height,screenWidth:width,screenHeight:height,deviceScaleFactor:1,mobile})
  await p.call('Emulation.setTouchEmulationEnabled',{enabled:mobile})
}
const click = async selector => {
  const point = await p.evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`)
  await p.call('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1})
  await p.call('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1})
}
const fresh = async () => {
  await p.call('Page.navigate',{url:'http://127.0.0.1:4173/'})
  await until("document.querySelector('main')?.dataset.state==='AWAITING_ENTER'")
}
const fits = async () => {
  assert.equal(await p.evaluate('document.documentElement.scrollWidth>innerWidth || document.documentElement.scrollHeight>innerHeight'),false)
  assert.equal(await p.evaluate("[...document.querySelectorAll('.home-menu button,.sound-control,.play-controls button,.mode-option')].filter(e=>e.checkVisibility()).every(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth})"),true)
}
try {
  await p.call('Runtime.enable'); await p.call('Page.enable')
  let {identifier} = await p.call('Page.addScriptToEvaluateOnNewDocument',{source:`
    window.calls=[]; localStorage.setItem('aman.portfolio.muted','true');
    Object.defineProperty(document,'fullscreenEnabled',{value:true});
    Element.prototype.requestFullscreen=function(){window.calls.push(['fullscreen',navigator.userActivation.isActive]);return Promise.reject(Error('denied'))};
    screen.orientation.lock=function(){window.calls.push(['lock',navigator.userActivation.isActive]);return Promise.reject(Error('unsupported'))};
  `})
  await metrics(390,844)
  await fresh()
  assert.equal(await p.evaluate("document.querySelector('main').dataset.mobile"),'true')
  assert.equal(await p.evaluate("!!document.querySelector('dialog')"),false)
  await fits(); await click('.enter-button')
  await until("document.querySelector('dialog')?.open")
  assert.deepEqual(await p.evaluate('window.calls.map(x=>x[0])'),['fullscreen','lock'])
  assert.equal(await p.evaluate('window.calls[0][1]'),true)
  await until("document.querySelector('[data-media=entrance]')?.readyState>=2")
  await wait(600)
  assert.equal(await p.evaluate("document.querySelector('[data-media=entrance]').currentTime"),0)
  assert.equal(await p.evaluate("document.querySelector('[data-media=entrance]').paused"),true)
  // A portrait gate must outlive the opening's normal 15-second stall watchdog.
  await wait(15100)
  assert.equal(await p.evaluate("document.querySelector('main').dataset.state"),'ENTRANCE_ANIMATION')
  assert.equal(await p.evaluate("document.querySelector('[data-media=entrance]').currentTime"),0)
  await p.call('Page.captureScreenshot',{format:'png'}).then(r=>writeFile('test-results/w32-rotate.png',Buffer.from(r.data,'base64')))
  await metrics(844,390)
  await until("!document.querySelector('dialog')")
  await until("document.querySelector('[data-media=entrance]').currentTime>.2")
  const before = await p.evaluate("document.querySelector('[data-media=entrance]').currentTime")
  await metrics(390,844)
  await until("document.querySelector('dialog')?.open")
  await wait(350)
  const held = await p.evaluate("document.querySelector('[data-media=entrance]').currentTime")
  assert.ok(held>=before)
  await wait(350)
  assert.equal(await p.evaluate("document.querySelector('[data-media=entrance]').currentTime"),held)
  await metrics(844,390)
  await until("document.querySelector('main').dataset.state==='HOME_MENU'")
  await fits()
  assert.equal(await p.evaluate('window.calls.length'),2)
  await wait(800)
  await p.call('Page.captureScreenshot',{format:'png'}).then(r=>writeFile('test-results/w32-home.png',Buffer.from(r.data,'base64')))
  await click('[data-section=Play]')
  await until("document.querySelector('.play-controls .enter-button')")
  await fits(); await click('.play-controls .enter-button')
  await until("document.querySelector('main').dataset.state==='MODE_SELECTION'")
  await fits()
  await wait(800)
  await p.call('Page.captureScreenshot',{format:'png'}).then(r=>writeFile('test-results/w32-modes.png',Buffer.from(r.data,'base64')))
  await metrics(390,844)
  await until("document.querySelector('dialog')?.open")
  await click('.orientation-gate .enter-button')
  await until("document.querySelector('main').dataset.simplified==='true'")
  await fits()
  assert.equal(await p.evaluate("document.querySelectorAll('audio').length"),1)
  assert.equal(await p.evaluate("document.querySelector('audio').muted"),true)
  // Missing APIs, reduced motion, portrait escape fallback, narrow desktop.
  await p.call('Page.removeScriptToEvaluateOnNewDocument',{identifier})
  // Simulate the successful API lifecycle; native mobile permission behavior
  // still requires physical-device QA. Calls and fullscreen state are observable.
  ;({identifier}=await p.call('Page.addScriptToEvaluateOnNewDocument',{source:`
    window.calls=[]; window.fullElement=null;
    Object.defineProperty(document,'fullscreenEnabled',{value:true});
    Object.defineProperty(document,'fullscreenElement',{get:()=>window.fullElement});
    Element.prototype.requestFullscreen=function(){window.calls.push('fullscreen');window.fullElement=this;document.dispatchEvent(new Event('fullscreenchange'));return Promise.resolve()};
    screen.orientation.lock=function(){window.calls.push('lock');return Promise.resolve()};
    screen.orientation.unlock=function(){window.calls.push('unlock')};
    document.exitFullscreen=function(){window.calls.push('exit');window.fullElement=null;document.dispatchEvent(new Event('fullscreenchange'));return Promise.resolve()};
    localStorage.setItem('aman.portfolio.muted','false');
  `}))
  await metrics(844,390)
  await fresh(); await click('.enter-button')
  await until("window.calls.includes('lock')")
  await until("!document.querySelector('audio').paused")
  const audioTime = await p.evaluate("document.querySelector('audio').currentTime")
  await p.evaluate("void(window.savedAudio=document.querySelector('audio'))")
  await metrics(390,844)
  await until("document.querySelector('dialog')?.open")
  await wait(300)
  assert.ok(await p.evaluate(`document.querySelector('audio').currentTime>${audioTime}`))
  await click('.orientation-controls .sound-control')
  assert.equal(await p.evaluate("document.querySelector('audio').muted"),true)
  await click('.orientation-controls .text-control')
  await until("document.fullscreenElement===null")
  assert.equal(await p.evaluate("window.calls.filter(c=>c==='fullscreen').length"),1)
  await metrics(568,320)
  await until("!document.querySelector('dialog')")
  await until("document.querySelector('main').dataset.state==='HOME_MENU'")
  await fits()
  await click('[data-section=Play]')
  await until("document.querySelector('.play-controls .enter-button')!==null")
  await fits(); await click('.play-controls .enter-button')
  await until("document.querySelector('main').dataset.state==='MODE_SELECTION'")
  await fits()
  await metrics(320,568)
  await until("document.querySelector('dialog')?.open")
  await click('.orientation-gate .enter-button')
  await fits()
  assert.equal(await p.evaluate("window.savedAudio===document.querySelector('audio') && document.querySelector('audio').muted"),true)
  await p.call('Page.removeScriptToEvaluateOnNewDocument',{identifier})
  ;({identifier}=await p.call('Page.addScriptToEvaluateOnNewDocument',{source:`Element.prototype.requestFullscreen=undefined;screen.orientation.lock=undefined;localStorage.setItem('aman.portfolio.muted','true')`}))
  await p.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
  await fresh(); await click('.enter-button')
  await until("document.querySelector('dialog')?.open")
  assert.equal(await p.evaluate("document.querySelectorAll('video').length"),0)
  await p.call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27})
  await until("!document.querySelector('dialog')")
  await fits()
  await metrics(390,844,false); await fresh(); await click('.enter-button')
  assert.equal(await p.evaluate("document.querySelector('main').dataset.mobile"),'false')
  assert.equal(await p.evaluate("!!document.querySelector('dialog')"),false)
  await p.call('Page.removeScriptToEvaluateOnNewDocument',{identifier})
  assert.deepEqual(p.errors,[])
  console.log('Landscape gate: rejected/missing APIs, real gesture, pause/resume without restart, rotation return, idle handoff, Play/modes, portrait fallback, reduced motion, narrow desktop and layout fit passed.')
} finally {
  await p.call('Emulation.clearDeviceMetricsOverride')
  await p.call('Emulation.setTouchEmulationEnabled',{enabled:false})
  await p.call('Emulation.setEmulatedMedia',{features:[]})
  p.close()
}

