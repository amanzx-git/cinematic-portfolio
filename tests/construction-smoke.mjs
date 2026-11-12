import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { connect } from './cdp.mjs'
import { course } from '../src/game/course.ts'

const base = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:4175'
const pages = await (await fetch('http://127.0.0.1:9223/json')).json()
const browser = await connect(pages.find(page => page.type === 'page').webSocketDebuggerUrl)
await browser.call('Runtime.enable')
await browser.call('Page.enable')
await browser.call('Emulation.setFocusEmulationEnabled', { enabled: true })
await browser.call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false })
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
  await browser.evaluate('void([...document.querySelectorAll("button")].find(button => button.textContent === "Test construction").click())')
  await until(data => data.zone === 'construction-site')
  await browser.evaluate('void(document.querySelector(".game-debug").open = false)')
  const supports = new Set(), jumps = new Set()
  let capture = false, finished
  for (let attempt = 0; attempt < 900; attempt++) {
    const data = await read()
    assert.equal(data.failure, '')
    assert.equal(data.restarts, '1')
    if (data.grounded === 'true') supports.add(Number(data.support))
    const marker = course.takeoffs[Number(data.support)]
    if (marker != null && data.grounded === 'true' && Number(data.x) >= marker - .08 && !jumps.has(data.support)) {
      jumps.add(data.support)
      await browser.call('Input.dispatchKeyEvent', { type: 'keyDown', code: 'Space', key: ' ' })
      await browser.call('Input.dispatchKeyEvent', { type: 'keyUp', code: 'Space', key: ' ' })
    }
    if (!capture && Number(data.x) > 184) {
      const screenshot = await browser.call('Page.captureScreenshot', { format: 'png' })
      await writeFile('test-results/g51-construction.png', Buffer.from(screenshot.data, 'base64'))
      capture = true
    }
    if (data.phase === 'finished') { finished = data; break }
    await wait(35)
  }
  assert.ok(finished, 'construction route completes')
  assert.equal(finished.x, String(course.finish))
  assert.equal(finished.jumps, '2')
  assert.equal(finished.hardLandings, '1')
  assert.equal(finished.landCompletions, '1')
  assert.equal(supports.size, 5)
  assert.equal(await browser.evaluate('document.querySelector("progress").max'), course.finish)
  assert.equal(await browser.evaluate('document.querySelector(".game-primary").textContent'), 'Replay')
  assert.deepEqual(browser.errors, [])
  await writeFile('test-results/g51-smoke.json', JSON.stringify({ passed: true, supports: [...supports], finished, checks: ['debug construction entry', 'two jumps', 'supported catwalk', 'hard drop recovery', 'new finish', 'progress HUD', 'no console errors'] }, null, 2))
  console.log('G5.1 construction smoke passed')
} finally {
  browser.close()
}
