// Sets x through a Set-Cookie response header, the way an API or auth endpoint would.
export default defineEventHandler((event) => {
  setCookie(event, 'x', String(getQuery(event).v ?? ''), { path: '/' })
  return { ok: true }
})
