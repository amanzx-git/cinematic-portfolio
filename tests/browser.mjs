// Run after starting Chrome with --remote-debugging-port=9222 and the Vite server.
import assert from 'node:assert/strict'
import { writeFile, mkdir } from 'node:fs/promises'
const pages = await (await fetch('http://127.0.0.1:9222/json')).json()
const socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl)
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }))
let id = 0
const pending = new Map()
const errors = []
const measurements = []
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data)
  if (message.id) { pending.get(message.id)?.(message); pending.delete(message.id) }
  if (message.method === 'Runtime.exceptionThrown' || (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error')) errors.push(message.params)
})
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const requestId = ++id
  pending.set(requestId, result => result.error ? reject(result.error) : resolve(result.result))
  socket.send(JSON.stringify({ id: requestId, method, params }))
})
const evaluate = async expression => (await call('Runtime.evaluate', { expression, returnByValue: true })).result.value
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const origin = `${(process.env.TEST_URL ?? 'http://127.0.0.1:5173').replace(/\/$/, '')}/lab`
const measure = async () => {
  const result = await call('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `new Promise(resolve => {
    const times = []; let previous; let start;
    function frame(now) {
      if (start === undefined) start = now;
      if (previous !== undefined) times.push(now - previous);
      previous = now;
      if (now - start < 3000) requestAnimationFrame(frame);
      else {
        times.sort((a,b)=>a-b);
        const worst = times.slice(-Math.max(1, Math.ceil(times.length * .01)));
        resolve({frames:times.length, medianMs:times[Math.floor(times.length/2)], p99Ms:times[Math.floor(times.length*.99)], maxMs:times.at(-1), onePercentLowFPS:1000/(worst.reduce((a,b)=>a+b,0)/worst.length)});
      }
    }
    requestAnimationFrame(frame);
  })` })
  return result.result.value
}
await call('Runtime.enable')
await call('Page.enable')
await mkdir('test-results', { recursive: true })
for (const backend of ['auto', 'webgl', 'unavailable']) {
  await call('Page.addScriptToEvaluateOnNewDocument', { source: backend === 'unavailable' ? "Object.defineProperty(navigator, 'gpu', {value: undefined})" : '' })
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1.5, mobile: false })
  await call('Page.navigate', { url: `${origin}/${backend === 'webgl' ? '?backend=webgl' : ''}` })
  let state
  for (let attempt = 0; attempt < 40; attempt++) {
    await wait(250)
    state = await evaluate("({backend: document.querySelector('[data-testid=backend]')?.textContent, frames: document.querySelector('output')?.textContent, canvas: !!document.querySelector('canvas')})")
    if (state?.frames?.includes('FPS')) break
  }
  assert.ok(state?.canvas && state.frames.includes('FPS'), JSON.stringify(state))
  if (backend !== 'auto') assert.equal(state.backend, 'WebGL 2')
  console.log(backend, state)
  await evaluate("document.querySelector('.viewport').style.height = document.querySelector('.viewport').clientWidth * 9 / 16 + 'px'")
  await wait(1000)
  if (backend !== 'unavailable') {
    for (const effects of [false, true]) {
      await evaluate(`{const input=document.querySelector('[data-testid=effects]'); if(input.checked!==${effects})input.click()}`)
      await wait(1200)
      const timing = await measure()
      const record = { backend, effects, quality: 'Balanced', timing, diagnostics: await evaluate("document.querySelector('output').textContent") }
      measurements.push(record)
      console.log('16:9 comparison', record)
      const screenshot = await call('Page.captureScreenshot')
      await writeFile(`test-results/${backend}-desktop-${effects ? 'on' : 'off'}.png`, Buffer.from(screenshot.data, 'base64'))
    }
    await evaluate("document.querySelector('select').value='Low'; document.querySelector('select').dispatchEvent(new Event('change',{bubbles:true}))")
    await wait(1200)
    const low = { backend, effects: true, quality: 'Low', timing: await measure(), diagnostics: await evaluate("document.querySelector('output').textContent") }
    measurements.push(low)
    console.log('16:9 Low', low)
  }
  await evaluate("document.querySelector('.viewport').style.height = ''")
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: false })
  for (const [quality, dpr] of [['High','2.00'], ['Balanced','1.50'], ['Low','1.00']]) {
    await evaluate(`document.querySelector('select').value='${quality}'; document.querySelector('select').dispatchEvent(new Event('change',{bubbles:true}))`)
    let text = ''
    for (let attempt = 0; attempt < 30; attempt++) {
      await wait(200)
      text = await evaluate("document.querySelector('output').textContent")
      if (text.includes('DPR ' + dpr)) break
    }
    assert.ok(text.includes('DPR ' + dpr), `${backend} ${quality}: ${text}`)
  }
  await wait(1200)
  const resized = await evaluate("({frames:document.querySelector('output').textContent, width:document.querySelector('canvas').width, client:document.querySelector('canvas').clientWidth, overflow:document.documentElement.scrollWidth>innerWidth})")
  assert.ok(resized.frames.includes('DPR 1.00'), JSON.stringify(resized))
  assert.equal(resized.overflow, false)
  await evaluate("document.querySelector('input[type=checkbox]').click()")
  await wait(600)
  assert.equal(await evaluate("document.querySelector('output') === null"), true)
  await evaluate("document.querySelector('input[type=checkbox]').click()")
  console.log('narrow low', resized)
  const screenshot = await call('Page.captureScreenshot')
  await writeFile(`test-results/${backend}.png`, Buffer.from(screenshot.data, 'base64'))
  await call('Emulation.clearDeviceMetricsOverride')
}
await call('Page.addScriptToEvaluateOnNewDocument', { source: "Object.defineProperty(navigator,'gpu',{value:undefined}); HTMLCanvasElement.prototype.getContext=()=>null" })
await call('Page.navigate', { url: `${origin}/` })
await wait(1500)
assert.ok((await evaluate("document.querySelector('[role=alert]')?.textContent"))?.includes('Graphics initialization failed'))
console.log('Unsupported graphics: readable error confirmed')
console.log('Browser:', await call('Browser.getVersion'))
console.log('Errors:', errors)
assert.equal(errors.length, 0)
await writeFile('test-results/measurements.json', JSON.stringify(measurements, null, 2))
socket.close()
