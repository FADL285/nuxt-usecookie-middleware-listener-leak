<template>
  <div>
    <NuxtLink to="/a">a</NuxtLink> | <NuxtLink to="/b">b</NuxtLink>
    <button id="go" @click="navigateTo(route.path === '/a' ? '/b' : '/a')">go</button>
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
</script>
