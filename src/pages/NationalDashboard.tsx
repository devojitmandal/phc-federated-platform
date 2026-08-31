// src/pages/NationalDashboard.tsx
import { useCallback, useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import RoleGuard from '@/components/layout/RoleGuard'
import Card from '@/components/ui/Card'
import Badge, { daysOfSupplyBadge } from '@/components/ui/Badge'
import { useNationalRollups } from '@/hooks/useRollups'
import { refreshRollups } from '@/lib/api-client'
import type { State } from '@/types/database'

interface NationalInventoryRow {
  medicine_id: string
  total_quantity: number
  state_count: number
  avg_daily_consumption: number
  days_of_supply: number | null
  medicines?: { name_en: string; name_hi: string; code: string }
}

interface NationalBedRow {
  total_beds: number
  occupied_beds: number
  available_beds: number
  occupancy_pct: number
  reporting_state_count: number
}

interface RiskGridRow {
  district_id: string
  days_of_supply: number | null
  districts?: { name_en: string; name_hi: string; state_id: string }
}

export default function NationalDashboard() {
  const { fetchNationalInventory, fetchNationalBeds, fetchStates, fetchDistrictRiskGrid } =
    useNationalRollups()

  const [inventory, setInventory] = useState<NationalInventoryRow[]>([])
  const [beds, setBeds] = useState<NationalBedRow | null>(null)
  const [states, setStates] = useState<State[]>([])
  const [riskGrid, setRiskGrid] = useState<RiskGridRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [inv, bed, st, risk] = await Promise.all([
        fetchNationalInventory(),
        fetchNationalBeds(),
        fetchStates(),
        fetchDistrictRiskGrid(),
      ])
      setInventory(inv as NationalInventoryRow[])
      setBeds(bed as NationalBedRow | null)
      setStates(st as State[])
      setRiskGrid(risk as unknown as RiskGridRow[])
    } finally {
      setLoading(false)
    }
  }, [fetchNationalInventory, fetchNationalBeds, fetchStates, fetchDistrictRiskGrid])

  useEffect(() => {
    void loadData()
  }, [loadData])

  async function handleRecalculate() {
    setRefreshing(true)
    try {
      await refreshRollups()
      await loadData()
    } finally {
      setRefreshing(false)
    }
  }

  function riskColor(days: number | null): string {
    if (days === null) return 'bg-slate-100 text-slate-500'
    if (days <= 3) return 'bg-red-100 text-red-700'
    if (days <= 7) return 'bg-orange-100 text-orange-700'
    if (days <= 14) return 'bg-yellow-100 text-yellow-700'
    return 'bg-emerald-100 text-emerald-700'
  }

  return (
    <RoleGuard allowed={['national_admin']}>
      <AppShell
        title="National Dashboard"
        actions={
          <button
            type="button"
            onClick={handleRecalculate}
            disabled={refreshing}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {refreshing ? 'Recalculating…' : 'Recalculate rollups'}
          </button>
        }
      >
        <p className="mb-4 text-sm text-slate-600">
          {states.length} states · Aggregated national view — raw PHC data stays local (RLS enforced)
        </p>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="National bed capacity">
            {beds ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Occupied / Total</span>
                  <span className="font-medium">
                    {beds.occupied_beds} / {beds.total_beds}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${beds.occupancy_pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(beds.occupancy_pct, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  {beds.available_beds} available · {beds.reporting_state_count} states reporting
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No bed rollup yet.</p>
            )}
          </Card>

          <Card title="States">
            <ul className="space-y-2 text-sm">
              {states.map((s) => (
                <li key={s.id} className="flex justify-between border-b border-slate-50 pb-2">
                  <span>{s.name_en}</span>
                  <span className="text-slate-500">{s.name_hi}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="District stockout risk grid" className="lg:col-span-2">
            {riskGrid.length === 0 ? (
              <p className="text-sm text-slate-500">No risk data yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {riskGrid.map((r) => (
                  <div
                    key={`${r.district_id}`}
                    className={`rounded-lg p-3 text-xs ${riskColor(r.days_of_supply)}`}
                  >
                    <div className="font-medium">{r.districts?.name_en ?? r.district_id}</div>
                    <div>{r.days_of_supply !== null ? `${r.days_of_supply}d supply` : 'No data'}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Medicine stock — national totals" className="lg:col-span-2">
            {loading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : inventory.length === 0 ? (
              <p className="text-sm text-slate-500">No rollup data yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-slate-500">
                      <th className="pb-2 pr-4">Medicine</th>
                      <th className="pb-2 pr-4">Total qty</th>
                      <th className="pb-2 pr-4">States reporting</th>
                      <th className="pb-2">Days of supply</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.map((row) => {
                      const badge = daysOfSupplyBadge(row.days_of_supply)
                      return (
                        <tr key={row.medicine_id} className="border-b border-slate-50">
                          <td className="py-2 pr-4">
                            <div>{row.medicines?.name_en ?? row.medicine_id}</div>
                            <div className="text-xs text-slate-500">{row.medicines?.name_hi}</div>
                          </td>
                          <td className="py-2 pr-4">
                            {Number(row.total_quantity).toLocaleString('en-IN')}
                          </td>
                          <td className="py-2 pr-4">{row.state_count}</td>
                          <td className="py-2">
                            <Badge label={badge.label} variant={badge.variant} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </AppShell>
    </RoleGuard>
  )
}