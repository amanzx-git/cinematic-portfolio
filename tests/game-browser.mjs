import assert from 'node:assert/strict'
import { mkdir,writeFile } from 'node:fs/promises'
import { connect } from './cdp.mjs'
import { compositionLead } from '../src/game/camera.ts'
import { course } from '../src/game/simulation.ts'

const artifactPrefix = process.env.TEST_ARTIFACT_PREFIX ?? 'g24'
const profile = process.env.PROFILE_GAME === '1'
const baseUrl = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:4173'
const pages=await(await fetch('http://127.0.0.1:'+(process.env.TEST_CDP_PORT ?? '9222')+'/json')).json()
const cdp=await connect(pages.find(p=>p.type==='page' && p.url.startsWith('http://127.0.0.1')).webSocketDebuggerUrl)
await cdp.call('Runtime.enable');await cdp.call('Page.enable')
if (process.env.TEST_HEADLESS !== '1') {
  const testWindow = await cdp.call('Browser.getWindowForTarget')
  await cdp.call('Browser.setWindowBounds',{windowId:testWindow.windowId,bounds:{windowState:'normal'}})
}
await cdp.call('Emulation.setFocusEmulationEnabled',{enabled:true});await cdp.call('Page.bringToFront')
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const read=()=>cdp.evaluate('({...document.querySelector("output")?.dataset})')
const until=async predicate=>{for(let i=0;i<1200;i++){const s=await read();if(predicate(s))return s;await wait(30)}throw Error(JSON.stringify(await read()))}
const click=async name=>{
  if(name==='Test high drop')await cdp.evaluate("if(!document.querySelector('.game-debug').open)document.querySelector('.game-debug summary').click()")
  await cdp.evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent===${JSON.stringify(name)}&&!b.closest('[inert]')&&!b.disabled).click()`)
  if(name==='Test high drop')await cdp.evaluate("if(document.querySelector('.game-debug').open)document.querySelector('.game-debug summary').click()")
}
const tap=async name=>{
  const point=await cdp.evaluate(`(()=>{const r=[...document.querySelectorAll('button')].find(b=>b.textContent===${JSON.stringify(name)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
  await cdp.call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]})
  await cdp.call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
}
await mkdir('test-results',{recursive:true})
const records=[]
let profilingScript
if (profile) {
  profilingScript = await cdp.call('Page.addScriptToEvaluateOnNewDocument',{source:`
    window.gameFrameDiagnostics={longTasks:[],longFrames:[]};
    for(const [type,key] of [['longtask','longTasks'],['long-animation-frame','longFrames']]){
      if(!PerformanceObserver.supportedEntryTypes.includes(type))continue;
      new PerformanceObserver(list=>{
        for(const e of list.getEntries())window.gameFrameDiagnostics[key].push({
          startTime:e.startTime,duration:e.duration,blockingDuration:e.blockingDuration,
          scripts:e.scripts?.map(s=>({function:s.sourceFunctionName,url:s.sourceURL,duration:s.duration,invoker:s.invoker}))
        });
      }).observe({type,buffered:true});
    }
  `})
}
const configurations = process.env.TEST_CONFIG === 'webgpu'
  ? [['',false]] : [['',false],['?backend=webgl',false],['',true]]
