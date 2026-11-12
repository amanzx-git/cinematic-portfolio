// W4.5 real-media audio ownership and navigation checks (CDP, production preview).
import assert from 'node:assert/strict'
import {writeFile,mkdir} from 'node:fs/promises'
import {connect} from './cdp.mjs'
const pages=await(await fetch(`http://127.0.0.1:${process.env.DEBUG_PORT??9222}/json`)).json()
const p=await connect(pages.find(p=>p.type==='page').webSocketDebuggerUrl)
const origin=process.env.TEST_URL??'http://127.0.0.1:4173'
const wait=ms=>new Promise(r=>setTimeout(r,ms))
const until=async(expr,timeout=15000)=>{for(let i=0;i<timeout/50;i++){if(await p.evaluate(expr))return;await wait(50)}throw Error('Timed out '+expr)}
const click=async selector=>{const point=await p.evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await p.call('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await p.call('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1})}
const home=()=>until(`document.querySelector('main')?.dataset.state==='HOME_MENU'`)
const modes=()=>until(`document.querySelector('main')?.dataset.state==='MODE_SELECTION' && document.querySelector('audio').volume>.349`,60000)
await p.call('Page.enable');await p.call('Runtime.enable')
const {identifier}=await p.call('Page.addScriptToEvaluateOnNewDocument',{source:`
localStorage.setItem('aman.portfolio.muted','false');window.audioSamples=[];window.ambientPlays=0;
const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(this.tagName==='AUDIO')window.ambientPlays++;return play.call(this)};
function frame(){const a=document.querySelector('audio'),v=document.querySelector('.play-intro-video');if(a){const audible=e=>!!e&&!e.paused&&!e.muted&&e.volume>.001;window.audioSamples.push({t:performance.now(),owner:document.querySelector('main')?.dataset.state,phase:document.querySelector('.play-experience')?.dataset.transition,a:audible(a),v:audible(v),volume:a.volume,at:a.currentTime,vt:v?.currentTime});}requestAnimationFrame(frame)}requestAnimationFrame(frame);
`})
try {
 await p.call('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false})
 await p.call('Page.navigate',{url:origin});await until(`document.querySelector('main')?.dataset.state==='AWAITING_ENTER'`)
 await click('.enter-button');await home();await until(`document.querySelector('audio').volume>.349`)
 await p.evaluate(`void(window.savedAmbient=document.querySelector('audio'))`)
 await click('[data-section=Play]');await until(`document.querySelector('.play-intro-video')?.currentTime>.3`)
 assert.equal(await p.evaluate(`document.querySelector('audio').paused && !document.querySelector('.play-intro-video').muted`),true)
 const position=await p.evaluate(`document.querySelector('audio').currentTime`)
 await until(`document.querySelector('progress')?.value===2`);await wait(600)
 assert.equal(await p.evaluate(`document.querySelector('audio').currentTime`),position)
 await click('.sound-control');assert.equal(await p.evaluate(`document.querySelector('.play-intro-video').muted`),true)
 await click('.sound-control');await until(`!document.querySelector('.play-intro-video').muted`)
 assert.equal(await p.evaluate(`document.querySelector('audio').paused`),true)
 await click('.cinematic-skip');await modes()
 assert.equal(await p.evaluate(`window.savedAmbient===document.querySelector('audio') && document.querySelectorAll('audio').length===1`),true)
 assert.ok(await p.evaluate(`document.querySelector('audio').currentTime>=${position}`))
 // Back during intro and rapidly during the fade/handoff.
 await click('.play-controls .text-control');await home()
 for(let i=0;i<3;i++){
  await p.evaluate(`document.querySelector('[data-section=Play]').click()`)
  await until(`!!document.querySelector('.play-controls .text-control')`)
  await p.evaluate(`document.querySelector('.play-controls .text-control').click()`);await home()
 }
 await wait(800);assert.equal(await p.evaluate(`document.querySelector('audio').paused`),false)
 // Uninterrupted natural playback with the current real file (no seek).
 await click('[data-section=Play]');await until(`document.querySelector('.play-intro-video')?.currentTime>.2`)
 await p.evaluate(`void(window.naturalVideo=document.querySelector('.play-intro-video'));window.naturalEnded=false;window.naturalVideo.addEventListener('ended',()=>{window.naturalEnded=true;window.nativeAudioEvidence={duration:window.naturalVideo.duration,decodedAudio:window.naturalVideo.webkitAudioDecodedByteCount}})`)
 await modes()
 assert.equal(await p.evaluate(`window.naturalEnded && window.naturalVideo.paused && window.naturalVideo.muted`),true)
 const result=await p.evaluate(`({samples:window.audioSamples.length,overlap:window.audioSamples.filter(s=>s.a&&s.v),blackAudio:window.audioSamples.filter(s=>['darkening','waiting','revealing'].includes(s.phase)&&(s.a||s.v)),...window.nativeAudioEvidence,ambientPlays:window.ambientPlays})`)
 assert.deepEqual(result.overlap,[]);assert.deepEqual(result.blackAudio,[])
 // Back in the black transition must restore home ownership.
 await click('.play-controls .text-control');await home();await click('[data-section=Play]')
 await until(`!!document.querySelector('.cinematic-skip')`);await click('.cinematic-skip')
 await click('.play-controls .text-control');await home();await until(`!document.querySelector('audio').paused && document.querySelector('audio').volume>.349`)
 // Reject audible intro playback, retaining moving visuals and explicit mute preference.
 await p.evaluate(`window.originalPlay=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(this.classList.contains('play-intro-video')&&!this.muted)return Promise.reject(new DOMException('Blocked','NotAllowedError'));return window.originalPlay.call(this)}`)
 await click('[data-section=Play]');await until(`document.body.textContent.includes('Intro audio was blocked')`)
 await until(`document.querySelector('.play-intro-video')?.currentTime>.1`)
 assert.equal(await p.evaluate(`localStorage.getItem('aman.portfolio.muted')`),'false')
 assert.equal(await p.evaluate(`document.querySelector('audio').paused`),true)
 await p.evaluate(`HTMLMediaElement.prototype.play=window.originalPlay`)
 await click('.sound-control');await click('.sound-control');await until(`!document.querySelector('.play-intro-video').muted`)
 await click('.play-controls .text-control');await home()
 Object.assign(result,await p.evaluate(`({samples:window.audioSamples.length,overlap:window.audioSamples.filter(s=>s.a&&s.v),blackAudio:window.audioSamples.filter(s=>['darkening','waiting','revealing'].includes(s.phase)&&(s.a||s.v))})`))
 assert.deepEqual(result.overlap,[]);assert.deepEqual(result.blackAudio,[])
 assert.deepEqual(p.errors,[])
 await mkdir('test-results',{recursive:true});await writeFile('test-results/w45-audio.json',JSON.stringify(result,null,2))
 console.log('W4.5 real-media handoffs, natural end/Skip, black silence, mute/retry, Back/races and no overlaps passed',result)
}finally{await p.call('Page.removeScriptToEvaluateOnNewDocument',{identifier});p.close()}
