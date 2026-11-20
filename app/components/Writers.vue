<template>
  <span>
    <button id="write-component" @click="fromComponent">component write</button>
    <button id="write-document" @click="fromDocument">document.cookie write</button>
    <button id="write-server" @click="fromServer">Set-Cookie write</button>
  </span>
</template>

<script setup lang="ts">
// Each button writes x = window.__next, waits window.__delay ms (0 = same task), then navigates,
// so the middleware on the next page shows whether it sees the new value.
const route = useRoute()
const cookie = useCookie<string | number | null>('x')
const next = () => (window as any).__next
const other = () => (route.path === '/a' ? '/b' : '/a')
const go = async () => {
  await new Promise(resolve => setTimeout(resolve, (window as any).__delay ?? 0))
  return navigateTo(other())
}

function fromComponent() {
  cookie.value = next()
  return go()
}
function fromDocument() {
  document.cookie = `x=${next()}; path=/`
  return go()
}
async function fromServer() {
  await $fetch('/api/set', { query: { v: next() } })
  return go()
}
</script>
