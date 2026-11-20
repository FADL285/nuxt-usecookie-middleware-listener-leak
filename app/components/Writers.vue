<template>
  <span>
    <button id="write-component" @click="fromComponent">component write</button>
    <button id="write-document" @click="fromDocument">document.cookie write</button>
    <button id="write-server" @click="fromServer">Set-Cookie write</button>
  </span>
</template>

<script setup lang="ts">
// Each button writes x = window.__next, then navigates in the same task, so the
// middleware on the next page shows whether it sees the new value.
const route = useRoute()
const cookie = useCookie<string | number | null>('x')
const next = () => (window as any).__next
const other = () => (route.path === '/a' ? '/b' : '/a')

function fromComponent() {
  cookie.value = next()
  return navigateTo(other())
}
function fromDocument() {
  document.cookie = `x=${next()}; path=/`
  return navigateTo(other())
}
async function fromServer() {
  await $fetch('/api/set', { query: { v: next() } })
  return navigateTo(other())
}
</script>
