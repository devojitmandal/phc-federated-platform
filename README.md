# PHC Federated Platform

Hackathon prototype for **Code for Communities** — federated health resource and supply chain management across India's PHC network.

## Stack

- **Frontend:** React + Vite + Tailwind CSS
- **Backend/DB:** Supabase (Postgres, auth, RLS)
- **AI:** Gemini API, Google Cloud Speech-to-Text + Text-to-Speech
- **Deploy:** Vercel

## Project structure

```
api/                    Vercel serverless (Gemini, voice)
supabase/
  migrations/           Schema + RLS + refresh_rollups()
  seed.sql              2 states, 8 districts, 20 PHCs, 30 medicines
  functions/            SQL reference scripts
scripts/                Seed users, synthetic history
src/
  components/           layout, ui, facility, district, national, charts
  pages/                Role-based dashboards
  hooks/                useProfile, useInventory, useRollups, useVoiceRecorder
  lib/                  supabase client, api-client, constants
  types/                database + API types
```

## Setup

1. Create a Supabase project
2. Run [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql)
3. Run [`supabase/seed.sql`](supabase/seed.sql)
4. Copy `.env.example` → `.env` and fill in keys
5. `npm install && npm run dev`

## Data model highlights

- **Raw tables** (`inventory_snapshots`, `bed_status`, `attendance_logs`) — facility-scoped, RLS-protected
- **Rollup tables** (`district_*_rollup` → `state_*_rollup` → `national_*_rollup`) — aggregates only
- **Rollup refresh:** manual `refresh_rollups()` RPC (primary); insert triggers (secondary)
- **Seed geography:** Rajasthan + Karnataka, real district/PHC names, ~35,600 population/PHC (RHS 2020-21)

## Demo accounts (after seed-demo-users script)

| Email | Role |
|-------|------|
| worker@phc.demo | facility_worker (PHC Amer, Jaipur) |
| district@phc.demo | district_admin (Jaipur) |
| state@phc.demo | state_viewer (Rajasthan) |
| national@phc.demo | national_admin |

Password: `demo123456`
# phc-federated-platform
Federated AI platform for real-time PHC medicine stock, bed, and staff tracking across Indian districts. This project is built for Code for Communities 2.
dfc02f8c796c2e751d3932d40ad38d16724fe3d9
