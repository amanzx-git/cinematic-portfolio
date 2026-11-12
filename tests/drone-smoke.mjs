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
const until = async predicate => {
  for (let attempt = 0; attempt < 400; attempt++) {
    const data = await read()
    if (predicate(data)) return data
    await wait(15)
  }
  throw Error(JSON.stringify(await read()))
}
const click = label => browser.evaluate(`void([...document.querySelectorAll('button')].find(button => button.textContent === ${JSON.stringify(label)}).click())`)
try {
  const token = String(Date.now())
  await browser.call('Page.navigate', { url: base + '/lab/game?drone-smoke=' + token })
  await browser.evaluate(`new Promise(resolve => { const check = () => { if (location.search.includes(${JSON.stringify(token)}) && document.querySelector('output')?.dataset.started === 'false') resolve(); else requestAnimationFrame(check) }; check() })`)
  await until(data => data.started === 'false')
  assert.equal((await read()).droneState, 'idle')
  const warningSeen = await browser.evaluate(`new Promise((resolve, reject) => {
    const start = performance.now()
    let warned = false
    const watch = () => {
      const data = document.querySelector('output').dataset
      if (data.dronePhase === 'warning') warned = true
      if (data.dronePhase === 'active' && Number(data.droneTime) >= .9) {
        [...document.querySelectorAll('button')].find(button => button.textContent === 'Pause').click()
        resolve(warned)
        return
      }
      if (performance.now() - start > 20000) { reject(Error('Scan phase was not reached')); return }
      requestAnimationFrame(watch)
    }
    document.querySelector('.game-debug').open = true
    ;[...document.querySelectorAll('button')].find(button => button.textContent === 'Test construction').click()
    document.querySelector('.game-debug').open = false
    watch()
  })`)
  assert.equal(warningSeen, true)
  const stopped = await until(data => data.paused === 'true')
  await wait(180)
  assert.equal((await read()).droneTime, stopped.droneTime)
  const shot = await browser.call('Page.captureScreenshot', { format: 'png' })
  await writeFile('test-results/g55-drone.png', Buffer.from(shot.data, 'base64'))
  await browser.call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await until(data => data.reducedMotion === 'true')
  const passed = await browser.evaluate(`new Promise((resolve, reject) => {
    const start = performance.now()
    const watch = () => {
      const data = document.querySelector('output').dataset
      if (data.droneState === 'reset' && Number(data.x) > 163) {
        const snapshot = {...data}
        ;[...document.querySelectorAll('button')].find(button => button.textContent === 'Pause').click()
        resolve(snapshot)
        return
      }
      if (performance.now() - start > 20000) { reject(Error('Safe crossing was not reached')); return }
      requestAnimationFrame(watch)
    }
    ;[...document.querySelectorAll('button')].find(button => button.textContent === 'Resume').click()
    watch()
  })`)
  assert.ok(Number(passed.droneTime) > Number(stopped.droneTime))
  assert.equal(passed.dronePhase, 'inactive')
  assert.equal(passed.failure, '')
  assert.equal(passed.restarts, '1')
  await click('Restart')
  await until(data => data.droneState === 'idle' && data.droneTime === '0')
  assert.deepEqual(browser.errors, [])
  await writeFile('test-results/g55-smoke.json', JSON.stringify({ passed: true, encounter: passed, checks: ['Idle', 'warning', 'active beam', 'Pause freezes scanning', 'reduced motion preserves timing', 'safe inactive crossing', 'Reset', 'Restart', 'no console errors'] }, null, 2))
  console.log('G5.5 drone smoke passed')
} finally {
  browser.close()
}
