// Counts live cookieStore "change" listeners after N client-side navigations.
// Usage: node count.mjs [baseUrl] [navigations] [link|button]
import { chromium } from '@playwright/test'

const BASE = process.argv[2] ?? 'http://127.0.0.1:3519'
const NAVS = Number(process.argv[3] ?? 50)
const MODE = process.argv[4] ?? 'link'

const browser = await chromium.launch()
const page = await browser.newPage()
await page.addInitScript(() => {
  let live = 0
  const add = CookieStore.prototype.addEventListener
  const remove = CookieStore.prototype.removeEventListener
  CookieStore.prototype.addEventListener = function (type, ...rest) {
    if (type === 'change') live++
    return add.call(this, type, ...rest)
  }
  CookieStore.prototype.removeEventListener = function (type, ...rest) {
    if (type === 'change') live--
    return remove.call(this, type, ...rest)
  }
  window.__liveCookieListeners = () => live
})

await page.goto(`${BASE}/a`, { waitUntil: 'networkidle' })
const start = await page.evaluate(() => window.__liveCookieListeners())
for (let i = 0; i < NAVS; i++) {
  const to = i % 2 ? '/a' : '/b'
  await page.click(MODE === 'button' ? '#go' : `a[href="${to}"]`)
  await page.waitForURL(`**${to}`)
}
const end = await page.evaluate(() => window.__liveCookieListeners())
console.log(`${MODE}: cookieStore change listeners after load ${start}, after ${NAVS} navigations ${end}`)
await browser.close()
