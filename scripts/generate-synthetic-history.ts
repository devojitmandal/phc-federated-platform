/**
 * Generate 30 days of synthetic inventory/bed/attendance history for demo charts.
 * Run: npx tsx scripts/generate-synthetic-history.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })

const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(url, serviceKey)

const MEDICINE_BASE_STOCK: Record<string, number> = {
  PARA500: 800,
  AMOX500: 400,
  ORS: 600,
  METF500: 300,
  AMLOD5: 250,
  IBUP400: 500,
  AZITH500: 200,
  IRON100: 350,
}

async function main() {
  const { data: facilities } = await admin.from('facilities').select('id, bed_capacity, code')
  const { data: medicines } = await admin.from('medicines').select('id, code, unit')
  const { data: staffRows } = await admin.from('staff').select('id, facility_id')

  if (!facilities?.length || !medicines?.length) {
    console.error('Run seed.sql first')
    process.exit(1)
  }

  const days = 30
  let snapshotCount = 0

  for (let d = days; d >= 0; d--) {
    const date = new Date()
    date.setDate(date.getDate() - d)
    const dateStr = date.toISOString().slice(0, 10)
    const recordedAt = new Date(date)
    recordedAt.setHours(9, 0, 0, 0)

    for (const facility of facilities) {
      // Beds — vary occupancy
      const occupancy = Math.floor(Math.random() * (facility.bed_capacity + 1))
      await admin.from('bed_status').insert({
        facility_id: facility.id,
        total_beds: facility.bed_capacity,
        occupied_beds: occupancy,
        recorded_at: recordedAt.toISOString(),
      })

      // Inventory — key medicines with declining trend for some districts
      for (const med of medicines) {
        if (!MEDICINE_BASE_STOCK[med.code] && Math.random() > 0.3) continue
        const base = MEDICINE_BASE_STOCK[med.code] ?? 200
        const decline = facility.code.includes('JDH') && med.code === 'PARA500' ? d * 8 : d * 2
        const noise = Math.floor(Math.random() * 50)
        const qty = Math.max(0, base - decline + noise)

        await admin.from('inventory_snapshots').insert({
          facility_id: facility.id,
          medicine_id: med.id,
          quantity: qty,
          unit: med.unit,
          source: 'manual',
          recorded_at: recordedAt.toISOString(),
        })
        snapshotCount++
      }

      // Attendance
      const facilityStaff = staffRows?.filter((s) => s.facility_id === facility.id) ?? []
      for (const s of facilityStaff) {
        const status = Math.random() > 0.15 ? 'present' : Math.random() > 0.5 ? 'absent' : 'on_leave'
        await admin.from('attendance_logs').upsert(
          {
            facility_id: facility.id,
            staff_id: s.id,
            log_date: dateStr,
            status,
            recorded_at: recordedAt.toISOString(),
          },
          { onConflict: 'facility_id,staff_id,log_date' },
        )
      }
    }
  }

  console.log(`Inserted ~${snapshotCount} inventory snapshots over ${days + 1} days`)
  console.log('Running refresh_rollups...')
  const { data, error } = await admin.rpc('refresh_rollups', { p_district_id: null })
  if (error) console.error('Rollup error:', error.message)
  else console.log('Rollups refreshed:', data)
}

main()
