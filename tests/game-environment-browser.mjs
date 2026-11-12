import assert from 'node:assert/strict'
import { mkdir,writeFile } from 'node:fs/promises'
import { connect } from './cdp.mjs'
const artifactPrefix = process.env.TEST_ARTIFACT_PREFIX ?? 'g24'
const baseUrl = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:4173'
const pages=await(await fetch('http://127.0.0.1:'+(process.env.TEST_CDP_PORT ?? '9222')+'/json')).json()
const p=await connect(pages.find(p=>p.type==='page' && p.url.startsWith('http://127.0.0.1')).webSocketDebuggerUrl)
await p.call('Runtime.enable');await p.call('Page.enable');await p.call('Emulation.setFocusEmulationEnabled',{enabled:true});await p.call('Page.bringToFront')
const wait=ms=>new Promise(r=>setTimeout(r,ms))
const until=async expr=>{for(let i=0;i<160;i++){if(await p.evaluate(expr))return;await wait(50)}throw Error(expr)}
const click=name=>p.evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent===${JSON.stringify(name)}).click()`)
const read=()=>p.evaluate(`({...document.querySelector('output').dataset})`)
const sample=()=>p.evaluate(`new Promise(resolve=>{const intervals=[];let first,previous;function frame(now){first??=now;if(previous!==undefined)intervals.push(now-previous);previous=now;if(now-first<3000)requestAnimationFrame(frame);else{intervals.sort((a,b)=>a-b);resolve({frames:intervals.length,medianMs:intervals[Math.floor(intervals.length*.5)],p95Ms:intervals[Math.floor(intervals.length*.95)],p99Ms:intervals[Math.floor(intervals.length*.99)],maxMs:intervals.at(-1),...document.querySelector('output').dataset})}}requestAnimationFrame(frame)})`)
await mkdir('test-results',{recursive:true})
const results=[]
for(const backend of ['auto','webgl']) {
 await p.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]})
 await p.call('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false})
 await p.call('Page.navigate',{url:baseUrl + '/lab/game'+(backend==='webgl'?'?backend=webgl':'')})
 await until(`!![...document.querySelectorAll('button')].find(b=>b.textContent==='Start'&&!b.disabled)`)
 await click('Start')
 await until(`!!document.querySelector('canvas') && Number(document.querySelector('output')?.dataset.x)>1`)
 await click('Pause');await wait(800)
 for(const enabled of [true,false]) {
  await p.evaluate(`{const e=document.querySelector('[aria-label="Environment decorations"]');if(e.checked!==${enabled})e.click()}`)
  await wait(1000)
  const record=await sample();assert.equal(record.decorations,String(enabled));assert.ok(Number(record.drawCalls)>=10&&Number(record.drawCalls)<30);assert.ok(Number(record.triangles)>49000)
  results.push({backend,enabled,...record})
  const shot=await p.call('Page.captureScreenshot',{format:'png'});await writeFile('test-results/'+artifactPrefix+'-'+backend+'-'+(enabled?'on':'off')+'.png',Buffer.from(shot.data,'base64'))
 }
 await p.evaluate(`document.querySelector('[aria-label="Environment decorations"]').click()`)
 const before=await read();await click('Restart')
 await until(`Number(document.querySelector('output')?.dataset.restarts)===${Number(before.restarts)+1}`)
 const after=await read();assert.equal(after.cameraX,'2.6');assert.equal(after.actorX,'0')
 // No sweep or discontinuity in the city relative to the view on restart.
 assert.ok(Math.abs(Number(after.cityFarOffset)-Number(before.cityFarOffset))<.005)
 results.push({backend,restartBefore:before.cityFarOffset,restartAfter:after.cityFarOffset})
}
assert.deepEqual(p.errors,[])
await writeFile('test-results/'+artifactPrefix+'-environment.json',JSON.stringify(results,null,2));console.log('Environment comparison/restart checks passed',results.map(r=>({backend:r.backend,enabled:r.enabled,drawCalls:r.drawCalls,triangles:r.triangles,median:r.medianMs,p95:r.p95Ms,restartBefore:r.restartBefore,restartAfter:r.restartAfter})))
p.close()

