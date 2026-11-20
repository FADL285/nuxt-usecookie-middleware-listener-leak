#!/usr/bin/env bash
# Starts the built server once per middleware mode and runs the counters and freshness checks.
# Usage: ./run-matrix.sh   (after pnpm build)
set -u
PORT=3519
start() {
  NUXT_PUBLIC_MODE=$1 NUXT_PUBLIC_WRITERS=${2:-} PORT=$PORT HOST=127.0.0.1 node .output/server/index.mjs >/dev/null 2>&1 &
  for _ in $(seq 50); do curl -sf "http://127.0.0.1:$PORT/a" >/dev/null && return; sleep 0.2; done
}
stop() { kill "$(ss -ltnp "sport = :$PORT" | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2)"; sleep 0.5; }

for mode in none default readonly alt-options inline-default maxage no-scope both; do
  echo "## mode: $mode"
  start "$mode"
  node count-all.mjs "http://127.0.0.1:$PORT" 50
  node count-all.mjs "http://127.0.0.1:$PORT" 50 --no-cookiestore
  stop
done

# default reads before any await (app scope); no-scope reads after one.
for mode in default no-scope; do
  echo "## freshness (mode: $mode)"
  start "$mode" 1
  for d in 0 100; do
    node fresh.mjs "http://127.0.0.1:$PORT" --delay=$d
    node fresh.mjs "http://127.0.0.1:$PORT" --no-cookiestore --delay=$d
  done
  stop
done

echo "## one-shot checks"
start none
for check in plugin timer; do
  node oneshot.mjs "http://127.0.0.1:$PORT" $check
  node oneshot.mjs "http://127.0.0.1:$PORT" $check --no-cookiestore
done
stop
for pair in mw-write:mw-write mw-deep:mw-deep shared-ref:shared; do
  start "${pair%%:*}"
  node oneshot.mjs "http://127.0.0.1:$PORT" "${pair##*:}"
  node oneshot.mjs "http://127.0.0.1:$PORT" "${pair##*:}" --no-cookiestore
  stop
done
