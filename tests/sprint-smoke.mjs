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
const read = () => browser.evaluate('({...document.querySelector("output")?.dataset})')
const resumeForDebug = async () => {
  await browser.evaluate('void([...document.querySelectorAll("button")].find(button => button.textContent === "Resume").click())')
  await browser.evaluate(`new Promise(resolve => { const watch = () => { const button = [...document.querySelectorAll('button')].find(button => button.textContent === 'Test Hunter'); if (!button.disabled) resolve(); else requestAnimationFrame(watch) }; watch() })`)
}
try {
  const token = String(Date.now())
  await browser.call('Page.navigate', { url: base + '/lab/game?sprint-smoke=' + token })
  await browser.evaluate(`new Promise(resolve => { const check = () => { if (location.search.includes(${JSON.stringify(token)}) && document.querySelector('output')?.dataset.started === 'false') resolve(); else requestAnimationFrame(check) }; check() })`)
  const keyboard = await browser.evaluate(`new Promise((resolve, reject) => {
    const start = performance.now()
    const key = (type, code) => window.dispatchEvent(new KeyboardEvent(type, {code, bubbles: true, cancelable: true}))
    let jumped = false, airborne = false, slid = false, sawSlide = false, released = false, maxSlide = 0, maxRate = 0
    const watch = () => {
      const data = document.querySelector('output').dataset
      maxRate = Math.max(maxRate, Number(data.runMeanRate))
      if (!jumped && Number(data.speed) === 6) { jumped = true; key('keydown', 'Space') }
      if (jumped && data.grounded === 'false') airborne = true
      if (airborne && data.grounded === 'true' && !slid) { slid = true; key('keydown', 'ArrowDown') }
      if (Number(data.slideTime) > 0) { sawSlide = true; maxSlide = Math.max(maxSlide, Number(data.slideTime)) }
      if (sawSlide && Number(data.slideTime) === 0 && !released) { released = true; key('keyup', 'ShiftLeft') }
      if (released && data.sprintHeld === 'false' && Number(data.speed) === 4.5) {
        const snapshot = {...data}
        ;[...document.querySelectorAll('button')].find(button => button.textContent === 'Pause').click()
        resolve({snapshot, jumped, airborne, slid, sawSlide, maxSlide, maxRate})
        return
      }
      if (data.failure || performance.now() - start > 20000) { reject(Error(data.failure || 'Sprint sequence timed out')); return }
      requestAnimationFrame(watch)
    }
    document.querySelector('.game-debug').open = true
    ;[...document.querySelectorAll('button')].find(button => button.textContent === 'Test Hunter').click()
    document.querySelector('.game-debug').open = false
    document.querySelector('.game-stage').focus()
    key('keydown', 'ShiftLeft')
    watch()
  })`)
  assert.ok(keyboard.jumped && keyboard.airborne && keyboard.slid && keyboard.sawSlide)
  assert.ok(keyboard.maxSlide > 1.4 && keyboard.maxSlide <= 46 / 30)
  assert.ok(keyboard.maxRate > 1)
  assert.equal(keyboard.snapshot.failure, '')
  const stopped = await browser.evaluate(`new Promise(resolve => { const watch = () => { const data = document.querySelector('output').dataset; if (data.paused === 'true') resolve({...data}); else requestAnimationFrame(watch) }; watch() })`)
  await new Promise(resolve => setTimeout(resolve, 150))
  assert.equal((await read()).x, stopped.x)
  assert.equal((await read()).sprintHeld, 'false')

  await resumeForDebug()
  await browser.evaluate(`void(window.pointerSprint = new Promise((resolve, reject) => {
    const start = performance.now(), button = document.querySelector('.game-sprint')
    let pointer = 0, cancelled = false, indicator = false
    button.addEventListener('pointerdown', event => { pointer = event.pointerId }, {once: true})
    const watch = () => {
      const data = document.querySelector('output').dataset
      if (!cancelled && data.sprintHeld === 'true' && Number(data.speed) === 6) {
        indicator = button.dataset.held === 'true'
        cancelled = true
        button.dispatchEvent(new PointerEvent('pointercancel', {pointerId: pointer, bubbles: true}))
      }
      if (cancelled && data.sprintHeld === 'false' && Number(data.speed) === 4.5) {
        ;[...document.querySelectorAll('button')].find(button => button.textContent === 'Pause').click()
        resolve({indicator, cancelled})
        return
      }
      if (data.failure || performance.now() - start > 20000) { reject(Error(JSON.stringify({failure: data.failure, pointer, cancelled, indicator, held: data.sprintHeld, speed: data.speed}))); return }
      requestAnimationFrame(watch)
    }
    document.querySelector('.game-debug').open = true
    ;[...document.querySelectorAll('button')].find(button => button.textContent === 'Test Hunter').click()
    document.querySelector('.game-debug').open = false
    watch()
  }))`)
  await browser.call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 })
  await browser.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
  const point = await browser.evaluate('(() => { const r = document.querySelector(".game-sprint").getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + r.height / 2} })()')
  await browser.call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] })
  const pointer = await browser.evaluate('window.pointerSprint')
  await browser.call('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
  assert.ok(pointer.indicator && pointer.cancelled)
  assert.equal((await read()).sprintHeld, 'false')
  await resumeForDebug()
  const focusReleased = await browser.evaluate(`new Promise((resolve, reject) => {
    const start = performance.now(), button = document.querySelector('.game-sprint')
    let started = false, blurred = false
    const watch = () => {
      const data = document.querySelector('output').dataset
      if (!started && !button.disabled) {
        started = true
        button.focus()
        button.dispatchEvent(new KeyboardEvent('keydown', {code: 'Space', bubbles: true, cancelable: true}))
      }
      if (started && !blurred && data.sprintHeld === 'true' && Number(data.speed) === 6) { blurred = true; button.blur() }
      if (blurred && data.sprintHeld === 'false' && Number(data.speed) === 4.5) {
        ;[...document.querySelectorAll('button')].find(button => button.textContent === 'Pause').click()
        resolve(true)
        return
      }
      if (performance.now() - start > 20000) { reject(Error('Focus release timed out')); return }
      requestAnimationFrame(watch)
    }
    document.querySelector('.game-debug').open = true
    ;[...document.querySelectorAll('button')].find(button => button.textContent === 'Test Hunter').click()
    document.querySelector('.game-debug').open = false
    watch()
  })`)
  assert.equal(focusReleased, true)
  const shot = await browser.call('Page.captureScreenshot', { format: 'png' })
  await writeFile('test-results/g60-sprint.png', Buffer.from(shot.data, 'base64'))
  assert.deepEqual(browser.errors, [])
  await writeFile('test-results/g60-smoke.json', JSON.stringify({ passed: true, keyboard, pointer, focusReleased, checks: ['Shift hold/release', '6 m/s', 'Jump while sprinting', 'fixed-duration Slide while sprinting', 'deceleration', 'Pause', 'emulated touch hold', 'pointer cancellation', 'focus loss release', 'Sprint indicator', 'no console errors'] }, null, 2))
  console.log('G6.0 Sprint smoke passed')
} finally {
  browser.close()
}
