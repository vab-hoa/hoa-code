#!/bin/bash
# Setup RLS UPDATE policy for work_items table

set -e

PROJECT_URL="https://obveytoovkzjrpzrhrim.supabase.co"
SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"

if [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "Error: SUPABASE_SERVICE_ROLE_KEY environment variable not set"
  echo "Load it from .env.local first: export \$(cat .env.local | xargs)"
  exit 1
fi

echo "Creating UPDATE RLS policy for anon users on work_items table..."

# Execute SQL via Supabase SQL API
curl -X POST "${PROJECT_URL}/rest/v1/rpc/exec_sql" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sql": "CREATE POLICY IF NOT EXISTS \"anon_update_work_items\" ON work_items FOR UPDATE USING (true) WITH CHECK (true);"
  }' 2>/dev/null || \
curl -X POST "${PROJECT_URL}/rest/v1/rpc/query" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "CREATE POLICY IF NOT EXISTS \"anon_update_work_items\" ON work_items FOR UPDATE USING (true) WITH CHECK (true);"
  }' 2>/dev/null || \
echo "Note: Direct SQL execution not available via API. Please create the policy manually:"
echo ""
echo "Go to Supabase Dashboard → SQL Editor → New Query → paste:"
echo ""
echo 'CREATE POLICY IF NOT EXISTS "anon_update_work_items" ON work_items FOR UPDATE USING (true) WITH CHECK (true);'
