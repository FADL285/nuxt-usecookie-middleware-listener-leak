// An app-lifetime ref created in a plugin. It must keep following the cookie.
export default defineNuxtPlugin((nuxtApp) => {
  const cookie = useCookie<string | null>('p')
  const win = window as any
  win.__pluginCookie = () => cookie.value
  // An app-lifetime ref created lazily in app._scope from vue:setup, the way an app-level
  // helper that shares one ref per cookie would. Records whether middleware was still running.
  nuxtApp.hook('vue:setup', () => {
    win.__vueSetupFlag = !!nuxtApp._processingMiddleware
    win.__vueSetupRef = nuxtApp._scope.run(() => useCookie<string | null>('v'))
  })
})
