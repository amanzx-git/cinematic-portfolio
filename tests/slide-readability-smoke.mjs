import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { connect } from './cdp.mjs'

const base = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:5177'
const pages = await (await fetch('http://127.0.0.1:9223/json')).json()
const browser = await connect(pages.find(page => page.type === 'page').webSocketDebuggerUrl)
await browser.call('Runtime.enable')
await browser.call('Page.enable')
await browser.call('Emulation.setFocusEmulationEnabled', { enabled: true })
await browser.call('Emulation.setTouchEmulationEnabled', { enabled: false })
await browser.call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false })
try {
  const token = String(Date.now())
  await browser.call('Page.navigate', { url: base + '/lab/game?slide-smoke=' + token })
  await browser.evaluate(`new Promise(resolve => { const watch = () => { if (location.search.includes(${JSON.stringify(token)}) && document.querySelector('output')?.dataset.started === 'false') resolve(); else requestAnimationFrame(watch) }; watch() })`)
  const preview = await browser.evaluate(`new Promise((resolve, reject) => {
    const start = performance.now()
    const watch = () => {
      const data = document.querySelector('output').dataset
      if (Number(data.x) >= 362.8) {
        const snapshot = {...data}
        ;[...document.querySelectorAll('button')].find(button => button.textContent === 'Pause').click()
        resolve(snapshot)
        return
      }
      if (data.failure || performance.now() - start > 20000) { reject(Error(data.failure || 'Slide approach timed out')); return }
      requestAnimationFrame(watch)
    }
    document.querySelector('.game-debug').open = true
    ;[...document.querySelectorAll('button')].find(button => button.textContent === 'Test Hunter').click()
    document.querySelector('.game-debug').open = false
    window.dispatchEvent(new KeyboardEvent('keydown', {code: 'ShiftLeft', bubbles: true, cancelable: true}))
    watch()
  })`)
  assert.equal(preview.speed, '6')
  const shot = await browser.call('Page.captureScreenshot', { format: 'png' })
  await writeFile('test-results/g61-slide.png', Buffer.from(shot.data, 'base64'))
  const passed = await browser.evaluate(`new Promise((resolve, reject) => {
    const start = performance.now()
    let slid = false, sawSlide = false, released = false, maxSlide = 0
    const key = (type, code) => window.dispatchEvent(new KeyboardEvent(type, {code, bubbles: true, cancelable: true}))
    const watch = () => {
      const data = document.querySelector('output').dataset
      if (!slid && Number(data.x) >= 363.4) { slid = true; key('keydown', 'ArrowDown') }
      if (Number(data.slideTime) > 0) {
        sawSlide = true
        maxSlide = Math.max(maxSlide, Number(data.slideTime))
        if (!released && Number(data.slideTime) >= .5) { released = true; key('keyup', 'ShiftLeft') }
      }
      if (sawSlide && Number(data.slideTime) === 0 && Number(data.x) > 370 && Number(data.speed) === 4.5) {
        const snapshot = {...data}
        ;[...document.querySelectorAll('button')].find(button => button.textContent === 'Pause').click()
        resolve({snapshot, slid, released, maxSlide})
        return
      }
      if (data.failure || performance.now() - start > 15000) { reject(Error(data.failure || 'Slide crossing timed out')); return }
      requestAnimationFrame(watch)
    }
    ;[...document.querySelectorAll('button')].find(button => button.textContent === 'Resume').click()
    key('keydown', 'ShiftLeft')
    watch()
  })`)
  assert.ok(passed.slid && passed.released)
  assert.ok(passed.maxSlide > 1.4 && passed.maxSlide <= 46 / 30)
  assert.equal(passed.snapshot.failure, '')
  assert.equal(passed.snapshot.bodyHeight, '1.8')
  assert.equal(passed.snapshot.sprintHeld, 'false')
  assert.deepEqual(browser.errors, [])
  await writeFile('test-results/g61-smoke.json', JSON.stringify({ passed: true, preview, result: passed, checks: ['6 m/s approach', 'dark steel and amber preview', 'fixed-duration Slide', 'Sprint release during Slide', 'clear opening', 'no collision bypass', 'no console errors'] }, null, 2))
  console.log('G6.1 Slide readability smoke passed')
} finally {
  browser.close()
}
