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

const DAYS = 30
const BATCH_SIZE = 500

async function insertInBatches(table: string, rows: any[], upsertConflict?: string) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const query = upsertConflict
      ? admin.from(table).upsert(batch, { onConflict: upsertConflict })
      : admin.from(table).insert(batch)
    const { error } = await query
    if (error) console.error(`${table} batch ${i}: ${error.message}`)
  }
  console.log(`  ${table}: ${rows.length} rows`)
}

async function main() {
  const { data: facilities } = await admin.from('facilities').select('id, bed_capacity, code')
  const { data: medicines } = await admin.from('medicines').select('id, code, unit')
  const { data: staffRows } = await admin.from('staff').select('id, facility_id')

  if (!facilities?.length || !medicines?.length) {
    console.error('Run seed.sql first')
    process.exit(1)
  }

  const bedRows: any[] = []
  const inventoryRows: any[] = []
  const attendanceRows: any[] = []

  for (let d = DAYS; d >= 0; d--) {
    const date = new Date()
    date.setDate(date.getDate() - d)
    const dateStr = date.toISOString().slice(0, 10)
    const recordedAt = new Date(date)
    recordedAt.setHours(9, 0, 0, 0)

    // daysElapsed: 0 on the oldest day, DAYS on today — depletion grows as we approach today
    const daysElapsed = DAYS - d

    for (const facility of facilities) {
      const occupancy = Math.floor(Math.random() * (facility.bed_capacity + 1))
      bedRows.push({
        facility_id: facility.id,
        total_beds: facility.bed_capacity,
        occupied_beds: occupancy,
        recorded_at: recordedAt.toISOString(),
      })

      // Every facility x medicine gets a snapshot every day — no gaps,
      // so the exact-date consumption match always has data to compare.
      for (const med of medicines) {
        const base = MEDICINE_BASE_STOCK[med.code] ?? 200
        // Steeper depletion for the "JDH" demo district's paracetamol, to
        // produce a clear critical-risk example for the forecast demo.
        const dailyRate = facility.code.includes('JDH') && med.code === 'PARA500' ? 8 : 2
        const noise = Math.floor(Math.random() * 20) - 10 // small daily jitter, +/-10
        const qty = Math.max(0, base - daysElapsed * dailyRate + noise)

        inventoryRows.push({
          facility_id: facility.id,
          medicine_id: med.id,
          quantity: qty,
          unit: med.unit,
          source: 'manual',
          recorded_at: recordedAt.toISOString(),
        })
      }

      const facilityStaff = staffRows?.filter((s) => s.facility_id === facility.id) ?? []
      for (const s of facilityStaff) {
        const roll = Math.random()
        const status = roll < 0.05 ? 'on_leave' : roll < 0.15 ? 'absent' : 'present'
        attendanceRows.push({
          facility_id: facility.id,
          staff_id: s.id,
          log_date: dateStr,
          status,
          recorded_at: recordedAt.toISOString(),
        })
      }
    }
  }

  console.log(`Inserting ${bedRows.length} bed rows, ${inventoryRows.length} inventory rows, ${attendanceRows.length} attendance rows...`)
  await insertInBatches('bed_status', bedRows)
  await insertInBatches('inventory_snapshots', inventoryRows)
  await insertInBatches('attendance_logs', attendanceRows, 'facility_id,staff_id,log_date')

  console.log('Running refresh_rollups...')
  const { data, error } = await admin.rpc('refresh_rollups', { p_district_id: null })
  if (error) console.error('Rollup error:', error.message)
  else console.log('Rollups refreshed:', data)
}

main()