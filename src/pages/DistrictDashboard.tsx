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
