// Reads a cookie on every navigation. The docs list route middleware as a valid place for composables.
// NUXT_PUBLIC_MODE picks the variant; the value read is pushed to window.__seen for the freshness checks.
let calls = 0
let shared: Ref<string | null> | undefined

export default defineNuxtRouteMiddleware(async (to) => {
  const mode = useRuntimeConfig().public.mode
  const seen = (value: unknown) => {
    if (import.meta.client) ((window as any).__seen ||= []).push(value)
  }

  switch (mode) {
    case 'none':
      return
    case 'readonly':
      return seen(useCookie('x', { readonly: true }).value)
    case 'alt-options':
      // Same name, options that differ on every other call.
      return seen(useCookie('x', ++calls % 2 ? {} : { maxAge: 60 }).value)
    case 'inline-default':
      // A new function object on every call, as inline options usually are.
      return seen(useCookie('x', { default: () => 0 }).value)
    case 'maxage':
      // An expiring cookie goes through Nuxt's internal cookieRef (its own watcher and timeout).
      return seen(useCookie('x', { maxAge: 60 }).value)
    case 'both':
      // One call before an await (app scope) and one after it (no scope).
      useCookie('x').value
      await Promise.resolve()
      return seen(useCookie('x').value)
    case 'mw-write':
      // A plain assignment in middleware. window.__mwWrote is what should reach document.cookie.
      if (import.meta.client) {
        const written = String(++calls)
        useCookie<string>('w').value = written
        ;(window as any).__mwWrote = written
      }
      return
    case 'mw-deep':
      // A deep mutation, which the docs say the default deep watch persists.
      if (import.meta.client) {
        const cookie = useCookie<{ n: number }>('d', { default: () => ({ n: 0 }) })
        cookie.value.n = ++calls
        ;(window as any).__mwDeep = calls
      }
      return
    case 'shared-ref':
      // An app-lifetime ref created in app._scope the first time middleware needs it,
      // the way an app-level helper that shares one ref per cookie would.
      if (import.meta.client) {
        shared ||= useNuxtApp()._scope.run(() => useCookie<string | null>('s'))
        ;(window as any).__sharedRef = shared
      }
      return
    case 'slow':
      // Middleware that awaits something (a fetch, a timer) before it reads the cookie.
      await new Promise(resolve => setTimeout(resolve, 50))
      return seen(useCookie('x').value)
    case 'slow-b':
      // Only navigations to /b wait, so a navigation to /b can outlast the initial one.
      if (to.path === '/b') await new Promise(resolve => setTimeout(resolve, 200))
      return seen(useCookie('x').value)
    case 'maxage-both':
      // An expiring cookie read once before an await and once after it.
      useCookie('x', { maxAge: 60 }).value
      await Promise.resolve()
      return seen(useCookie('x', { maxAge: 60 }).value)
    case 'overlap': {
      // ?wait=N waits before reading, ?after=N waits again and then writes the path to the cookie.
      // Records whether the call after the await ran in another navigation's scope, or in none.
      const nuxtApp = useNuxtApp() as any
      const own = nuxtApp._middlewareScope
      const wait = Number(to.query.wait || 0)
      const after = Number(to.query.after || 0)
      if (wait) await new Promise(resolve => setTimeout(resolve, wait))
      const current = nuxtApp._middlewareScope
      const c = useCookie<string | null>('o')
      if (import.meta.client) {
        ;((window as any).__overlap ||= []).push({ path: to.path, adoptedOther: !!current && current !== own, noScope: !current })
      }
      if (after) {
        await new Promise(resolve => setTimeout(resolve, after))
        c.value = to.path
      }
      return
    }
    case 'no-scope':
      // After an await the effect scope is no longer active.
      await Promise.resolve()
      return seen(useCookie('x').value)
    default:
      return seen(useCookie('x').value)
  }
})
