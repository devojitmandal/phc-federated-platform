// src/pages/NationalDashboard.tsx
import { useCallback, useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import RoleGuard from '@/components/layout/RoleGuard'
import Card from '@/components/ui/Card'
import { useNationalRollups } from '@/hooks/useRollups'
import { refreshRollups } from '@/lib/api-client'
import { BRICS_MOCK_DATA } from '@/lib/bricsData'
import { supabase } from '@/lib/supabase'
import type { State } from '@/types/database'

interface NationalBedRow {
  total_beds: number
  occupied_beds: number
  available_beds: number
  occupancy_pct: number
  reporting_state_count: number
}

interface BricsInsight {
  matched_country: string
  insight_en: string
  insight_hi: string
  confidence: 'low' | 'medium' | 'high'
}

const GLOBAL_NEEDS = [
  { id: 'za', country: 'South Africa', medicine: 'Azithromycin 500mg', urgency: 'Critical', domestic_surplus: 84500 },
  { id: 'br', country: 'Brazil', medicine: 'Losartan 50mg', urgency: 'High', domestic_surplus: 42000 },
  { id: 'ru', country: 'Russia', medicine: 'Examination Gloves', urgency: 'Medium', domestic_surplus: 120000 },
]

function BricsAnalyticsHub() {
  const [insight, setInsight] = useState<BricsInsight | null>(null)
  const [basedOnMedicine, setBasedOnMedicine] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [exportingTo, setExportingTo] = useState<string | null>(null)
  const [procureState, setProcureState] = useState<'idle' | 'processing' | 'success'>('idle')

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
      
      // 1. If it's a 500 error, grab the raw text instead of forcing JSON
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Server Error: ${errorText.substring(0, 50)}...`);
      }

      // 2. If it is OK, proceed with JSON
      const data = await res.json()
      
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

  const handleExportAI = (countryId: string) => {
    setExportingTo(countryId)
    setTimeout(() => setExportingTo(`${countryId}-done`), 2500)
  }

  const handleEmergencyProcurement = () => {
    setProcureState('processing')
    setTimeout(() => setProcureState('success'), 3000)
  }

  const confidenceColor = {
    low: 'bg-slate-100 text-slate-600',
    medium: 'bg-amber-100 text-amber-700',
    high: 'bg-emerald-100 text-emerald-700',
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Global Deficits & Domestic Surplus (Export)">
          <p className="mb-4 text-xs text-slate-600">
            Real-time cross-referencing of allied nation deficits against current domestic overstock. 
          </p>
          <div className="space-y-3">
            {GLOBAL_NEEDS.map((need) => {
              const isProcessing = exportingTo === need.id
              const isDone = exportingTo === `${need.id}-done`
              
              return (
                <div key={need.id} className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">{need.country}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        need.urgency === 'Critical' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {need.urgency} NEED
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      Lacking: <span className="font-medium text-slate-900">{need.medicine}</span>
                    </div>
                    <div className="text-xs text-emerald-600 font-medium mt-0.5">
                      Our Surplus: {need.domestic_surplus.toLocaleString('en-IN')} units
                    </div>
                  </div>
                  
                  <div className="mt-3 sm:mt-0">
                    {isDone ? (
                      <span className="inline-flex w-full justify-center rounded border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 sm:w-auto">
                        Protocol Dispatched
                      </span>
                    ) : (
                      <button
                        onClick={() => handleExportAI(need.id)}
                        disabled={isProcessing}
                        className="w-full rounded bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50 sm:w-auto"
                      >
                        {isProcessing ? 'Drafting Protocol...' : 'AI Export Suggestion'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        <Card title="International Emergency Procurement">
          <p className="mb-4 text-xs text-slate-600">
            Trigger an immediate high-priority request to the BRICS medical reserve for critical domestic stockouts that cannot be resolved regionally.
          </p>
          <div className="flex h-32 flex-col items-center justify-center rounded-lg border-2 border-dashed border-red-200 bg-red-50 p-4 text-center">
            {procureState === 'idle' && (
              <>
                <p className="mb-3 text-sm font-semibold text-red-800">No active domestic crises requiring international aid.</p>
                <button 
                  onClick={handleEmergencyProcurement}
                  className="rounded bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-red-700"
                >
                  Override: Request Foreign Aid
                </button>
              </>
            )}
            {procureState === 'processing' && (
              <div className="flex items-center gap-2 text-sm font-bold text-red-700 animate-pulse">
                <span>📡 Broadcasting secure request to BRICS network...</span>
              </div>
            )}
            {procureState === 'success' && (
              <div className="flex flex-col items-center">
                <span className="mb-1 text-xl">✅</span>
                <span className="text-sm font-bold text-emerald-700">Foreign Aid Request Authorized</span>
                <span className="text-xs text-emerald-600">Awaiting vendor fulfillment parameters.</span>
              </div>
            )}
          </div>
        </Card>
      </div>

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
  const { fetchNationalBeds, fetchStates } = useNationalRollups()

  const [activeTab, setActiveTab] = useState<'national' | 'brics'>('national')
  const [beds, setBeds] = useState<NationalBedRow | null>(null)
  const [states, setStates] = useState<State[]>([])
  const [allDistricts, setAllDistricts] = useState<any[]>([])
  const [riskGrid, setRiskGrid] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expandedStateId, setExpandedStateId] = useState<string | null>(null)
  const [approvedTransfers, setApprovedTransfers] = useState<string[]>([])

  // MOCK DATA for Infection Formula (i / d * 100)
  // In a production app, this would be rolled up from facility discharge/infection logs.
  const infectionData = {
    infections: 1245,
    discharges: 48200
  }
  const infectionRate = ((infectionData.infections / infectionData.discharges) * 100).toFixed(2)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [bed, st, { data: riskData }, { data: distData }] = await Promise.all([
        fetchNationalBeds(),
        fetchStates(),
        supabase.from('district_inventory_rollup').select('district_id, days_of_supply, medicines(name_en)').not('days_of_supply', 'is', null),
        supabase.from('districts').select('id, name_en, state_id')
      ])
      
      setBeds(bed as NationalBedRow | null)
      setStates(st as State[])
      setRiskGrid(riskData || [])
      setAllDistricts(distData || [])
    } finally {
      setLoading(false)
    }
  }, [fetchNationalBeds, fetchStates])

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

  const handleApproveTransfer = (id: string) => {
    setApprovedTransfers(prev => [...prev, id])
  }

  function riskColor(days: number | null): string {
    if (days === null) return 'bg-slate-100 text-slate-500'
    if (days <= 3) return 'bg-red-100 text-red-700'
    if (days <= 7) return 'bg-orange-100 text-orange-700'
    if (days <= 14) return 'bg-yellow-100 text-yellow-700'
    return 'bg-emerald-100 text-emerald-700'
  }
  
  const CRITICAL_THRESHOLD_DAYS = 7

  const toggleState = (stateId: string) => {
    setExpandedStateId(prev => (prev === stateId ? null : stateId))
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
            
            {/* BED CAPACITY */}
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

            {/* NEW: INFECTION CONTROL CARD (From User Formula) */}
            <Card title="National Infection Control">
              <div className="space-y-3">
                <p className="text-xs text-slate-600">
                  Aggregated Healthcare-Associated Infections (HAI) rate across reporting states.
                </p>
                
                {/* The Formula Breakdown */}
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Standard Formula</div>
                  <div className="font-mono text-xs text-indigo-700 font-semibold">Rate = (i / d) × 100</div>
                  <div className="mt-1 text-[10px] text-slate-500">
                    <span className="font-medium">i</span> = Total Infections | <span className="font-medium">d</span> = Total Discharges (including deaths)
                  </div>
                </div>

                {/* The Math Execution */}
                <div className="flex items-end gap-3 pt-1">
                  <div>
                    <div className="text-[10px] uppercase text-slate-500">Infections (i)</div>
                    <div className="text-lg font-semibold text-slate-800">{infectionData.infections.toLocaleString()}</div>
                  </div>
                  <div className="text-xl font-light text-slate-300 pb-1">/</div>
                  <div>
                    <div className="text-[10px] uppercase text-slate-500">Discharges (d)</div>
                    <div className="text-lg font-semibold text-slate-800">{infectionData.discharges.toLocaleString()}</div>
                  </div>
                  <div className="text-xl font-light text-slate-300 pb-1">=</div>
                  <div className="ml-auto text-right">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Infection Rate</div>
                    <div className="text-2xl font-bold text-emerald-600">{infectionRate}%</div>
                  </div>
                </div>
              </div>
            </Card>

            <Card title="National AI Cross-State Rebalancing" className="lg:col-span-2">
              <p className="mb-3 text-xs text-slate-600">
                Automated recommendations for inter-state transfers based on current stock anomalies.
              </p>
              <div className="flex flex-col gap-3 lg:flex-row">
                {[
                  { id: 'tr-1', med: 'Paracetamol 500mg', from: 'Karnataka', to: 'Rajasthan', qty: 25000, urg: 'Critical', reason: 'Rajasthan districts critically low (< 2 days). Karnataka shows 45+ days surplus.' },
                  { id: 'tr-2', med: 'Azithromycin 500mg', from: 'Maharashtra', to: 'Uttar Pradesh', qty: 12000, urg: 'High', reason: 'Predictive seasonal spike in UP. Pre-positioning from MH.' }
                ].map(transfer => {
                  const isApproved = approvedTransfers.includes(transfer.id)
                  return (
                    <div key={transfer.id} className="flex-1 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="font-semibold text-slate-800">{transfer.med}</span>
                        {isApproved ? (
                          <span className="rounded bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">Dispatched</span>
                        ) : (
                          <button onClick={() => handleApproveTransfer(transfer.id)} className="rounded bg-indigo-600 px-3 py-1 text-xs font-bold text-white transition hover:bg-indigo-700">
                            Approve Transfer
                          </button>
                        )}
                      </div>
                      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-700">
                        <span className="rounded bg-slate-100 px-2 py-1">{transfer.from}</span>
                        <span className="text-slate-400">➔</span>
                        <span className="rounded bg-slate-100 px-2 py-1">{transfer.to}</span>
                        <span className="ml-auto text-emerald-600">{transfer.qty.toLocaleString()} units</span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-tight">
                        <span className="font-semibold text-slate-700">AI Logic:</span> {transfer.reason}
                      </p>
                    </div>
                  )
                })}
              </div>
            </Card>

            <Card title="State Network & District Breakdown" className="lg:col-span-2">
              {loading ? (
                <p className="text-sm text-slate-500">Scanning national grid...</p>
              ) : states.length === 0 ? (
                <p className="text-sm text-slate-500">No state data available.</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {states.map((s) => {
                    const stateDistricts = allDistricts.filter(d => d.state_id === s.id)
                    
                    const districtSummary = stateDistricts.map(dist => {
                      const matchingRisk = riskGrid.filter(r => r.district_id === dist.id)
                      let minSupply: number | null = null
                      let criticalMedName: string | null = null
                      
                      matchingRisk.forEach(r => {
                        if (r.days_of_supply !== null) {
                          if (minSupply === null || r.days_of_supply < minSupply) {
                            minSupply = r.days_of_supply
                            criticalMedName = Array.isArray(r.medicines) ? r.medicines[0]?.name_en : r.medicines?.name_en
                          }
                        }
                      })

                      return {
                        district_id: dist.id,
                        name_en: dist.name_en,
                        days_of_supply: minSupply,
                        critical_medicine: criticalMedName
                      }
                    })

                    districtSummary.sort((a, b) => {
                      if (a.days_of_supply === null) return 1
                      if (b.days_of_supply === null) return -1
                      return a.days_of_supply - b.days_of_supply
                    })

                    const criticalCount = districtSummary.filter((d) => d.days_of_supply !== null && d.days_of_supply <= CRITICAL_THRESHOLD_DAYS).length
                    const isExpanded = expandedStateId === s.id

                    return (
                      <div key={s.id} className="overflow-hidden rounded-lg border border-slate-200 shadow-sm transition-all">
                        <button
                          onClick={() => toggleState(s.id)}
                          className="flex w-full items-center justify-between bg-slate-50 px-4 py-3 transition-colors hover:bg-slate-100"
                        >
                          <div className="text-left">
                            <div className="font-semibold text-slate-800 flex items-center gap-2">
                              🗺️ {s.name_en}
                            </div>
                            <div className="text-xs text-slate-500">{s.name_hi}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            {criticalCount > 0 ? (
                              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                                {criticalCount} Districts at Risk
                              </span>
                            ) : (
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                Stable
                              </span>
                            )}
                            <span className="text-xs text-slate-400">
                              {isExpanded ? '▼' : '▶'}
                            </span>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-slate-200 bg-white p-4">
                            {districtSummary.length === 0 ? (
                              <p className="text-sm text-slate-500">No districts found for this state.</p>
                            ) : (
                              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                {districtSummary.map((r: any) => {
                                  const isCritical = r.days_of_supply !== null && r.days_of_supply <= CRITICAL_THRESHOLD_DAYS
                                  return (
                                    <div
                                      key={r.district_id}
                                      className={`flex flex-col justify-between rounded-lg p-3 text-xs ${riskColor(r.days_of_supply)} ${
                                        isCritical ? 'ring-2 ring-red-400' : ''
                                      }`}
                                    >
                                      <div className="flex items-center gap-1 font-medium mb-2 truncate">
                                        {isCritical && <span>⚠</span>}
                                        {r.name_en}
                                      </div>
                                      <div>
                                        <div className="font-semibold opacity-90">
                                          {r.days_of_supply !== null ? `${r.days_of_supply} days supply` : 'No data'}
                                        </div>
                                        {r.critical_medicine && (
                                          <div className="mt-1 text-[11px] font-medium opacity-90 leading-tight">
                                            Lowest: {r.critical_medicine}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          </div>
        )}
      </AppShell>
    </RoleGuard>
  )
}