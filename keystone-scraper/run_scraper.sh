#!/bin/bash
# Keystone scraper cron wrapper (v2 — REST API via Playwright)
# Runs the new CINC Connect REST API scraper
# Cron entry: 0 3 * * * /home/dee/hoa-code/keystone-scraper/run_scraper.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG="$SCRIPT_DIR/scraper.log"

# Trim log to last 14 days
if [ -f "$LOG" ]; then
    CUTOFF=$(date -d '14 days ago' '+%a %b')
    LINE=$(grep -n "=== Keystone scraper run:" "$LOG" | while IFS=: read -r num text; do
        run_epoch=$(date -d "$(echo "$text" | sed 's/.*run: //;s/ ===//')" '+%s' 2>/dev/null)
        cutoff_epoch=$(date -d '14 days ago' '+%s')
        if [ -n "$run_epoch" ] && [ "$run_epoch" -ge "$cutoff_epoch" ]; then
            echo "$num"
            break
        fi
    done)
    if [ -n "$LINE" ] && [ "$LINE" -gt 1 ]; then
        tail -n +"$LINE" "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
    fi
fi

echo "=== Keystone scraper run: $(date) ===" >> "$LOG"

# Run v2 scraper (reads .env directly, uses Playwright + REST API)
"$SCRIPT_DIR/venv/bin/python3" "$SCRIPT_DIR/keystone_scraper_v2.py" >> "$LOG" 2>&1
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    echo "FAILED with exit code $EXIT_CODE at $(date)" >> "$LOG"
    echo "Keystone scraper v2 failed at $(date) on $(hostname). Check $LOG" | \
        mail -s "Keystone scraper FAILED" dee@wmbuck.net 2>/dev/null
else
    echo "Completed successfully at $(date)" >> "$LOG"
fi

echo "" >> "$LOG"