// Checks that matter for treating middleware and scope-less useCookie calls as one-shot:
//   plugin  - a plugin's app-lifetime ref still follows writes from a component ref and from document.cookie
//   timer   - a ref created in a setTimeout (no scope) follows a later document.cookie write
//   mw-write - (NUXT_PUBLIC_MODE=mw-write) a plain assignment in middleware reaches document.cookie and app-level refs
//   mw-deep  - (NUXT_PUBLIC_MODE=mw-deep) a deep mutation in middleware reaches document.cookie
//   shared   - (NUXT_PUBLIC_MODE=shared-ref) a ref created in app._scope during middleware follows a later document.cookie write
//   setup    - 10 fresh loads: was _processingMiddleware set in vue:setup, and does a ref created there in app._scope
//              follow a later document.cookie write (use NUXT_PUBLIC_RACE=1 for the overlapping navigation)
// Without Cookie Store, a plain document.cookie write notifies no ref at all, even unpatched; compare against the baseline.
// Usage: node oneshot.mjs <baseUrl> <plugin|timer|mw-write|mw-deep|shared|setup> [--no-cookiestore]
import { openPage } from './probe.mjs'

const [BASE = 'http://127.0.0.1:3519', CHECK = 'plugin'] = process.argv.slice(2).filter(a => !a.startsWith('--'))
const noCookieStore = process.argv.includes('--no-cookiestore')
const { browser, page } = await openPage({ noCookieStore })
await page.goto(`${BASE}/a`, { waitUntil: 'networkidle' })
const settle = () => page.waitForTimeout(300)
const cookie = name => page.evaluate(n => document.cookie.split('; ').find(c => c.startsWith(`${n}=`))?.slice(n.length + 1), name)
const verdict = (ok, detail) => `${ok ? 'OK' : 'FAIL'} (${detail})`
const out = []

async function navigate(times) {
  for (let i = 0; i < times; i++) {
    const to = new URL(page.url()).pathname === '/a' ? '/b' : '/a'
    await page.click(`a[href="${to}"]`)
    await page.waitForURL(`**${to}`)
  }
}

if (CHECK === 'plugin') {
  // Navigate first: a plugin ref must not be adopted by, or stopped with, a navigation's scope.
  await navigate(5)
  await page.evaluate(() => window.__setPluginCookie('from-component'))
  await settle()
  const a = await page.evaluate(() => window.__pluginCookie())
  out.push(`component write -> ${verdict(a === 'from-component', `plugin read ${a}`)}`)
  await page.evaluate(() => { document.cookie = 'p=from-document; path=/' })
  await settle()
  const b = await page.evaluate(() => window.__pluginCookie())
  out.push(`document.cookie write -> ${verdict(b === 'from-document', `plugin read ${b}`)}`)
}

if (CHECK === 'timer') {
  await page.evaluate(() => { document.cookie = 't=before; path=/' })
  await page.evaluate(() => window.__makeTimerRef())
  const first = await page.evaluate(() => window.__timerRef.value)
  out.push(`initial read -> ${verdict(first === 'before', `read ${first}`)}`)
  await page.evaluate(() => { document.cookie = 't=after; path=/' })
  await settle()
  const later = await page.evaluate(() => window.__timerRef.value)
  out.push(`after a later document.cookie write -> ${verdict(later === 'after', `read ${later}`)}`)
}

if (CHECK === 'mw-write') {
  await navigate(3)
  await settle()
  const wrote = await page.evaluate(() => window.__mwWrote)
  const raw = await cookie('w')
  const doc = raw === undefined ? undefined : String(JSON.parse(decodeURIComponent(raw)))
  const app = await page.evaluate(() => window.__appW())
  out.push(`document.cookie -> ${verdict(doc === wrote, `middleware wrote ${wrote}, document.cookie has ${doc}`)}`)
  out.push(`app-level ref -> ${verdict(String(app) === wrote, `app ref reads ${app}`)}`)
}

if (CHECK === 'mw-deep') {
  await navigate(3)
  await settle()
  const n = await page.evaluate(() => window.__mwDeep)
  const raw = await cookie('d')
  const stored = raw ? JSON.parse(decodeURIComponent(raw)).n : undefined
  out.push(`document.cookie -> ${verdict(stored === n, `middleware set n=${n}, cookie has n=${stored}`)}`)
}

if (CHECK === 'shared') {
  await navigate(1)
  await page.evaluate(() => { document.cookie = 's=after; path=/' })
  await settle()
  const later = await page.evaluate(() => window.__sharedRef?.value)
  out.push(`after a later document.cookie write -> ${verdict(later === 'after', `shared ref reads ${later}`)}`)
}

if (CHECK === 'setup') {
  let flagged = 0
  let followed = 0
  let followedWhileFlagged = 0
  const runs = 10
  for (let i = 0; i < runs; i++) {
    await page.context().clearCookies()
    await page.goto(`${BASE}/a`, { waitUntil: 'networkidle' })
    const flag = await page.evaluate(() => window.__vueSetupFlag)
    await page.evaluate(() => { document.cookie = 'v=after; path=/' })
    await settle()
    const ok = (await page.evaluate(() => window.__vueSetupRef?.value)) === 'after'
    if (flag) flagged++
    if (ok) followed++
    if (flag && ok) followedWhileFlagged++
  }
  out.push(`flag set in vue:setup ${flagged}/${runs}; ref follows a later document.cookie write ${followed}/${runs} (${followedWhileFlagged}/${flagged} of the flagged runs)`)
}

console.log(`${noCookieStore ? 'no cookieStore' : 'cookieStore'}, ${CHECK}: ${out.join('; ')}`)
await browser.close()
