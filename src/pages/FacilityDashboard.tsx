import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import RoleGuard from '@/components/layout/RoleGuard'
import AttendanceForm from '@/components/facility/AttendanceForm'
import BedForm from '@/components/facility/BedForm'
import StockForm from '@/components/facility/StockForm'
import VoiceLogger from '@/components/facility/VoiceLogger'
import Card from '@/components/ui/Card'
import { useProfile } from '@/hooks/useProfile'
import { useAttendance, useBedStatus, useInventory, useMedicines } from '@/hooks/useInventory'
import { supabase } from '@/lib/supabase'
import type { Facility } from '@/types/database'

export default function FacilityDashboard() {
  const { profile } = useProfile()
  const { medicines, loading: medsLoading } = useMedicines()
  const { logStock, loading: stockLoading, recentStock, refresh: refreshStock } = useInventory(
    profile?.facility_id ?? null,
  )
  const { logBedStatus, loading: bedLoading, latest } = useBedStatus(profile?.facility_id ?? null)
  const { staff, logAttendance, loading: attLoading } = useAttendance(profile?.facility_id ?? null)
  const [facility, setFacility] = useState<Facility | null>(null)

  useEffect(() => {
    if (!profile?.facility_id) return
    supabase
      .from('facilities')
      .select('*')
      .eq('id', profile.facility_id)
      .single()
      .then(({ data }) => {
        if (data) setFacility(data)
      })
  }, [profile?.facility_id])

  return (
    <RoleGuard allowed={['facility_worker']}>
      <AppShell
        title={facility ? facility.name_en : 'Facility Dashboard'}
        actions={
          facility && (
            <span className="text-sm text-slate-500">
              Pop. served: {facility.population_served.toLocaleString('en-IN')}
            </span>
          )
        }
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Log medicine stock">
            {medsLoading ? (
              <p className="text-sm text-slate-500">Loading medicines…</p>
            ) : (
              <StockForm medicines={medicines} loading={stockLoading} onSubmit={logStock} />
            )}
          </Card>

          <Card title="Hindi voice stock logging">
            <VoiceLogger facilityId={profile?.facility_id ?? null} onApplied={refreshStock} />
          </Card>

          <Card title="Bed availability">
            <BedForm
              bedCapacity={facility?.bed_capacity ?? 6}
              loading={bedLoading}
              latest={latest}
              onSubmit={logBedStatus}
            />
          </Card>

          <Card title="Staff attendance">
            <AttendanceForm staff={staff} loading={attLoading} onSubmit={logAttendance} />
          </Card>
        </div>

        {recentStock.length > 0 && (
          <Card title="Recent stock entries" className="mt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="pb-2 pr-4">Medicine</th>
                    <th className="pb-2 pr-4">Qty</th>
                    <th className="pb-2 pr-4">Source</th>
                    <th className="pb-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recentStock.map((row) => (
                    <tr key={row.id} className="border-b border-slate-50">
                      <td className="py-2 pr-4">{row.medicines.name_en}</td>
                      <td className="py-2 pr-4">
                        {row.quantity} {row.unit}
                      </td>
                      <td className="py-2 pr-4 capitalize">{row.source}</td>
                      <td className="py-2 text-slate-500">
                        {new Date(row.recorded_at).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </AppShell>
    </RoleGuard>
  )
}
