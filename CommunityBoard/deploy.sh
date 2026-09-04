#!/bin/bash
# Deploy Community Board Apps Script

set -e

echo "Building Community Board deployment..."
echo ""

# Locate clasp. v3 is required: ~/.clasprc.json uses the v3 `tokens.default` format,
# which clasp v2 cannot read ("Cannot read properties of undefined (reading 'access_token')").
if command -v clasp &> /dev/null; then
    CLASP="clasp"
else
    echo "clasp not installed globally; using npx."
    CLASP="npx --yes @google/clasp@3.0.6-alpha"
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

# The public URL is pinned to this deployment. Pushing alone does NOT update it,
# and `clasp deploy` without -i creates a new unused URL instead. Always redeploy
# this exact ID.
DEPLOYMENT_ID="AKfycbzyn986Bx40Fv6SdeWNQcWTHEhsXeXFXR9S92ZppM03USOZ16-hWkB8bOAoCF-kk3I9Fw"
DESC="${1:-Community Board update}"

# Push code
echo "Pushing code..."
$CLASP push --force

echo ""
echo "Redeploying public URL (deployment $DEPLOYMENT_ID)..."
$CLASP deploy -i "$DEPLOYMENT_ID" -d "$DESC"

echo ""
echo "Verifying the live URL serves the new code..."
if curl -s "https://script.google.com/macros/s/$DEPLOYMENT_ID/exec" | grep -q showPostModal; then
    echo "  OK - live URL is serving current code."
else
    echo "  WARNING - live URL still looks stale. Check the deployment in the Apps Script editor."
    exit 1
fi

echo ""
echo "Done. Public URL:"
echo "  https://script.google.com/macros/s/$DEPLOYMENT_ID/exec"
