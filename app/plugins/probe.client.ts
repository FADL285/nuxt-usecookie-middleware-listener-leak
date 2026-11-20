// An app-lifetime ref created in a plugin. It must keep following the cookie.
export default defineNuxtPlugin(() => {
  const cookie = useCookie<string | null>('p')
  ;(window as any).__pluginCookie = () => cookie.value
})
