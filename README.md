# `useCookie` in route middleware leaks a `cookieStore` listener per navigation

Minimal reproduction for Nuxt 4.6.4.

`app/middleware/read-cookie.global.ts` calls `useCookie('x')` on every navigation. Each call adds a `cookieStore` "change" listener that is never removed, so the count grows by one per navigation.

## Run

```sh
pnpm install
pnpm exec playwright install chromium
pnpm build
pnpm start            # serves http://127.0.0.1:3519
# in a second terminal:
node count.mjs http://127.0.0.1:3519 50 link     # navigate with <NuxtLink>
node count.mjs http://127.0.0.1:3519 50 button   # navigate with navigateTo()
```

## Result

| Setup | After load | After 50 navigations |
| --- | --- | --- |
| Middleware, `<NuxtLink>` | 1 | 51 |
| Middleware, `navigateTo()` | 1 | 51 |
| Middleware removed, `<NuxtLink>` | 0 | 0 |
| Middleware removed, `navigateTo()` | 0 | 0 |

`count.mjs` wraps `CookieStore.prototype.addEventListener` / `removeEventListener` in an init script and counts live `change` listeners.
