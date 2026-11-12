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
    await wait(20)
  }
  throw Error(JSON.stringify(await read()))
}
const click = label => browser.evaluate(`void([...document.querySelectorAll('button')].find(button => button.textContent === ${JSON.stringify(label)}).click())`)
try {
  const token = String(Date.now())
  await browser.call('Page.navigate', { url: base + '/lab/game?chase-smoke=' + token })
  await browser.evaluate(`new Promise(resolve => { const check = () => { if (location.search.includes(${JSON.stringify(token)}) && document.querySelector('output')?.dataset.started === 'false') resolve(); else requestAnimationFrame(check) }; check() })`)
  assert.equal((await read()).hunterState, 'dormant')
  const initial = await browser.evaluate(`new Promise((resolve, reject) => {
    const start = performance.now(), states = new Set()
    const watch = () => {
      const data = document.querySelector('output').dataset
      states.add(data.hunterState)
      if (data.hunterState === 'pursuing' && Number(data.x) >= 349) {
        const snapshot = {...data}
        ;[...document.querySelectorAll('button')].find(button => button.textContent === 'Pause').click()
        resolve({states: [...states], snapshot})
        return
      }
      if (performance.now() - start > 20000) { reject(Error('Pursuit did not activate')); return }
      requestAnimationFrame(watch)
    }
    document.querySelector('.game-debug').open = true
    ;[...document.querySelectorAll('button')].find(button => button.textContent === 'Test Hunter').click()
    document.querySelector('.game-debug').open = false
    watch()
  })`)
  assert.ok(initial.states.includes('alert'))
  const stopped = await until(data => data.paused === 'true')
  const shot = await browser.call('Page.captureScreenshot', { format: 'png' })
  await writeFile('test-results/g56-chase.png', Buffer.from(shot.data, 'base64'))
  await wait(180)
  assert.equal((await read()).hunterX, stopped.hunterX)
  await browser.call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await until(data => data.reducedMotion === 'true')
  const result = await browser.evaluate(`new Promise((resolve, reject) => {
    const start = performance.now()
    let slid = false, minimumGap = Infinity, maximumGap = 0, visible = true
    const watch = () => {
      const data = document.querySelector('output').dataset
      if (data.hunterState === 'pursuing') {
        minimumGap = Math.min(minimumGap, Number(data.hunterGap))
        maximumGap = Math.max(maximumGap, Number(data.hunterGap))
        visible = visible && Number(data.hunterX) - .6 >= Number(data.cameraX) - 7
      }
      if (!slid && Number(data.x) >= 364) {
        slid = true
        ;[...document.querySelectorAll('button')].find(button => button.textContent === 'Slide').click()
      }
      if (data.phase === 'finished') { resolve({finished: {...data}, slid, minimumGap, maximumGap, visible}); return }
      if (data.failure) { reject(Error(data.failure)); return }
      if (performance.now() - start > 30000) { reject(Error('Final chase did not finish')); return }
      requestAnimationFrame(watch)
    }
    ;[...document.querySelectorAll('button')].find(button => button.textContent === 'Resume').click()
    watch()
  })`)
  assert.equal(result.finished.x, String(course.finish))
  assert.equal(result.finished.hunterState, 'disengaged')
  assert.equal(result.finished.failure, '')
  assert.ok(result.slid && result.visible)
  assert.ok(result.minimumGap > 2.2 && result.maximumGap < 3.4)
  await until(data => Number(data.hunterDisengage) >= .4)
  await click('Replay')
  await until(data => data.x !== String(course.finish) && data.hunterState === 'dormant')
  assert.deepEqual(browser.errors, [])
  await writeFile('test-results/g56-smoke.json', JSON.stringify({passed: true, ...result, checks: ['40 m chase', 'Alert', 'safe separation', 'robot visible', 'Pause', 'reduced motion', 'final-pipe Slide', 'smooth disengage', 'Replay', 'no console errors']}, null, 2))
  console.log('G5.6 final chase smoke passed')
} finally {
  browser.close()
}
