import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { connect } from './cdp.mjs'

const base = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:5177'
const pages = await (await fetch('http://127.0.0.1:9223/json')).json()
const browser = await connect(pages.find(page => page.type === 'page').webSocketDebuggerUrl)
await browser.call('Runtime.enable')
await browser.call('Page.enable')
await browser.call('Emulation.setFocusEmulationEnabled', { enabled: true })
await browser.call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false })
await browser.call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const read = () => browser.evaluate('({...document.querySelector("output")?.dataset})')
const click = label => browser.evaluate(`void([...document.querySelectorAll('button')].find(button => button.textContent === ${JSON.stringify(label)}).click())`)
const until = async predicate => {
  for (let attempt = 0; attempt < 400; attempt++) {
    const data = await read()
    if (predicate(data)) return data
    await wait(40)
  }
  throw Error(JSON.stringify(await read()))
}
const key = async (code, key) => {
  await browser.call('Input.dispatchKeyEvent', { type: 'keyDown', code, key })
  await browser.call('Input.dispatchKeyEvent', { type: 'keyUp', code, key })
}
try {
  await browser.call('Page.navigate', { url: base + '/lab/game' })
  await until(data => data.started === 'false')
  await browser.evaluate('void(document.querySelector(".game-debug").open = true)')
  await click('Test electrical')
  await until(data => data.zone === 'electrical-yard')
  await browser.evaluate('void(document.querySelector(".game-debug").open = false)')
  let jumped = false, slid = false, paused = false, finished
  const states = new Set()
  for (let attempt = 0; attempt < 700; attempt++) {
    const data = await read()
    states.add(data.arcState)
    assert.equal(data.failure, '')
    assert.equal(data.restarts, '1')
    if (!jumped && Number(data.x) >= 237.5) { jumped = true; await key('Space', ' ') }
    if (!slid && Number(data.x) >= 251) { slid = true; await key('ArrowDown', 'ArrowDown') }
    if (!paused && Number(data.x) >= 262) {
      await click('Pause')
      const stopped = await until(data => data.paused === 'true')
      await wait(180)
      const frozen = await read()
      assert.equal(frozen.hazardTime, stopped.hazardTime)
      assert.equal(frozen.x, stopped.x)
      await browser.call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
      await until(data => data.reducedMotion === 'true' && data.effects === 'false')
      const screenshot = await browser.call('Page.captureScreenshot', { format: 'png' })
      await writeFile('test-results/g52-electrical.png', Buffer.from(screenshot.data, 'base64'))
      await click('Resume')
      paused = true
    }
    if (data.phase === 'finished') { finished = data; break }
    await wait(35)
  }
  assert.ok(finished, 'electrical run reaches finish')
  assert.equal(finished.x, '279')
  assert.equal(finished.jumps, '1')
  assert.equal(finished.landings, '1')
  assert.equal(finished.hardLandings, '0')
  assert.ok(jumped && slid && paused)
  assert.deepEqual([...states].sort(), ['active', 'inactive', 'warning'])
  assert.deepEqual(browser.errors, [])
  await writeFile('test-results/g52-smoke.json', JSON.stringify({ passed: true, states: [...states], finished, checks: ['electrical debug entry', 'jump cable', 'fixed Slide conduit', 'all pulse states', 'safe arc crossing', 'pause freezes hazard clock', 'reduced motion', 'new finish', 'no console errors'] }, null, 2))
  console.log('G5.2 electrical smoke passed')
} finally {
  browser.close()
}
