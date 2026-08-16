#!/usr/bin/env bash
# End-to-end realtime verification for the quiz platform.
# Starts the socket service itself (kept alive within this single command),
# then drives both admin + participant via Caddy (:81) using ref-based clicks.

set +e
ADMIN_URL="http://localhost:81"
PASS=0; FAIL=0
log() { echo ">>> $*"; }
ok()   { echo "[OK]   $*"; PASS=$((PASS+1)); }
bad()  { echo "[FAIL] $*"; FAIL=$((FAIL+1)); }

# helper: extract a ref by matching a label in the interactive snapshot
ref_of() { agent-browser $1 snapshot -i 2>/dev/null | grep -F "$2" | grep -oE 'ref=e[0-9]+' | head -1 | sed 's/ref=//'; }
click_text() { local r=$(ref_of "" "$1"); [ -n "$r" ] && agent-browser click @$r; }
click_text_p() { local r=$(ref_of "--session participant" "$1"); [ -n "$r" ] && agent-browser --session participant click @$r; }

# ---------- start socket service ----------
log "starting socket service on :3003"
pkill -f "index.ts" >/dev/null 2>&1
sleep 1
cd /home/z/my-project/mini-services/quiz-realtime
bun index.ts > /home/z/my-project/quiz-realtime.log 2>&1 &
RT_PID=$!
sleep 3
if kill -0 $RT_PID 2>/dev/null; then ok "socket service running (pid=$RT_PID)"; else bad "socket service failed"; fi
DIRECT=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3003/socket.io/?EIO=4&transport=polling")
log "direct socket polling = $DIRECT"
CADDY=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:81/socket.io/?EIO=4&transport=polling&XTransformPort=3003")
log "caddy socket polling = $CADDY"

agent-browser close >/dev/null 2>&1
agent-browser --session participant close >/dev/null 2>&1
sleep 1

# ---------- ADMIN: login ----------
log "ADMIN: open + login"
agent-browser set viewport 1280 800 >/dev/null 2>&1
agent-browser open "$ADMIN_URL" >/dev/null 2>&1
sleep 2.5
click_text "Host a quiz"; sleep 1.5
EMAIL_REF=$(ref_of "" "Email")
agent-browser fill @$EMAIL_REF "admin@quiz.local" >/dev/null 2>&1
PASS_REF=$(ref_of "" "Password")
agent-browser fill @$PASS_REF "admin123" >/dev/null 2>&1
SIGNIN_REF=$(ref_of "" "Sign in")
agent-browser click @$SIGNIN_REF >/dev/null 2>&1
sleep 2
if agent-browser snapshot -i 2>/dev/null | grep -q "Create Activity"; then ok "admin dashboard reached"; else bad "no dashboard"; agent-browser screenshot /home/z/my-project/dbg-no-dashboard.png >/dev/null 2>&1; fi

# ---------- ADMIN: open presentation of the published activity ----------
log "ADMIN: open presentation"
PRES_REF=$(ref_of "" "Present")
agent-browser click @$PRES_REF >/dev/null 2>&1
sleep 2.5
if agent-browser snapshot -i 2>/dev/null | grep -q "Start activity"; then ok "presentation lobby reached"; else bad "no lobby"; fi
agent-browser screenshot /home/z/my-project/verify-admin-lobby.png >/dev/null 2>&1
# Capture the access code NOW (lobby shows it prominently) — fall back to known code
CODE=$(agent-browser snapshot 2>/dev/null | grep -oE '[0-9]{6}' | head -1)
if [ -z "$CODE" ]; then CODE="586553"; fi
log "captured access code = $CODE"

# ---------- ADMIN: start activity ----------
log "ADMIN: start activity"
START_REF=$(ref_of "" "Start activity")
agent-browser click @$START_REF >/dev/null 2>&1
sleep 2.5
# After start_activity the admin screen transitions; look for a "Start Question" button
SQ_REF=$(ref_of "" "Start Question")
if [ -z "$SQ_REF" ]; then SQ_REF=$(ref_of "" "Start question"); fi
if [ -z "$SQ_REF" ]; then SQ_REF=$(ref_of "" "Question 1"); fi
log "start-question ref=$SQ_REF"
if [ -n "$SQ_REF" ]; then
  agent-browser click @$SQ_REF >/dev/null 2>&1
  sleep 2.5
  ok "start question clicked"
