import { useCallback, useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import RoleGuard from '@/components/layout/RoleGuard'
import BedOccupancyBar from '@/components/charts/BedOccupancy'
import DistrictInventoryTable from '@/components/district/DistrictInventoryTable'
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
  const [aiPlans, setAiPlans] = useState<Record<string, string>>({})
  const [planningMedId, setPlanningMedId] = useState<string | null>(null)

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

  // --- Isolate critical shortages ---
  // Temporarily set to 100 for your demo so the buttons appear. Change back to 7 for production!
  const CRITICAL_DAYS = 100
  const criticalInventory = inventory.filter(
    (item) => item.days_of_supply !== null && item.days_of_supply <= CRITICAL_DAYS
  )

  return (
    <RoleGuard allowed={['district_admin']}>
      <AppShell
        title={district ? `${district.name_en} District` : 'District Dashboard'}
        actions={
          <RecalculateRollupsButton onRecalculate={handleRecalculate} refreshing={refreshing} />
        }
      >
        {district && (
          <p className="mb-4 text-sm text-slate-600">
            {district.name_hi} · Population: {district.population.toLocaleString('en-IN')} · Aggregated
            view only — raw PHC data stays local (RLS enforced)
          </p>
        )}

        {/* NEW CARD: Exception-based action alerts */}
        {!loading && criticalInventory.length > 0 && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 font-label text-sm font-semibold tracking-wide text-red-800">
              <span>🚨</span> Action Required: Critical Medicine Shortages
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {criticalInventory.map((med, idx) => {
                const medData: any = Array.isArray(med.medicines) ? med.medicines[0] : med.medicines
                const displayName = medData?.name_en ?? med.medicine_id

                return (
                  <div key={`${med.medicine_id}-${idx}`} className="rounded-lg border border-red-100 bg-white p-3 shadow-sm">
                    <div className="font-medium text-slate-800">{displayName}</div>
                    <div className="text-xs text-slate-500">{medData?.name_hi}</div>
                    <div className="mt-2 text-xs font-semibold text-red-600">
                      Only {med.days_of_supply} days of supply remaining
                    </div>
                    <div className="text-xs text-slate-500">
                      {med.facility_count} PHCs reporting low stock
                    </div>
                    {aiPlans[med.medicine_id] ? (
                      <div className="mt-3 animate-fade-in rounded bg-emerald-50 p-2 text-xs font-medium text-emerald-800 border border-emerald-200">
                        {aiPlans[med.medicine_id]}
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
          <Card title="Medicine stock rollup" className="lg:col-span-2">
            <DistrictInventoryTable rows={inventory} loading={loading} />
            {lastRefreshed && (
              <p className="mt-3 text-xs text-slate-500">Last refreshed: {lastRefreshed}</p>
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