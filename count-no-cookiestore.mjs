// Same navigation as count.mjs, with the Cookie Store API removed so Nuxt falls back to BroadcastChannel.
// Counts BroadcastChannel instances that are open (created minus closed).
import { chromium } from '@playwright/test'

const BASE = process.argv[2] ?? 'http://127.0.0.1:3519'
const NAVS = Number(process.argv[3] ?? 50)

const browser = await chromium.launch()
const page = await browser.newPage()
await page.addInitScript(() => {
  delete window.cookieStore
  delete window.CookieStore
  let open = 0
  const Native = window.BroadcastChannel
  window.BroadcastChannel = class extends Native {
    constructor(name) { super(name); if (String(name).startsWith('nuxt:cookies:')) { open++; this.__counted = true } }
    close() { if (this.__counted && !this.__closed) { open--; this.__closed = true } return super.close() }
  }
  window.__openCookieChannels = () => open
})

await page.goto(`${BASE}/a`, { waitUntil: 'networkidle' })
const hasStore = await page.evaluate(() => typeof window.cookieStore)
const start = await page.evaluate(() => window.__openCookieChannels())
for (let i = 0; i < NAVS; i++) {
  const to = i % 2 ? '/a' : '/b'
  await page.click(`a[href="${to}"]`)
  await page.waitForURL(`**${to}`)
}
const end = await page.evaluate(() => window.__openCookieChannels())
console.log(`no cookieStore (typeof cookieStore = ${hasStore}): open nuxt:cookies BroadcastChannels after load ${start}, after ${NAVS} navigations ${end}`)
await browser.close()
