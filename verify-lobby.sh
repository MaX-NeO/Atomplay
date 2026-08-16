#!/bin/bash
# All-in-one corrected lobby verification.
cd /home/z/my-project
: > /home/z/my-project/dev.log

node ./node_modules/.bin/next dev -p 3000 >> /home/z/my-project/dev.log 2>&1 &
DEV_PID=$!
echo "[verify] dev pid=$DEV_PID"

READY=0
for i in $(seq 1 30); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null)
  if [ "$CODE" = "200" ]; then echo "[verify] ready after ${i}s"; READY=1; break; fi
  sleep 1
done
if [ "$READY" != "1" ]; then echo "[verify] FAILED start"; tail -15 dev.log; kill $DEV_PID 2>/dev/null; exit 1; fi

agent-browser close 2>/dev/null; sleep 1
echo "=== [1] Open landing ==="
agent-browser open "http://localhost:81/" 2>&1 | tail -1
agent-browser wait 4000 2>&1 | tail -1
echo "title: $(agent-browser get title 2>&1 | tail -1)"

echo "=== [2] Click Admin button -> login ==="
agent-browser find role button click --name "Admin" 2>&1 | tail -1
agent-browser wait 3000 2>&1 | tail -1
echo "url: $(agent-browser get url 2>&1 | tail -1)"
agent-browser snapshot -i -c 2>&1 | head -25

echo ""
echo "=== [3] Fill login form ==="
agent-browser find label "Email" fill "admin@atomcode.dev" 2>&1 | tail -1
agent-browser find label "Password" fill "Mr@1811321" 2>&1 | tail -1
echo "filled. snapshot before submit:"
agent-browser snapshot -i -c 2>&1 | head -20

echo ""
echo "=== [4] Click Sign in (ref e8) ==="
agent-browser click @e8 2>&1 | tail -1
agent-browser wait 4000 2>&1 | tail -1
echo "url: $(agent-browser get url 2>&1 | tail -1)"
echo "snapshot dashboard:"
agent-browser snapshot -i -c 2>&1 | head -30

echo ""
echo "=== [5] Screenshot dashboard ==="
agent-browser screenshot /tmp/dashboard.png 2>&1 | tail -1

echo ""
echo "=== [6] Click Present on Test Activity ==="
# Re-snapshot dashboard to find Present button ref
agent-browser snapshot -i 2>&1 | grep -iE "present|test activity" | head -8
# Click the first Present button by semantic finder (case-insensitive)
agent-browser find role button click --name "Present" 2>&1 | tail -1
# Fallback: if that failed, try clicking by text
agent-browser wait 5000 2>&1 | tail -1
echo "url: $(agent-browser get url 2>&1 | tail -1)"

echo ""
echo "=== [7] LOBBY screenshot ==="
agent-browser screenshot /tmp/lobby-host.png 2>&1 | tail -1
echo "lobby snapshot (compact):"
agent-browser snapshot -c 2>&1 | head -35

echo ""
echo "=== [8] Verify lobby elements via JS ==="
echo "access code text:"
agent-browser eval "var el=document.body.innerText.match(/\\d{6}/); el?el[0]:'none'" 2>&1 | tail -1
echo "join count:"
agent-browser eval "var el=document.body.innerText.match(/(\\d+)\\s*(joined|participants?)/i); el?el[0]:'none'" 2>&1 | tail -1
echo "start button present:"
agent-browser eval "Array.from(document.querySelectorAll('button')).some(b=>/start/i.test(b.textContent))?'YES':'NO'" 2>&1 | tail -1
echo "bubble circles count:"
agent-browser eval "document.querySelectorAll('.bubble-circle').length" 2>&1 | tail -1

echo ""
echo "=== [9] Errors + console ==="
agent-browser errors 2>&1 | tail -6
echo "--- console ---"
agent-browser console 2>&1 | tail -10

echo ""
echo "=== [10] dev.log tail ==="
tail -12 /home/z/my-project/dev.log

kill $DEV_PID 2>/dev/null
echo "[verify] DONE"
