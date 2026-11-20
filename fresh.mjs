// Does the middleware see a value written just before navigating?
// Needs NUXT_PUBLIC_WRITERS=1. Each write sets x to a new number, then navigates in the same task.
// Usage: node fresh.mjs [baseUrl] [--no-cookiestore]
import { openPage } from './probe.mjs'

const [BASE = 'http://127.0.0.1:3519'] = process.argv.slice(2).filter(a => !a.startsWith('--'))
const noCookieStore = process.argv.includes('--no-cookiestore')

const { browser, page } = await openPage({ noCookieStore })
await page.goto(`${BASE}/a`, { waitUntil: 'networkidle' })
// Prime: one navigation so a middleware ref for x already exists before the writes.
await page.click('a[href="/b"]')
await page.waitForURL('**/b')

let n = 100
for (const writer of ['component', 'document', 'server']) {
  const results = []
  for (let round = 0; round < 3; round++) {
    const value = ++n
    const to = new URL(page.url()).pathname === '/a' ? '/b' : '/a'
    await page.evaluate(v => { window.__next = v }, value)
    await page.click(`#write-${writer}`)
    await page.waitForURL(`**${to}`)
    const seen = await page.evaluate(() => window.__seen.at(-1))
    results.push(String(seen) === String(value) ? 'fresh' : `STALE (wrote ${value}, middleware read ${seen})`)
  }
  console.log(`${noCookieStore ? 'no cookieStore' : 'cookieStore'}, ${writer} write -> ${results.join(', ')}`)
}
await browser.close()
