// Reads a cookie on every navigation. The docs list route middleware as a valid place for composables.
// NUXT_PUBLIC_MODE picks the variant; the value read is pushed to window.__seen for the freshness checks.
let calls = 0

export default defineNuxtRouteMiddleware(async () => {
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
    case 'no-scope':
      // After an await the effect scope is no longer active.
      await Promise.resolve()
      return seen(useCookie('x').value)
    default:
      return seen(useCookie('x').value)
  }
})
