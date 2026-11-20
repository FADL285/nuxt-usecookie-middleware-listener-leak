// Counts what each middleware useCookie call leaves behind after N client-side navigations:
// cookieStore "change" listeners (or open nuxt:cookies BroadcastChannels without Cookie Store),
// nuxtApp._cookieWriters, and the effects (watchers) on nuxtApp._scope.
// Usage: node count-all.mjs [baseUrl] [navigations] [--no-cookiestore]
import { openPage } from './probe.mjs'

const [BASE = 'http://127.0.0.1:3519', NAVS = '50'] = process.argv.slice(2).filter(a => !a.startsWith('--'))
const noCookieStore = process.argv.includes('--no-cookiestore')

const { browser, page } = await openPage({ noCookieStore })
await page.goto(`${BASE}/a`, { waitUntil: 'networkidle' })
const start = await page.evaluate(() => window.__counts())
for (let i = 0; i < Number(NAVS); i++) {
  const to = i % 2 ? '/a' : '/b'
  await page.click(`a[href="${to}"]`)
  await page.waitForURL(`**${to}`)
}
const end = await page.evaluate(() => window.__counts())
const keys = noCookieStore ? ['channels', 'writers', 'appScopeEffects'] : ['listeners', 'writers', 'appScopeEffects']
console.log(`${noCookieStore ? 'no cookieStore' : 'cookieStore'}, ${NAVS} navs: ` + keys.map(k => `${k} ${start[k]} -> ${end[k]}`).join(', '))
await browser.close()
