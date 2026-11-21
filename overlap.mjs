// Overlapping navigations (NUXT_PUBLIC_MODE=overlap). The first navigation's middleware awaits;
// a second navigation starts 50 ms later. 10 repetitions per case, counters before and after.
//   A - the second navigation is still running when the first resumes, and ends before the first writes the cookie
//   B - the second navigation ends before the first resumes
//   C - control: one slow navigation, no overlap
// Usage: node overlap.mjs <baseUrl> <A|B|C> [--no-cookiestore]
import { openPage } from './probe.mjs'

const [BASE = 'http://127.0.0.1:3519', CASE = 'A'] = process.argv.slice(2).filter(a => !a.startsWith('--'))
const noCookieStore = process.argv.includes('--no-cookiestore')
const cases = {
  A: { first: '/b?wait=300&after=300', second: '/a?wait=400', total: 900 },
  B: { first: '/b?wait=300', second: '/a?fast=1', total: 500 },
  C: { first: '/b?wait=300&after=300', second: null, total: 800 },
}
const { first, second, total } = cases[CASE]
const { browser, page } = await openPage({ noCookieStore })
await page.goto(`${BASE}/a`, { waitUntil: 'networkidle' })
const counts = () => page.evaluate(() => window.__counts())
const before = await counts()
let landed = 0
const runs = 10
for (let i = 0; i < runs; i++) {
  await page.evaluate(() => { document.cookie = 'o=; path=/; max-age=0' })
  await page.evaluate(({ first, second }) => {
    const router = document.querySelector('#__nuxt').__vue_app__.$nuxt.$router
    router.push(first).catch(() => {})
    if (second) setTimeout(() => router.push(second).catch(() => {}), 50)
  }, { first, second })
  await page.waitForTimeout(total)
  const raw = await page.evaluate(() => document.cookie.split('; ').find(c => c.startsWith('o='))?.slice(2))
  if (raw && decodeURIComponent(raw).replaceAll('"', '') === '/b') landed++
  await page.evaluate(() => document.querySelector('#__nuxt').__vue_app__.$nuxt.$router.push('/a').catch(() => {}))
  await page.waitForTimeout(100)
}
const after = await counts()
const log = await page.evaluate(() => window.__overlap || [])
const firstCalls = log.filter(e => e.path === '/b')
const fmt = c => `listeners ${c.listeners}, channels ${c.channels}, writers ${c.writers}, effects ${c.appScopeEffects}, scopes ${c.appScopeScopes}`
console.log(`${noCookieStore ? 'no cookieStore' : 'cookieStore'}, case ${CASE}: first navigation's call after the await ran in the other navigation's scope ${firstCalls.filter(e => e.adoptedOther).length}/${firstCalls.length}, in no scope ${firstCalls.filter(e => e.noScope).length}/${firstCalls.length}; its later write reached document.cookie ${CASE === 'B' ? 'n/a' : `${landed}/${runs}`}`)
console.log(`  counters: ${fmt(before)}  ->  after ${runs} overlaps: ${fmt(after)}`)
await browser.close()