for(const [backend,mobile] of configurations){
  await cdp.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]})
  await cdp.call('Emulation.setDeviceMetricsOverride',{width:mobile?844:1440,height:mobile?390:900,deviceScaleFactor:1,mobile})
  await cdp.call('Emulation.setTouchEmulationEnabled',{enabled:mobile})
  if (profile) { await cdp.call('Profiler.enable'); await cdp.call('Profiler.setSamplingInterval',{interval:2000}); await cdp.call('Profiler.start'); await cdp.call('Performance.enable') }
  await cdp.call('Page.navigate',{url:baseUrl + '/lab/game'+backend})
  await until(s=>s.phase==='ready'&&s.started==='false')
  const waiting=await read();await wait(350)
  assert.equal((await read()).x,'0')
  assert.equal(waiting.x,'0')
  assert.equal(await cdp.evaluate('document.activeElement.textContent'),'Start')
  await click('Start')
  await until(s=>s.phase==='running')
  assert.equal((await read()).jumps,'0')
  const readyMs = await cdp.evaluate('performance.now()')
  const metricsBefore = profile ? await cdp.call('Performance.getMetrics') : null
  const actualBackend=await cdp.evaluate('document.querySelector("[data-testid=backend]").textContent')
  assert.equal(actualBackend,backend?'WebGL 2':'WebGPU')
  // Observe diagnostics and schedule actual keyboard events. Touch controls are
  // dispatched by CDP after the page signals each approach.
  await cdp.evaluate(`(()=>{
    const markers=${JSON.stringify(course.takeoffs)};
    window.routeCheck={seen:[],frames:[],slowFrames:[],slides:0,peakDraws:0,peakTriangles:0,waitFor:null,error:null,done:false};
    const result=window.routeCheck;
    let last=performance.now(),jumpSupport=-1,slide=false,hardSeen=false,impactX;
    function frame(now){
      const s=document.querySelector('output').dataset;
      if(now-last>25)result.slowFrames.push({at:now,interval:now-last,x:s.x,animation:s.animation,puffs:s.activePuffs,land:s.landEffects,slide:s.slideEffects,finish:s.finishEffects});
      result.frames.push(now-last);
      result.peakDraws=Math.max(result.peakDraws,Number(s.drawCalls)||0);
      result.peakTriangles=Math.max(result.peakTriangles,Number(s.triangles)||0);
      last=now;
      if(s.phase==='fallen'||Number(s.restarts)>0){result.error={...s};return}
      if(!result.seen.some(v=>v.support===s.support)&&s.grounded==='true')result.seen.push({...s});
      if(s.animation==='Land'){hardSeen=true;impactX??=Number(s.x);}
      if(s.animation==='Slide')result.slides++;
      if(s.phase==='finished'){result.done=true;result.finish={...s};result.hardSeen=hardSeen;return}
      const index=Number(s.support),mark=markers[index];
      if(s.grounded==='true'&&Number(s.recovery)===0&&mark!=null&&jumpSupport!==index&&Number(s.x)>=mark-.12){
        jumpSupport=index;
        if(${mobile})result.waitFor='Jump';
        else window.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',key:' ',bubbles:true}));
      }
      if(!slide&&index===5&&Number(s.x)>=78.85){
        slide=true;
        if(${mobile})result.waitFor='Slide';
        else {
          window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyS',key:'s',bubbles:true}));
          window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyS',key:'s',bubbles:true}));
        }
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  })()`)
  const deadline=Date.now()+65000
  let result
  while(Date.now()<deadline){
    result=await cdp.evaluate('({done:routeCheck.done,error:routeCheck.error,waitFor:routeCheck.waitFor})')
    assert.equal(result.error,null,JSON.stringify(result.error))
    if(result.done)break
    if(result.waitFor){const action=result.waitFor;await cdp.evaluate('window.routeCheck.waitFor=null');await tap(action)}
    await wait(mobile?15:150)
  }
  if (result.done) result=await cdp.evaluate('window.routeCheck')
  await writeFile('test-results/'+artifactPrefix+'-latest-route.json',JSON.stringify(result))
  assert.equal(result.done,true)
  assert.equal(result.finish.screen,'complete');
  assert.equal(result.finish.jumps,'5');assert.equal(result.finish.landings,'6');assert.equal(result.finish.hardLandings,'1')
  assert.equal(result.finish.landCompletions,'1');assert.equal(result.finish.x,'147')
  assert.equal(result.hardSeen,true);assert.ok(result.slides>0)
  if (result.finish.effects !== undefined) assert.equal(result.finish.effects,'true')
  if (result.finish.effects === 'true') {
    assert.equal(result.finish.landEffects,'1')
    assert.equal(result.finish.slideEffects,'1')
    assert.equal(result.finish.finishEffects,'1')
    assert.equal(result.finish.failureEffects,'0')
  }
  assert.equal(new Set(result.seen.map(s=>s.support)).size,11)
  assert.ok(Math.abs(Number(result.finish.cameraX)-Number(result.finish.actorX)-compositionLead(course.finish))<1)
  if (profile) {
    const cpu = await cdp.call('Profiler.stop')
    await writeFile(`test-results/${artifactPrefix}-${mobile?'mobile':backend?'webgl':'webgpu'}-cpu.json`,JSON.stringify(cpu))
  }
  const frameDiagnostics = profile ? await cdp.evaluate('window.gameFrameDiagnostics') : null
  const metricsAfter = profile ? await cdp.call('Performance.getMetrics') : null
  const sorted=result.frames.slice(120).sort((a,b)=>a-b)
  const metrics={slowFrames:result.slowFrames,peakDraws:result.peakDraws,peakTriangles:result.peakTriangles,readyMs, frameDiagnostics, metricsBefore, metricsAfter, startupFrames:result.frames.slice(0,120), backend:actualBackend,mobile,median:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],max:sorted.at(-1),drawCalls:result.finish.drawCalls,triangles:result.finish.triangles}
  const shot=await cdp.call('Page.captureScreenshot',{format:'png'})
  await writeFile(`test-results/${artifactPrefix}-${mobile?'mobile':backend?'webgl':'webgpu'}-finish.png`,Buffer.from(shot.data,'base64'))
  assert.equal(await cdp.evaluate('document.documentElement.scrollWidth>innerWidth'),false)
  assert.equal(await cdp.evaluate('document.activeElement.textContent'),'Replay')
  assert.equal(await cdp.evaluate('document.querySelector("progress").value'),course.finish)
  assert.equal(await cdp.evaluate('document.querySelector(".game-debug").open'),false)
  assert.equal(await cdp.evaluate('new URL(document.querySelector("[role=dialog] a").href).pathname'),'/lab')
  assert.equal(await cdp.evaluate('!!document.querySelector(".game-failure")'),false)
  if(mobile)await tap('Replay')
  else {
    await cdp.call('Input.dispatchKeyEvent',{type:'keyDown',code:'Tab',key:'Tab',modifiers:8})
    await cdp.call('Input.dispatchKeyEvent',{type:'keyUp',code:'Tab',key:'Tab',modifiers:8})
    assert.equal(await cdp.evaluate('document.activeElement.textContent'),'Back')
    await cdp.call('Input.dispatchKeyEvent',{type:'keyDown',code:'Tab',key:'Tab'})
    await cdp.call('Input.dispatchKeyEvent',{type:'keyUp',code:'Tab',key:'Tab'})
    assert.equal(await cdp.evaluate('document.activeElement.textContent'),'Replay')
    await cdp.call('Input.dispatchKeyEvent',{type:'keyDown',code:'Enter',key:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13,text:'\r'})
    await cdp.call('Input.dispatchKeyEvent',{type:'keyUp',code:'Enter',key:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13})
  }
  const reset=await until(s=>s.phase==='running'&&s.restarts==='1')
  if (reset.effects !== undefined) { assert.equal(reset.activePuffs,'0'); assert.equal(reset.landEffects,'0'); assert.equal(reset.finishEffects,'0') }
  assert.ok(Number(reset.x)<.5);assert.ok(Math.abs(Number(reset.cameraX)-Number(reset.actorX)-2.6)<.15);assert.equal(reset.cameraY,'0')
  await click('Test high drop');await until(s=>s.animation==='Land')
  await click('Pause');await wait(100);const paused=await read()
  await wait(200);const frozen=await read();assert.equal(frozen.x,paused.x);assert.equal(frozen.landClipTime,paused.landClipTime)
  await click('Resume');await until(s=>s.animation==='Run'&&s.recovery==='0')
  await click('Restart');await until(s=>s.phase==='ready');await until(s=>s.phase==='running')
  if(mobile)await tap('Slide');else await cdp.evaluate("window.dispatchEvent(new KeyboardEvent('keydown',{code:'ArrowDown',key:'ArrowDown'}));window.dispatchEvent(new KeyboardEvent('keyup',{code:'ArrowDown',key:'ArrowDown'}))")
  await until(s=>s.animation==='Slide')
  await click('Pause');await wait(100);const slidePause=await read()
  await wait(200);assert.equal((await read()).slideTime,slidePause.slideTime)
  await click('Restart');await wait(100);assert.equal((await read()).animation,'Idle')
  await click('Resume');await until(s=>s.phase==='running')
  const fallen=await until(s=>s.phase==='fallen')
  assert.equal(fallen.failure,'fall')
  if (fallen.effects === 'true') assert.equal(fallen.failureEffects,'1')
  const resetCount=Number(fallen.restarts)+1
  await until(s=>s.phase==='ready'&&Number(s.restarts)===resetCount)
  records.push({metrics,route:result.seen,finished:result.finish,reset})
}
await cdp.call('Page.navigate',{url:baseUrl + '/lab/runner'})
await wait(1000)
assert.equal(await cdp.evaluate('!!document.querySelector(".game-lab")'),false)
assert.deepEqual(cdp.errors,[])
await writeFile('test-results/'+artifactPrefix+'-game-browser.json',JSON.stringify(records,null,2))
console.log('Full-route WebGPU/WebGL 2 and mobile emulation passed',records.map(r=>({backend:r.metrics.backend,mobile:r.metrics.mobile,readyMs:r.metrics.readyMs,median:r.metrics.median,p95:r.metrics.p95,max:r.metrics.max,drawCalls:r.metrics.drawCalls,triangles:r.metrics.triangles})))
if (profilingScript) await cdp.call('Page.removeScriptToEvaluateOnNewDocument',{identifier:profilingScript.identifier})
cdp.close()
