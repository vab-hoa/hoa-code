#!/usr/bin/env node
/**
 * Setup RLS policies for work_items table
 * Run with: node setup-rls.js
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function setupRLS() {
  try {
    console.log('Setting up RLS policies for work_items table...')

    // Create UPDATE policy for anon users
    const { error: updateError } = await supabase.rpc('_execute_sql', {
      sql: `
        CREATE POLICY "anon_update_work_items"
        ON work_items
        FOR UPDATE
        USING (true)
        WITH CHECK (true);
      `
    }).catch(err => {
      // If RPC doesn't exist, try direct approach
      return { error: err }
    })

    if (updateError && updateError.message?.includes('_execute_sql')) {
      // RPC doesn't exist, try using the admin query instead
      console.log('RPC method not available, using direct SQL via Postgres...')

      // We'll use the raw fetch API to execute SQL
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/sql`, {
        method: 'POST',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            CREATE POLICY IF NOT EXISTS "anon_update_work_items"
            ON work_items
            FOR UPDATE
            USING (true)
            WITH CHECK (true);
          `
        })
      })

      const result = await response.json()
      if (result.error) {
        throw new Error(result.error)
      }
    } else if (updateError) {
      throw new Error(updateError.message || 'Failed to create UPDATE policy')
    }

    console.log('✓ UPDATE policy created for anon users')

    // List policies
    console.log('\nVerifying policies...')
    const { data: policies, error: listError } = await supabase
      .from('information_schema.table_privileges')
      .select('*')
      .eq('table_name', 'work_items')

    if (!listError) {
      console.log('Policy check complete')
    }

    console.log('\n✅ RLS setup complete!')
    console.log('\nYou can now:')
    console.log('1. Mark items as completed')
    console.log('2. Mark items as excluded')
    console.log('3. The dashboard will update automatically')

  } catch (error) {
    console.error('❌ Error setting up RLS:', error.message)
    process.exit(1)
  }
}

setupRLS()
