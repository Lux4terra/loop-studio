#!/bin/sh
# Runs every suite against the local mock. Usage: sh dev/tests/run_all.sh   or   sh dev/tests/run_all.sh a_api c_ui
cd "$(dirname "$0")"
export PYTHONDONTWRITEBYTECODE=1
SUITES=${*:-"a_api b_registry m_modules c_ui d_flows s_secrets"}
FAILED=0; TOTAL=0
for t in $SUITES; do
  sh run_dev.sh >/dev/null   # a fresh mock for each suite
  timeout 600 python3 -W ignore $t.py > out_$t.txt 2>&1
  P=$(grep -c '^PASS' out_$t.txt); F=$(grep -c '^FAIL ' out_$t.txt); TOTAL=$((TOTAL+P+F))
  STOP=$(grep -q '^Traceback' out_$t.txt && echo ', STOPPED EARLY')
  echo "$t: $P pass, $F fail$STOP"
  [ "$F" -gt 0 ] || [ -n "$STOP" ] && FAILED=1
done
[ -f dev.pid ] && kill $(cat dev.pid) 2>/dev/null
echo "checks: $TOTAL"
exit $FAILED
