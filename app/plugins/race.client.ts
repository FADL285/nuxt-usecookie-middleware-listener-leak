// NUXT_PUBLIC_RACE=1: a plugin starts a navigation without awaiting it, so it overlaps the
// initial navigation and _processingMiddleware can still be set when vue:setup runs.
export default defineNuxtPlugin(() => {
  if (useRuntimeConfig().public.race) navigateTo('/b')
})