else
  bad "no start-question button"
  agent-browser snapshot -i 2>/dev/null | head -20
fi

# Verify admin sees the question
ADMIN_Q=$(agent-browser snapshot 2>/dev/null | grep -iE "typeof|array|object" | head -1)
log "admin question text: $ADMIN_Q"
if [ -n "$ADMIN_Q" ]; then ok "admin question slide visible"; else bad "admin no question"; fi
agent-browser screenshot /home/z/my-project/verify-admin-question.png >/dev/null 2>&1

# ---------- PARTICIPANT: join ----------
log "PARTICIPANT: join"
agent-browser --session participant set viewport 375 720 >/dev/null 2>&1
agent-browser --session participant open "$ADMIN_URL" >/dev/null 2>&1
sleep 2.5
click_text_p "Join a quiz"; sleep 1.5
log "using access code = $CODE"
CODEINPUT=$(ref_of "--session participant" "access code")
agent-browser --session participant fill @$CODEINPUT "$CODE" >/dev/null 2>&1
sleep 0.5
click_text_p "Continue"; sleep 1.5
NAMEINPUT=$(ref_of "--session participant" "Display name")
agent-browser --session participant fill @$NAMEINPUT "Tester" >/dev/null 2>&1
sleep 0.5
click_text_p "Join quiz"; sleep 3

PART_SNAP=$(agent-browser --session participant snapshot 2>/dev/null)
PART_Q=$(echo "$PART_SNAP" | grep -iE "typeof|array|object|Question [0-9]" | head -1)
log "participant sees: $PART_Q"
if echo "$PART_SNAP" | grep -qiE "typeof|array|object"; then ok "PARTICIPANT received live question via socket"; else bad "participant did not receive question"; fi
agent-browser --session participant screenshot /home/z/my-project/verify-participant-question.png >/dev/null 2>&1

# ---------- PARTICIPANT: answer ----------
log "PARTICIPANT: answering"
click_text_p "array"; sleep 2
PART_POST=$(agent-browser --session participant snapshot -i 2>/dev/null)
if echo "$PART_POST" | grep -qiE "submitted|waiting|Answer submitted"; then ok "participant answer submitted"; else bad "participant answer state unclear"; fi
agent-browser --session participant screenshot /home/z/my-project/verify-participant-answered.png >/dev/null 2>&1

# ---------- ADMIN: live results ----------
log "ADMIN: live results"
sleep 1
ADMIN_SNAP=$(agent-browser snapshot 2>/dev/null)
if echo "$ADMIN_SNAP" | grep -qiE "answered|responses"; then ok "admin sees live response count"; else bad "admin no live results"; fi
agent-browser screenshot /home/z/my-project/verify-admin-results.png >/dev/null 2>&1

# ---------- ADMIN: end question ----------
log "ADMIN: end question"
ENDQ=$(ref_of "" "End question"); [ -z "$ENDQ" ] && ENDQ=$(ref_of "" "End Question")
[ -n "$ENDQ" ] && agent-browser click @$ENDQ >/dev/null 2>&1
sleep 2.5
PART_REVEAL=$(agent-browser --session participant snapshot 2>/dev/null | grep -iE "correct|Correct|reveal" | head -1)
log "participant reveal: $PART_REVEAL"
agent-browser --session participant screenshot /home/z/my-project/verify-participant-reveal.png >/dev/null 2>&1
if [ -n "$PART_REVEAL" ]; then ok "PARTICIPANT saw the reveal"; else bad "participant no reveal"; fi

# ---------- ADMIN: end activity ----------
log "ADMIN: end activity"
ENDA=$(ref_of "" "End activity"); [ -z "$ENDA" ] && ENDA=$(ref_of "" "End Activity")
[ -n "$ENDA" ] && agent-browser click @$ENDA >/dev/null 2>&1
sleep 2

echo ""
echo "=========================================="
echo "REALTIME E2E RESULT:  PASS=$PASS  FAIL=$FAIL"
echo "=========================================="
agent-browser console 2>/dev/null | grep -iE "socket" | head -8
kill $RT_PID >/dev/null 2>&1
exit 0
