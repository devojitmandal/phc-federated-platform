// src/pages/NationalDashboard.tsx
import { useCallback, useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import RoleGuard from '@/components/layout/RoleGuard'
import Card from '@/components/ui/Card'
import Badge, { daysOfSupplyBadge } from '@/components/ui/Badge'
import { useNationalRollups } from '@/hooks/useRollups'
import { refreshRollups } from '@/lib/api-client'
import { BRICS_MOCK_DATA } from '@/lib/bricsData'
import type { State } from '@/types/database'

interface NationalInventoryRow {
  medicine_id: string
  total_quantity: number
  state_count: number
  avg_daily_consumption: number
  days_of_supply: number | null
  medicines?: { name_en: string; name_hi: string; code: string } | Array<{ name_en: string; name_hi: string; code: string }>
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
  districts?: { name_en: string; name_hi: string; state_id: string } | Array<{ name_en: string; name_hi: string; state_id: string }>
}

interface BricsInsight {
  matched_country: string
  insight_en: string
  insight_hi: string
  confidence: 'low' | 'medium' | 'high'
}

function BricsAnalyticsHub() {
  const [insight, setInsight] = useState<BricsInsight | null>(null)
  const [basedOnMedicine, setBasedOnMedicine] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generateInsight() {
    setLoading(true)
    setError(null)
    setInsight(null)
    try {
      const res = await fetch('/api/brics-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bricsData: BRICS_MOCK_DATA }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate insight')
      if (!data.insight) {
        setError(data.message || 'No data available to generate an insight yet.')
      } else {
        setInsight(data.insight)
        setBasedOnMedicine(data.based_on_medicine)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const confidenceColor = {
    low: 'bg-slate-100 text-slate-600',
    medium: 'bg-amber-100 text-amber-700',
    high: 'bg-emerald-100 text-emerald-700',
  }

  return (
    <div className="space-y-6">
      <Card title="Shared predictive modelling across BRICS nations">
        <p className="mb-4 text-sm text-slate-600">
          Recent public-health supply chain interventions from other BRICS nations, compared against
          India's current highest-risk medicines using Gemini.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          {BRICS_MOCK_DATA.map((c) => (
            <div key={c.code} className="rounded-lg border border-slate-200 p-3 text-sm">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-semibold">{c.country}</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">{c.code}</span>
              </div>
              <p className="text-xs text-slate-600">{c.event}</p>
              <p className="mt-1 text-xs text-slate-500">
                <span className="font-medium">Action:</span> {c.intervention}
              </p>
              <p className="mt-1 text-xs text-emerald-700">
                <span className="font-medium">Result:</span> {c.outcome}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Cross-border insight">
        <button
          type="button"
          onClick={generateInsight}
          disabled={loading}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? 'Analyzing…' : 'Generate cross-border insight'}
        </button>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        {insight && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                Matched: {insight.matched_country}
                {basedOnMedicine && ` · based on ${basedOnMedicine}`}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${confidenceColor[insight.confidence]}`}>
                {insight.confidence} confidence
              </span>
            </div>
            <p className="text-sm text-slate-800">{insight.insight_en}</p>
            <p className="mt-2 border-t border-emerald-200 pt-2 text-sm text-slate-600">
              {insight.insight_hi}
            </p>
          </div>
        )}
      </Card>
    </div>
  )
}

export default function NationalDashboard() {
  const { fetchNationalInventory, fetchNationalBeds, fetchStates, fetchDistrictRiskGrid } =
    useNationalRollups()

  const [activeTab, setActiveTab] = useState<'national' | 'brics'>('national')
  const [inventory, setInventory] = useState<NationalInventoryRow[]>([])
  const [beds, setBeds] = useState<NationalBedRow | null>(null)
  const [states, setStates] = useState<State[]>([])
  const [riskGrid, setRiskGrid] = useState<RiskGridRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedStateId, setSelectedStateId] = useState<string | null>(null)

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
  const CRITICAL_THRESHOLD_DAYS = 7

const statesWithCriticalDistricts = new Set(
  riskGrid
    .filter((r) => r.days_of_supply !== null && r.days_of_supply <= CRITICAL_THRESHOLD_DAYS)
    .map((r) => (r.districts as any)?.state_id)
    .filter(Boolean)
)

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

        <div className="mb-6 flex gap-2 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('national')}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'national'
                ? 'border-b-2 border-emerald-600 text-emerald-700'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            National View
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('brics')}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'brics'
                ? 'border-b-2 border-emerald-600 text-emerald-700'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            BRICS Analytics Hub
          </button>
        </div>

        {activeTab === 'brics' ? (
          <BricsAnalyticsHub />
        ) : (
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

            <Card title="States & district risk" className="lg:col-span-2">
  <div className="mb-4 flex flex-wrap gap-2">
    {states.map((s) => {
      const isCritical = statesWithCriticalDistricts.has(s.id)
      const isSelected = selectedStateId === s.id
      return (
        <button
          key={s.id}
          type="button"
          onClick={() => setSelectedStateId(isSelected ? null : s.id)}
          className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
            isSelected
              ? 'border-emerald-600 bg-emerald-50'
              : isCritical
                ? 'border-red-300 bg-red-50 hover:bg-red-100'
                : 'border-slate-200 bg-white hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-1.5">
            {isCritical && <span className="text-red-600">⚠</span>}
            <span className="font-medium">{s.name_en}</span>
          </div>
          <span className="text-xs text-slate-500">{s.name_hi}</span>
        </button>
      )
    })}
  </div>

  {selectedStateId ? (
    (() => {
      const districtsInState = riskGrid.filter((r) => (r.districts as any)?.state_id === selectedStateId)
      return districtsInState.length === 0 ? (
        <p className="text-sm text-slate-500">No risk data for this state yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {districtsInState.map((r) => {
            const isCritical = r.days_of_supply !== null && r.days_of_supply <= CRITICAL_THRESHOLD_DAYS
            return (
              <div
                key={r.district_id}
                className={`rounded-lg p-3 text-xs ${riskColor(r.days_of_supply)} ${
                  isCritical ? 'ring-2 ring-red-400' : ''
                }`}
              >
                <div className="flex items-center gap-1 font-medium">
                  {isCritical && <span>⚠</span>}
                  {(r.districts as any)?.name_en ?? r.district_id}
                </div>
                <div>{r.days_of_supply !== null ? `${r.days_of_supply}d supply` : 'No data'}</div>
              </div>
            )
          })}
        </div>
      )
    })()
  ) : (
    <p className="text-sm text-slate-500">
      Select a state above to see its district-level stockout risk.
    </p>
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
                        const med: any = Array.isArray(row.medicines) ? row.medicines[0] : row.medicines
                        return (
                          <tr key={row.medicine_id} className="border-b border-slate-50">
                            <td className="py-2 pr-4">
                              <div>{med?.name_en ?? row.medicine_id}</div>
                              <div className="text-xs text-slate-500">{med?.name_hi}</div>
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
        )}
      </AppShell>
    </RoleGuard>
  )
}