#!/bin/bash
# HOA email processor — runs natively on oregano (immune to jane-side SIGTERM kills)
# Installed 2026-09-19 after repeated 6am SIGTERM kills of jane-dispatched runs.
cd /home/dee/hoa-code/hoa-tracker
LOG=/home/dee/hoa-code/hoa-tracker/cron_run.log
STATUS=/home/dee/hoa-code/hoa-tracker/last_run.json
START=$(date +%s)
echo "===== $(date -Is) cron wrapper start =====" >> "$LOG"
python3 email_processor.py --days 1 --notify >> "$LOG" 2>&1
RC=$?
END=$(date +%s)
python3 - "$RC" "$START" "$END" "$STATUS" "$LOG" <<'PY'
import json, sys, datetime
rc, start, end, status_path, log_path = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5]
status = {
    "run_date": datetime.date.today().isoformat(),
    "finished_at": datetime.datetime.now().isoformat(timespec="seconds"),
    "exit_code": rc,
    "duration_s": end - start,
    "log_tail": open(log_path).read()[-500:],
}
json.dump(status, open(status_path, "w"), indent=1)
PY
