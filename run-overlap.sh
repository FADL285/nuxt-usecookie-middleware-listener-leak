#!/usr/bin/env bash
# Overlapping navigations, cases A, B and C, with and without Cookie Store. Usage: ./run-overlap.sh <label>
set -u
PORT=3519
NUXT_PUBLIC_MODE=overlap PORT=$PORT HOST=127.0.0.1 node .output/server/index.mjs >/dev/null 2>&1 &
for _ in $(seq 50); do curl -sf "http://127.0.0.1:$PORT/a" >/dev/null && break; sleep 0.2; done
echo "## overlap, $1"
for c in A B C; do
  node overlap.mjs "http://127.0.0.1:$PORT" $c
  node overlap.mjs "http://127.0.0.1:$PORT" $c --no-cookiestore
done
kill "$(ss -ltnp "sport = :$PORT" | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2)"; sleep 0.5
