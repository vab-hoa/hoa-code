#!/bin/bash
# Link monitor cron wrapper
# Crawls villasboulders.org and alerts on new broken links.
# Cron entry: 30 3 * * * dee /home/dee/hoa-code/drive-tools/run_monitor.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG="$SCRIPT_DIR/monitor.log"

echo "=== Link monitor run: $(date) ===" >> "$LOG"

# Activate venv if it exists, otherwise use system python
if [ -f "$SCRIPT_DIR/venv/bin/python" ]; then
    PYTHON="$SCRIPT_DIR/venv/bin/python"
else
    PYTHON="/usr/bin/python3"
fi

# One-time --force-report flag: if the flag file exists, send a full report
# regardless of whether there are new broken links, then remove the flag.
EXTRA_FLAGS=""
FLAG_FILE="$SCRIPT_DIR/.force-report"
if [ -f "$FLAG_FILE" ]; then
    EXTRA_FLAGS="--force-report"
    rm -f "$FLAG_FILE"
    echo "  (force-report flag active — will send report regardless)" >> "$LOG"
fi

"$PYTHON" "$SCRIPT_DIR/monitor_links.py" --email $EXTRA_FLAGS >> "$LOG" 2>&1
EXIT_CODE=$?

case $EXIT_CODE in
    0) echo "Clean — no new broken links at $(date)" >> "$LOG" ;;
    1) echo "BROKEN LINKS FOUND at $(date)" >> "$LOG" ;;
    *) echo "ERROR (exit $EXIT_CODE) at $(date)" >> "$LOG"
       echo "Link monitor error at $(date) on $(hostname). Check $LOG" | \
           mail -s "Link monitor ERROR" dee@wmbuck.net 2>/dev/null
       ;;
esac

echo "" >> "$LOG"
