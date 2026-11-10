// Production baseline via CDP. Start a dedicated browser on DEBUG_PORT (default 9223).
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { connect } from './cdp.mjs'
import { frameStats } from './frame-stats.mjs'

const port = process.env.DEBUG_PORT ?? '9223'
const origin = `${(process.env.TEST_URL ?? 'http://127.0.0.1:4173').replace(/\/$/, '')}/lab`
const output = process.env.PERF_OUTPUT ?? 'test-results/f1-1-baseline.json'
const endpoint = `http://127.0.0.1:${port}`
const browser = await connect((await (await fetch(`${endpoint}/json/version`)).json()).webSocketDebuggerUrl)
const version = await browser.call('Browser.getVersion')
const system = await browser.call('SystemInfo.getInfo')
const { targetId } = await browser.call('Target.createTarget', { url: 'about:blank' })
const pages = await (await fetch(`${endpoint}/json`)).json()
const page = await connect(pages.find(page => page.id === targetId).webSocketDebuggerUrl)
const results = []
const startup = []
let failure = null
const metrics = async () => Object.fromEntries((await page.call('Performance.getMetrics')).metrics.map(metric => [metric.name, metric.value]))
const deltaMetrics = (before, after) => Object.fromEntries(['TaskDuration', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration'].map(key => [key, (after[key] - before[key]) * 1000]))
const collect = async (durationMs, label) => {
  console.log(`Recording ${label}: ${durationMs / 1000}s`)
  const before = await metrics()
  const data = await page.evaluate(`new Promise(resolve => {
    const start = performance.now(); const first = window.__baseline.frames.length;
    setTimeout(() => resolve({frames:window.__baseline.frames.slice(first), start, end:performance.now(), longTasks:window.__baseline.longTasks.filter(task=>task.startTime>=start), visibility:document.visibilityState, visibilityChanges:window.__baseline.visibilityChanges.filter(change=>change.at>=start)}), ${durationMs});
  })`)
  const after = await metrics()
  assert.equal(data.visibility, 'visible', 'Measurement tab must be foreground/visible')
  assert.ok(data.visibilityChanges.every(change => change.state === 'visible'), 'Visibility changed during measurement')
  return { label, requestedDurationMs: durationMs, observedDurationMs: data.end - data.start, stats: frameStats(data.frames.map(frame => frame.interval)), mainThreadMs: deltaMetrics(before, after), longTasks: data.longTasks, frames: data.frames }
}
const snapshot = () => page.evaluate(`(() => {
  const canvas=document.querySelector('canvas');
  return {backend:document.querySelector('[data-testid=backend]').textContent, quality:document.querySelector('select').value, drift:document.querySelector('[data-testid=effects]').checked,
    viewport:{width:innerWidth,height:innerHeight}, canvasCSS:{width:canvas.clientWidth,height:canvas.clientHeight}, drawingBuffer:{width:canvas.width,height:canvas.height}, deviceDPR:devicePixelRatio, actualDPR:canvas.width/canvas.clientWidth, visibility:document.visibilityState, diagnostics:document.querySelector('output')?.textContent};
})()`)
await mkdir('test-results', { recursive: true })
try {
  await page.call('Runtime.enable')
  await page.call('Page.enable')
  await page.call('Performance.enable')
  await page.call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1080, deviceScaleFactor: 1.5, mobile: false })
  await page.call('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__baseline={frames:[],longTasks:[],visibilityChanges:[],canvasAttachedMs:null,backendReadyMs:null};
    document.addEventListener('visibilitychange',()=>window.__baseline.visibilityChanges.push({at:performance.now(),state:document.visibilityState}));
    let previous;
    function frame(now){if(previous!==undefined)window.__baseline.frames.push({at:now,interval:now-previous}); previous=now; requestAnimationFrame(frame)}
    requestAnimationFrame(frame);
    new PerformanceObserver(list=>window.__baseline.longTasks.push(...list.getEntries().map(({startTime,duration})=>({startTime,duration})))).observe({type:'longtask',buffered:true});
    new MutationObserver(()=>{
      if(window.__baseline.canvasAttachedMs===null&&document.querySelector('canvas'))window.__baseline.canvasAttachedMs=performance.now();
      if(window.__baseline.backendReadyMs===null&&/^(WebGPU|WebGL 2)$/.test(document.querySelector('[data-testid=backend]')?.textContent))window.__baseline.backendReadyMs=performance.now();
    }).observe(document,{subtree:true,childList:true,characterData:true});
  ` })
  for (const backend of process.env.CONTROL_ONLY === '1' ? [] : ['auto', 'webgl']) {
    console.log(`Navigate ${backend} production build`)
    await page.call('Page.navigate', { url: `${origin}/${backend === 'webgl' ? '?backend=webgl' : ''}` })
    await page.call('Page.bringToFront')
    // Exactly 15 seconds from navigation, retaining the initial, unfiltered frame intervals.
    await page.evaluate('new Promise(resolve=>setTimeout(resolve,Math.max(0,15000-performance.now())))')
    const initial = await page.evaluate('window.__baseline')
    const context = await snapshot()
    assert.equal(context.visibility, 'visible')
    assert.equal(context.backend, backend === 'auto' ? 'WebGPU' : 'WebGL 2')
    const initialRecord = {
      ...context, backendReadyMs: initial.backendReadyMs, canvasAttachedMs: initial.canvasAttachedMs,
      first5Seconds: frameStats(initial.frames.filter(frame => frame.at <= 5000).map(frame => frame.interval)),
      warmup5To15Seconds: frameStats(initial.frames.filter(frame => frame.at > 5000 && frame.at <= 15000).map(frame => frame.interval)),
      longTasks: initial.longTasks,
    }
    startup.push(initialRecord)
    console.log('Startup/warmup', initialRecord)
    // Counterbalance order to reduce always-measuring-off-first bias.
    for (const drift of backend === 'auto' ? [false, true] : [true, false]) {
      await page.evaluate(`{const input=document.querySelector('[data-testid=effects]'); if(input.checked!==${drift})input.click()}`)
      const transition = await collect(5000, `${backend} drift ${drift}: material warmup`)
      const steady = await collect(30000, `${backend} drift ${drift}: steady state`)
      const record = { context: await snapshot(), transition, steady }
      results.push(record)
      console.log('Steady result', { context: record.context, stats: steady.stats, mainThreadMs: steady.mainThreadMs, longTasks: steady.longTasks })
      const screenshot = await page.call('Page.captureScreenshot')
      await writeFile(`test-results/f1-1-${backend}-${drift ? 'on' : 'off'}.png`, Buffer.from(screenshot.data, 'base64'))
    }
    await page.evaluate("document.querySelector('select').value='Low';document.querySelector('select').dispatchEvent(new Event('change',{bubbles:true}));const input=document.querySelector('[data-testid=effects]');if(!input.checked)input.click()")
    const transition = await collect(5000, `${backend} Low: resize/material warmup`)
    const steady = await collect(15000, `${backend} Low: steady state`)
    results.push({ context: await snapshot(), transition, steady })
    console.log('Low result', { context: await snapshot(), stats: steady.stats })
  }
  if (process.env.CONTROL_ONLY === '1') {
    await page.call('Page.navigate', { url: 'data:text/html,<title>Scheduling control</title>' })
    await page.call('Page.bringToFront')
    await page.evaluate('new Promise(resolve=>setTimeout(resolve,1000))')
    const steady = await collect(30000, 'empty tab: scheduling control')
    results.push({ context: { backend: 'none', scene: 'empty tab', viewport: { width: 1440, height: 1080 }, deviceDPR: 1.5 }, steady })
    console.log('Empty-tab result', steady.stats, steady.mainThreadMs)
  }
  assert.equal(page.errors.length, 0, JSON.stringify(page.errors))
} catch (error) {
  failure = String(error)
  throw error
} finally {
  await writeFile(output, JSON.stringify({ status: failure ? 'rejected' : 'passed', failure, recordedAt: new Date().toISOString(), origin, version, gpu: system.gpu, startup, results, errors: page.errors }, null, 2))
  await browser.call('Target.closeTarget', { targetId })
  page.close()
  browser.close()
}
