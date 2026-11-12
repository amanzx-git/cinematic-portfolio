import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { connect } from './cdp.mjs'
import { course } from '../src/game/course.ts'

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
const until = async predicate => {
  for (let attempt = 0; attempt < 400; attempt++) {
    const data = await read()
    if (predicate(data)) return data
    await wait(40)
  }
  throw Error(JSON.stringify(await read()))
}
try {
  await browser.call('Page.navigate', { url: base + '/lab/game' })
  await until(data => data.started === 'false')
  await browser.evaluate('void(document.querySelector(".game-debug").open = true)')
  await browser.evaluate('void([...document.querySelectorAll("button")].find(button => button.textContent === "Test underground").click())')
  await until(data => data.zone === 'underground-maintenance')
  await browser.evaluate('void(document.querySelector(".game-debug").open = false)')
  const jumps = new Set(), captures = new Set(), supports = new Set()
  let slid = false, finished, cameraMinimum = 0
  for (let attempt = 0; attempt < 900; attempt++) {
    const data = await read()
    assert.equal(data.failure, '')
    assert.equal(data.restarts, '1')
    cameraMinimum = Math.min(cameraMinimum, Number(data.cameraY))
    if (data.grounded === 'true' && Number(data.support) >= 19) supports.add(Number(data.support))
    const marker = course.takeoffs[Number(data.support)]
    if (marker != null && data.grounded === 'true' && Number(data.x) >= marker - .08 && !jumps.has(data.support)) {
      jumps.add(data.support)
      await browser.call('Input.dispatchKeyEvent', { type: 'keyDown', code: 'Space', key: ' ' })
      await browser.call('Input.dispatchKeyEvent', { type: 'keyUp', code: 'Space', key: ' ' })
    }
    if (!slid && Number(data.x) >= 301) {
      slid = true
      await browser.call('Input.dispatchKeyEvent', { type: 'keyDown', code: 'ArrowDown', key: 'ArrowDown' })
      await browser.call('Input.dispatchKeyEvent', { type: 'keyUp', code: 'ArrowDown', key: 'ArrowDown' })
    }
    for (const [name, x] of [['tunnel', 307], ['exit', 345]]) {
      if (!captures.has(name) && Number(data.x) > x) {
        const screenshot = await browser.call('Page.captureScreenshot', { format: 'png' })
        await writeFile(`test-results/g53-${name}.png`, Buffer.from(screenshot.data, 'base64'))
        captures.add(name)
      }
    }
    if (data.phase === 'finished') { finished = data; break }
    await wait(35)
  }
  assert.ok(finished, 'underground route completes')
  assert.equal(finished.x, '355')
  assert.equal(finished.jumps, '3')
  assert.equal(finished.landings, '4')
  assert.equal(finished.hardLandings, '1')
  assert.equal(finished.landCompletions, '1')
  assert.equal(supports.size, 5)
  assert.ok(slid && cameraMinimum < -3.8)
  assert.ok(Math.abs(Number(finished.cameraY) + 1.4) < .25)
  assert.equal(await browser.evaluate('document.querySelector("progress").max'), 355)
  assert.deepEqual(browser.errors, [])
  await writeFile('test-results/g53-smoke.json', JSON.stringify({ passed: true, supports: [...supports], cameraMinimum, finished, checks: ['service descent', 'full hard Land', 'low-pipe Slide', 'drainage jump', 'two exit ascents', 'surface finish', 'camera framing', 'no console errors'] }, null, 2))
  console.log('G5.3 underground smoke passed')
} finally {
  browser.close()
}
