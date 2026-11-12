import assert from 'node:assert/strict'
import { connect } from './cdp.mjs'
import { mkdir, writeFile } from 'node:fs/promises'
const baseUrl = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:4173'
const pages = await (await fetch('http://127.0.0.1:9222/json')).json()
const cdp = await connect(pages.find(page => page.type === 'page' && page.url.startsWith('http://127.0.0.1')).webSocketDebuggerUrl)
await cdp.call('Runtime.enable'); await cdp.call('Page.enable')
await cdp.call('Emulation.setFocusEmulationEnabled',{enabled:true});await cdp.call('Page.bringToFront')
await cdp.call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const read = () => cdp.evaluate('document.querySelector("output")?.textContent')
const click = name => cdp.evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent===${JSON.stringify(name)}).click()`)
await mkdir('test-results', { recursive: true })
const records = []
for (const backend of ['', '?backend=webgl']) {
  await cdp.call('Page.navigate', { url: `${baseUrl}/lab/runner${backend}` })
  for (let i=0;i<80;i++) { await wait(250); if ((await read())?.includes('FPS')) break }
  assert.match(await read(), /mixers 1/)
  for (const name of ['Idle','Run','Jump','Land','Slide']) {
    await click(name); await wait(3500)
    const diagnostic = await read(); assert.ok(diagnostic.startsWith(name)); assert.match(diagnostic, /active actions 1/)
    records.push({ backend: backend || 'auto', diagnostic })
  }
  await click('Pause'); await wait(350); const paused = await read(); await wait(650); assert.equal((await read()).split(' | ~')[0], paused.split(' | ~')[0])
  await click('Restart'); await wait(350); assert.match(await read(), /time 0.000 s/)
  await click('Resume')
  await cdp.evaluate(`{const e=document.querySelector('[aria-label="Playback speed"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'0.5');e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))}`)
  await wait(400); assert.match(await read(), /0.50×/)
  for (const camera of ['Front','Side','Back','Three-quarter']) {
    await click(camera); await wait(400)
    assert.equal(await cdp.evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent===${JSON.stringify(camera)}).getAttribute('aria-pressed')`),'true')
    const shot = await cdp.call('Page.captureScreenshot', { format: 'png' })
    await writeFile(`test-results/runner-${backend ? 'webgl' : 'auto'}-${camera}.png`, Buffer.from(shot.data,'base64'))
  }
  await cdp.evaluate('document.querySelector("input[type=checkbox]").click()')
  await click('Test transitions'); await wait(11500)
  assert.ok((await read()).startsWith('Idle')); assert.ok(!(await read()).includes('test running'))
  // Interrupted fades must settle to one action.
  for (const name of ['Run','Jump','Land','Run','Idle']) await click(name)
  await wait(1200); assert.match(await read(), /active actions 1/)
  await cdp.call('Page.navigate', { url: baseUrl + '/' }); await wait(1000)
  assert.equal(await cdp.evaluate('!!document.querySelector(".runner-lab")'), false)
}
assert.deepEqual(cdp.errors, [])
await writeFile('test-results/runner-browser.json', JSON.stringify(records,null,2))
console.log('Runner desktop browser checks passed', records)
cdp.close()
