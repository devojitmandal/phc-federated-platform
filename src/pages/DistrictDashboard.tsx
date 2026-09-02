import { useCallback, useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import RoleGuard from '@/components/layout/RoleGuard'
import BedOccupancyBar from '@/components/charts/BedOccupancy'
import RecalculateRollupsButton from '@/components/district/RecalculateRollupsButton'
import Card from '@/components/ui/Card'
import { useProfile } from '@/hooks/useProfile'
import { useRollups } from '@/hooks/useRollups'
import { supabase } from '@/lib/supabase'
import type {
  DistrictAttendanceRollup,
  DistrictBedRollup,
  DistrictInventoryRollup,
  District,
} from '@/types/database'

export default function DistrictDashboard() {
  const { profile } = useProfile()
  const {
    recalculate,
    refreshing,
    lastRefreshed,
    fetchDistrictInventory,
    fetchDistrictBeds,
    fetchDistrictAttendance,
  } = useRollups(profile?.district_id ?? null)

  const [district, setDistrict] = useState<District | null>(null)
  const [inventory, setInventory] = useState<DistrictInventoryRollup[]>([])
  const [beds, setBeds] = useState<DistrictBedRollup | null>(null)
  const [attendance, setAttendance] = useState<DistrictAttendanceRollup | null>(null)
  const [loading, setLoading] = useState(true)

  // AI & Action States
  const [aiPlans, setAiPlans] = useState<Record<string, string>>({})
  const [planningMedId, setPlanningMedId] = useState<string | null>(null)
  
  const [bedAiPlans, setBedAiPlans] = useState<Record<string, string>>({})
  const [planningBedId, setPlanningBedId] = useState<string | null>(null)

  // UI States
  const [expandedHospitals, setExpandedHospitals] = useState<Record<number, boolean>>({})
  const [showCriticalOnly, setShowCriticalOnly] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [activeTransfers, setActiveTransfers] = useState<Array<{ 
    id: string; 
    type: 'med' | 'bed'; 
    targetId: string; 
    plan: string; 
    timestamp: string 
  }>>([])

  // Data States (allFacilitiesBeds state removed)
  const [criticalFacilities, setCriticalFacilities] = useState<{
    beds: Array<{ id: string; name: string; available: number }>;
    meds: Record<string, Array<{ name: string; qty: number }>>;
  }>({ beds: [], meds: {} })

  const [hospitalStocks, setHospitalStocks] = useState<Array<{
    name: string;
    stock: Array<{ medicineName: string; quantity: number; unit: string }>
  }>>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [inv, bed, att] = await Promise.all([
        fetchDistrictInventory(),
        fetchDistrictBeds(),
        fetchDistrictAttendance(),
      ])
      setInventory(inv)
      setBeds(bed)
      setAttendance(att)
    } finally {
      setLoading(false)
    }
  }, [fetchDistrictInventory, fetchDistrictBeds, fetchDistrictAttendance])

  useEffect(() => {
    if (!profile?.district_id) return
    supabase
      .from('districts')
      .select('*')
      .eq('id', profile.district_id)
      .single()
      .then(({ data }) => {
        if (data) setDistrict(data)
      })
    void loadData()
  }, [profile?.district_id, loadData])

  async function handleRecalculate() {
    await recalculate()
    await loadData()
  }

  // Set to 100 for Hackathon Demo testing
  const CRITICAL_DAYS = 100
  const criticalInventory = inventory.filter(
    (item) => item.days_of_supply !== null && item.days_of_supply <= CRITICAL_DAYS
  )

  useEffect(() => {
    async function fetchHotspots() {
      if (!profile?.district_id) return
      
      const { data: facs } = await supabase
        .from('facilities')
        .select(`id, name_en, bed_status(total_beds, occupied_beds)`)
        .eq('district_id', profile.district_id)

      const allBeds = facs?.map(f => {
        const bs = Array.isArray(f.bed_status) ? f.bed_status[0] : f.bed_status
        const avail = bs ? (bs.total_beds - bs.occupied_beds) : 99
        return { id: f.id, name: f.name_en, available: avail }
      }) || []
      
      const overloadedBeds = allBeds.filter(f => f.available <= 2)

      const criticalMedIds = criticalInventory.map(m => m.medicine_id)
      const medHotspots: Record<string, Array<{ name: string; qty: number }>> = {}
      
      if (criticalMedIds.length > 0) {
        const { data: snaps } = await supabase
          .from('inventory_snapshots')
          .select('medicine_id, quantity, facilities!inner(name_en, district_id)')
          .eq('facilities.district_id', profile.district_id)
          .in('medicine_id', criticalMedIds)
          .order('recorded_at', { ascending: false })

        const latestSnaps = new Map()
        snaps?.forEach((s: any) => {
          const facName = Array.isArray(s.facilities) ? s.facilities[0].name_en : s.facilities?.name_en
          const key = `${facName}-${s.medicine_id}`
          if (!latestSnaps.has(key)) {
            latestSnaps.set(key, { facName, medicineId: s.medicine_id, qty: s.quantity })
          }
        })

        const lowestTracker: Record<string, { name: string, qty: number }> = {}
        latestSnaps.forEach((val) => {
          if (!lowestTracker[val.medicineId] || val.qty < lowestTracker[val.medicineId].qty) {
            lowestTracker[val.medicineId] = { name: val.facName, qty: val.qty }
          }
        })

        Object.keys(lowestTracker).forEach(medId => {
          medHotspots[medId] = [{ 
            name: lowestTracker[medId].name, 
            qty: lowestTracker[medId].qty 
          }]
        })
      }
      
      setCriticalFacilities({ beds: overloadedBeds, meds: medHotspots })
    }
    
    if (!loading) fetchHotspots()
  }, [loading, profile?.district_id, criticalInventory.length])

  useEffect(() => {
    async function fetchHospitalBreakdown() {
      if (!profile?.district_id) return;
      const { data } = await supabase
        .from('inventory_snapshots')
        .select(`
          medicine_id, 
          quantity, 
          unit,
          facilities!inner(id, name_en, district_id),
          medicines(name_en)
        `)
        .eq('facilities.district_id', profile.district_id)
        .order('recorded_at', { ascending: false });
        
      if (!data) return;
       
      const facilityMap = new Map<string, { name: string, stock: any[] }>();
      const seen = new Set();
       
      data.forEach((row: any) => {
        const facId = Array.isArray(row.facilities) ? row.facilities[0].id : row.facilities?.id;
        const facName = Array.isArray(row.facilities) ? row.facilities[0].name_en : row.facilities?.name_en;
        const medId = row.medicine_id;
        const medName = Array.isArray(row.medicines) ? row.medicines[0]?.name_en : row.medicines?.name_en || medId;
          
        const key = `${facId}-${medId}`;
        if (!seen.has(key)) {
          seen.add(key);
          if (!facilityMap.has(facId)) {
            facilityMap.set(facId, { name: facName, stock: [] });
          }
          facilityMap.get(facId)!.stock.push({
            medicineName: medName,
            quantity: row.quantity,
            unit: row.unit || 'units'
          });
        }
      });
       
      setHospitalStocks(Array.from(facilityMap.values()));
    }
    if (!loading) fetchHospitalBreakdown();
  }, [loading, profile?.district_id]);

  const toggleHospital = (idx: number) => setExpandedHospitals(prev => ({ ...prev, [idx]: !prev[idx] }))

  // EXECUTION LOOPS
  const handleApproveTransfer = (type: 'med' | 'bed', targetId: string, plan: string, displayName: string) => {
    setActiveTransfers(prev => [...prev, { 
      id: crypto.randomUUID(), 
      type,
      targetId, 
      plan, 
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
    }])
    
    if (type === 'med') {
      setAiPlans(prev => { const p = { ...prev }; delete p[targetId]; return p })
      setToast(`Transfer Order Authorized: Dispatching fleet for ${displayName}`)
    } else {
      setBedAiPlans(prev => { const p = { ...prev }; delete p[targetId]; return p })
      setToast(`Ambulance Diversion Active: Rerouting trauma units from ${displayName}`)
    }
    setTimeout(() => setToast(null), 4000)
  }

  const handleBedAI = async (facId: string, facName: string) => {
    setPlanningBedId(facId)
    try {
      const res = await fetch('/api/redistribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overloadedFacilityId: facId,
          overloadedFacilityName: facName,
          issueType: 'bed shortage'
        })
      })
      
      const data = await res.json()
      
      if (data.plan) {
        const formattedPlan = data.plan.startsWith('CRITICAL') || data.plan.startsWith('🚨') 
          ? data.plan 
          : `🚨 DIVERT TRAUMA: ${data.plan}`
          
        setBedAiPlans(prev => ({ ...prev, [facId]: formattedPlan }))
      }
    } catch (error) {
      console.error("Failed to calculate diversion route:", error)
    } finally {
      setPlanningBedId(null)
    }
  }

  const displayedHospitals = showCriticalOnly 
    ? hospitalStocks.filter(h => h.stock.some(s => s.quantity < 50))
    : hospitalStocks

  return (
    <RoleGuard allowed={['district_admin']}>
      {toast && (
        <div className="fixed top-6 right-6 z-50 animate-fade-in rounded-lg bg-emerald-600 px-6 py-4 text-sm font-semibold text-white shadow-xl">
          ✅ {toast}
        </div>
      )}

      <AppShell
        title={district ? `${district.name_en} District Operations` : 'District Dashboard'}
        actions={
          <RecalculateRollupsButton onRecalculate={handleRecalculate} refreshing={refreshing} />
        }
      >
        {district && (
          <p className="mb-4 text-sm text-slate-600">
            {district.name_hi} · Population: {district.population.toLocaleString('en-IN')}
          </p>
        )}

        {/* ACTIVE FLEET PANEL */}
        {activeTransfers.length > 0 && (
          <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 font-label text-sm font-semibold tracking-wide text-blue-800">
              <span>📡</span> Active AI Protocols (In-Transit)
            </h2>
            <div className="flex flex-col gap-3">
              {activeTransfers.map(transfer => (
                <div key={transfer.id} className="flex items-center justify-between rounded-lg border border-blue-100 bg-white p-3 shadow-sm">
                  <div className="flex items-center gap-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-xl">
                      {transfer.type === 'med' ? '🚚' : '🚑'}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {transfer.plan.replace('✅ LOCAL TRANSFER: ', '')}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">Authorized at {transfer.timestamp} · Status: En Route</p>
                    </div>
                  </div>
                  <span className="animate-pulse rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                    Executing
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BED SHORTAGES CARD */}
        {!loading && criticalFacilities.beds.length > 0 && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 font-label text-sm font-semibold tracking-wide text-red-800">
              <span>🛏️</span> Action Required: Critical Bed Capacity
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {criticalFacilities.beds.map((fac, idx) => {
                if (activeTransfers.some(t => t.targetId === fac.id)) return null;

                return (
                  <div key={idx} className="rounded-lg border border-red-100 bg-white p-3 shadow-sm">
                    <div className="font-medium text-slate-800">{fac.name}</div>
                    <div className="mt-1 text-xs font-semibold text-red-600">
                      Only {fac.available} beds available
                    </div>
                    
                    {bedAiPlans[fac.id] ? (
                      <div className="mt-3 animate-fade-in rounded border border-emerald-200 bg-emerald-50 p-3 shadow-sm">
                        <div className="mb-3 text-xs font-medium text-emerald-800">
                          {bedAiPlans[fac.id]}
                        </div>
                        <button 
                          onClick={() => handleApproveTransfer('bed', fac.id, bedAiPlans[fac.id], fac.name)}
                          className="w-full rounded bg-emerald-600 px-2 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
                        >
                          Approve Ambulance Diversion
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => handleBedAI(fac.id, fac.name)}
                        disabled={planningBedId === fac.id}
                        className="mt-3 w-full rounded bg-red-100 px-2 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-200 disabled:opacity-50"
                      >
                        {planningBedId === fac.id ? 'Calculating Reroute...' : 'Request AI Diversion Plan'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* MEDICINE SHORTAGES CARD */}
        {!loading && criticalInventory.length > 0 && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 font-label text-sm font-semibold tracking-wide text-red-800">
              <span>🚨</span> Action Required: Critical Medicine Shortages
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {criticalInventory.map((med, idx) => {
                const medData: any = Array.isArray(med.medicines) ? med.medicines[0] : med.medicines
                const displayName = medData?.name_en ?? med.medicine_id
                
                if (activeTransfers.some(t => t.targetId === med.medicine_id)) return null;

                return (
                  <div key={`${med.medicine_id}-${idx}`} className="rounded-lg border border-red-100 bg-white p-3 shadow-sm">
                    <div className="font-medium text-slate-800">{displayName}</div>
                    <div className="text-xs text-slate-500">{medData?.name_hi}</div>
                    
                    <div className="mt-3 text-xs font-semibold text-amber-700">
                      District Avg: {med.days_of_supply} days of supply
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      <span className="font-semibold text-slate-800">Critically Low At: </span>
                      {criticalFacilities.meds[med.medicine_id] 
                        ? criticalFacilities.meds[med.medicine_id].map(f => `${f.name} (${f.qty} units left)`).join(', ')
                        : 'Scanning network...'}
                    </div>

                    {aiPlans[med.medicine_id] ? (
                      <div className="mt-3 animate-fade-in rounded border border-emerald-200 bg-emerald-50 p-3 shadow-sm">
                        <div className="mb-3 text-xs font-medium text-emerald-800">
                          {aiPlans[med.medicine_id]}
                        </div>
                        <button 
                          onClick={() => handleApproveTransfer('med', med.medicine_id, aiPlans[med.medicine_id], displayName)}
                          className="w-full rounded bg-emerald-600 px-2 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
                        >
                          Approve & Execute Transfer
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={async () => {
                          setPlanningMedId(med.medicine_id)
                          try {
                            const res = await fetch('/api/transfer', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                districtId: profile?.district_id,
                                stateId: district?.state_id,
                                medicineId: med.medicine_id,
                                medicineName: displayName
                              })
                            })
                            const data = await res.json()
                            if (data.plan) {
                              setAiPlans(prev => ({ ...prev, [med.medicine_id]: data.plan }))
                            }
                          } finally {
                            setPlanningMedId(null)
                          }
                        }}
                        disabled={planningMedId === med.medicine_id}
                        className="mt-3 w-full rounded bg-red-100 px-2 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-200 disabled:opacity-50"
                      >
                        {planningMedId === med.medicine_id ? 'AI Scanning Network...' : 'Request AI Transfer Plan'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* HOSPITAL STOCK BREAKDOWN */}
          <Card title="Hospital-Wise Stock Breakdown" className="lg:col-span-2">
            <div className="mb-4 flex items-center justify-end border-b border-slate-100 pb-3">
              <label className="flex cursor-pointer items-center gap-2">
                <input 
                  type="checkbox" 
                  checked={showCriticalOnly}
                  onChange={(e) => setShowCriticalOnly(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm font-medium text-slate-700">Show Critical Hospitals Only</span>
              </label>
            </div>

            {loading ? (
              <p className="text-sm text-slate-500">Loading hospital data...</p>
            ) : displayedHospitals.length === 0 ? (
              <p className="text-sm text-slate-500">No critical shortages found matching this filter.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {displayedHospitals.map((hospital, hIdx) => {
                  const isExpanded = expandedHospitals[hIdx]
                  const criticalCount = hospital.stock.filter(s => s.quantity < 50).length

                  return (
                    <div key={hIdx} className="overflow-hidden rounded-lg border border-slate-200 shadow-sm transition-all">
                      <button
                        onClick={() => toggleHospital(hIdx)}
                        className="flex w-full items-center justify-between bg-slate-50 px-4 py-3 transition-colors hover:bg-slate-100"
                      >
                        <div className="font-semibold text-slate-800">
                          🏥 {hospital.name}
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
                              {hospital.stock.map((item, iIdx) => (
                                <tr key={iIdx} className="border-b border-slate-50 bg-white transition-colors hover:bg-slate-50">
                                  <td className="px-4 py-2 text-slate-700">{item.medicineName}</td>
                                  <td className="px-4 py-2 text-right">
                                    <span className={`rounded px-2 py-1 text-xs font-medium ${item.quantity < 50 ? 'bg-red-100 text-red-800' : 'bg-emerald-50 text-emerald-800'}`}>
                                      {item.quantity} {item.unit}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            {lastRefreshed && (
              <p className="mt-4 text-right text-xs text-slate-500">Last refreshed: {lastRefreshed}</p>
            )}
          </Card>

          <Card title="Bed occupancy">
            <BedOccupancyBar data={beds} />
          </Card>

          <Card title="Staff attendance">
            {attendance ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Present</span>
                  <span className="font-medium text-emerald-600">{attendance.staff_present}</span>
                </div>
                <div className="flex justify-between">
                  <span>Absent / leave</span>
                  <span className="font-medium text-red-600">{attendance.staff_absent}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span>Attendance rate</span>
                  <span className="font-medium">{attendance.attendance_pct}%</span>
                </div>
                <p className="text-xs text-slate-500">
                  {attendance.reporting_facility_count} PHCs reporting
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No attendance rollup yet.</p>
            )}
          </Card>
        </div>
      </AppShell>
    </RoleGuard>
  )
}