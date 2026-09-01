import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AppShell from '@/components/layout/AppShell'
import RoleGuard from '@/components/layout/RoleGuard'
import { StockForm } from '@/components/facility/StockForm'
import VoiceLogger from '@/components/facility/VoiceLogger'
import BedForm from '@/components/facility/BedForm'
import AttendanceForm from '@/components/facility/AttendanceForm'
import { useProfile } from '@/hooks/useProfile'
import { useAttendance, useBedStatus, useInventory, useMedicines } from '@/hooks/useInventory'
import { supabase } from '@/lib/supabase'
import type { Facility } from '@/types/database'

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-primary/10 bg-white p-5 shadow-sm">
      <h2 className="mb-4 font-label text-xs font-semibold uppercase tracking-wide text-primary-light">
        {title}
      </h2>
      {children}
    </div>
  )
}

export default function FacilityDashboard() {
  const { t } = useTranslation()
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
      <div className="min-h-screen bg-paper font-body text-ink">
        <AppShell
          title={facility ? facility.name_en : t('Facility Dashboard')}
          actions={
            facility && (
              <span className="font-label text-xs text-ink/50">
                {t('Pop. served: ')}{facility.population_served.toLocaleString('en-IN')}
              </span>
            )
          }
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title={t('Log medicine stock')}>
              {medsLoading ? (
                <p className="text-sm text-ink/50">{t('Loading medicines…')}</p>
              ) : (
                <StockForm medicines={medicines} loading={stockLoading} onSubmit={logStock} />
              )}
            </SectionCard>

            <SectionCard title={t('Hindi voice stock logging')}>
              <VoiceLogger facilityId={profile?.facility_id ?? null} onApplied={refreshStock} />
            </SectionCard>

            <SectionCard title={t('Bed availability')}>
              <BedForm
                facilityId={facility?.id}
                facilityName={facility?.name_en}
                bedCapacity={facility?.bed_capacity ?? 6}
                loading={bedLoading}
                latest={latest}
                onSubmit={logBedStatus}
              />
            </SectionCard>

            <SectionCard title={t('Staff attendance')}>
              <AttendanceForm staff={staff} loading={attLoading} onSubmit={logAttendance} />
            </SectionCard>
          </div>

          {recentStock.length > 0 && (
            <div className="mt-6">
              <SectionCard title={t('Recent stock entries')}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-primary/10 text-left font-label text-xs uppercase tracking-wide text-ink/40">
                        <th className="pb-2 pr-4">{t('Medicine')}</th>
                        <th className="pb-2 pr-4">{t('Qty')}</th>
                        <th className="pb-2 pr-4">{t('Source')}</th>
                        <th className="pb-2">{t('Time')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentStock.map((row) => (
                        <tr key={row.id} className="border-b border-primary/5">
                          <td className="py-2 pr-4">{row.medicines.name_en}</td>
                          <td className="py-2 pr-4 font-label">
                            {row.quantity} {row.unit}
                          </td>
                          <td className="py-2 pr-4 capitalize text-ink/60">{row.source}</td>
                          <td className="py-2 font-label text-xs text-ink/50">
                            {new Date(row.recorded_at).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>
          )}
        </AppShell>
      </div>
    </RoleGuard>
  )
}