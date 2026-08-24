/**
 * Creates demo auth users and links them to profiles.
 * Run after supabase/seed.sql:
 *   npx tsx scripts/seed-demo-users.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })

const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

const DEMO_USERS = [
  {
    email: 'worker@phc.demo',
    password: 'demo123456',
    role: 'facility_worker' as const,
    full_name: 'Sunita Devi (ANM)',
    facility_id: '33333333-3333-3333-3333-333333333301',
    district_id: null,
    state_id: null,
  },
  {
    email: 'district@phc.demo',
    password: 'demo123456',
    role: 'district_admin' as const,
    full_name: 'Dr. Vikram Singh',
    facility_id: null,
    district_id: '22222222-2222-2222-2222-222222222201',
    state_id: null,
  },
  {
    email: 'state@phc.demo',
    password: 'demo123456',
    role: 'state_viewer' as const,
    full_name: 'Rajasthan HMIS Coordinator',
    facility_id: null,
    district_id: null,
    state_id: '11111111-1111-1111-1111-111111111101',
  },
  {
    email: 'national@phc.demo',
    password: 'demo123456',
    role: 'national_admin' as const,
    full_name: 'National Health Mission Admin',
    facility_id: null,
    district_id: null,
    state_id: null,
  },
]

async function main() {
  for (const user of DEMO_USERS) {
    const { data: existing } = await admin.auth.admin.listUsers()
    const found = existing?.users?.find((u) => u.email === user.email)

    let userId = found?.id

    if (!userId) {
      const { data, error } = await admin.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
      })
      if (error) {
        console.error(`Failed to create ${user.email}:`, error.message)
        continue
      }
      userId = data.user.id
      console.log(`Created auth user: ${user.email}`)
    } else {
      console.log(`Auth user exists: ${user.email}`)
    }

    const { error: profileError } = await admin.from('profiles').upsert({
      id: userId,
      role: user.role,
      full_name: user.full_name,
      facility_id: user.facility_id,
      district_id: user.district_id,
      state_id: user.state_id,
    })
    if (profileError) {
      console.error(`Failed to upsert profile for ${user.email}:`, profileError.message)
    } else {
      console.log(`Profile linked: ${user.email} → ${user.role}`)
    }
  }
  console.log('\nDone. Login with demo123456')
}

main()
