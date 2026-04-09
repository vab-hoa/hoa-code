#!/bin/bash
# Keystone scraper cron wrapper
# Loads credentials from .env and runs the Selenium scraper
# Cron entry: 0 3 * * * /home/dee/hoa-code/keystone-scraper/run_scraper.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG="$SCRIPT_DIR/scraper.log"

# Trim log to last 14 days
if [ -f "$LOG" ]; then
    CUTOFF=$(date -d '14 days ago' '+%a %b')
    # Find the first run header within the retention window
    LINE=$(grep -n "=== Keystone scraper run:" "$LOG" | while IFS=: read -r num text; do
        # Extract date from: === Keystone scraper run: Mon Mar 24 03:00:00 AM MDT 2026 ===
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

# Load credentials
set -a
source "$SCRIPT_DIR/.env"
set +a

# Run scraper
"$SCRIPT_DIR/venv/bin/python" "$SCRIPT_DIR/keystone_scraper_selenium.py" >> "$LOG" 2>&1
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    echo "FAILED with exit code $EXIT_CODE at $(date)" >> "$LOG"
    # Send failure alert via mail
    echo "Keystone scraper failed at $(date) on $(hostname). Check $LOG" | \
        mail -s "Keystone scraper FAILED" dee@wmbuck.net 2>/dev/null
else
    echo "Completed successfully at $(date)" >> "$LOG"
fi

echo "" >> "$LOG"
