export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  devtools: { enabled: false },
  // Set at start time, no rebuild needed:
  // NUXT_PUBLIC_MODE picks the middleware variant; NUXT_PUBLIC_WRITERS=1 shows the write buttons.
  runtimeConfig: { public: { mode: 'default', writers: false } },
})
