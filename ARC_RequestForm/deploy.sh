#!/bin/bash
# Deploy ARC form: ./deploy.sh "Description of changes"

set -e

cd "$(dirname "$0")"

echo "Pushing code to Apps Script..."
clasp push --force

echo "Creating new deployment..."
DEPLOYMENT=$(clasp deploy --description "${1:-Update}" 2>&1 | grep -oP '(?<=Deployed )[^ ]+' || true)

if [ -z "$DEPLOYMENT" ]; then
  echo "ERROR: Deployment failed. Check Apps Script UI."
  exit 1
else
  URL="https://script.google.com/macros/s/$DEPLOYMENT/exec"
  echo ""
  echo "✓ Deployment complete."
  echo ""
  echo "Copy this URL:"
  echo "$URL"
fi
