#!/bin/sh
# Starts a fresh local mock (Vercel + GitHub) on SPORT (default 8791).
cd "$(dirname "$0")"
[ -f dev.pid ] && kill $(cat dev.pid) 2>/dev/null
sleep 0.3
nohup node devserver.mjs "$(cd ../.. && pwd)" ${SPORT:-8791} > dev.log 2>&1 &
echo $! > dev.pid
i=0; until curl -s -o /dev/null "http://localhost:${SPORT:-8791}/__mock" || [ $i -ge 40 ]; do sleep 0.1; i=$((i+1)); done
cat dev.log
