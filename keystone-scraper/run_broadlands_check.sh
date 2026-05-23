#!/bin/bash
# Broadlands document sync — cron wrapper
# Checks for new/changed documents in the Broadlands portal and
# updates Google Drive in-place. Emails dee@wmbuck.net if anything changed.
# Cron entry: 30 4 * * 1  dee  /home/dee/hoa-code/keystone-scraper/run_broadlands_check.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG="$SCRIPT_DIR/broadlands_check.log"

# Trim log to last 30 days (500 lines)
if [ -f "$LOG" ]; then
    tail -n 500 "$LOG" > "${LOG}.tmp" && mv "${LOG}.tmp" "$LOG"
fi

echo "=== Broadlands check: $(date) ===" >> "$LOG"

set -a
source "$SCRIPT_DIR/.env"
set +a

"$SCRIPT_DIR/venv/bin/python" "$SCRIPT_DIR/broadlands_docs.py" >> "$LOG" 2>&1
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    echo "FAILED with exit code $EXIT_CODE at $(date)" >> "$LOG"
    echo "Broadlands document check failed at $(date) on $(hostname). Check $LOG" | \
        mail -s "Broadlands check FAILED" dee@wmbuck.net 2>/dev/null
fi

echo "" >> "$LOG"
