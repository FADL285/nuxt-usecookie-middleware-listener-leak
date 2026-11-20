<template>
  <div>
    <NuxtLink to="/a">a</NuxtLink> | <NuxtLink to="/b">b</NuxtLink>
    <button id="go" @click="navigateTo(route.path === '/a' ? '/b' : '/a')">go</button>
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
const route = useRoute()

// Refs that live as long as the app component, for oneshot.mjs:
// p is written from here and read by the plugin; w shows whether a middleware write reaches other refs.
const p = useCookie<string | null>('p')
const w = useCookie<string | null>('w')
if (import.meta.client) {
  const win = window as any
  win.__setPluginCookie = (value: string) => { p.value = value }
  win.__appW = () => w.value
  // A ref created with no active scope, outside middleware, like a timer or event callback would.
  win.__makeTimerRef = () => new Promise<void>(resolve => setTimeout(() => {
    win.__timerRef = useCookie<string | null>('t')
    resolve()
  }))
}
</script>
