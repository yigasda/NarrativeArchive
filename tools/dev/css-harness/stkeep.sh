#!/usr/bin/env bash
# tools/dev/css-harness/stkeep.sh (in the background) — keep the local SillyTavern up: start it when :8000 stops answering
while true; do
  if ! curl -s -o /dev/null --max-time 5 127.0.0.1:8000; then
    echo "$(date +%H:%M:%S) restarting ST"; (cd ~/sillytavern && nohup node server.js >> ~/st.log 2>&1 &); sleep 20
  fi
  sleep 10
done
