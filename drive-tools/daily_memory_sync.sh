#!/bin/bash
# daily_memory_sync.sh - Posts today's hoa-code git activity to ai-memory.
# Runs nightly at midnight via /etc/crontab.

API_KEY="m_rw_Xi0yqUT5B6m4iJm6RxsNumQc2RcE5-K8BFFBfTXDMUk"
API_URL="https://memory.wmbuck.net/memories"
REPO="/home/dee/hoa-code"
LOG="/home/dee/hoa-code/drive-tools/memory_sync.log"
DATE=$(date +%Y-%m-%d)

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"; }

# Trim log to last 30 days
if [ -f "$LOG" ]; then
    tail -n 500 "$LOG" > "${LOG}.tmp" && mv "${LOG}.tmp" "$LOG"
fi

cd "$REPO" || { log "ERROR: cannot cd to $REPO"; exit 1; }

# Collect today's commits (since midnight)
COMMITS=$(git log --since="$DATE 00:00:00" --until="$DATE 23:59:59" \
    --format="  %h %s" 2>/dev/null)

# Collect uncommitted modified files (snapshot of work in progress)
DIRTY=$(git status --short 2>/dev/null | grep -v "^?" | head -20)

if [ -z "$COMMITS" ] && [ -z "$DIRTY" ]; then
    log "No activity today — nothing to record."
    exit 0
fi

# Build content
CONTENT="hoa-code daily activity snapshot: $DATE"$'\n'

if [ -n "$COMMITS" ]; then
    CONTENT+=$'\nCommits:\n'"$COMMITS"
fi

if [ -n "$DIRTY" ]; then
    CONTENT+=$'\nUncommitted changes:\n'"$DIRTY"
fi

# Post to ai-memory
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL" \
    -H "X-API-Key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "$(python3 -c "
import json, sys
content = sys.argv[1]
print(json.dumps({
    'content': content,
    'confidence': 0.9,
    'tags': ['hoa', 'git', 'daily-log', '$DATE']
}))
" "$CONTENT")")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    log "Posted daily snapshot for $DATE."
else
    log "ERROR: POST returned HTTP $HTTP_CODE"
    log "Response: $(echo "$RESPONSE" | head -1)"
    exit 1
fi
