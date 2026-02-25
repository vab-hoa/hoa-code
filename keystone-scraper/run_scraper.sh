#!/bin/bash
# Keystone scraper cron wrapper
# Loads credentials from .env and runs the Selenium scraper
# Cron entry: 0 3 * * * /home/dee/hoa-code/keystone-scraper/run_scraper.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG="$SCRIPT_DIR/scraper.log"

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
