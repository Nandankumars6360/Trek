#!/bin/bash
# Stops the local e2e stack started by up.sh (and an app server on :3000).
LOGS=${LOGS:-/tmp/trek-e2e}
for s in gateway postgrest auth next; do
  [ -f "$LOGS/$s.pid" ] && kill "$(cat "$LOGS/$s.pid")" 2>/dev/null && echo "stopped $s"
  rm -f "$LOGS/$s.pid"
done
for p in $(ps -eo pid,args | grep -E "next-server|next start" | grep -v grep | awk "{print \$1}"); do kill "$p" 2>/dev/null && echo "stopped next ($p)"; done
for port in 54321 9999 3001; do
  for pid in $(ss -ltnpH "sport = :$port" 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u); do kill "$pid" 2>/dev/null && echo "stopped :$port"; done
done
exit 0
