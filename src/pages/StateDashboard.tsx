import { useCallback, useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import RoleGuard from '@/components/layout/RoleGuard'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
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

export default function StateDashboard() {
  const { profile } = useProfile()
  const { fetchStateInventory, fetchDistricts, fetchAlerts, fetchRecommendations } =
    useStateRollups(profile?.state_id ?? null)

  const [state, setState] = useState<State | null>(null)
  const [districts, setDistricts] = useState<District[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [recommendations, setRecommendations] = useState<RedistributionRecommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [escalations, setEscalations] = useState<any[]>([])
  const [expandedDistricts, setExpandedDistricts] = useState<Record<string, boolean>>({}) 
  const [planningId, setPlanningId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const [allDistrictStock, setAllDistrictStock] = useState<Record<string, { districtName: string, stock: any[] }>>({})
  const [expandedAllDistricts, setExpandedAllDistricts] = useState<Record<string, boolean>>({})

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [, dist, al, recs] = await Promise.all([
        fetchStateInventory(), 
        fetchDistricts(),
        fetchAlerts(),
        fetchRecommendations(),
      ])
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

  useEffect(() => {
    async function fetchEscalations() {
      if (!profile?.state_id) return
      const today = new Date().toISOString().slice(0, 10)

      const { data } = await supabase
        .from('district_inventory_rollup')
        .select(`
          medicine_id, 
          district_id, 
          total_quantity, 
          days_of_supply,
          districts!inner(name_en, state_id),
          medicines(name_en)
        `)
        .eq('districts.state_id', profile.state_id)
        .eq('snapshot_date', today)
        .lte('days_of_supply', 5)
        .order('days_of_supply', { ascending: true })

      if (data) setEscalations(data)
    }
    if (!loading) fetchEscalations()
  }, [loading, profile?.state_id])

  useEffect(() => {
    async function fetchAllDistrictStock() {
      if (!profile?.state_id) return
      const today = new Date().toISOString().slice(0, 10)

      const { data } = await supabase
        .from('district_inventory_rollup')
        .select(`
          medicine_id, 
          district_id, 
          total_quantity, 
          days_of_supply,
          districts!inner(name_en),
          medicines(name_en)
        `)
        .eq('districts.state_id', profile.state_id)
        .eq('snapshot_date', today)
        .order('days_of_supply', { ascending: true }) 

      if (data) {
        const groupedStock = data.reduce((acc: Record<string, { districtName: string, stock: any[] }>, row: any) => {
          const dId = row.district_id
          if (!acc[dId]) {
            acc[dId] = {
              districtName: Array.isArray(row.districts) ? row.districts[0]?.name_en : row.districts?.name_en,
              stock: []
            }
          }
          acc[dId].stock.push(row)
          return acc
        }, {})
        setAllDistrictStock(groupedStock)
      }
    }
    if (!loading) fetchAllDistrictStock()
  }, [loading, profile?.state_id])

  async function handleRecalculate() {
    setRefreshing(true)
    try {
      await refreshRollups()
      await loadData()
    } finally {
      setRefreshing(false)
    }
  }

  const handleStateAI = async (esc: any) => {
    const key = `${esc.district_id}-${esc.medicine_id}`
    setPlanningId(key)
    try {
      await fetch('/api/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          districtId: esc.district_id,
          medicineId: esc.medicine_id,
          medicineName: Array.isArray(esc.medicines) ? esc.medicines[0]?.name_en : esc.medicines?.name_en
        })
      })
      await loadData()
      setToast('AI Protocol drafted. Review in Recommendations panel.')
      setTimeout(() => setToast(null), 4000)
    } finally {
      setPlanningId(null)
    }
  }

  async function handleRecommendation(id: string, status: 'approved' | 'dismissed') {
    await supabase.from('redistribution_recommendations').update({ status }).eq('id', id)
    await loadData()
    if (status === 'approved') {
      setToast('Inter-District Convoy Authorized & Dispatched.')
      setTimeout(() => setToast(null), 4000)
    }
  }

  const toggleDistrict = (distId: string) => {
    setExpandedDistricts(prev => ({ ...prev, [distId]: !prev[distId] }))
  }

  const toggleAllDistricts = (distId: string) => {
    setExpandedAllDistricts(prev => ({ ...prev, [distId]: !prev[distId] }))
  }

  const groupedEscalations = escalations.reduce((acc: Record<string, { districtName: string, medicines: any[] }>, esc: any) => {
    const distId = esc.district_id
    if (!acc[distId]) {
      acc[distId] = {
        districtName: Array.isArray(esc.districts) ? esc.districts[0]?.name_en : esc.districts?.name_en,
        medicines: []
      }
    }
    acc[distId].medicines.push(esc)
    return acc
  }, {})

  const activeConvoys = recommendations.filter(r => r.status === 'approved')

  return (
    <RoleGuard allowed={['state_viewer' ]}>
      {toast && (
        <div className="fixed top-6 right-6 z-50 animate-fade-in rounded-lg bg-indigo-600 px-6 py-4 text-sm font-semibold text-white shadow-xl">
          📡 {toast}
        </div>
      )}

      <AppShell
        title={state ? `${state.name_en} State Command` : 'State Dashboard'}
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
          <p className="mb-6 text-sm text-slate-600">
            {state.name_hi} · {districts.length} districts · Regional Supply Chain & Escalation Oversight
          </p>
        )}

        {/* ACTIVE CONVOY PANEL (Now DB-Driven) */}
        {activeConvoys.length > 0 && (
          <div className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 font-label text-sm font-semibold text-indigo-800">
              <span>🚚</span> Active Inter-District Convoys
            </h2>
            <div className="flex flex-col gap-3">
              {activeConvoys.map(convoy => (
                <div key={convoy.id} className="flex items-center justify-between rounded-lg border border-indigo-100 bg-white p-3 shadow-sm">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{convoy.reason_en.replace('🟡 STATE ESCALATION: ', '')}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Transferring {convoy.suggested_quantity} units of {convoy.medicines?.name_en}
                    </p>
                  </div>
                  <span className="animate-pulse rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-800">
                    Executing Transfer
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TIER 2 ESCALATION GROUPED ACCORDION */}
        <div className="mb-6">
          <Card title="Escalated District Crises (< 5 Days Supply)">
            {loading ? (
              <p className="text-sm text-slate-500">Scanning statewide networks...</p>
            ) : Object.keys(groupedEscalations).length === 0 ? (
              <p className="text-sm font-medium text-emerald-600">All districts operating within safe supply thresholds.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {Object.entries(groupedEscalations).map(([distId, group]: [string, any]) => {
                  const isExpanded = expandedDistricts[distId]
                  
                  // Hide medicines that have an APPROVED transfer in the DB
                  const activeMeds = group.medicines.filter((esc: any) => {
                    return !activeConvoys.some(r => r.medicine_id === esc.medicine_id && r.to_district_id === esc.district_id)
                  })

                  if (activeMeds.length === 0) return null; 

                  return (
                    <div key={distId} className="overflow-hidden rounded-lg border border-slate-200 shadow-sm transition-all">
                      <button
                        onClick={() => toggleDistrict(distId)}
                        className="flex w-full items-center justify-between bg-slate-50 px-4 py-3 transition-colors hover:bg-slate-100"
                      >
                        <div className="font-semibold text-slate-800">
                          📍 {group.districtName} District
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                            {activeMeds.length} Critical Shortages
                          </span>
                          <span className="text-xs text-slate-400">
                            {isExpanded ? '▼' : '▶'}
                          </span>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-slate-200 bg-white p-4">
                          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {activeMeds.map((esc: any, mIdx: number) => {
                              const key = `${esc.district_id}-${esc.medicine_id}`
                              const medName = Array.isArray(esc.medicines) ? esc.medicines[0]?.name_en : esc.medicines?.name_en
                              const existingRec = recommendations.find(r => r.medicine_id === esc.medicine_id && r.to_district_id === esc.district_id && r.status === 'suggested')

                              return (
                                <div key={mIdx} className="flex flex-col justify-between rounded-lg border border-red-100 bg-red-50 p-3 shadow-sm">
                                  <div>
                                    <div className="mb-1 text-sm font-bold text-slate-800">{medName}</div>
                                    <div className="mb-3 text-xs font-medium text-red-600">
                                      District Avg: {esc.days_of_supply} days supply remaining
                                    </div>
                                  </div>

                                  {existingRec ? (
                                    <div className="mt-auto rounded border border-amber-200 bg-amber-50 p-2 text-center">
                                      <span className="text-xs font-bold text-amber-800">Protocol Awaiting Approval</span>
                                    </div>
                                  ) : (
                                    <button 
                                      onClick={() => handleStateAI(esc)}
                                      disabled={planningId === key}
                                      className="mt-auto w-full rounded bg-slate-800 px-2 py-2 text-xs font-bold text-white transition hover:bg-slate-700 disabled:opacity-50"
                                    >
                                      {planningId === key ? 'Scanning Network...' : 'Find Regional Surplus'}
                                    </button>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* GENERAL DISTRICT STOCK BREAKDOWN */}
          <Card title="District-Wise Stock Breakdown" className="lg:col-span-2">
            {loading ? (
              <p className="text-sm text-slate-500">Loading district network data...</p>
            ) : Object.keys(allDistrictStock).length === 0 ? (
              <p className="text-sm text-slate-500">No rollup data yet.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {Object.entries(allDistrictStock).map(([distId, group]: [string, any]) => {
                  const isExpanded = expandedAllDistricts[distId]
                  const criticalCount = group.stock.filter((s: any) => s.days_of_supply !== null && s.days_of_supply <= 5).length

                  return (
                    <div key={distId} className="overflow-hidden rounded-lg border border-slate-200 shadow-sm transition-all">
                      <button
                        onClick={() => toggleAllDistricts(distId)}
                        className="flex w-full items-center justify-between bg-slate-50 px-4 py-3 transition-colors hover:bg-slate-100"
                      >
                        <div className="font-semibold text-slate-800">
                          🗺️ {group.districtName} District
                        </div>
                        <div className="flex items-center gap-3">
                          {criticalCount > 0 && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                              {criticalCount} Low Stock
                            </span>
                          )}
                          <span className="text-xs text-slate-400">
                            {isExpanded ? '▼' : '▶'}
                          </span>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="max-h-60 overflow-y-auto border-t border-slate-200">
                          <table className="w-full text-left text-sm">
                            <thead className="sticky top-0 bg-white shadow-sm">
                              <tr className="border-b text-slate-500">
                                <th className="px-4 py-2 font-medium">Medicine</th>
                                <th className="px-4 py-2 text-right font-medium">Stock</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.stock.map((item: any, iIdx: number) => {
                                const medName = Array.isArray(item.medicines) ? item.medicines[0]?.name_en : item.medicines?.name_en
                                const isCritical = item.days_of_supply !== null && item.days_of_supply <= 5

                                return (
                                  <tr key={iIdx} className="border-b border-slate-50 bg-white transition-colors hover:bg-slate-50">
                                    <td className="px-4 py-2 text-slate-700">{medName}</td>
                                    <td className="px-4 py-2 text-right">
                                      <span className={`rounded px-2 py-1 text-xs font-medium ${isCritical ? 'bg-red-100 text-red-800' : 'bg-emerald-50 text-emerald-800'}`}>
                                        {item.total_quantity} units
                                      </span>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          <Card title="Recent alerts">
            {alerts.length === 0 ? (
              <p className="text-sm text-slate-500">No active network alerts.</p>
            ) : (
              <ul className="space-y-2">
                {alerts.map((a) => (
                  <li key={a.id} className="border-b border-slate-50 pb-2 text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-slate-800">{a.title_en}</span>
                      <Badge label={a.severity} variant={a.severity} />
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-2">{a.body_en}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Redistribution recommendations">
            {recommendations.length === 0 ? (
              <p className="text-sm text-slate-500">No pending transfers awaiting approval.</p>
            ) : (
              <ul className="space-y-3">
                {recommendations.map((r) => {
                  if (r.status !== 'suggested') return null;
                  return (
                    <li key={r.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">
                          {r.medicines?.name_en}
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRecommendation(r.id, 'approved')}
                            className="rounded bg-indigo-600 px-3 py-1 text-xs font-bold text-white transition hover:bg-indigo-700"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleRecommendation(r.id, 'dismissed')}
                            className="rounded border border-slate-300 px-3 py-1 text-xs font-medium hover:bg-slate-50"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-slate-500 mb-2">
                        {r.suggested_quantity} units · {r.from_district ? `${r.from_district.name_en} → ` : ''}{r.to_district?.name_en}
                      </div>
                      <p className="text-xs text-slate-600 border-l-2 border-indigo-200 pl-2">
                        {r.reason_en}
                      </p>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>
      </AppShell>
    </RoleGuard>
  )
}