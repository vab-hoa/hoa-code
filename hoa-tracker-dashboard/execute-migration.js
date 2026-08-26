const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://obveytoovkzjrpzrhrim.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9idmV5dG9vdmt6anJwenJocmltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjMwMzU2NiwiZXhwIjoyMTAxODc5NTY2fQ.vveYf4zyAxuSs3gKWtYM0jY3yYFiCCpmOU27PUGd0Bk'
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
