// Shared browser setup for count-all.mjs and fresh.mjs.
import { chromium } from '@playwright/test'

export async function openPage({ noCookieStore }) {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.addInitScript((noCookieStore) => {
    let listeners = 0
    let channels = 0
    if (noCookieStore) {
      delete window.cookieStore
      delete window.CookieStore
    } else {
      const add = CookieStore.prototype.addEventListener
      const remove = CookieStore.prototype.removeEventListener
      CookieStore.prototype.addEventListener = function (type, ...rest) {
        if (type === 'change') listeners++
        return add.call(this, type, ...rest)
      }
      CookieStore.prototype.removeEventListener = function (type, ...rest) {
        if (type === 'change') listeners--
        return remove.call(this, type, ...rest)
      }
    }
    const Native = window.BroadcastChannel
    window.BroadcastChannel = class extends Native {
      constructor(name) { super(name); if (String(name).startsWith('nuxt:cookies:')) { channels++; this.__counted = true } }
      close() { if (this.__counted && !this.__closed) { channels--; this.__closed = true } return super.close() }
    }
    window.__counts = () => {
      const app = document.querySelector('#__nuxt').__vue_app__.$nuxt
      return {
        listeners,
        channels,
        writers: app._cookieWriters?.size ?? 0,
        appScopeEffects: app._scope.effects.length,
        appScopeScopes: app._scope.scopes?.length ?? 0,
      }
    }
  }, noCookieStore)
  return { browser, page }
}
