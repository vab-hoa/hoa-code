#!/bin/bash
# Deploy ARC form with one command: ./deploy.sh "Description of changes"

set -e

cd "$(dirname "$0")"

echo "Pushing code to Apps Script..."
clasp push --force

echo "Creating new deployment..."
DEPLOYMENT=$(clasp deploy --description "${1:-Update}" 2>&1 | grep -oP '(?<=Deployment ID: )\S+' || true)

if [ -z "$DEPLOYMENT" ]; then
  echo "Deployment created. Check Apps Script UI for new deployment URL."
else
  URL="https://script.google.com/macros/s/$DEPLOYMENT/exec"
  echo "New deployment ID: $DEPLOYMENT"
  echo "URL: $URL"
  echo "$URL" > CURRENT_DEPLOYMENT_URL.txt
  echo "✓ URL saved to CURRENT_DEPLOYMENT_URL.txt"
fi
