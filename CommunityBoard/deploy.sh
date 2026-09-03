#!/bin/bash
# Deploy Community Board Apps Script

set -e

echo "Building Community Board deployment..."
echo ""

# Check if clasp is installed
if ! command -v clasp &> /dev/null; then
    echo "Error: clasp not found. Install with: npm install -g @google/clasp"
    exit 1
fi

# Check if .clasp.json exists and has scriptId
if [ ! -f .clasp.json ]; then
    echo "Error: .clasp.json not found."
    echo "Run 'clasp create --type webapp --title \"Community Board\"' first."
    exit 1
fi

SCRIPT_ID=$(grep -o '"scriptId": "[^"]*"' .clasp.json | cut -d'"' -f4)

if [ -z "$SCRIPT_ID" ] || [ "$SCRIPT_ID" = "TO_BE_SET_BY_CLASP_LOGIN" ]; then
    echo "Error: scriptId not set in .clasp.json"
    echo "Run 'clasp create --type webapp --title \"Community Board\"' first."
    exit 1
fi

echo "Script ID: $SCRIPT_ID"
echo ""

# Push code
echo "Pushing code..."
clasp push --force

echo ""
echo "Code pushed successfully!"
echo ""
echo "Next: Deploy the web app"
echo "  clasp deploy --description \"Community Board web app\""
echo ""
echo "After deploying, update DEPLOYMENT_INFO.txt with the deployment ID and Sheet ID."
