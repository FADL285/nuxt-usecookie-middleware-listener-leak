# `useCookie` in route middleware leaks a `cookieStore` listener per navigation

Minimal reproduction for Nuxt 4.6.4 ([nuxt/nuxt#37169](https://github.com/nuxt/nuxt/issues/37169)).

`app/middleware/read-cookie.global.ts` calls `useCookie('x')` on every navigation. Route middleware runs inside `nuxtApp._scope`, which lives as long as the app, so nothing a call registers is ever cleaned up. Each call leaves behind:

- a `cookieStore` "change" listener, or an open `nuxt:cookies:x` BroadcastChannel when the browser has no Cookie Store API;
- a writer in `nuxtApp._cookieWriters`;
- a watcher in `nuxtApp._scope.effects` (only for calls that aren't `readonly`).

## Run

```sh
pnpm install
pnpm exec playwright install chromium
pnpm build
./run-matrix.sh        # starts the server once per middleware variant and runs every check below
```

Or by hand:

```sh
pnpm start                                                # serves http://127.0.0.1:3519
node count-all.mjs http://127.0.0.1:3519 50               # listeners, writers, app scope watchers
node count-all.mjs http://127.0.0.1:3519 50 --no-cookiestore
NUXT_PUBLIC_WRITERS=1 pnpm start                          # then:
node fresh.mjs http://127.0.0.1:3519 [--no-cookiestore] [--delay=100]
```

The older single-purpose scripts still work: `node count.mjs <url> 50 link|button` and `node count-no-cookiestore.mjs <url> 50`.

- `NUXT_PUBLIC_MODE` picks the middleware variant at start time, so no rebuild is needed:
  - `default`: `useCookie('x')`;
  - `readonly`;
  - `alt-options`: `{}` and `{ maxAge: 60 }` on alternate calls;
  - `inline-default`: `{ default: () => 0 }`;
  - `no-scope`: the call is made after an `await`;
  - `none`: no `useCookie` call.
- `--no-cookiestore` deletes `cookieStore` before the app loads, so Nuxt falls back to BroadcastChannel.
- `fresh.mjs` checks whether the middleware on the next page sees a value written just before navigating. Each check runs three times, after one warm-up navigation. The value is written in three ways:
  - from a page component's `useCookie` ref;
  - with a plain `document.cookie` assignment;
  - from a server route's `Set-Cookie` header (`$fetch('/api/set')`).

  `--delay` waits that many milliseconds between the write and `navigateTo`.

## Results, Nuxt 4.6.4 unpatched (`results-unpatched.txt`)

Start → after 50 navigations between `/a` and `/b` (Chromium):

| Middleware variant          | Listeners (channels without Cookie Store) | `_cookieWriters` | `_scope.effects`                                                  |
| --------------------------- | ----------------------------------------- | ---------------- | ----------------------------------------------------------------- |
| none                        | 0 → 0                                     | 0 → 0            | 0 → 0                                                             |
| `useCookie('x')`            | 1 → 51                                    | 1 → 51           | 1 → 51                                                            |
| `readonly: true`            | 1 → 51                                    | 1 → 51           | 0 → 0                                                             |
| alternating options         | 1 → 51                                    | 1 → 51           | 1 → 76                                                            |
| inline `default` function   | 1 → 51                                    | 1 → 51           | 1 → 51                                                            |
| after an `await` (no scope) | 1 → 51                                    | 0 → 0            | 0 → 0 (the watchers belong to no scope, so nothing can stop them) |

With and without Cookie Store the numbers are the same. Freshness: the middleware sees every write, with any delay and in either mode.

## Trying the app-scope ref cache from the issue thread

Branch [`try-app-scope-ref-cache`](https://github.com/FADL285/nuxt-usecookie-middleware-listener-leak/tree/try-app-scope-ref-cache) applies the sketch from [the comment on #37169](https://github.com/nuxt/nuxt/issues/37169) as a pnpm patch. When `useCookie` runs directly in `app._scope`, the patched version returns one cached ref per cookie name and options. Its results are in `results-patched.txt` on that branch.

| Middleware variant          | Listeners | `_cookieWriters` | `_scope.effects` |
| --------------------------- | --------- | ---------------- | ---------------- |
| `useCookie('x')`            | 1 → 1     | 1 → 1            | 1 → 1            |
| `readonly: true`            | 1 → 1     | 1 → 1            | 0 → 0            |
| alternating options         | 1 → 51    | 1 → 51           | 1 → 76           |
| inline `default` function   | 1 → 1     | 1 → 1            | 1 → 1            |
| after an `await` (no scope) | 1 → 51    | 0 → 0            | 0 → 0            |

Freshness with the cache (the middleware reads one cached ref):

| Write, then `navigateTo`  | Cookie Store, no delay | Cookie Store, 100 ms | No Cookie Store, no delay | No Cookie Store, 100 ms |
| ------------------------- | ---------------------- | -------------------- | ------------------------- | ----------------------- |
| component `useCookie` ref | stale (previous value) | fresh                | stale (previous value)    | fresh                   |
| `document.cookie`         | stale (previous value) | fresh                | stale (never updates)     | stale (never updates)   |
| server `Set-Cookie`       | fresh                  | fresh                | stale (never updates)     | stale (never updates)   |

The cached ref only changes when a `cookieStore` change event or a BroadcastChannel message arrives. A change event arrives after the next navigation has already started. A BroadcastChannel message is only sent by another `useCookie` ref, so a `document.cookie` or `Set-Cookie` write never reaches it. Without the cache, each call reads `document.cookie`, so all of these cases are fresh.

## Trying one-shot calls (second sketch from the issue thread)

Branch `try-one-shot-calls` applies the [second sketch](https://github.com/nuxt/nuxt/issues/37169#issuecomment-7041850360) as a pnpm patch. On the client, a call with no active scope, or a call in `app._scope` while `nuxtApp._processingMiddleware` is set, returns a plain `customRef` that writes `document.cookie` on set and registers no listener, writer or watcher. The results are in `results-one-shot-baseline.txt` (unpatched 4.6.4) and `results-one-shot-patched.txt`.

Extra middleware variants on this branch:
- `maxage`: `{ maxAge: 60 }` on every call;
- `both`: one call before an `await` and one after it;
- `mw-write`: a plain assignment;
- `mw-deep`: a deep mutation of an object cookie;
- `shared-ref`: a ref created once in `app._scope` the first time the middleware needs it.

`oneshot.mjs` runs the checks that aren't counters.

Start → after 50 navigations (Chromium; the numbers are the same without Cookie Store):

| Middleware variant | Unpatched: listeners / writers / `_scope.effects` | One-shot patch |
| --- | --- | --- |
| `useCookie('x')` | 4→54 / 4→54 / 2→52 | 3→3 / 3→3 / 1→1 |
| `readonly: true` | 4→54 / 4→54 / 1→1 | 3→3 / 3→3 / 1→1 |
| before and after an `await` | 5→105 / 4→54 / 2→52 | 3→3 / 3→3 / 1→1 |
| after an `await` only | 4→54 / 3→3 / 1→1 | 3→3 / 3→3 / 1→1 |
| `{ maxAge: 60 }` | 4→54 / 4→54 / 3→103 | 3→3 / 3→3 / **2→52** |
| alternating options | 4→54 / 4→54 / 2→77 | 3→3 / 3→3 / **1→26** |

The baseline of 3 is the plugin and the two refs in `app.vue`, which this branch adds.

With the patch, freshness is the same as unpatched. Whether the write comes from a component ref, `document.cookie` or a server `Set-Cookie`, the middleware reads the new value before and after an `await`, with and without Cookie Store, with no delay and with 100 ms.

Other checks (✓ = works, ✗ = doesn't):

| Check | Unpatched, Cookie Store | Unpatched, no Cookie Store | Patched, Cookie Store | Patched, no Cookie Store |
| --- | --- | --- | --- | --- |
| A plugin ref follows a component ref write | ✓ | ✓ | ✓ | ✓ |
| A plugin ref follows a `document.cookie` write | ✓ | ✗ (no notification exists) | ✓ | ✗ (same) |
| A ref created in `setTimeout` (no scope) follows a later `document.cookie` write | ✓ | ✗ (same) | **✗** | ✗ |
| A plain assignment in middleware reaches `document.cookie` | ✓ | ✓ | ✓ | ✓ |
| ...and reaches a long-lived ref in `app.vue` | ✓ | ✓ | ✓ | **✗** (no BroadcastChannel message) |
| A deep mutation in middleware reaches `document.cookie` | ✓ | ✓ | **✗** | **✗** |
| A ref created in `app._scope` during middleware follows a later `document.cookie` write | ✓ | ✗ (same) | **✗** | ✗ |

Notes:
- With `maxAge` or `expires`, the ref is built by Nuxt's internal `cookieRef` before the one-shot check. That ref creates its own watcher in the current scope and registers a scope cleanup and a timeout, so those calls still leak watchers.
- `_processingMiddleware` stays set for the whole middleware chain. Any code that runs in `app._scope` during that window gets a one-shot ref, including an app-lifetime ref created lazily there, which then never updates.
