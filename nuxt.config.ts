export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  devtools: { enabled: false },
  // REPRO_SSR=false at build time gives a client-only build (for the vue:setup race check).
  ssr: process.env.REPRO_SSR !== 'false',
  // Set at start time, no rebuild needed:
  // NUXT_PUBLIC_MODE picks the middleware variant; NUXT_PUBLIC_WRITERS=1 shows the write buttons;
  // NUXT_PUBLIC_RACE=1 makes a plugin start a navigation without await;
  // NUXT_PUBLIC_ONE_SHOT=middleware-only switches the patch to the narrower condition.
  runtimeConfig: { public: { mode: 'default', writers: false, race: false, oneShot: 'sketch' } },
})
