#!/usr/bin/env bash
# The vue:setup race: is _processingMiddleware still set when vue:setup runs, and does a ref
# created there in app._scope keep following the cookie? Run once per build (SSR and REPRO_SSR=false).
# Usage: ./run-setup-race.sh <label>   (after pnpm build; ONE_SHOTS=sketch for the unpatched baseline)
set -u
PORT=3519
for mode in default slow-b; do
for oneShot in ${ONE_SHOTS:-sketch middleware-only}; do
  for race in '' 1; do
    NUXT_PUBLIC_MODE=$mode NUXT_PUBLIC_RACE=$race NUXT_PUBLIC_ONE_SHOT=$oneShot PORT=$PORT HOST=127.0.0.1 node .output/server/index.mjs >/dev/null 2>&1 &
    for _ in $(seq 50); do curl -sf "http://127.0.0.1:$PORT/a" >/dev/null && break; sleep 0.2; done
    echo "## $1, middleware: $mode, one-shot condition: $oneShot, plugin navigation without await: ${race:-no}"
    node oneshot.mjs "http://127.0.0.1:$PORT" setup
    kill "$(ss -ltnp "sport = :$PORT" | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2)"; sleep 0.5
  done
done
done
