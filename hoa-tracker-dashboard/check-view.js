const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://obveytoovkzjrpzrhrim.supabase.co',
  'REDACTED'
)

async function checkView() {
  const { data, error } = await supabase
    .from('v_aging_work_items')
    .select('*')
    .limit(5)
  
  if (error) {
    console.error('Error:', error.message)
    return
  }

  console.log('Aging Work Items Sample:')
  console.log('========================\n')
  
  if (data && data.length > 0) {
    data.forEach((item, i) => {
      console.log(`${i+1}. ${item.title}`)
      console.log(`   Category: ${item.category}`)
      console.log(`   Status: ${item.status}`)
      console.log(`   Days Open: ${item.days_open}`)
      console.log(`   Max Days Threshold: ${item.max_days}`)
      console.log('')
    })

    // Analyze thresholds
    const thresholds = {}
    data.forEach(item => {
      if (!thresholds[item.category]) {
        thresholds[item.category] = item.max_days
      }
    })

    console.log('Aging Thresholds by Category:')
    console.log('=============================')
    Object.entries(thresholds).forEach(([cat, days]) => {
      console.log(`${cat}: ${days} days`)
    })
  }
}

checkView()
