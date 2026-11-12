import assert from 'node:assert/strict'
import {writeFile} from 'node:fs/promises'
import {connect} from './cdp.mjs'
const base=process.env.TEST_BASE_URL??'http://127.0.0.1:4173'
const port=process.env.TEST_CDP_PORT??'9222'
const pages=await(await fetch('http://127.0.0.1:'+port+'/json')).json()
const c=await connect(pages.find(p=>p.url.startsWith('http://127.0.0.1')).webSocketDebuggerUrl)
await c.call('Runtime.enable');await c.call('Page.enable');await c.call('Emulation.setFocusEmulationEnabled',{enabled:true})
const wait=ms=>new Promise(r=>setTimeout(r,ms))
const read=()=>c.evaluate('({...document.querySelector("output")?.dataset})')
const until=async predicate=>{
  for(let i=0;i<600;i++){const s=await read();if(predicate(s))return s;await wait(25)}
  throw Error('Timeout '+JSON.stringify(await read()))
}
const click=name=>c.evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent===${JSON.stringify(name)}&&!b.disabled&&!b.closest('[inert]')).click()`)
const key=async(code,key,modifiers=0)=>{
  const nativeCode=({Space:32,ArrowUp:38,ArrowDown:40,Escape:27,Tab:9,Enter:13})[code]??0
  await c.call('Input.dispatchKeyEvent',{type:'keyDown',code,key,modifiers,windowsVirtualKeyCode:nativeCode,nativeVirtualKeyCode:nativeCode,...(code==='Enter'?{text:'\r'}:{})})
  await c.call('Input.dispatchKeyEvent',{type:'keyUp',code,key,modifiers,windowsVirtualKeyCode:nativeCode,nativeVirtualKeyCode:nativeCode})
}
const records=[]
for(const [backend,mobile,reduced] of [['',false,false],['?backend=webgl',false,false],['',true,true]]){
  await c.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:reduced?'reduce':'no-preference'}]})
  await c.call('Emulation.setDeviceMetricsOverride',{width:mobile?844:1440,height:mobile?390:900,deviceScaleFactor:1,mobile})
  await c.call('Emulation.setTouchEmulationEnabled',{enabled:mobile})
  await c.call('Page.navigate',{url:base+'/lab/game'+backend})
  await until(s=>s.started==='false')
  await wait(900)
  const ready=await read()
  assert.equal(ready.x,'0');assert.equal(ready.phase,'ready');assert.equal(ready.jumps,'0')
  assert.equal(await c.evaluate('document.activeElement.textContent'),'Start')
  assert.equal(await c.evaluate('document.querySelector(".game-debug").open'),false)
  assert.equal(await c.evaluate('getComputedStyle(document.querySelector("output")).display==="none"||document.querySelector("output").getClientRects().length===0'),true)
  assert.equal(await c.evaluate('document.querySelector("progress").value'),0)
  const readyShot=await c.call('Page.captureScreenshot',{format:'png'})
  await writeFile('test-results/g31-ready-'+(mobile?'mobile':backend?'webgl':'webgpu')+'.png',Buffer.from(readyShot.data,'base64'))
  if(mobile){
    const point=await c.evaluate("(()=>{const r=[...document.querySelectorAll('button')].find(b=>b.textContent==='Start').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()")
    await c.call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]})
    await c.call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
  }else await key('Space',' ')
  await until(s=>s.phase==='running')
  assert.equal((await read()).jumps,'0')
  assert.equal(await c.evaluate('document.activeElement.className'),'game-stage')
  assert.equal(await c.evaluate('!!document.querySelector(".game-overlay")'),false)
  await key('ArrowUp','ArrowUp')
  await until(s=>s.grounded==='false')
  await key('ArrowDown','ArrowDown')
  assert.equal((await read()).slideTime,'0')
  await key('Escape','Escape')
  await until(s=>s.screen==='paused')
  assert.equal(await c.evaluate('document.activeElement.textContent'),'Resume')
  const frozen=await read();await wait(200);assert.equal((await read()).x,frozen.x)
  await key('Tab','Tab')
  assert.equal(await c.evaluate('document.activeElement.textContent'),'Restart')
  await key('Tab','Tab')
  assert.equal(await c.evaluate('document.activeElement.textContent'),'Back')
  await key('Tab','Tab')
  assert.equal(await c.evaluate('document.activeElement.textContent'),'Resume')
  await key('Tab','Tab',8)
  assert.equal(await c.evaluate('document.activeElement.textContent'),'Back')
  await key('Tab','Tab')
  assert.equal(await c.evaluate('document.activeElement.textContent'),'Resume')
  await key('Escape','Escape')
  await until(s=>s.screen==='playing')
  assert.equal(await c.evaluate('document.activeElement.className'),'game-stage')
  await click('Restart')
  await until(s=>s.screen==='resetting')
  await until(s=>s.screen==='playing')
  const fall=await until(s=>s.phase==='fallen')
  assert.equal(await c.evaluate('document.querySelector(".game-failure").textContent.includes("Restarting")'),true)
  assert.equal(await c.evaluate('!!document.querySelector("[role=dialog]")'),false)
  await until(s=>Number(s.restarts)===Number(fall.restarts)+1)
  await until(s=>s.screen==='playing')
  await c.evaluate("document.querySelector('.game-debug summary').click()")
  assert.equal(await c.evaluate('document.querySelector("output").getClientRects().length>0'),true)
  assert.equal(await c.evaluate(`!!document.querySelector('[aria-label="Presentation effects"]')`),true)
  await c.evaluate(`document.querySelector('[aria-label="Environment decorations"]').click()`)
  await until(s=>s.decorations==='false')
  await c.evaluate(`document.querySelector('[aria-label="Environment decorations"]').click()`)
  await until(s=>s.decorations==='true')
  if(!reduced){
    await c.evaluate(`document.querySelector('[aria-label="Presentation effects"]').click()`)
    await until(s=>s.effects==='false')
    await c.evaluate(`document.querySelector('[aria-label="Presentation effects"]').click()`)
    await until(s=>s.effects==='true')
  }
  const reduceState=await read()
  assert.equal(reduceState.reducedMotion,String(reduced))
  if(reduced)assert.equal(reduceState.effects,'false')
  await c.evaluate("document.querySelector('.game-debug summary').click()")
  assert.equal(await c.evaluate('document.documentElement.scrollWidth>innerWidth'),false)
  const bounds=await c.evaluate(`(()=>{
    const stage=document.querySelector('.game-stage').getBoundingClientRect();
    const buttons=[...document.querySelectorAll('.game-controls button')].map(b=>b.getBoundingClientRect());
    return {stageBottom:stage.bottom,top:Math.min(...buttons.map(b=>b.top)),height:Math.min(...buttons.map(b=>b.height))}
  })()`)
  assert.ok(bounds.top>=bounds.stageBottom);assert.ok(bounds.height>=44)
  records.push({backend,mobile,reduced,ready,frozen,fall,bounds})
  await c.evaluate("document.querySelector('.game-hud a').focus()")
  await key('Enter','Enter')
  await wait(700)
  assert.equal(await c.evaluate('location.pathname'),'/lab')
  assert.equal(await c.evaluate('!!document.querySelector(".game-stage")'),false)
}
assert.deepEqual(c.errors,[])
await writeFile('test-results/g31-interface-browser.json',JSON.stringify(records,null,2))
console.log('Ready, native Start, input isolation, focus, pause, failure retry, debug, Back and mobile layout passed')
c.close()
