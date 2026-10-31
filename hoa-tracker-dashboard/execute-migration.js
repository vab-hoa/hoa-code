const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://obveytoovkzjrpzrhrim.supabase.co',
  // Never hardcode keys here: this repo is public. Set SUPABASE_SERVICE_ROLE_KEY in the environment.
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function runMigration() {
  const sqlStatements = [
    `ALTER TABLE work_items ADD COLUMN IF NOT EXISTS keystone_status VARCHAR(50)`,
    `ALTER TABLE work_items ADD COLUMN IF NOT EXISTS arc_request_serial VARCHAR(50)`,
    `CREATE INDEX IF NOT EXISTS idx_arc_request_serial ON work_items(arc_request_serial) WHERE arc_request_serial IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS idx_keystone_status ON work_items(keystone_status)`
  ]

  for (const sql of sqlStatements) {
    try {
      console.log(`Executing: ${sql.substring(0, 60)}...`)
      // Use rpc to execute raw SQL
      const { error } = await supabase.rpc('exec_sql', { sql })
      if (error && !error.message.includes('already exists')) {
        console.error(`Error: ${error.message}`)
      } else {
        console.log(`✓ Success`)
      }
    } catch (e) {
      console.error(`Exception: ${e.message}`)
    }
  }
}

runMigration()
