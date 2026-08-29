// src/pages/StateDashboard.tsx
import { useCallback, useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import RoleGuard from '@/components/layout/RoleGuard'
import Card from '@/components/ui/Card'
import Badge, { daysOfSupplyBadge } from '@/components/ui/Badge'
import { useProfile } from '@/hooks/useProfile'
import { useStateRollups } from '@/hooks/useRollups'
import { refreshRollups } from '@/lib/api-client'
import { supabase } from '@/lib/supabase'
import type {
  Alert,
  District,
  RedistributionRecommendation,
  State,
} from '@/types/database'

interface StateInventoryRow {
  medicine_id: string
  total_quantity: number
  district_count: number
  avg_daily_consumption: number
  days_of_supply: number | null
  medicines?: { name_en: string; name_hi: string; code: string }
}

export default function StateDashboard() {
  const { profile } = useProfile()
  const { fetchStateInventory, fetchDistricts, fetchAlerts, fetchRecommendations } =
    useStateRollups(profile?.state_id ?? null)

  const [state, setState] = useState<State | null>(null)
  const [inventory, setInventory] = useState<StateInventoryRow[]>([])
  const [districts, setDistricts] = useState<District[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [recommendations, setRecommendations] = useState<RedistributionRecommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [inv, dist, al, recs] = await Promise.all([
        fetchStateInventory(),
        fetchDistricts(),
        fetchAlerts(),
        fetchRecommendations(),
      ])
      setInventory(inv as StateInventoryRow[])
      setDistricts(dist as District[])
      setAlerts(al)
      setRecommendations(recs)
    } finally {
      setLoading(false)
    }
  }, [fetchStateInventory, fetchDistricts, fetchAlerts, fetchRecommendations])

  useEffect(() => {
    if (!profile?.state_id) return
    supabase
      .from('states')
      .select('*')
      .eq('id', profile.state_id)
      .single()
      .then(({ data }) => {
        if (data) setState(data)
      })
    void loadData()
  }, [profile?.state_id, loadData])

  async function handleRecalculate() {
    setRefreshing(true)
    try {
      await refreshRollups()
      await loadData()
    } finally {
      setRefreshing(false)
    }
  }

  async function handleRecommendation(id: string, status: 'approved' | 'dismissed') {
    await supabase.from('redistribution_recommendations').update({ status }).eq('id', id)
    await loadData()
  }

  return (
    <RoleGuard allowed={['state_viewer']}>
      <AppShell
        title={state ? `${state.name_en} State` : 'State Dashboard'}
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
        {state && (
          <p className="mb-4 text-sm text-slate-600">
            {state.name_hi} · {districts.length} districts · Aggregated view — raw PHC data stays local
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Medicine stock by state" className="lg:col-span-2">
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
                      <th className="pb-2 pr-4">Districts reporting</th>
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
                          <td className="py-2 pr-4">{row.district_count}</td>
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

          <Card title="Districts">
            <ul className="space-y-2 text-sm">
              {districts.map((d) => (
                <li key={d.id} className="flex justify-between border-b border-slate-50 pb-2">
                  <span>{d.name_en}</span>
                  <span className="text-slate-500">
                    Pop. {d.population.toLocaleString('en-IN')}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Recent alerts">
            {alerts.length === 0 ? (
              <p className="text-sm text-slate-500">No alerts yet.</p>
            ) : (
              <ul className="space-y-2">
                {alerts.map((a) => (
                  <li key={a.id} className="border-b border-slate-50 pb-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{a.title_en}</span>
                      <Badge label={a.severity} variant={a.severity} />
                    </div>
                    <p className="text-xs text-slate-500">{a.body_en}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Redistribution recommendations" className="lg:col-span-2">
            {recommendations.length === 0 ? (
              <p className="text-sm text-slate-500">No suggestions yet — run a forecast to generate some.</p>
            ) : (
              <ul className="space-y-3">
                {recommendations.map((r) => (
                  <li key={r.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {r.medicines?.name_en} · {r.suggested_quantity} units
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRecommendation(r.id, 'approved')}
                          className="rounded bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleRecommendation(r.id, 'dismissed')}
                          className="rounded border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {r.from_district?.name_en} → {r.to_district?.name_en}: {r.reason_en}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </AppShell>
    </RoleGuard>
  )
}