import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { connect } from './cdp.mjs'

const base = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:5177'
const pages = await (await fetch('http://127.0.0.1:9223/json')).json()
const browser = await connect(pages.find(page => page.type === 'page').webSocketDebuggerUrl)
await browser.call('Runtime.enable')
await browser.call('Page.enable')
await browser.call('Emulation.setFocusEmulationEnabled', { enabled: true })
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const until = async expression => {
  for (let attempt = 0; attempt < 300; attempt++) {
    if (await browser.evaluate(expression)) return
    await wait(40)
  }
  throw Error(expression)
}
const click = label => browser.evaluate(`void([...document.querySelectorAll('button')].find(button => button.textContent === ${JSON.stringify(label)}).click())`)
try {
  await browser.call('Page.navigate', { url: base + '/lab/game' })
  await until('document.querySelector("output")?.dataset.zone === "corporate-rooftops" && !!document.querySelector(".game-primary")')
  assert.equal(await browser.evaluate('document.querySelector("output").dataset.started'), 'false')
  await click('Start')
  await until('Number(document.querySelector("output").dataset.x) > .2')
  await browser.evaluate('document.querySelector(".game-stage").focus()')
  await browser.call('Input.dispatchKeyEvent', { type: 'keyDown', code: 'Space', key: ' ' })
  await browser.call('Input.dispatchKeyEvent', { type: 'keyUp', code: 'Space', key: ' ' })
  await until('document.querySelector("output").dataset.grounded === "false"')
  await until('document.querySelector("output").dataset.grounded === "true"')
  await click('Pause')
  await until('document.querySelector("output").dataset.paused === "true"')
  const pausedX = await browser.evaluate('document.querySelector("output").dataset.x')
  await wait(180)
  assert.equal(await browser.evaluate('document.querySelector("output").dataset.x'), pausedX)
  await click('Resume')
  await click('Restart')
  await until('document.querySelector("output").dataset.restarts === "1"')
  assert.equal(await browser.evaluate('document.querySelector("output").dataset.zone'), 'corporate-rooftops')
  await browser.call('Page.navigate', { url: base + '/play/recruiter' })
  await until('document.querySelector(".route-curtain")?.dataset.phase === "idle" && document.querySelector("output")?.dataset.zone === "corporate-rooftops"')
  assert.equal(await browser.evaluate('document.querySelector("output").dataset.started'), 'false')
  assert.deepEqual(browser.errors, [])
  await writeFile('test-results/g50-smoke.json', JSON.stringify({ passed: true, checks: ['lab Ready', 'auto-run', 'jump and landing', 'pause/resume', 'restart', 'corporate zone', 'recruiter Ready', 'no console errors'] }, null, 2))
  console.log('G5.0 quick gameplay smoke passed')
} finally {
  browser.close()
}
