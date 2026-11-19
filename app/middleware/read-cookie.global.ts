// Reads a cookie on every navigation. The docs list route middleware as a valid place for composables.
export default defineNuxtRouteMiddleware(() => {
  useCookie('x').value
})
