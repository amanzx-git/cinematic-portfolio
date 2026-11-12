import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { connect } from './cdp.mjs'

const base = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:4175'
const pages = await (await fetch('http://127.0.0.1:9223/json')).json()
const browser = await connect(pages.find(page => page.type === 'page').webSocketDebuggerUrl)
await browser.call('Runtime.enable')
await browser.call('Page.enable')
await browser.call('Network.enable')
await browser.call('Emulation.setFocusEmulationEnabled', { enabled: true })
await browser.call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
let openingRequests = 0
browser.on('Network.requestWillBeSent', ({ request }) => {
  if (request.url.endsWith('/media/recruiter/opening.mp4')) openingRequests++
})
const until = async expression => {
  for (let attempt = 0; attempt < 300; attempt++) {
    if (await browser.evaluate(expression)) return
    await new Promise(resolve => setTimeout(resolve, 40))
  }
  throw Error(expression)
}
const click = async selector => {
  const point = await browser.evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  await browser.call('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point })
  await browser.call('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point })
}
try {
  await browser.call('Page.navigate', { url: base + '/play' })
  await until('!!document.querySelector(".mode-recruiter")')
  await click('.mode-recruiter')
  await until('document.querySelector(".route-curtain")?.dataset.phase === "idle" && !!document.querySelector(".game-primary")')
  assert.equal(await browser.evaluate('document.querySelector(".recruiter-experience").dataset.storyStage'), 'gameplay-ready')
  assert.equal(await browser.evaluate('document.querySelectorAll("video").length'), 0)
  assert.equal(await browser.evaluate('document.querySelector("output").dataset.started'), 'false')
  assert.equal(openingRequests, 1)
  await click('.game-primary')
  await until('document.querySelector(".recruiter-experience")?.dataset.storyStage === "escape"')
  await click('.game-hud a')
  await until('location.pathname === "/play" && document.querySelector(".route-curtain")?.dataset.phase === "idle"')
  assert.equal(await browser.evaluate('!!document.querySelector(".play-intro-video")'), false)
  await click('.mode-recruiter')
  await until('document.querySelector(".recruiter-experience")?.dataset.storyStage === "gameplay-ready" && document.querySelector(".route-curtain").dataset.phase === "idle"')
  assert.equal(openingRequests, 1)
  await browser.evaluate('history.back()')
  await until('location.pathname === "/play" && document.querySelector(".route-curtain")?.dataset.phase === "idle"')
  assert.deepEqual(browser.errors, [])
  await writeFile('test-results/g40-smoke.json', JSON.stringify({ passed: true, openingRequests, checks: ['missing opening fallback', 'Ready', 'Start', 'Back', 'cached re-entry', 'browser Back', 'no intro replay', 'no console errors'] }, null, 2))
  console.log('G4.0 missing-video smoke passed')
} finally {
  browser.close()
}
